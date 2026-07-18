import { env } from "cloudflare:workers";
import { accessErrorResponse, requireAccess } from "@/lib/server-access";

export const runtime = "edge";
const hospitalId = "demo-hospital";

export async function GET(request: Request) {
  try {
    await requireAccess(request, hospitalId);
    const [leads, appointments, visits, payments, adSpend] = await Promise.all([
      env.DB.prepare("SELECT lead_id, patient_key, received_at AS created_at, source_channel, inquiry_type, department, status FROM leads WHERE hospital_id = ? ORDER BY received_at").bind(hospitalId).all(),
      env.DB.prepare("SELECT appointment_id, lead_id, patient_key, booked_at, scheduled_at, department, status FROM appointments WHERE hospital_id = ? ORDER BY booked_at").bind(hospitalId).all(),
      env.DB.prepare("SELECT visit_id, appointment_id, patient_key, visited_at, visit_type, department, visit_source FROM visits WHERE hospital_id = ? ORDER BY visited_at").bind(hospitalId).all(),
      env.DB.prepare("SELECT payment_id, visit_id, patient_key, paid_at, gross_amount, refund_amount, net_amount, department FROM payments WHERE hospital_id = ? ORDER BY paid_at").bind(hospitalId).all(),
      env.DB.prepare("SELECT spend_date, channel, campaign_name AS campaign_id, cost, impressions, clicks, conversions FROM ad_spend WHERE hospital_id = ? ORDER BY spend_date").bind(hospitalId).all(),
    ]);
    const rows = { leads: leads.results, appointments: appointments.results, visits: visits.results, payments: payments.results, adSpend: adSpend.results };
    const counts = Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value.length]));
    return Response.json({ connected: Object.values(counts).some((count) => count > 0), source: "D1 실데이터", rows, counts });
  } catch (error) {
    return accessErrorResponse(error, "대시보드 데이터를 불러오지 못했습니다.");
  }
}
