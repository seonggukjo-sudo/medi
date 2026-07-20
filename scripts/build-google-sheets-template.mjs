import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = process.env.REPO_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(repoRoot, "public", "medi-insight-google-sheets-template.xlsx");

const sheets = [
  {
    name: "입력안내",
    rows: [
      ["메디인사이트 Google Sheets 입력 템플릿"],
      ["구분", "내용"],
      ["1행", "영문 시스템 컬럼입니다. 앱 동기화가 이 값을 기준으로 읽으므로 수정하지 마세요."],
      ["2행", "한글 항목명입니다. 입력자가 이해하기 위한 안내 행입니다."],
      ["3행", "각 항목의 설명입니다. 실제 데이터로 저장되지 않습니다."],
      ["4행", "예시 값입니다. 실제 데이터로 저장되지 않습니다."],
      ["5행부터", "실제 운영 데이터를 입력하세요. 구글 시트 동기화 시 5행부터만 반영됩니다."],
      ["탭 이름", "상담문의, 예약, 내원, 결제매출, 광고비 탭 이름은 변경하지 마세요."],
      ["개인정보", "이름, 전화번호 등 개인정보 대신 환자 가명키를 사용하세요."],
    ],
  },
  {
    name: "상담문의",
    rows: [
      ["lead_id", "patient_key", "created_at", "source_channel", "campaign_id", "inquiry_type", "department", "owner_id", "first_response_at", "status"],
      ["문의 ID", "환자 가명키", "문의 일시", "유입 경로", "캠페인 ID", "문의 유형", "문의 진료과목", "상담 담당자 ID", "최초 응답 일시", "상담 상태"],
      ["필수. 문의 건을 구분하는 고유값입니다.", "선택. 개인정보가 아닌 내부 분석용 환자 키입니다.", "필수. 문의가 접수된 날짜와 시간입니다.", "필수. 최초 문의가 들어온 경로입니다.", "선택. 광고 캠페인과 연결할 때 입력합니다.", "필수. 전화문의, 온라인문의, 카카오문의 등으로 구분합니다.", "필수. 상담 문의가 연결된 진료과목입니다.", "선택. 담당자별 응대 분석이 필요할 때 입력합니다.", "선택. 응답 속도 KPI 계산에 사용합니다.", "필수. 신규, 응답완료, 예약완료, 미예약, 종료, 스팸 등으로 입력합니다."],
      ["L-20260720-001", "P-8F31A", "2026-07-20 09:24", "네이버 검색", "NAVER-ACCIDENT-01", "전화문의", "교통사고", "STAFF-03", "2026-07-20 09:31", "예약완료"],
    ],
  },
  {
    name: "예약",
    rows: [
      ["appointment_id", "lead_id", "patient_key", "booked_at", "scheduled_at", "department", "status", "cancel_reason"],
      ["예약 ID", "문의 ID", "환자 가명키", "예약 확정 일시", "방문 예정 일시", "예약 진료과목", "예약 상태", "취소 사유"],
      ["필수. 예약 건을 구분하는 고유값입니다.", "선택. 상담문의 시트의 문의 ID와 연결합니다.", "선택. 환자 단위 중복 분석용 키입니다.", "필수. 예약이 확정된 날짜와 시간입니다.", "필수. 실제 내원 예정 날짜와 시간입니다.", "필수. 예약된 진료과목입니다.", "필수. 예약확정, 변경, 취소, 노쇼, 내원완료 중 입력합니다.", "선택. 취소 또는 노쇼 사유를 입력합니다."],
      ["A-20260720-001", "L-20260720-001", "P-8F31A", "2026-07-20 10:02", "2026-07-21 15:30", "수술후재활", "예약확정", "일정 변경"],
    ],
  },
  {
    name: "내원",
    rows: [
      ["visit_id", "appointment_id", "patient_key", "visited_at", "visit_type", "department", "treatment_type", "visit_source"],
      ["내원 ID", "예약 ID", "환자 가명키", "내원 일시", "내원 구분", "내원 진료과목", "치료 유형", "내원 경로"],
      ["필수. 내원 건을 구분하는 고유값입니다.", "선택. 예약 후 내원인 경우 예약 ID를 입력합니다.", "필수. 신환/재진과 재내원 분석용 키입니다.", "필수. 실제 방문 완료 날짜와 시간입니다.", "필수. 신환 또는 재진을 입력합니다.", "필수. 실제 내원한 진료과목입니다.", "선택. 내부 치료 또는 프로그램명을 입력합니다.", "필수. 실제 내원 기준 유입 경로입니다."],
      ["V-20260721-001", "A-20260720-001", "P-8F31A", "2026-07-21 15:28", "신환", "교통사고", "도수치료", "카페(청라맘스)"],
    ],
  },
  {
    name: "결제매출",
    rows: [
      ["payment_id", "visit_id", "patient_key", "paid_at", "gross_amount", "refund_amount", "net_amount", "department"],
      ["결제 ID", "내원 ID", "환자 가명키", "결제 일시", "총 결제금액", "환불 금액", "순매출", "매출 진료과목"],
      ["필수. 결제 건을 구분하는 고유값입니다.", "선택. 내원 시트의 내원 ID와 연결합니다.", "선택. 환자 단위 매출 분석용 키입니다.", "필수. 결제가 완료된 날짜와 시간입니다.", "필수. 환불 전 결제 금액입니다. 숫자만 입력합니다.", "필수. 환불 또는 취소 금액입니다. 없으면 0을 입력합니다.", "필수. 총 결제금액에서 환불 금액을 뺀 금액입니다.", "선택. 진료과목별 매출 기여 분석에 사용합니다."],
      ["PAY-20260721-001", "V-20260721-001", "P-8F31A", "2026-07-21 16:10", 350000, 0, 350000, "다이어트"],
    ],
  },
  {
    name: "광고비",
    rows: [
      ["spend_date", "channel", "campaign_id", "ad_group_id", "creative_id", "cost", "impressions", "clicks", "conversions"],
      ["집행일", "매체", "캠페인 ID", "광고그룹 ID", "소재 ID", "광고비", "노출 수", "클릭 수", "광고 전환 수"],
      ["필수. 광고비가 집행된 날짜입니다.", "필수. 광고 또는 유입 매체명입니다.", "선택. 캠페인 단위 성과 분석용 값입니다.", "선택. 광고그룹 단위 성과 분석용 값입니다.", "선택. 소재별 성과 분석용 값입니다.", "필수. 해당 날짜와 매체에 사용한 광고비입니다. 숫자만 입력합니다.", "선택. 광고 노출 수입니다.", "선택. 광고 클릭 수입니다.", "선택. 광고 플랫폼 집계 전환 수입니다."],
      ["2026-07-20", "네이버 검색광고", "NAVER-ACCIDENT-01", "ACCIDENT-KEYWORD-A", "CREATIVE-07", 280000, 18400, 742, 18],
    ],
  },
];

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - rem - 1) / 26);
  }
  return name;
}

function cellXml(value, rowIndex, colIndex) {
  const ref = `${columnName(colIndex)}${rowIndex + 1}`;
  if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function worksheetXml(sheet) {
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => cellXml(value, rowIndex, colIndex)).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.name === "입력안내" ? 1 : 4}" topLeftCell="A${sheet.name === "입력안내" ? 2 : 5}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${Array.from({ length: Math.max(...sheet.rows.map((row) => row.length)) }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="22" customWidth="1"/>`).join("")}</cols>
  <sheetData>${rows}</sheetData>
</worksheet>`;
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBuffer.length), u16(0), nameBuffer, data,
    ]);
    chunks.push(local);
    central.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBuffer.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBuffer,
    ]));
    offset += local.length;
  }
  const centralDir = Buffer.concat(central);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralDir.length), u32(offset), u16(0)]);
  return Buffer.concat([...chunks, centralDir, end]);
}

const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
const contentTypes = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");

const files = [
  ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${contentTypes}</Types>`],
  ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`],
  ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>`],
  ...sheets.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet)]),
];

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, zip(files));
console.log(outputPath);
