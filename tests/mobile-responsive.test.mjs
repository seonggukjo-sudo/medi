import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("모바일 뷰포트와 안전 영역을 설정한다", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /width: "device-width"/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /maximumScale: 5/);
});

test("모바일 메뉴와 기간 선택, 카드, 표가 반응형으로 재배치된다", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /Mobile operating layout/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) 42px/);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
