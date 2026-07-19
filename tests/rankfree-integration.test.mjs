import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../app/page.tsx", import.meta.url);
const rankPath = new URL("../app/api/place-rank/route.ts", import.meta.url);
const insightsPath = new URL("../app/api/rankfree-insights/route.ts", import.meta.url);

test("랭크프리 일자별 순위 이력을 대시보드 기록으로 동기화한다", async () => {
  const source = await readFile(rankPath, "utf8");
  assert.match(source, /GET \/rank\/slots|api\/v1\/rank\/slots/);
  assert.match(source, /syncRankfreeSlotHistory/);
  assert.match(source, /rankfreeHistorySnapshot/);
  assert.match(source, /rankMethod: "provider-absolute"/);
  assert.match(source, /rankfreeSlotMatches/);
  assert.match(source, /rankfreeRankResult/);
  assert.match(source, /matchedSlots/);
  assert.match(source, /current\?\.status === "manual"/);
  assert.match(source, /row\.status === "measured"/);
});

test("랭크프리 분석 API는 인증과 권한별 빈 상태를 제공한다", async () => {
  const source = await readFile(insightsPath, "utf8");
  assert.match(source, /requireAccess\(request, hospitalId\)/);
  assert.match(source, /\/keyword\/detail\?keyword=/);
  assert.match(source, /\/compete\/tracks/);
  assert.match(source, /scope-required/);
  assert.doesNotMatch(source, /rk_[A-Za-z0-9]{20,}/);
});

test("광고채널은 순위 변화와 키워드·경쟁 분석을 함께 표시한다", async () => {
  const source = await readFile(pagePath, "utf8");
  for (const phrase of ["현재 순위", "직전 측정 대비", "선택 기간 변화", "키워드 · 경쟁 분석", "월간 검색 수요", "연관 키워드"]) {
    assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /추적 슬롯 매칭/);
  assert.match(source, /추적 동기화 확인 필요/);
});
