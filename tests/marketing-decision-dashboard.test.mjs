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
