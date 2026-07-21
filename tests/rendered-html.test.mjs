import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSources() {
  const [pageSource, dataSource, importContractSource, importValidatorSource, kpiCalculatorSource, sampleKpiSource, layoutSource, previewSource, planSource, mappingSource, serverDesignSource, hostingSource, schemaSource] =
    await Promise.all([
      readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
      readFile(new URL("../lib/dashboard-data.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/data-import-contract.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/import-validator.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/kpi-calculator.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/sample-kpi-result.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../outputs/메디인사이트_대시보드_로컬미리보기.html", import.meta.url), "utf8"),
      readFile(new URL("../outputs/병원_마케팅_대시보드_MVP_기획서.md", import.meta.url), "utf8"),
      readFile(new URL("../outputs/메디인사이트_데이터매핑_정의서.md", import.meta.url), "utf8"),
      readFile(new URL("../outputs/메디인사이트_서버저장_권한구조_설계.md", import.meta.url), "utf8"),
      readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    ]);

  return {
    pageSource,
    dataSource,
    importContractSource,
    importValidatorSource,
    kpiCalculatorSource,
    sampleKpiSource,
    layoutSource,
    previewSource,
    planSource,
    mappingSource,
    serverDesignSource,
    hostingSource,
    schemaSource,
    appSource: `${pageSource}\n${dataSource}`,
    allSource: `${pageSource}\n${dataSource}\n${importContractSource}\n${importValidatorSource}\n${kpiCalculatorSource}\n${sampleKpiSource}\n${layoutSource}\n${previewSource}\n${planSource}\n${mappingSource}\n${serverDesignSource}\n${hostingSource}\n${schemaSource}`,
  };
}

test("KPI 요약 요구사항이 화면과 데이터에 반영되어 있다", async () => {
  const { pageSource, appSource } = await readSources();

  assert.match(pageSource, /@\/lib\/dashboard-data/);
  assert.match(appSource, /KPI 요약/);
  assert.match(appSource, /1일/);
  assert.match(appSource, /최근 7일/);
  assert.match(appSource, /최근 30일/);
  assert.match(appSource, /지난달/);
  assert.match(appSource, /이번달/);
  assert.match(appSource, /직접입력/);
  assert.match(appSource, /문의, 예약, 내원 퍼널/);
  assert.match(appSource, /기간별 핵심 KPI 흐름/);
  assert.match(appSource, /ROAS/);
});

test("대시보드 데이터 레이어가 재사용 가능한 계약을 제공한다", async () => {
  const { dataSource } = await readSources();

  assert.match(dataSource, /export type PeriodKey/);
  assert.match(dataSource, /export type MarketingChannelSummary/);
  assert.match(dataSource, /export const periodDefinitions/);
  assert.match(dataSource, /export const departmentSummaries/);
  assert.match(dataSource, /export const marketingChannels/);
  assert.match(dataSource, /export const treatmentSummaries/);
  assert.match(dataSource, /export const aiReportBlocks/);
  assert.match(dataSource, /export function rate/);
  assert.match(dataSource, /export function formatMoney/);
});

test("실제 데이터 업로드를 위한 매핑 계약과 검증 유틸이 정의되어 있다", async () => {
  const { importContractSource, importValidatorSource, mappingSource } = await readSources();
  const source = `${importContractSource}\n${importValidatorSource}\n${mappingSource}`;

  assert.match(importContractSource, /export type ImportTableKey/);
  assert.match(importContractSource, /export const importTables/);
  assert.match(importContractSource, /export const importQualityRules/);
  assert.match(importContractSource, /requiredFieldsFor/);
  assert.match(importValidatorSource, /validateImportRows/);
  assert.match(importValidatorSource, /missing_required_field/);
  assert.match(importValidatorSource, /invalid_enum_value/);
  assert.match(importValidatorSource, /duplicate_key/);
  assert.match(source, /상담\/문의/);
  assert.match(source, /예약/);
  assert.match(source, /내원/);
  assert.match(source, /매출\/결제/);
  assert.match(source, /광고비/);
  assert.match(source, /lead_id/);
  assert.match(source, /appointment_id/);
  assert.match(source, /visit_id/);
  assert.match(source, /payment_id/);
  assert.match(source, /spend_date/);
  assert.match(source, /patient_key/);
  assert.match(source, /개인정보/);
});

