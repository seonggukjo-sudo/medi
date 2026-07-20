import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("Google Sheets sync uses the existing validated upload pipeline", async () => {
  const route = await readFile(new URL("../app/api/google-sheets/route.ts", import.meta.url), "utf8");
  assert.match(route, /spreadsheets\.readonly/);
  assert.match(route, /values:batchGet/);
  assert.match(route, /hasKoreanHelperRows/);
  assert.match(route, /importableRows/);
  assert.match(route, /rows\.slice\(4\)/);
  assert.match(route, /new URL\("\/api\/uploads", request\.url\)/);
  assert.match(route, /\["owner", "admin", "marketer"\]/);
  assert.match(route, /google_sheet_sync/);
  for (const tableKey of ["leads", "appointments", "visits", "payments", "ad_spend"]) {
    assert.match(route, new RegExp(`tableKey: "${tableKey}"`));
  }
});

test("Google service account authentication is server-side and read-only", async () => {
  const route = await readFile(new URL("../app/api/google-sheets/route.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("../lib/google-service-account.ts", import.meta.url), "utf8");
  assert.match(route, /GOOGLE_SHEETS_PRIVATE_KEY/);
  assert.doesNotMatch(route, /privateKey:\s*config\.privateKey/);
  assert.match(auth, /urn:ietf:params:oauth:grant-type:jwt-bearer/);
  assert.match(auth, /RSASSA-PKCS1-v1_5/);
});

test("Settings provides template download, connection status, and manual sync", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const settings = await readFile(new URL("../app/api/settings/route.ts", import.meta.url), "utf8");
  assert.match(page, /medi-insight-google-sheets-template\.xlsx/);
  assert.match(page, /구글 시트 주소 또는 ID/);
  assert.match(page, /서비스 계정 공유 주소/);
  assert.match(page, /지금 동기화/);
  assert.match(page, /key: "google-sheets"/);
  assert.match(settings, /googleSheetId: ""/);
  assert.match(settings, /googleSheetAutomation: false/);
});

test("Downloadable Google Sheets template is packaged with the site", async () => {
  const file = await stat(new URL("../public/medi-insight-google-sheets-template.xlsx", import.meta.url));
  assert.ok(file.size > 10_000);
});
