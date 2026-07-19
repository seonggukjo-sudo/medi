import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const uploadRouteUrl = new URL("../app/api/uploads/route.ts", import.meta.url);
const dataQualityRouteUrl = new URL("../app/api/data-quality/route.ts", import.meta.url);
const dailyOverridesUrl = new URL("../lib/daily-metric-overrides.ts", import.meta.url);
const dailyDataRouteUrl = new URL("../app/api/daily-data/route.ts", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const updateDocUrl = new URL("../outputs/메디인사이트_운영저장구조_마이그레이션_업데이트.md", import.meta.url);

test("서버 업로드 API는 CSV 원본을 R2에 저장하고 검증 결과를 D1에 남긴다", async () => {
  const source = await readFile(uploadRouteUrl, "utf8");

  assert.match(source, /export async function POST/);
  assert.match(source, /request\.formData/);
  assert.match(source, /validateImportRows/);
  assert.match(source, /env\.UPLOADS\.put/);
  assert.match(source, /INSERT INTO upload_batches/);
  assert.match(source, /INSERT INTO uploaded_files/);
  assert.match(source, /INSERT INTO audit_logs/);
  assert.match(source, /env\.DB\.batch/);
  assert.match(source, /needs_review/);
  assert.match(source, /validated/);
});

test("서버 업로드 API는 업로드 이력을 조회하는 GET 경로를 제공한다", async () => {
  const source = await readFile(uploadRouteUrl, "utf8");

  assert.match(source, /export async function GET/);
  assert.match(source, /FROM upload_batches b/);
  assert.match(source, /LEFT JOIN uploaded_files f/);
  assert.match(source, /WHERE b\.hospital_id = \?/);
  assert.match(source, /ORDER BY b\.uploaded_at DESC/);
});

test("데이터 관리 업로드 이력은 원본 파일과 실제 적용 기간을 표시한다", async () => {
  const [qualitySource, pageSource] = await Promise.all([
    readFile(dataQualityRouteUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(qualitySource, /f\.file_name AS fileName/);
  assert.match(qualitySource, /f\.table_key AS tableKey/);
  assert.match(qualitySource, /END AS periodStart/);
  assert.match(qualitySource, /END AS periodEnd/);
  assert.match(pageSource, /적용 기간/);
  assert.match(pageSource, /이상 없음/);
  assert.match(pageSource, /오류 \$\{row\.errorCount\}/);
});

test("일자별 직접 수정값은 수정자와 시각을 포함한 전체 이력으로 표시한다", async () => {
  const [overrideSource, qualitySource, pageSource] = await Promise.all([
    readFile(dailyOverridesUrl, "utf8"),
    readFile(dataQualityRouteUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(overrideSource, /loadDailyMetricOverrideHistory/);
  assert.match(overrideSource, /ORDER BY created_at DESC LIMIT \?/);
  assert.match(qualitySource, /overrideHistory/);
  assert.match(pageSource, /일자별 수치 수정 이력/);
  assert.match(pageSource, /수정자/);
  assert.match(pageSource, /수정 시각/);
  assert.match(pageSource, /동일 일자를 여러 번 수정한 경우/);
});

test("과거 일자별 값을 복원한 뒤 저장으로 확정할 수 있다", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /const restoreDailyData/);
  assert.match(pageSource, /과거 값을 편집 테이블에 복원했습니다/);
  assert.match(pageSource, /저장 버튼을 눌러 최종 반영/);
  assert.match(pageSource, /이 값 복원/);
  assert.match(pageSource, /setIsDataDirty\(true\)/);
  assert.match(pageSource, /id="daily-data-table"/);
  assert.match(cssSource, /\.history-restore-button/);
});

test("일자별 수치 저장은 수정 사유를 검증하고 감사 이력에 남긴다", async () => {
  const [routeSource, overrideSource, pageSource] = await Promise.all([
    readFile(dailyDataRouteUrl, "utf8"),
    readFile(dailyOverridesUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(routeSource, /수정 사유를 2자 이상 입력해 주세요/);
  assert.match(routeSource, /수정 사유는 200자 이내/);
  assert.match(routeSource, /JSON\.stringify\(\{ \.\.\.row, reason \}\)/);
  assert.match(overrideSource, /reason: String\(value\.reason/);
  assert.match(pageSource, /dailyEditReason/);
  assert.match(pageSource, /수정 사유/);
  assert.match(pageSource, /사유 미기록/);
  assert.match(pageSource, /applyDailyOverrides/);
  assert.match(pageSource, /setDataQualityRefreshKey/);
  assert.match(pageSource, /reservationRate: rate\(totals\.reservations, totals\.inquiries\)/);
  assert.match(pageSource, /세부 원천 합계와 차이가 생기면 대사 경고/);
});

test("저장하지 않은 일자별 수정값은 메뉴 이동과 창 종료 전에 보호한다", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /beforeunload/);
  assert.match(pageSource, /dailyEditBackupRef/);
  assert.match(pageSource, /requestMenuChange/);
  assert.match(pageSource, /저장하지 않은 변경사항이 있습니다/);
  assert.match(pageSource, /계속 수정/);
  assert.match(pageSource, /dailyEditReason\.trim\(\)\.length < 2/);
  assert.match(pageSource, /onClick=\{saveDailyData\}/);
  assert.match(pageSource, /저장 후 이동/);
  assert.match(pageSource, /변경 취소 후 이동/);
  assert.match(pageSource, /discardDailyChangesAndNavigate/);
  assert.match(cssSource, /\.unsaved-dialog/);
});

test("업로드 화면과 운영 문서는 서버 저장 API 준비 상태를 안내한다", async () => {
  const [pageSource, updateDocSource] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(updateDocUrl, "utf8"),
  ]);

  assert.match(pageSource, /서버 저장 API 준비/);
  assert.match(pageSource, /\/api\/uploads/);
  assert.match(pageSource, /R2 UPLOADS/);
  assert.match(pageSource, /D1 DB/);
  assert.match(updateDocSource, /업로드 API에서 R2에 원본 CSV 저장/);
  assert.match(updateDocSource, /D1에 업로드 배치와 파일 메타데이터 저장/);
});
