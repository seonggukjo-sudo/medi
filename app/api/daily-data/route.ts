import { env } from "cloudflare:workers";
import { accessErrorResponse, requireAccess } from "@/lib/server-access";
import type { DailyMetricOverride } from "@/lib/daily-metric-overrides";

export const runtime = "edge";
const hospitalId = "demo-hospital";

function normalizeRow(value: Partial<DailyMetricOverride>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date ?? "")) throw new Error("수정할 일자를 확인해 주세요.");
  const numberValue = (input: unknown) => Math.max(0, Math.round(Number(input) || 0));
  return {
    date: value.date!,
    inquiries: numberValue(value.inquiries),
    reservations: numberValue(value.reservations),
    visits: numberValue(value.visits),
    sales: numberValue(value.sales),
    adSpend: numberValue(value.adSpend),
  };
}

export async function POST(request: Request) {
  try {
    const access = await requireAccess(request, hospitalId, ["owner", "admin", "marketer"]);
    const body = await request.json() as { rows?: Partial<DailyMetricOverride>[] };
    const rows = (body.rows ?? []).map(normalizeRow);
    if (!rows.length) return Response.json({ error: "저장할 변경사항이 없습니다." }, { status: 400 });

    const createdAt = new Date().toISOString();
    await env.DB.batch(rows.map((row) => env.DB.prepare(
      "INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, 'daily_metrics_override', 'daily_metrics', ?, ?, ?)",
    ).bind(crypto.randomUUID(), hospitalId, access.userId, row.date, createdAt, JSON.stringify(row))));

    return Response.json({ saved: rows.length, updatedAt: createdAt });
  } catch (error) {
    return accessErrorResponse(error, "일자별 수정값을 저장하지 못했습니다.");
  }
}
