import { env } from "cloudflare:workers";
import { accessErrorResponse, requireAccess } from "@/lib/server-access";
import { createGoogleAccessToken } from "@/lib/google-service-account";

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
  { range: "광고비!A:Z", tableKey: "ad_spend", fileName: "google-sheet-ad-spend.csv" },
] as const;

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

function rowsToCsv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
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
    if (!config.clientEmail || !config.privateKey) return Response.json({ error: "Google 서비스 계정 환경변수가 설정되지 않았습니다." }, { status: 503 });

    const token = await createGoogleAccessToken(config.clientEmail, config.privateKey, sheetsScope);
    const query = new URLSearchParams({ majorDimension: "ROWS" });
    sheetTabs.forEach((tab) => query.append("ranges", tab.range));
    const sheetResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values:batchGet?${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!sheetResponse.ok) {
      if (sheetResponse.status === 403) throw new Error(`시트를 ${config.clientEmail} 계정에 뷰어로 공유하고 Google Sheets API를 활성화해 주세요.`);
      if (sheetResponse.status === 404) throw new Error("저장된 구글 시트 주소 또는 시트 탭 이름을 확인해 주세요.");
      throw new Error("구글 시트 데이터를 읽지 못했습니다.");
    }
    const sheetBody = await sheetResponse.json() as { valueRanges?: Array<{ values?: unknown[][] }> };
    const authEmail = request.headers.get("oai-authenticated-user-email") || "";
    const results = [];
    for (let index = 0; index < sheetTabs.length; index += 1) {
      const tab = sheetTabs[index];
      const rows = sheetBody.valueRanges?.[index]?.values ?? [];
      if (rows.length <= 1) {
        results.push({ tableKey: tab.tableKey, status: "empty", savedRows: 0 });
        continue;
      }
      const formData = new FormData();
      formData.set("tableKey", tab.tableKey);
      formData.set("hospitalId", hospitalId);
      formData.set("file", new File([rowsToCsv(rows)], tab.fileName, { type: "text/csv;charset=utf-8" }));
      const uploadResponse = await fetch(new URL("/api/uploads", request.url), {
        method: "POST",
        headers: authEmail ? { "oai-authenticated-user-email": authEmail } : undefined,
        body: formData,
      });
      const uploadBody = await uploadResponse.json() as { error?: string; savedRows?: number; status?: string };
      if (!uploadResponse.ok) throw new Error(`${tab.range.split("!")[0]} 탭: ${uploadBody.error || "동기화 실패"}`);
      results.push({ tableKey: tab.tableKey, status: uploadBody.status, savedRows: uploadBody.savedRows ?? 0 });
    }
    const syncedAt = new Date().toISOString();
    const savedRows = results.reduce((sum, row) => sum + row.savedRows, 0);
    await env.DB.prepare("INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, 'google_sheet_sync', 'integration', ?, ?, ?)")
      .bind(crypto.randomUUID(), hospitalId, access.email, config.sheetId, syncedAt, JSON.stringify({ savedRows, results })).run();
    return Response.json({ synced: true, syncedAt, savedRows, results });
  } catch (error) {
    return accessErrorResponse(error, "구글 시트 동기화에 실패했습니다.");
  }
}
