import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source() {
  return readFile(new URL("../lib/kpi-calculator.ts", import.meta.url), "utf8");
}

test("KPI 계산 유틸은 업로드 행 데이터에서 핵심 KPI를 계산한다", async () => {
  const text = await source();

  assert.match(text, /calculateImportedKpis/);
  assert.match(text, /inquiry/);
  assert.match(text, /phoneInquiry/);
  assert.match(text, /reservation/);
  assert.match(text, /visit/);
  assert.match(text, /newVisit/);
  assert.match(text, /sales/);
  assert.match(text, /adSpend/);
  assert.match(text, /reservationRate/);
  assert.match(text, /reservationVisitRate/);
  assert.match(text, /inquiryVisitRate/);
  assert.match(text, /cpl/);
  assert.match(text, /cpv/);
  assert.match(text, /roas/);
});

test("KPI 계산 유틸은 진료과목별·채널별 요약을 제공한다", async () => {
  const text = await source();

  assert.match(text, /DepartmentKpiSummary/);
  assert.match(text, /ChannelKpiSummary/);
  assert.match(text, /department/);
  assert.match(text, /reservations/);
  assert.match(text, /leadChannelById/);
  assert.match(text, /source_channel/);
  assert.match(text, /visit_source/);
  assert.match(text, /channel/);
});

test("KPI 계산 유틸은 0으로 나누는 비율을 null로 처리한다", async () => {
  const text = await source();

  assert.match(text, /function percent/);
  assert.match(text, /if \(total === 0\) return null/);
  assert.match(text, /adSpend === 0 \? null/);
});

test("KPI 계산 유틸은 중복 업무 ID를 제거한 뒤 세부 합계를 계산한다", async () => {
  const text = await source();

  assert.match(text, /function uniqueRows/);
  assert.match(text, /uniqueRows\(rows\.leads\.filter\(isValidLead\), "lead_id"\)/);
  assert.match(text, /uniqueRows\(rows\.appointments\.filter\(isBooked\), "appointment_id"\)/);
  assert.match(text, /uniqueRows\(rows\.visits\.filter\(isCompletedVisit\), "visit_id"\)/);
});

test("노쇼율은 방문예정 예약 중 실제 내원이 없는 예약을 기준으로 계산한다", async () => {
  const text = await source();

  assert.match(text, /noShowAppointments/);
  assert.match(text, /visitedAppointmentIds/);
  assert.match(text, /noShowRate: percent\(noShow, noShowEligible\)/);
  assert.match(text, /reservationVisitRate: percent\(bookedVisit, reservation\)/);
  assert.match(text, /inquiryVisitRate: percent\(newVisit, inquiry\)/);
});
