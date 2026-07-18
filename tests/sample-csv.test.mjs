import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const sampleFiles = {
  leads: {
    file: "../outputs/sample-csv/leads.csv",
    headers: ["lead_id", "patient_key", "created_at", "source_channel", "campaign_id", "inquiry_type", "department", "owner_id", "first_response_at", "status"],
  },
  appointments: {
    file: "../outputs/sample-csv/appointments.csv",
    headers: ["appointment_id", "lead_id", "patient_key", "booked_at", "scheduled_at", "department", "status", "cancel_reason"],
  },
  visits: {
    file: "../outputs/sample-csv/visits.csv",
    headers: ["visit_id", "appointment_id", "patient_key", "visited_at", "visit_type", "department", "treatment_type", "visit_source"],
  },
  payments: {
    file: "../outputs/sample-csv/payments.csv",
    headers: ["payment_id", "visit_id", "patient_key", "paid_at", "gross_amount", "refund_amount", "net_amount", "department"],
  },
  adSpend: {
    file: "../outputs/sample-csv/ad_spend.csv",
    headers: ["spend_date", "channel", "campaign_id", "ad_group_id", "creative_id", "cost", "impressions", "clicks"],
  },
};

function parseCsvLine(line) {
  return line.split(",");
}

function number(value) {
  return Number(String(value ?? "0").replaceAll(",", ""));
}

function percent(part, total) {
  if (total === 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

async function readCsv(relativePath) {
  const text = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
  return { headers, rows, text };
}

test("샘플 CSV 5종은 표준 컬럼 헤더를 갖는다", async () => {
  for (const config of Object.values(sampleFiles)) {
    const { headers, rows } = await readCsv(config.file);
    assert.deepEqual(headers, config.headers);
    assert.ok(rows.length > 0);
  }
});

test("정상 샘플 CSV는 앱 다운로드 경로에도 복사되어 있다", async () => {
  const publicFiles = await readdir(new URL("../public/sample-csv/", import.meta.url));

  assert.ok(publicFiles.includes("leads.csv"));
  assert.ok(publicFiles.includes("appointments.csv"));
  assert.ok(publicFiles.includes("visits.csv"));
  assert.ok(publicFiles.includes("payments.csv"));
  assert.ok(publicFiles.includes("ad_spend.csv"));
});

test("샘플 CSV는 개인정보 대신 patient_key를 사용한다", async () => {
  const combined = await Promise.all(Object.values(sampleFiles).map((config) => readCsv(config.file)));
  const text = combined.map((item) => item.text).join("\n");

  assert.match(text, /patient_key/);
  assert.doesNotMatch(text, /전화번호|주민등록번호|환자명|이름/);
});

test("샘플 CSV는 표준 허용 코드값을 사용한다", async () => {
  const allowedSources = ["네이버검색", "다음검색", "구글검색", "카페(청라맘스)", "카페(검단맘블리)", "소개/추천", "워크인", "기타"];
  const allowedDepartments = ["교통사고", "수술후재활", "암면역", "다이어트", "성장", "기타"];
  const allowedVisitTypes = ["신환", "재진"];
  const allowedLeadStatuses = ["신규", "응답완료", "예약완료", "미예약", "종료", "스팸"];
  const allowedAppointmentStatuses = ["예약확정", "변경", "취소", "노쇼", "내원완료"];

  const leads = await readCsv(sampleFiles.leads.file);
  const appointments = await readCsv(sampleFiles.appointments.file);
  const visits = await readCsv(sampleFiles.visits.file);

  leads.rows.forEach((row) => {
    assert.ok(allowedSources.includes(row.source_channel), `허용되지 않은 유입경로: ${row.source_channel}`);
    assert.ok(allowedDepartments.includes(row.department), `허용되지 않은 진료과목: ${row.department}`);
    assert.ok(allowedLeadStatuses.includes(row.status), `허용되지 않은 상담상태: ${row.status}`);
  });

  appointments.rows.forEach((row) => {
    assert.ok(allowedDepartments.includes(row.department), `허용되지 않은 예약 진료과목: ${row.department}`);
    assert.ok(allowedAppointmentStatuses.includes(row.status), `허용되지 않은 예약상태: ${row.status}`);
  });

  visits.rows.forEach((row) => {
    assert.ok(allowedSources.includes(row.visit_source), `허용되지 않은 내원경로: ${row.visit_source}`);
    assert.ok(allowedDepartments.includes(row.department), `허용되지 않은 내원 진료과목: ${row.department}`);
    assert.ok(allowedVisitTypes.includes(row.visit_type), `허용되지 않은 내원구분: ${row.visit_type}`);
  });
});

test("샘플 KPI 결과 JSON은 CSV에서 계산한 요약값과 일치한다", async () => {
  const [leads, appointments, visits, payments, adSpend, resultText] = await Promise.all([
    readCsv(sampleFiles.leads.file),
    readCsv(sampleFiles.appointments.file),
    readCsv(sampleFiles.visits.file),
    readCsv(sampleFiles.payments.file),
    readCsv(sampleFiles.adSpend.file),
    readFile(new URL("../outputs/sample-kpi-result.json", import.meta.url), "utf8"),
  ]);

  const result = JSON.parse(resultText);
  const validLeads = leads.rows.filter((row) => row.status !== "스팸");
  const bookedAppointments = appointments.rows.filter((row) => ["예약확정", "내원완료"].includes(row.status));
  const completedVisits = visits.rows.filter((row) => row.visit_id);
  const sales = payments.rows.reduce((sum, row) => sum + number(row.net_amount), 0);
  const spend = adSpend.rows.reduce((sum, row) => sum + number(row.cost), 0);

  assert.equal(result.summary.inquiry, validLeads.length);
  assert.equal(result.summary.phoneInquiry, validLeads.filter((row) => row.inquiry_type === "전화문의").length);
  assert.equal(result.summary.reservation, bookedAppointments.length);
  assert.equal(result.summary.visit, completedVisits.length);
  assert.equal(result.summary.newVisit, completedVisits.filter((row) => row.visit_type === "신환").length);
  assert.equal(result.summary.sales, sales);
  assert.equal(result.summary.adSpend, spend);
  assert.equal(result.summary.reservationRate, percent(bookedAppointments.length, validLeads.length));
  assert.equal(result.summary.reservationVisitRate, percent(completedVisits.length, bookedAppointments.length));
  assert.equal(result.summary.inquiryVisitRate, percent(completedVisits.length, validLeads.length));
  assert.equal(result.summary.cpl, Math.round(spend / validLeads.length));
  assert.equal(result.summary.cpv, Math.round(spend / completedVisits.length));
  assert.equal(result.summary.roas, percent(sales, spend));
});

test("샘플 데이터 시뮬레이션 문서는 예상 KPI와 처리 흐름을 설명한다", async () => {
  const text = await readFile(new URL("../outputs/메디인사이트_샘플데이터_시뮬레이션.md", import.meta.url), "utf8");

  assert.match(text, /업로드 검증 → KPI 계산 → AI 요약 보고서/);
  assert.match(text, /문의/);
  assert.match(text, /예약/);
  assert.match(text, /내원/);
  assert.match(text, /매출/);
  assert.match(text, /광고비/);
  assert.match(text, /ROAS/);
  assert.match(text, /2,270,000원/);
  assert.match(text, /890,000원/);
});