test("데이터 품질 화면이 실제 업로드 검증과 KPI 계산 흐름을 안내한다", async () => {
  const { pageSource, dataSource } = await readSources();
  const source = `${pageSource}\n${dataSource}`;

  assert.match(source, /데이터 업로드/);
  assert.match(source, /표준 데이터 묶음/);
  assert.match(source, /필수 컬럼/);
  assert.match(source, /업로드 검증/);
  assert.match(source, /KPI 계산 흐름/);
  assert.match(source, /원본 파일에서 AI 보고서까지/);
  assert.match(source, /patient_key/);
  assert.match(source, /검증된 행만 문의, 예약, 내원, 매출, 광고비, ROAS/);
});

test("샘플 CSV 계산 결과가 대시보드 화면 데이터로 연결되어 있다", async () => {
  const { pageSource, sampleKpiSource, previewSource, planSource } = await readSources();
  const source = `${pageSource}\n${sampleKpiSource}\n${previewSource}\n${planSource}`;

  assert.match(pageSource, /sampleKpiResult/);
  assert.match(sampleKpiSource, /export const sampleKpiResult/);
  assert.match(source, /샘플 CSV 계산 결과/);
  assert.match(source, /업로드 후 화면에 반영될 KPI 예시/);
  assert.match(source, /문의 10건/);
  assert.match(source, /예약률 70\.0%/);
  assert.match(source, /내원 6건/);
  assert.match(source, /매출 2,270,000원/);
  assert.match(source, /광고비 890,000원/);
  assert.match(source, /ROAS 255\.1%/);
  assert.match(source, /AI 요약 입력값/);
});

test("데이터 품질 화면에 실제 CSV 업로드 준비 UI가 연결되어 있다", async () => {
  const { pageSource, previewSource, planSource } = await readSources();
  const source = `${pageSource}\n${previewSource}\n${planSource}`;

  assert.match(pageSource, /uploadedFiles/);
  assert.match(pageSource, /uploadHistory/);
  assert.match(pageSource, /handleUploadFile/);
  assert.match(source, /CSV 업로드 준비/);
  assert.match(source, /실제 병원 파일 5종/);
  assert.match(source, /파일 선택/);
  assert.match(source, /상담\/문의/);
  assert.match(source, /예약/);
  assert.match(source, /내원/);
  assert.match(source, /매출\/결제/);
  assert.match(source, /광고비/);
  assert.match(source, /표준 컬럼 검증 → KPI 계산 → AI 요약 보고서/);
});

test("데이터 업로드 화면은 최근 업로드 이력을 제공한다", async () => {
  const { pageSource } = await readSources();

  assert.match(pageSource, /UploadHistoryItem/);
  assert.match(pageSource, /업로드 이력/);
  assert.match(pageSource, /최근 파일 업로드와 검증 상태/);
  assert.match(pageSource, /upload-history-table/);
  assert.match(pageSource, /파일명, 시간, 행 수, 오류 상태/);
  assert.match(pageSource, /확인 필요/);
});

test("선택한 CSV를 브라우저에서 읽어 실제 KPI 계산 결과로 연결한다", async () => {
  const { pageSource, previewSource, planSource } = await readSources();
  const source = `${pageSource}\n${previewSource}\n${planSource}`;

  assert.match(pageSource, /parseCsvRows/);
  assert.match(pageSource, /splitCsvLine/);
  assert.match(pageSource, /validateImportRows/);
  assert.match(pageSource, /calculateImportedKpis/);
  assert.match(pageSource, /actualKpiResult/);
  assert.match(pageSource, /실제 업로드 계산 결과/);
  assert.match(pageSource, /선택한 CSV에서 바로 계산한 KPI/);
  assert.match(source, /브라우저에서 읽어/);
  assert.match(source, /오류 수와 KPI 계산 결과/);
  assert.match(source, /표준 컬럼 검증 → 실제 업로드 계산 결과 → AI 요약 입력값/);
});

