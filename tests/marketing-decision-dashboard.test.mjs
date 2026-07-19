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

test("설정에서 외부 연동 상태와 실제 성공 기록을 통합 관리한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /외부 데이터 연동 상태/);
  assert.match(page, /GA4 Data API/);
  assert.match(page, /네이버 검색광고/);
  assert.match(page, /플레이스 자연 노출 순위/);
  assert.match(page, /마지막 성공/);
  assert.match(page, /성공 기록 없음/);
  assert.match(page, /지금 새로고침/);
  assert.doesNotMatch(page, /<strong>오늘 12:54<\/strong>/);
  assert.match(css, /\.integration-health-grid/);
  assert.match(css, /\.integration-state\.partial/);
});

test("로그인과 역할 확인 전에는 대시보드 데이터 요청과 화면을 차단한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const access = await readFile(new URL("../lib/server-access.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /authState !== "authenticated"/);
  assert.match(page, /로그인 전 데이터 요청 차단/);
  assert.match(page, /사용자 역할별 API 권한 검사/);
  assert.match(page, /등록되지 않은 계정/);
  assert.match(page, /\/signin-with-chatgpt\?return_to=\//);
  assert.match(access, /if \(!email\) throw new AccessError/);
  assert.match(access, /if \(!bootstrap && !user\) throw new AccessError/);
  assert.match(css, /\.auth-gate-shell/);
});

test("로그인 실패와 데이터 서비스 오류를 구분하고 안전하게 재시도한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /status === 401 \? "unauthenticated"/);
  assert.match(page, /"unavailable"/);
  assert.match(page, /로그인은 유지하고 연결을 다시 확인합니다/);
  assert.match(page, /연결 다시 확인/);
  assert.match(page, /setAuthRetryKey/);
});

test("실제 역할과 최근 접속 기록을 계정 화면에 반영한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const access = await readFile(new URL("../lib/server-access.ts", import.meta.url), "utf8");
  assert.match(page, /\$\{accessRole\} 계정/);
  assert.match(page, /업로드·수정 가능/);
  assert.match(page, /사용자·목표 변경 가능/);
  assert.match(page, /최근 접속 시각은 서버에서 15분 간격으로 갱신/);
  assert.match(access, /accessHeartbeatIntervalMs = 15 \* 60 \* 1000/);
  assert.match(access, /UPDATE users SET last_login_at = \?/);
  assert.match(access, /Access logging must not block/);
});

test("사용자 권한 저장은 중복 계정과 최고관리자 잠금을 방지한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/settings/route.ts", import.meta.url), "utf8");
  assert.match(page, /사용자 추가/);
  assert.match(page, /중복 사용자 이메일이 있습니다/);
  assert.match(page, /최고관리자를 최소 1명 유지해야 합니다/);
  assert.match(page, /현재 계정/);
  assert.match(route, /const seenEmails = new Set<string>/);
  assert.match(route, /if \(seenEmails\.has\(email\)\)/);
  assert.match(route, /normalizedUsers\.some\(\(user\) => user\.role === "owner"\)/);
  assert.match(route, /ownerCount/);
});

test("사용자 추가 삭제 권한 변경을 상세 감사 이력으로 보존한다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/settings/route.ts", import.meta.url), "utf8");
  assert.match(route, /user_added/);
  assert.match(route, /user_removed/);
  assert.match(route, /user_role_changed/);
  assert.match(route, /beforeRole/);
  assert.match(route, /afterRole/);
  assert.match(route, /existing\?\.lastLoginAt/);
  assert.match(route, /existing\?\.createdAt/);
  assert.match(page, /settingsActionLabels/);
  assert.match(page, /신규/);
  assert.match(page, /최고관리자/);
});

test("KPI 목표와 AI 분석 기준의 변경 전후 값을 감사 이력에 남긴다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/settings/route.ts", import.meta.url), "utf8");
  assert.match(route, /kpi_target_changed/);
  assert.match(route, /ai_settings_changed/);
  assert.match(route, /beforeValue/);
  assert.match(route, /afterValue/);
  assert.match(route, /분석 주기/);
  assert.match(route, /비교 기준/);
  assert.match(page, /KPI 목표 변경/);
  assert.match(page, /AI 분석 기준 변경/);
  assert.match(page, /row\.metadata\?\.detail/);
});
