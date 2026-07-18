import { env } from "cloudflare:workers";
import { accessErrorResponse, requireAccess } from "@/lib/server-access";
import { loadDailyMetricOverrides } from "@/lib/daily-metric-overrides";

export const runtime = "edge";
const hospitalId = "demo-hospital";

type CountRow = { count: number; amount?: number };

async function count(sql: string, start: string, end: string) {
  const row = await env.DB.prepare(sql).bind(hospitalId, start, `${end} 23:59:59`).first<CountRow>();
  return { count: Number(row?.count ?? 0), amount: Number(row?.amount ?? 0) };
}

export async function GET(request: Request) {
  try {
    await requireAccess(request, hospitalId);
    const url = new URL(request.url);
    const end = url.searchParams.get("end") || new Date().toISOString().slice(0, 10);
    const start = url.searchParams.get("start") || end;
    const [lead, appointment, visit, payment, spend, uploads, missingLinks, duplicateWarnings, overrides] = await Promise.all([
      count("SELECT COUNT(DISTINCT lead_id) AS count FROM leads WHERE hospital_id = ? AND received_at BETWEEN ? AND ? AND lead_id <> ''", start, end),
      count("SELECT COUNT(DISTINCT appointment_id) AS count FROM appointments WHERE hospital_id = ? AND booked_at BETWEEN ? AND ? AND appointment_id <> ''", start, end),
      count("SELECT COUNT(DISTINCT visit_id) AS count FROM visits WHERE hospital_id = ? AND visited_at BETWEEN ? AND ? AND visit_id <> ''", start, end),
      count("SELECT COUNT(*) AS count, COALESCE(SUM(net_amount), 0) AS amount FROM payments WHERE hospital_id = ? AND paid_at BETWEEN ? AND ?", start, end),
      count("SELECT COUNT(*) AS count, COALESCE(SUM(cost), 0) AS amount FROM ad_spend WHERE hospital_id = ? AND spend_date BETWEEN ? AND ?", start, end),
      env.DB.prepare("SELECT batch_id AS batchId, uploaded_by AS uploadedBy, uploaded_at AS uploadedAt, status, row_count AS rowCount, error_count AS errorCount, warning_count AS warningCount FROM upload_batches WHERE hospital_id = ? ORDER BY uploaded_at DESC LIMIT 20").bind(hospitalId).all(),
      env.DB.prepare("SELECT (SELECT COUNT(*) FROM appointments a LEFT JOIN leads l ON l.hospital_id = a.hospital_id AND l.lead_id = a.lead_id WHERE a.hospital_id = ? AND a.lead_id <> '' AND l.lead_id IS NULL) + (SELECT COUNT(*) FROM visits v LEFT JOIN appointments a ON a.hospital_id = v.hospital_id AND a.appointment_id = v.appointment_id WHERE v.hospital_id = ? AND v.appointment_id <> '' AND a.appointment_id IS NULL) AS count").bind(hospitalId, hospitalId).first<CountRow>(),
      env.DB.prepare("SELECT COALESCE(SUM(warning_count), 0) AS count FROM upload_batches WHERE hospital_id = ?").bind(hospitalId).first<CountRow>(),
      loadDailyMetricOverrides(env.DB, hospitalId, start, end),
    ]);

    const dateQueries = [
      ["leads", "received_at", "lead_id", "inquiries"], ["appointments", "booked_at", "appointment_id", "reservations"], ["visits", "visited_at", "visit_id", "visits"],
    ] as const;
    const grouped = await Promise.all(dateQueries.map(([table, field, idField]) => env.DB.prepare(`SELECT substr(${field}, 1, 10) AS date, COUNT(DISTINCT ${idField}) AS value FROM ${table} WHERE hospital_id = ? AND ${field} BETWEEN ? AND ? AND ${idField} <> '' GROUP BY substr(${field}, 1, 10)`).bind(hospitalId, start, `${end} 23:59:59`).all()));
    const moneyGrouped = await Promise.all([
      env.DB.prepare("SELECT substr(paid_at, 1, 10) AS date, SUM(net_amount) AS value FROM payments WHERE hospital_id = ? AND paid_at BETWEEN ? AND ? GROUP BY substr(paid_at, 1, 10)").bind(hospitalId, start, `${end} 23:59:59`).all(),
      env.DB.prepare("SELECT substr(spend_date, 1, 10) AS date, SUM(cost) AS value FROM ad_spend WHERE hospital_id = ? AND spend_date BETWEEN ? AND ? GROUP BY substr(spend_date, 1, 10)").bind(hospitalId, start, end).all(),
    ]);
    const dailyMap = new Map<string, { date: string; inquiries: number; reservations: number; visits: number; sales: number; adSpend: number }>();
    const put = (date: string, field: "inquiries" | "reservations" | "visits" | "sales" | "adSpend", value: number) => {
      const row = dailyMap.get(date) || { date, inquiries: 0, reservations: 0, visits: 0, sales: 0, adSpend: 0 };
      row[field] = Number(value || 0); dailyMap.set(date, row);
    };
    grouped.forEach((result, index) => result.results.forEach((row) => put(String(row.date), dateQueries[index][3], Number(row.value))));
    moneyGrouped[0].results.forEach((row) => put(String(row.date), "sales", Number(row.value)));
    moneyGrouped[1].results.forEach((row) => put(String(row.date), "adSpend", Number(row.value)));
    overrides.forEach((row) => dailyMap.set(row.date, { date: row.date, inquiries: row.inquiries, reservations: row.reservations, visits: row.visits, sales: row.sales, adSpend: row.adSpend }));
    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    const detailTotals = daily.reduce((sum, row) => ({ inquiries: sum.inquiries + row.inquiries, reservations: sum.reservations + row.reservations, visits: sum.visits + row.visits, sales: sum.sales + row.sales, adSpend: sum.adSpend + row.adSpend }), { inquiries: 0, reservations: 0, visits: 0, sales: 0, adSpend: 0 });
    const sourceTotals = { inquiries: lead.count, reservations: appointment.count, visits: visit.count, sales: payment.amount, adSpend: spend.amount };
    const totals = overrides.length > 0 ? detailTotals : sourceTotals;
    const reconciliation = Object.entries(totals).map(([metric, total]) => ({ metric, total, detailTotal: detailTotals[metric as keyof typeof detailTotals], passed: total === detailTotals[metric as keyof typeof detailTotals] }));
    const uploadRows = uploads.results as Array<{ status: string; rowCount: number; errorCount: number; warningCount: number }>;
    const uploadSummary = { total: uploadRows.length, validated: uploadRows.filter((row) => row.status === "validated").length, review: uploadRows.filter((row) => row.status === "needs_review").length, errors: uploadRows.reduce((sum, row) => sum + Number(row.errorCount), 0) };

    return Response.json({ range: { start, end }, connected: Object.values(totals).some((value) => value > 0), totals, sourceTotals, daily, overrides, uploads: uploads.results, uploadSummary, warnings: { missingLinks: Number(missingLinks?.count ?? 0), duplicates: Number(duplicateWarnings?.count ?? 0) }, reconciliation });
  } catch (error) {
    return accessErrorResponse(error, "데이터 품질을 검사하지 못했습니다.");
  }
}