test("실제 업로드 KPI가 KPI 요약 메인 화면에 반영된다", async () => {
  const { pageSource, previewSource, planSource } = await readSources();
  const source = `${pageSource}\n${previewSource}\n${planSource}`;

  assert.match(pageSource, /displayedValues/);
  assert.match(pageSource, /actualKpiResult=\{actualKpiResult\}/);
  assert.match(pageSource, /실제 업로드 KPI 반영 중/);
  assert.match(pageSource, /KPI 요약 카드와 퍼널에 적용/);
  assert.match(pageSource, /displayedValues\.inquiry/);
  assert.match(pageSource, /displayedValues\.reserve/);
  assert.match(pageSource, /displayedValues\.visit/);
  assert.match(pageSource, /displayedValues\.roas/);
  assert.match(source, /데이터 품질 메뉴에서 검증된 CSV 계산값/);
});

test("실제 업로드 KPI가 상담·내원과 마케팅 성과 화면에도 반영된다", async () => {
  const { pageSource } = await readSources();

  assert.match(pageSource, /상담·내원 실제 업로드 반영 중/);
  assert.match(pageSource, /진료과목별 문의, 예약, 신환 내원 값/);
  assert.match(pageSource, /displayedDepartments/);
  assert.match(pageSource, /마케팅 성과 실제 업로드 반영 중/);
  assert.match(pageSource, /marketingRows/);
  assert.match(pageSource, /업로드된 상담, 내원, 매출, 광고비 CSV/);
  assert.match(pageSource, /actualKpiResult\.channels/);
});

test("실제 업로드 KPI가 AI 요약 보고서 문장과 근거 데이터에 반영된다", async () => {
  const { pageSource, previewSource, planSource } = await readSources();
  const source = `${pageSource}\n${previewSource}\n${planSource}`;

  assert.match(pageSource, /실제 업로드 KPI 요약 보고서/);
  assert.match(pageSource, /LIVE KPI SUMMARY REPORT/);
  assert.match(pageSource, /reportHeadline/);
  assert.match(pageSource, /evidenceItems/);
  assert.match(pageSource, /priorityItems/);
  assert.match(pageSource, /문의 후 미예약 구간 점검/);
  assert.match(pageSource, /예약 후 미내원 관리/);
  assert.match(source, /AI 요약 보고서의 종합 판단, 근거 데이터, 이번 주 우선순위/);
  assert.match(source, /실제 문의·예약·내원·매출·광고비·ROAS 기준/);
});

test("AI 요약 보고서는 회의용 복사 텍스트를 제공한다", async () => {
  const { pageSource } = await readSources();

  assert.match(pageSource, /reportExportText/);
  assert.match(pageSource, /회의용 보고서/);
  assert.match(pageSource, /복사해서 공유할 수 있는 AI 요약문/);
  assert.match(pageSource, /보고서 텍스트 복사/);
  assert.match(pageSource, /navigator\.clipboard/);
  assert.match(pageSource, /개인정보 원본은 포함하지 않고 집계 KPI 기준/);
});

test("업로드 오류 상세 화면이 파일, 행, 컬럼, 수정 안내를 제공한다", async () => {
  const { pageSource, previewSource, planSource } = await readSources();
  const source = `${pageSource}\n${previewSource}\n${planSource}`;

  assert.match(pageSource, /validationResults=\{validationResults\}/);
  assert.match(pageSource, /validationIssues/);
  assert.match(pageSource, /업로드 오류 상세/);
  assert.match(pageSource, /수정해야 할 행과 컬럼을 확인합니다/);
  assert.match(pageSource, /issue-table/);
  assert.match(pageSource, /labelForImportTable/);
  assert.match(pageSource, /actionTextForIssue/);
  assert.match(pageSource, /missing_required_field/);
  assert.match(pageSource, /invalid_enum_value/);
  assert.match(source, /파일명, 행 번호, 컬럼명, 오류\/확인 상태, 수정 안내/);
});

test("정상 샘플과 오류 샘플 CSV 다운로드 버튼이 제공된다", async () => {
  const { pageSource, previewSource, planSource } = await readSources();
  const source = `${pageSource}\n${previewSource}\n${planSource}`;

  assert.match(pageSource, /sampleDownloadGroups/);
  assert.match(pageSource, /샘플 파일 다운로드/);
  assert.match(pageSource, /정상 샘플 CSV/);
  assert.match(pageSource, /오류 샘플 CSV/);
  assert.match(pageSource, /\/sample-csv\/leads\.csv/);
  assert.match(pageSource, /\/sample-csv-errors\/leads_invalid\.csv/);
  assert.match(pageSource, /expected-issues\.json/);
  assert.match(source, /정상 샘플은 KPI 계산 테스트용/);
  assert.match(source, /오류 샘플은 오류 상세 화면 테스트용/);
});

