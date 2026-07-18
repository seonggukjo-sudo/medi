import { env } from "cloudflare:workers";
import { importTables, type ImportTableKey } from "@/lib/data-import-contract";
import { validateImportRows, type ImportRow } from "@/lib/import-validator";
import { accessErrorResponse, requireAccess } from "@/lib/server-access";

export const runtime = "edge";

const defaultHospitalId = "demo-hospital";

const validTableKeys = new Set<ImportTableKey>(importTables.map((table) => table.key));

function isImportTableKey(value: unknown): value is ImportTableKey {
  return typeof value === "string" && validTableKeys.has(value as ImportTableKey);
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvRows(csvText: string): ImportRow[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");
  const headers = splitCsvLine(lines[0] ?? "").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^\w가-힣.-]+/g, "_").slice(0, 120) || "upload.csv";
}

function uploadStorageKey(hospitalId: string, batchId: string, tableKey: ImportTableKey, fileName: string) {
  return `uploads/${hospitalId}/${batchId}/${tableKey}/${safeFileName(fileName)}`;
}

function cell(row: ImportRow, key: string, fallback = "") {
  return String(row[key] ?? fallback).trim();
}

function moneyCell(row: ImportRow, key: string) {
  const value = Number(String(row[key] ?? "0").replaceAll(",", "").trim());
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function derivedSpendId(row: ImportRow) {
  return [cell(row, "spend_date"), cell(row, "channel"), cell(row, "campaign_id"), cell(row, "ad_group_id")]
    .filter(Boolean)
    .join("::");
}

function businessRowInsertStatements(tableKey: ImportTableKey, rows: ImportRow[], hospitalId: string, batchId: string) {
  if (tableKey === "leads") {
    return rows.map((row) =>
      env.DB.prepare(
        `INSERT OR REPLACE INTO leads
          (hospital_id, lead_id, patient_key, department, source_channel, inquiry_type, received_at, status, batch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        hospitalId,
        cell(row, "lead_id"),
        cell(row, "patient_key", `lead:${cell(row, "lead_id")}`),
        cell(row, "department"),
        cell(row, "source_channel"),
        cell(row, "inquiry_type"),
        cell(row, "created_at"),
        cell(row, "status"),
        batchId,
      ),
    );
  }

  if (tableKey === "appointments") {
    return rows.map((row) =>
      env.DB.prepare(
        `INSERT OR REPLACE INTO appointments
          (hospital_id, appointment_id, lead_id, patient_key, department, booked_at, scheduled_at, status, batch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        hospitalId,
        cell(row, "appointment_id"),
        cell(row, "lead_id"),
        cell(row, "patient_key", `appointment:${cell(row, "appointment_id")}`),
        cell(row, "department"),
        cell(row, "booked_at"),
        cell(row, "scheduled_at"),
        cell(row, "status"),
        batchId,
      ),
    );
  }

  if (tableKey === "visits") {
    return rows.map((row) =>
      env.DB.prepare(
        `INSERT OR REPLACE INTO visits
          (hospital_id, visit_id, appointment_id, patient_key, department, visit_source, visit_type, visited_at, batch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        hospitalId,
        cell(row, "visit_id"),
        cell(row, "appointment_id"),
        cell(row, "patient_key"),
        cell(row, "department"),
        cell(row, "visit_source"),
        cell(row, "visit_type"),
        cell(row, "visited_at"),
        batchId,
      ),
    );
  }

  if (tableKey === "payments") {
    return rows.map((row) =>
      env.DB.prepare(
        `INSERT OR REPLACE INTO payments
          (hospital_id, payment_id, visit_id, patient_key, department, gross_amount, refund_amount, net_amount, paid_at, batch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        hospitalId,
        cell(row, "payment_id"),
        cell(row, "visit_id"),
        cell(row, "patient_key", `payment:${cell(row, "payment_id")}`),
        cell(row, "department"),
        moneyCell(row, "gross_amount"),
        moneyCell(row, "refund_amount"),
        moneyCell(row, "net_amount"),
        cell(row, "paid_at"),
        batchId,
      ),
    );
  }

  return rows.map((row) =>
    env.DB.prepare(
      `INSERT OR REPLACE INTO ad_spend
        (hospital_id, spend_id, channel, campaign_name, cost, impressions, clicks, conversions, spend_date, batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      hospitalId,
      derivedSpendId(row),
      cell(row, "channel"),
      cell(row, "campaign_id", cell(row, "channel")),
      moneyCell(row, "cost"),
      moneyCell(row, "impressions"),
      moneyCell(row, "clicks"),
      moneyCell(row, "conversions"),
      cell(row, "spend_date"),
      batchId,
    ),
  );
}

async function ensureStorageReady() {
  if (!env.DB) {
    throw new Error("D1 DB binding is unavailable. Confirm .openai/hosting.json d1=DB and the deployment resource binding.");
  }

  if (!env.UPLOADS) {
    throw new Error("R2 UPLOADS binding is unavailable. Confirm .openai/hosting.json r2=UPLOADS and the deployment resource binding.");
  }
}

export async function GET(request: Request) {
  try {
    await ensureStorageReady();

    const url = new URL(request.url);
    const hospitalId = url.searchParams.get("hospitalId") || defaultHospitalId;
    await requireAccess(request, hospitalId, ["owner", "admin", "marketer"]);
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);

    const { results } = await env.DB.prepare(
      `SELECT
        b.batch_id AS batchId,
        b.hospital_id AS hospitalId,
        b.uploaded_by AS uploadedBy,
        b.uploaded_at AS uploadedAt,
        b.status,
        b.row_count AS rowCount,
        b.error_count AS errorCount,
        b.warning_count AS warningCount,
        f.file_id AS fileId,
        f.table_key AS tableKey,
        f.file_name AS fileName,
        f.storage_key AS storageKey
      FROM upload_batches b
      LEFT JOIN uploaded_files f ON f.batch_id = b.batch_id
      WHERE b.hospital_id = ?
      ORDER BY b.uploaded_at DESC
      LIMIT ?`,
    )
      .bind(hospitalId, limit)
      .all();

    return Response.json({ uploads: results });
  } catch (error) {
    return accessErrorResponse(error, "업로드 이력을 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    await ensureStorageReady();

    const formData = await request.formData();
    const tableKeyValue = formData.get("tableKey");
    const file = formData.get("file");

    if (!isImportTableKey(tableKeyValue)) {
      return jsonError("tableKey must be one of leads, appointments, visits, payments, ad_spend.");
    }

    if (!(file instanceof File)) {
      return jsonError("CSV file is required.");
    }

    const hospitalId = String(formData.get("hospitalId") || defaultHospitalId).trim();
    const access = await requireAccess(request, hospitalId, ["owner", "admin", "marketer"]);
    const uploadedBy = access.email;
    const uploadedAt = new Date().toISOString();
    const batchId = crypto.randomUUID();
    const fileId = crypto.randomUUID();
    const csvText = await file.text();
    const rows = parseCsvRows(csvText);
    const validation = validateImportRows(tableKeyValue, rows);
    const status = validation.errorCount > 0 ? "needs_review" : "validated";
    const storageKey = uploadStorageKey(hospitalId, batchId, tableKeyValue, file.name);
    const businessRowInserts = validation.errorCount === 0 ? businessRowInsertStatements(tableKeyValue, rows, hospitalId, batchId) : [];
    const savedRows = businessRowInserts.length;

    await env.UPLOADS.put(storageKey, csvText, {
      httpMetadata: { contentType: file.type || "text/csv; charset=utf-8" },
      customMetadata: {
        hospitalId,
        batchId,
        tableKey: tableKeyValue,
        uploadedBy,
      },
    });

    const batchInsert = env.DB.prepare(
      `INSERT INTO upload_batches
        (batch_id, hospital_id, uploaded_by, uploaded_at, status, row_count, error_count, warning_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(batchId, hospitalId, uploadedBy, uploadedAt, status, validation.totalRows, validation.errorCount, validation.warningCount);

    const fileInsert = env.DB.prepare(
      `INSERT INTO uploaded_files
        (file_id, batch_id, hospital_id, table_key, file_name, storage_key, row_count, error_count, warning_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      fileId,
      batchId,
      hospitalId,
      tableKeyValue,
      file.name,
      storageKey,
      validation.totalRows,
      validation.errorCount,
      validation.warningCount,
      uploadedAt,
    );

    const auditInsert = env.DB.prepare(
      `INSERT INTO audit_logs
        (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      hospitalId,
      uploadedBy,
      "upload_csv",
      "upload_batch",
      batchId,
      uploadedAt,
      JSON.stringify({ tableKey: tableKeyValue, fileName: file.name, storageKey, status, savedRows }),
    );

    await env.DB.batch([batchInsert, fileInsert, auditInsert, ...businessRowInserts]);

    return Response.json(
      {
        batchId,
        fileId,
        hospitalId,
        tableKey: tableKeyValue,
        fileName: file.name,
        storageKey,
        status,
        savedRows,
        validation,
      },
      { status: 201 },
    );
  } catch (error) {
    return accessErrorResponse(error, "업로드를 처리하지 못했습니다.");
  }
}
