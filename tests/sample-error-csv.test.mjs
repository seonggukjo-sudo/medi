import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const errorFixtureDir = new URL("../outputs/sample-csv-errors/", import.meta.url);

async function readFixture(name) {
  return readFile(new URL(name, errorFixtureDir), "utf8");
}

test("샘플 오류 CSV 5종과 예상 이슈 정의가 제공된다", async () => {
  const files = await readdir(errorFixtureDir);

  assert.ok(files.includes("leads_invalid.csv"));
  assert.ok(files.includes("appointments_invalid.csv"));
  assert.ok(files.includes("visits_invalid.csv"));
  assert.ok(files.includes("payments_invalid.csv"));
  assert.ok(files.includes("ad_spend_invalid.csv"));
  assert.ok(files.includes("expected-issues.json"));
});

test("오류 샘플 CSV는 앱 다운로드 경로에도 복사되어 있다", async () => {
  const publicFiles = await readdir(new URL("../public/sample-csv-errors/", import.meta.url));

  assert.ok(publicFiles.includes("leads_invalid.csv"));
  assert.ok(publicFiles.includes("appointments_invalid.csv"));
  assert.ok(publicFiles.includes("visits_invalid.csv"));
  assert.ok(publicFiles.includes("payments_invalid.csv"));
  assert.ok(publicFiles.includes("ad_spend_invalid.csv"));
  assert.ok(publicFiles.includes("expected-issues.json"));
});

test("샘플 오류 CSV는 업로드 오류 상세 화면의 주요 오류 유형을 포함한다", async () => {
  const [leads, appointments, visits, payments, adSpend, expectedText] = await Promise.all([
    readFixture("leads_invalid.csv"),
    readFixture("appointments_invalid.csv"),
    readFixture("visits_invalid.csv"),
    readFixture("payments_invalid.csv"),
    readFixture("ad_spend_invalid.csv"),
    readFixture("expected-issues.json"),
  ]);
  const expected = JSON.parse(expectedText);
  const combined = [leads, appointments, visits, payments, adSpend, expectedText].join("\n");

  assert.match(leads, /^,/m);
  assert.match(combined, /not-a-date/);
  assert.match(combined, /인스타그램|틱톡 광고|기타진료|첫방문|블로그|확정대기/);
  assert.match(combined, /abc|hello/);
  assert.match(combined, /-350000|-90000/);
  assert.match(leads, /L-ERR-002[\s\S]*L-ERR-002/);
  assert.match(appointments, /A-ERR-002[\s\S]*A-ERR-002/);
  assert.match(payments, /PAY-ERR-002[\s\S]*PAY-ERR-002/);
  assert.deepEqual(expected.expectedIssueCodes, [
    "missing_required_field",
    "invalid_enum_value",
    "invalid_date",
    "invalid_number",
    "negative_money",
    "duplicate_key",
  ]);
});

test("샘플 오류 CSV 검증 시나리오 문서는 화면 확인 기준을 설명한다", async () => {
  const text = await readFile(new URL("../outputs/메디인사이트_샘플오류CSV_검증시나리오.md", import.meta.url), "utf8");

  assert.match(text, /샘플 오류 CSV 검증 시나리오/);
  assert.match(text, /필수값 누락/);
  assert.match(text, /허용되지 않은/);
  assert.match(text, /잘못된 날짜 형식/);
  assert.match(text, /숫자가 아닌 값/);
  assert.match(text, /음수 금액/);
  assert.match(text, /중복 고유값 후보/);
  assert.match(text, /업로드 오류 상세/);
  assert.match(text, /수정 안내/);
});
