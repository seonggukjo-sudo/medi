import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const previewUrl = new URL("../outputs/메디인사이트_대시보드_로컬미리보기.html", import.meta.url);
const hostingUrl = new URL("../.openai/hosting.json", import.meta.url);
const schemaUrl = new URL("../db/schema.ts", import.meta.url);

test("로컬 미리보기는 현재까지 구축된 전체 대시보드 기능을 요약한다", async () => {
  const previewSource = await readFile(previewUrl, "utf8");

  assert.match(previewSource, /현재까지 반영된 전체 기능/);
  assert.match(previewSource, /관리자 페이지 로그인 구성/);
  assert.match(previewSource, /기간 필터와 기간대비 KPI/);
  assert.match(previewSource, /진료과목별 상담과 유입경로/);
  assert.match(previewSource, /매체별 효율과 광고비 비중/);
  assert.match(previewSource, /업로드 KPI 기반 자동 요약/);
  assert.match(previewSource, /표준 컬럼 검증, 오류 상세, 샘플 다운로드, 업로드 이력/);
  assert.match(previewSource, /설정 저장 상태, 권한·알림 그래프, 운영 배포 전 체크리스트/);
});

test("로컬 미리보기와 소스는 D1 R2 저장 준비 상태를 함께 보여준다", async () => {
  const [previewSource, hostingSource, schemaSource] = await Promise.all([
    readFile(previewUrl, "utf8"),
    readFile(hostingUrl, "utf8"),
    readFile(schemaUrl, "utf8"),
  ]);
  const storageSource = `${previewSource}\n${hostingSource}\n${schemaSource}`;

  assert.match(hostingSource, /"d1": "DB"/);
  assert.match(hostingSource, /"r2": "UPLOADS"/);
  assert.match(schemaSource, /sqliteTable\("hospitals"/);
  assert.match(schemaSource, /export const users = sqliteTable/);
  assert.match(schemaSource, /"upload_batches"/);
  assert.match(schemaSource, /"uploaded_files"/);
  assert.match(schemaSource, /"ai_reports"/);
  assert.match(schemaSource, /"audit_logs"/);
  assert.match(schemaSource, /"kpi_snapshots"/);
  assert.match(storageSource, /D1=DB/);
  assert.match(storageSource, /R2=UPLOADS/);
  assert.match(storageSource, /hospital_id/);
  assert.match(storageSource, /upload_batches/);
  assert.match(storageSource, /kpi_snapshots/);
});
