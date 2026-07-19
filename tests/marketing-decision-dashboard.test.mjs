import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("광고부터 매출까지 동일 기간의 마케팅 CRM 흐름을 표시한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /마케팅 · CRM 경영 핵심 KPI/);
  assert.match(page, /마케팅 CRM 전체 흐름/);
  assert.match(page, /광고 노출/);
  assert.match(page, /웹 전환/);
  assert.match(page, /유효 문의/);
  assert.match(page, /신환 내원/);
  assert.match(page, /매출/);
});

test("예산 판단은 광고 원천과 CRM 귀속 지표를 함께 사용한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /매체별 예산 판단 · CRM 전환 성과/);
  assert.match(page, /매체별 예산 조정 판단/);
  assert.match(page, /CPL/);
  assert.match(page, /예약 CPA/);
  assert.match(page, /내원 CPA/);
  assert.match(page, /ROAS/);
  assert.match(page, /문의 귀속 확인/);
});

test("GA4와 CRM을 임의 합산하지 않고 데이터 신뢰도를 별도 표시한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /GA4 → CRM 전환 연결 진단/);
  assert.match(page, /임의로 합치지 않고/);
  assert.match(page, /UTM 누락 세션/);
  assert.match(page, /데이터 신뢰도 요약/);
  assert.match(page, /기간 합계 = 세부 합계/);
});

test("반복 요약 카드를 제거하고 AI를 실행 과제 형식으로 표시한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /주요 데이터 요약/);
  assert.doesNotMatch(page, /상담 채널별 핵심 수치/);
  assert.doesNotMatch(page, /광고 원천 세부 데이터 필요/);
  assert.match(page, /문제 · 근거 · 실행 제안/);
});

test("일자별 실데이터로 상관관계를 계산하고 인과관계 단정을 제한한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /function pearsonCorrelation/);
  assert.match(page, /마케팅 · CRM 상관관계 진단/);
  assert.match(page, /광고비 ↔ 문의/);
  assert.match(page, /문의 ↔ 예약/);
  assert.match(page, /예약 ↔ 내원/);
  assert.match(page, /광고비 ↔ 매출/);
  assert.match(page, /인과관계로 해석하지 않습니다/);
});

test("매체별 클릭부터 내원까지 귀속 병목을 검증한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /매체별 전환 병목 진단/);
  assert.match(page, /클릭→문의/);
  assert.match(page, /문의→예약/);
  assert.match(page, /예약→내원/);
  assert.match(page, /part <= total/);
  assert.match(page, /귀속 확인 필요/);
});

test("KPI 카드는 계산 근거와 원천 데이터 이동 경로를 제공한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /KPI 계산 근거/);
  assert.match(page, /집계 기간/);
  assert.match(page, /계산식/);
  assert.match(page, /사용 원천/);
  assert.match(page, /대사 결과/);
  assert.match(page, /원천 데이터 확인/);
  assert.match(css, /\.kpi-detail-dialog/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
