import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const uploadRouteUrl = new URL("../app/api/uploads/route.ts", import.meta.url);
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