test("관리자 로그인과 메뉴별 화면 분리 구조가 제공된다", async () => {
  const { pageSource, dataSource, previewSource, planSource } = await readSources();
  const source = `${pageSource}\n${dataSource}\n${previewSource}\n${planSource}`;

  assert.match(pageSource, /관리자 페이지 로그인/);
  assert.match(pageSource, /AdminLoginView/);
  assert.match(pageSource, /setIsAuthenticated/);
  assert.match(pageSource, /로그아웃/);
  assert.match(dataSource, /"KPI 요약", "상담·내원", "마케팅 성과", "AI 요약 보고서"/);
  assert.match(pageSource, /데이터 업로드/);
  assert.match(pageSource, /SettingsView/);
  assert.match(pageSource, /설정/);
  assert.match(previewSource, /data-target="kpi"/);
  assert.match(previewSource, /data-target="upload"/);
  assert.match(previewSource, /data-target="settings"/);
  assert.match(source, /관리자 로그인 후 KPI 요약, 상담·내원, 마케팅 성과, AI 요약 보고서, 데이터 업로드, 설정 메뉴/);
});

test("설정 화면은 운영 프로필과 저장 상태를 제공한다", async () => {
  const { pageSource } = await readSources();

  assert.match(pageSource, /설정 저장 상태/);
  assert.match(pageSource, /운영 프로필과 마지막 저장 기록/);
  assert.match(pageSource, /주간 회의 중심/);
  assert.match(pageSource, /일일 상담 점검/);
  assert.match(pageSource, /월간 경영 보고/);
  assert.match(pageSource, /설정 저장/);
  assert.match(pageSource, /프로토타입 로컬 저장 상태/);
});

test("설정 화면은 운영 배포 전 체크리스트를 제공한다", async () => {
  const { pageSource } = await readSources();

  assert.match(pageSource, /운영 배포 전 체크리스트/);
  assert.match(pageSource, /실제 병원 운영 전에 확인할 항목/);
  assert.match(pageSource, /계정·권한/);
  assert.match(pageSource, /개인정보/);
  assert.match(pageSource, /업로드 보관/);
  assert.match(pageSource, /백업·복구/);
  assert.match(pageSource, /AI 보고서/);
  assert.match(pageSource, /readiness-list/);
});

test("설정 화면과 문서는 서버 저장·권한 구조를 제공한다", async () => {
  const { pageSource, serverDesignSource } = await readSources();
  const source = `${pageSource}\n${serverDesignSource}`;

  assert.match(pageSource, /서버 저장·권한 구조/);
  assert.match(pageSource, /운영 버전 아키텍처 요약/);
  assert.match(pageSource, /병원별 데이터 격리/);
  assert.match(pageSource, /권한 역할/);
  assert.match(pageSource, /DB 저장/);
  assert.match(pageSource, /파일 저장/);
  assert.match(pageSource, /감사 로그/);
  assert.match(source, /hospitals/);
  assert.match(source, /upload_batches/);
  assert.match(source, /ai_reports/);
  assert.match(source, /hospital_id/);
  assert.match(source, /D1\/R2/);
});

test("각 메뉴별 데이터 그래프와 추이 표시가 제공된다", async () => {
  const { pageSource, previewSource } = await readSources();
  const source = `${pageSource}\n${previewSource}`;

  assert.match(source, /광고비·매출 추이/);
  assert.match(source, /상담·예약·내원 추이/);
  assert.match(source, /광고비 비중 그래프/);
  assert.match(source, /보고서 근거 추이/);
  assert.match(source, /파일별 검증 요약/);
  assert.match(source, /권한·알림 설정 상태 그래프/);
  assert.match(pageSource, /dual-trend-chart/);
  assert.match(pageSource, /share-list/);
  assert.match(pageSource, /settings-meter-list/);
});

