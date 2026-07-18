import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../db/schema.ts", import.meta.url);
const migrationUrl = new URL("../drizzle/0000_medi_insight_initial.sql", import.meta.url);
const journalUrl = new URL("../drizzle/meta/_journal.json", import.meta.url);
const hostingUrl = new URL("../.openai/hosting.json", import.meta.url);
const workerUrl = new URL("../worker/index.ts", import.meta.url);
const updateDocUrl = new URL("../outputs/메디인사이트_운영저장구조_마이그레이션_업데이트.md", import.meta.url);

test("운영 저장소 바인딩은 D1 DB와 R2 UPLOADS를 함께 준비한다", async () => {
  const [hostingSource, workerSource] = await Promise.all([
    readFile(hostingUrl, "utf8"),
    readFile(workerUrl, "utf8"),
  ]);

  assert.match(hostingSource, /"d1": "DB"/);
  assert.match(hostingSource, /"r2": "UPLOADS"/);
  assert.match(workerSource, /DB: D1Database/);
  assert.match(workerSource, /UPLOADS: R2Bucket/);
});

test("DB 스키마는 병원별 설정과 업무 데이터 복합키를 정의한다", async () => {
  const schemaSource = await readFile(schemaUrl, "utf8");

  assert.match(schemaSource, /hospitalSettings/);
  assert.match(schemaSource, /"hospital_settings"/);
  assert.match(schemaSource, /primaryKey/);
  assert.match(schemaSource, /columns: \[table\.hospitalId, table\.leadId\]/);
  assert.match(schemaSource, /columns: \[table\.hospitalId, table\.appointmentId\]/);
  assert.match(schemaSource, /columns: \[table\.hospitalId, table\.visitId\]/);
  assert.match(schemaSource, /columns: \[table\.hospitalId, table\.paymentId\]/);
  assert.match(schemaSource, /columns: \[table\.hospitalId, table\.spendId\]/);
});

test("초기 D1 마이그레이션은 운영 테이블과 핵심 인덱스를 생성한다", async () => {
  const migrationSource = await readFile(migrationUrl, "utf8");

  for (const table of [
    "hospitals",
    "users",
    "hospital_settings",
    "upload_batches",
    "uploaded_files",
    "leads",
    "appointments",
    "visits",
    "payments",
    "ad_spend",
    "ai_reports",
    "audit_logs",
    "kpi_snapshots",
  ]) {
    assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }

  assert.match(migrationSource, /PRIMARY KEY \(hospital_id, lead_id\)/);
  assert.match(migrationSource, /PRIMARY KEY \(hospital_id, appointment_id\)/);
  assert.match(migrationSource, /PRIMARY KEY \(hospital_id, visit_id\)/);
  assert.match(migrationSource, /PRIMARY KEY \(hospital_id, payment_id\)/);
  assert.match(migrationSource, /PRIMARY KEY \(hospital_id, spend_id\)/);
  assert.match(migrationSource, /CREATE INDEX IF NOT EXISTS upload_batches_hospital_uploaded_idx/);
  assert.match(migrationSource, /CREATE INDEX IF NOT EXISTS kpi_snapshots_hospital_period_idx/);
});

test("마이그레이션 기록과 운영 문서는 최신 저장 구조를 설명한다", async () => {
  const [journalSource, updateDocSource] = await Promise.all([
    readFile(journalUrl, "utf8"),
    readFile(updateDocUrl, "utf8"),
  ]);

  assert.match(journalSource, /0000_medi_insight_initial/);
  assert.match(updateDocSource, /운영 저장 구조/);
  assert.match(updateDocSource, /hospital_settings/);
  assert.match(updateDocSource, /R2에 원본 CSV 저장/);
  assert.match(updateDocSource, /D1에 업로드 배치와 파일 메타데이터 저장/);
});
