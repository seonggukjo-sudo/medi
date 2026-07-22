import { env } from "cloudflare:workers";
import { accessErrorResponse, requireAccess } from "@/lib/server-access";
import { createGoogleAccessToken } from "@/lib/google-service-account";
import { POST as uploadCsv } from "@/app/api/uploads/route";

export const runtime = "edge";
const hospitalId = "demo-hospital";
const sheetsScope = "https://www.googleapis.com/auth/spreadsheets.readonly";

type RuntimeEnv = {
  GOOGLE_SHEETS_ID?: string;
  GOOGLE_SHEETS_CLIENT_EMAIL?: string;
  GOOGLE_SHEETS_PRIVATE_KEY?: string;
  GA4_CLIENT_EMAIL?: string;
  GA4_PRIVATE_KEY?: string;
};

const sheetTabs = [
  { range: "상담문의!A:Z", tableKey: "leads", fileName: "google-sheet-leads.csv" },
  { range: "예약!A:Z", tableKey: "appointments", fileName: "google-sheet-appointments.csv" },
  { range: "내원!A:Z", tableKey: "visits", fileName: "google-sheet-visits.csv" },
  { range: "결제매출!A:Z", tableKey: "payments", fileName: "google-sheet-payments.csv" },
  { range: "온라인광고성과!A:Z", tableKey: "ad_spend", fileName: "google-sheet-online-ad-spend.csv", adSource: "online" },
  { range: "고정광고비!A:Z", tableKey: "ad_spend", fileName: "google-sheet-fixed-ad-spend.csv", adSource: "fixed" },
  { range: "CRM성과!A:Z", tableKey: "ad_spend", fileName: "google-sheet-crm-ad-spend.csv", adSource: "crm" },
] as const;

type AdSource = "online" | "fixed" | "crm";
const adSpendHeaders = ["spend_date", "channel", "campaign_id", "ad_group_id", "creative_id", "cost", "impressions", "clicks", "conversions"];

function parseJson<T>(value: unknown, fallback: T): T {
  try { return typeof value === "string" ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function spreadsheetId(value: unknown) {
  const text = String(value ?? "").trim();
  return text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || (/^[a-zA-Z0-9-_]{20,}$/.test(text) ? text : "");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function hasKoreanHelperRows(rows: unknown[][]) {
  if (rows.length < 4) return false;
  const helperText = [rows[1], rows[2], rows[3]].flat().map((value) => String(value ?? "")).join(" ");
  return /한글|항목|설명|예시|필수|선택|실제 데이터/.test(helperText);
}

function importableRows(rows: unknown[][]) {
  if (!hasKoreanHelperRows(rows)) return rows;
  return [rows[0], ...rows.slice(4)];
}

function normalizedAdRows(rows: unknown[][], source?: AdSource) {
  const importRows = importableRows(rows);
  if (!source || source === "online" || importRows.length === 0) return importRows;

  const headers = importRows[0].map((value) => String(value ?? ""));
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const cell = (row: unknown[], key: string) => row[index[key]] ?? "";
  const dataRows = importRows.slice(1).filter((row) => {
    const dateKey = source === "fixed" ? "cost_month" : "send_date";
    return String(cell(row, dateKey)).trim() !== "";
  });

  if (source === "fixed") {
    return [adSpendHeaders, ...dataRows.map((row) => [
      cell(row, "cost_month"),
      "고정광고비",
      cell(row, "cost_item"),
      cell(row, "vendor_channel"),
      cell(row, "department"),
      cell(row, "cost"),
      0,
      0,
      0,
    ])];
  }

  return [adSpendHeaders, ...dataRows.map((row) => [
    cell(row, "send_date"),
    `CRM ${String(cell(row, "crm_channel")).trim()}`.trim(),
    cell(row, "campaign_id"),
    cell(row, "department"),
    cell(row, "message_content"),
    cell(row, "send_cost"),
    cell(row, "sent_count"),
    cell(row, "inquiry_count"),
    cell(row, "reservation_count"),
  ])];
}

function rowsToCsv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function parseCsvTable(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value.trim() !== ""));
}

async function fetchServiceAccountTabs(config: Awaited<ReturnType<typeof loadConfiguration>>) {
  if (!config.clientEmail || !config.privateKey) throw new Error("Google service account is not configured.");
  const token = await createGoogleAccessToken(config.clientEmail, config.privateKey, sheetsScope);
  const query = new URLSearchParams({ majorDimension: "ROWS" });
  sheetTabs.forEach((tab) => query.append("ranges", tab.range));
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values:batchGet?${query}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const googleError = await response.json().catch(() => null) as { error?: { message?: string; details?: Array<{ reason?: string }> } } | null;
    const reason = googleError?.error?.details?.map((item) => item.reason).filter(Boolean).join(", ");
    throw new Error(googleError?.error?.message || reason || `Google Sheets API HTTP ${response.status}`);
  }
  const body = await response.json() as { valueRanges?: Array<{ values?: unknown[][] }> };
  return sheetTabs.map((_, index) => body.valueRanges?.[index]?.values ?? []);
}