test("검증된 업로드 데이터를 KPI로 계산하는 유틸이 정의되어 있다", async () => {
  const { kpiCalculatorSource } = await readSources();

  assert.match(kpiCalculatorSource, /calculateImportedKpis/);
  assert.match(kpiCalculatorSource, /ImportedKpiSummary/);
  assert.match(kpiCalculatorSource, /DepartmentKpiSummary/);
  assert.match(kpiCalculatorSource, /ChannelKpiSummary/);
  assert.match(kpiCalculatorSource, /reservationRate/);
  assert.match(kpiCalculatorSource, /inquiryVisitRate/);
  assert.match(kpiCalculatorSource, /roas/);
  assert.match(kpiCalculatorSource, /leadDepartmentById/);
  assert.match(kpiCalculatorSource, /visitDepartmentById/);
});

test("상담·내원 요구사항이 반영되어 있다", async () => {
  const { appSource } = await readSources();

  assert.match(appSource, /상담·내원/);
  assert.match(appSource, /전화문의/);
  assert.match(appSource, /진료과목별 상담/);
  assert.match(appSource, /문의수, 예약, 예약률/);
  assert.match(appSource, /신환내원/);
  assert.match(appSource, /진료과목별 내원경로/);
  assert.match(appSource, /교통사고/);
  assert.match(appSource, /수술후재활/);
  assert.match(appSource, /암면역/);
  assert.match(appSource, /다이어트/);
  assert.match(appSource, /성장/);
  assert.match(appSource, /카페\(청라맘스\)/);
  assert.match(appSource, /카페\(검단맘블리\)/);
  assert.match(appSource, /소개\/추천/);
  assert.match(appSource, /워크인/);
});

test("마케팅 성과 요구사항이 반영되어 있다", async () => {
  const { appSource } = await readSources();

  assert.match(appSource, /마케팅 성과/);
  assert.match(appSource, /마케팅 성과 요약/);
  assert.match(appSource, /매체별 성과/);
  assert.match(appSource, /비용, 문의, 예약, 내원, 매출, ROAS/);
  assert.match(appSource, /효율성 비교/);
  assert.match(appSource, /예산 조정 기준/);
  assert.match(appSource, /네이버 검색광고/);
  assert.match(appSource, /카카오 채널/);
  assert.match(appSource, /메타 광고/);
  assert.match(appSource, /네이버 플레이스/);
  assert.match(appSource, /지역 카페/);
});

test("환자 및 진료와 AI 요약 보고서 요구사항이 반영되어 있다", async () => {
  const { appSource } = await readSources();

  assert.match(appSource, /환자 및 진료/);
  assert.match(appSource, /진료과목별 성과/);
  assert.match(appSource, /신환, 재진, 내원, 매출, 재내원율/);
  assert.match(appSource, /진료 매출 기여/);
  assert.match(appSource, /AI 요약 보고서/);
  assert.match(appSource, /병원 마케팅 데이터 요약 보고서/);
  assert.match(appSource, /이번 주 우선순위/);
  assert.match(appSource, /근거 데이터/);
});

test("문서 산출물이 프로젝트 관리 범위를 포함한다", async () => {
  const { planSource, mappingSource } = await readSources();

  assert.match(planSource, /프로젝트 목적/);
  assert.match(planSource, /핵심 KPI 정의/);
  assert.match(planSource, /데이터 구조/);
  assert.match(planSource, /화면 정보구조/);
  assert.match(planSource, /AI 요약 보고서 원칙/);
  assert.match(planSource, /제안 기술 스택/);
  assert.match(planSource, /단계별 개발 계획/);
  assert.match(planSource, /MVP 수용 기준/);
  assert.match(planSource, /현재 구축 상태/);
  assert.match(mappingSource, /KPI 연결 규칙/);
  assert.match(mappingSource, /업로드 검증 규칙/);
});

test("로컬 미리보기와 메타데이터가 최신 대시보드 범위를 담고 있다", async () => {
  const { layoutSource, previewSource } = await readSources();

  assert.match(layoutSource, /메디인사이트 \| 병원 마케팅 대시보드/);
  assert.match(layoutSource, /AI 요약 보고서/);
  assert.match(layoutSource, /favicon\.svg/);
  assert.match(previewSource, /KPI 요약/);
  assert.match(previewSource, /상담·내원/);
  assert.match(previewSource, /마케팅 성과/);
  assert.match(previewSource, /AI 요약 보고서/);
  assert.match(previewSource, /데이터 업로드/);
  assert.match(previewSource, /카페\(청라맘스\)/);
});
