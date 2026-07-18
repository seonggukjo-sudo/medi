import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source() {
  const [contractSource, validatorSource] = await Promise.all([
    readFile(new URL("../lib/data-import-contract.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/import-validator.ts", import.meta.url), "utf8"),
  ]);

  return `${contractSource}\n${validatorSource}`;
}

test("업로드 검증 유틸은 필수값, 코드값, 날짜, 숫자, 중복 검사를 포함한다", async () => {
  const text = await source();

  assert.match(text, /validateImportRows/);
  assert.match(text, /missing_required_field/);
  assert.match(text, /invalid_enum_value/);
  assert.match(text, /invalid_date/);
  assert.match(text, /invalid_number/);
  assert.match(text, /negative_money/);
  assert.match(text, /duplicate_key/);
  assert.match(text, /patient_key/);
  assert.match(text, /lead_id/);
  assert.match(text, /visit_id/);
});

test("업로드 검증 유틸은 운영자가 이해할 수 있는 한국어 메시지를 제공한다", async () => {
  const text = await source();

  assert.match(text, /필수값입니다/);
  assert.match(text, /허용 목록에 없습니다/);
  assert.match(text, /날짜 형식이 올바르지 않습니다/);
  assert.match(text, /숫자여야 합니다/);
  assert.match(text, /음수일 수 없습니다/);
  assert.match(text, /중복 후보입니다/);
});