async function fetchPublicTabs(sheetId: string) {
  return Promise.all(sheetTabs.map(async (tab) => {
    const tabName = tab.range.split("!")[0];
    const query = new URLSearchParams({ tqx: "out:csv", sheet: tabName });
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${query}`, {
      redirect: "follow",
      headers: { accept: "text/csv" },
    });
    const csv = await response.text();
    if (!response.ok || /^\s*<!doctype html/i.test(csv) || /^\s*<html/i.test(csv)) {
      throw new Error(`Public sheet tab '${tabName}' could not be read (HTTP ${response.status}).`);
    }
    return parseCsvTable(csv.replace(/^\uFEFF/, ""));
  }));
}

async function loadConfiguration() {
  const runtimeEnv = env as unknown as RuntimeEnv;
  const row = await env.DB.prepare("SELECT alert_policy_json AS settingsJson FROM hospital_settings WHERE hospital_id = ?")
    .bind(hospitalId).first<{ settingsJson?: string }>();
  const settings = parseJson<Record<string, unknown>>(row?.settingsJson, {});
  return {
    sheetId: spreadsheetId(settings.googleSheetId || runtimeEnv.GOOGLE_SHEETS_ID),
    clientEmail: runtimeEnv.GOOGLE_SHEETS_CLIENT_EMAIL || runtimeEnv.GA4_CLIENT_EMAIL || "",
    privateKey: runtimeEnv.GOOGLE_SHEETS_PRIVATE_KEY || runtimeEnv.GA4_PRIVATE_KEY || "",
  };
}

export async function GET(request: Request) {
  try {
    await requireAccess(request, hospitalId);
    const config = await loadConfiguration();
    const latest = await env.DB.prepare("SELECT created_at AS createdAt, metadata_json AS metadataJson FROM audit_logs WHERE hospital_id = ? AND action = 'google_sheet_sync' ORDER BY created_at DESC LIMIT 1")
      .bind(hospitalId).first<{ createdAt?: string; metadataJson?: string }>();
    return Response.json({
      configured: Boolean(config.sheetId && config.clientEmail && config.privateKey),
      sheetConfigured: Boolean(config.sheetId),
      serviceAccountConfigured: Boolean(config.clientEmail && config.privateKey),
      serviceAccountEmail: config.clientEmail,
      lastSyncedAt: latest?.createdAt || null,
      lastSync: parseJson(latest?.metadataJson, null),
      tabs: sheetTabs.map((tab) => tab.range.split("!")[0]),
    });
  } catch (error) {
    return accessErrorResponse(error, "구글 시트 연결 상태를 확인하지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAccess(request, hospitalId, ["owner", "admin", "marketer"]);
    const config = await loadConfiguration();
    if (!config.sheetId) return Response.json({ error: "설정에서 구글 시트 주소를 저장해 주세요." }, { status: 400 });
    let sourceMode: "service_account" | "public_link" = "service_account";
    let tabRows: unknown[][][];
    try {
      tabRows = await fetchServiceAccountTabs(config);
    } catch (serviceAccountError) {
      try {
        tabRows = await fetchPublicTabs(config.sheetId);
        sourceMode = "public_link";
      } catch (publicError) {
        const apiDetail = serviceAccountError instanceof Error ? serviceAccountError.message : String(serviceAccountError);
        const publicDetail = publicError instanceof Error ? publicError.message : String(publicError);
        throw new Error(`Google Sheets sync failed. API: ${apiDetail} Public link: ${publicDetail}`);
      }
    }
    const results = [];
    for (let index = 0; index < sheetTabs.length; index += 1) {
      const tab = sheetTabs[index];
      const rows = normalizedAdRows(tabRows[index] ?? [], "adSource" in tab ? tab.adSource : undefined);
      if (rows.length <= 1) {
        results.push({ tableKey: tab.tableKey, status: "empty", savedRows: 0 });
        continue;
      }
      const formData = new FormData();
      formData.set("tableKey", tab.tableKey);
      formData.set("hospitalId", hospitalId);
      formData.set("file", new File([rowsToCsv(rows)], tab.fileName, { type: "text/csv;charset=utf-8" }));
      // Preserve the authenticated identity when the worker calls its own upload route.
      // Cloudflare Access uses its own header, while Sites uses the oai header.
      const forwardedHeaders = new Headers();
      for (const headerName of [
        "oai-authenticated-user-email",
        "oai-authenticated-user-full-name",
        "oai-authenticated-user-full-name-encoding",
        "cf-access-authenticated-user-email",
        "cf-access-jwt-assertion",
      ]) {
        const value = request.headers.get(headerName);
        if (value) forwardedHeaders.set(headerName, value);
      }
      // Call the upload handler in-process. A network request back to this Worker is
      // intercepted by Cloudflare Access and returns a non-JSON 1042 response.
      const uploadResponse = await uploadCsv(new Request(new URL("/api/uploads", request.url), {
        method: "POST",
        headers: forwardedHeaders,
        body: formData,
      }));
      const uploadText = await uploadResponse.text();
      const uploadBody = (() => {
        try {
          return JSON.parse(uploadText) as { error?: string; savedRows?: number; status?: string };
        } catch {
          return { error: uploadText || `Upload handler returned HTTP ${uploadResponse.status}` };
        }
      })();
      if (!uploadResponse.ok) throw new Error(`${tab.range.split("!")[0]} 탭: ${uploadBody.error || "동기화 실패"}`);
      results.push({ tableKey: tab.tableKey, status: uploadBody.status, savedRows: uploadBody.savedRows ?? 0 });
    }
    const syncedAt = new Date().toISOString();
    const savedRows = results.reduce((sum, row) => sum + row.savedRows, 0);
    await env.DB.prepare("INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, 'google_sheet_sync', 'integration', ?, ?, ?)")
      .bind(crypto.randomUUID(), hospitalId, access.email, config.sheetId, syncedAt, JSON.stringify({ savedRows, results, sourceMode })).run();
    return Response.json({ synced: true, syncedAt, savedRows, results, sourceMode });
  } catch (error) {
    return accessErrorResponse(error, "구글 시트 동기화에 실패했습니다.");
  }
}
