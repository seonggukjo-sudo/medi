export type ImportTableKey = "leads" | "appointments" | "visits" | "payments" | "ad_spend";
export type ImportFieldType = "string" | "date" | "datetime" | "number" | "money" | "enum";

export type ImportField = {
  key: string;
  label: string;
  type: ImportFieldType;
  required: boolean;
  description: string;
  allowedValues?: readonly string[];
  example: string;
};

export type ImportTableContract = {
  key: ImportTableKey;
  label: string;
  purpose: string;
  primaryDateField: string;
  dedupeKey: string;
  fields: readonly ImportField[];
};

export const departmentValues = ["교통사고", "수술후재활", "암면역", "다이어트", "성장", "기타"] as const;

export const visitSourceValues = [
  "네이버검색",
  "다음검색",
  "구글검색",
  "카페(청라맘스)",
  "카페(검단맘블리)",
  "소개/추천",
  "워크인",
  "기타",
] as const;

export const marketingChannelValues = [
  "네이버 검색광고",
  "카카오 채널",
  "메타 광고",
  "네이버 플레이스",
  "지역 카페",
  "소개/추천",
] as const;

export const leadStatusValues = ["신규", "응답완료", "예약완료", "미예약", "종료", "스팸"] as const;
export const appointmentStatusValues = ["예약확정", "변경", "취소", "노쇼", "내원완료"] as const;
export const visitTypeValues = ["신환", "재진"] as const;

export const importTables: readonly ImportTableContract[] = [
  {
    key: "leads",
    label: "상담/문의",
    purpose: "문의, 전화문의, 예약률, 진료과목별 문의수의 기준 데이터",
    primaryDateField: "created_at",
    dedupeKey: "lead_id",
    fields: [
      { key: "lead_id", label: "문의ID", type: "string", required: true, description: "문의 한 건을 식별하는 고유값", example: "L-20260711-001" },
      { key: "patient_key", label: "환자가명키", type: "string", required: false, description: "개인정보가 아닌 가명 처리된 환자 연결 키", example: "P-8F31A" },
      { key: "created_at", label: "문의일시", type: "datetime", required: true, description: "문의가 생성된 날짜와 시간", example: "2026-07-11 09:24" },
      { key: "source_channel", label: "유입경로", type: "enum", required: true, description: "최초 문의가 들어온 경로", allowedValues: visitSourceValues, example: "네이버검색" },
      { key: "campaign_id", label: "캠페인ID", type: "string", required: false, description: "광고 캠페인과 연결할 때 사용하는 값", example: "NAVER-ACCIDENT-01" },
      { key: "inquiry_type", label: "문의유형", type: "enum", required: true, description: "전화문의 또는 온라인문의 구분", allowedValues: ["전화문의", "온라인문의", "카카오문의", "기타"], example: "전화문의" },
      { key: "department", label: "문의 진료과목", type: "enum", required: true, description: "상담 시 문의한 진료과목", allowedValues: departmentValues, example: "교통사고" },
      { key: "owner_id", label: "상담담당자ID", type: "string", required: false, description: "상담 담당자 분석이 필요할 때 사용", example: "STAFF-03" },
      { key: "first_response_at", label: "최초응답일시", type: "datetime", required: false, description: "응답속도 KPI 계산에 사용", example: "2026-07-11 09:31" },
      { key: "status", label: "상담상태", type: "enum", required: true, description: "상담 진행 상태", allowedValues: leadStatusValues, example: "예약완료" },
    ],
  },
  {
    key: "appointments",
    label: "예약",
    purpose: "예약 수, 예약률, 노쇼, 예약 대비 내원율의 기준 데이터",
    primaryDateField: "booked_at",
    dedupeKey: "appointment_id",
    fields: [
      { key: "appointment_id", label: "예약ID", type: "string", required: true, description: "예약 한 건을 식별하는 고유값", example: "A-20260711-001" },
      { key: "lead_id", label: "문의ID", type: "string", required: false, description: "상담 데이터와 연결하는 키", example: "L-20260711-001" },
      { key: "patient_key", label: "환자가명키", type: "string", required: false, description: "환자 단위 중복 분석을 위한 가명 키", example: "P-8F31A" },
      { key: "booked_at", label: "예약확정일시", type: "datetime", required: true, description: "예약이 확정된 일시", example: "2026-07-11 10:02" },
      { key: "scheduled_at", label: "방문예정일시", type: "datetime", required: true, description: "실제 내원 예정 일시", example: "2026-07-12 15:30" },
      { key: "department", label: "예약 진료과목", type: "enum", required: true, description: "예약한 진료과목", allowedValues: departmentValues, example: "수술후재활" },
      { key: "status", label: "예약상태", type: "enum", required: true, description: "예약 확정, 취소, 노쇼, 내원완료 상태", allowedValues: appointmentStatusValues, example: "예약확정" },
      { key: "cancel_reason", label: "취소사유", type: "string", required: false, description: "취소 또는 노쇼 사유", example: "일정 변경" },
    ],
  },
  {
    key: "visits",
    label: "내원",
    purpose: "내원, 신환내원, 진료과목별 내원경로의 기준 데이터",
    primaryDateField: "visited_at",
    dedupeKey: "visit_id",
    fields: [
      { key: "visit_id", label: "내원ID", type: "string", required: true, description: "내원 한 건을 식별하는 고유값", example: "V-20260712-001" },
      { key: "appointment_id", label: "예약ID", type: "string", required: false, description: "예약 데이터와 연결하는 키", example: "A-20260711-001" },
      { key: "patient_key", label: "환자가명키", type: "string", required: true, description: "신환/재진 구분과 재내원 분석에 사용", example: "P-8F31A" },
      { key: "visited_at", label: "내원일시", type: "datetime", required: true, description: "실제 방문 완료 일시", example: "2026-07-12 15:28" },
      { key: "visit_type", label: "내원구분", type: "enum", required: true, description: "신환 또는 재진 구분", allowedValues: visitTypeValues, example: "신환" },
      { key: "department", label: "내원 진료과목", type: "enum", required: true, description: "실제 내원한 진료과목", allowedValues: departmentValues, example: "교통사고" },
      { key: "treatment_type", label: "치료유형", type: "string", required: false, description: "세부 치료 또는 프로그램", example: "도수치료" },
      { key: "visit_source", label: "내원경로", type: "enum", required: true, description: "실제 내원 기준 유입경로", allowedValues: visitSourceValues, example: "카페(청라맘스)" },
    ],
  },
  {
    key: "payments",
    label: "매출/결제",
    purpose: "매출, 객단가, ROAS 계산의 기준 데이터",
    primaryDateField: "paid_at",
    dedupeKey: "payment_id",
    fields: [
      { key: "payment_id", label: "결제ID", type: "string", required: true, description: "결제 한 건을 식별하는 고유값", example: "PAY-20260712-001" },
      { key: "visit_id", label: "내원ID", type: "string", required: false, description: "내원 데이터와 연결하는 키", example: "V-20260712-001" },
      { key: "patient_key", label: "환자가명키", type: "string", required: false, description: "환자 단위 매출 분석이 필요할 때 사용", example: "P-8F31A" },
      { key: "paid_at", label: "결제일시", type: "datetime", required: true, description: "결제 완료 일시", example: "2026-07-12 16:10" },
      { key: "gross_amount", label: "총결제금액", type: "money", required: true, description: "환불 전 결제 금액", example: "350000" },
      { key: "refund_amount", label: "환불금액", type: "money", required: true, description: "환불 또는 취소 금액", example: "0" },
      { key: "net_amount", label: "순매출", type: "money", required: true, description: "총결제금액에서 환불금액을 뺀 금액", example: "350000" },
      { key: "department", label: "매출 진료과목", type: "enum", required: false, description: "진료과목별 매출 기여 분석용", allowedValues: departmentValues, example: "암면역" },
    ],
  },
  {
    key: "ad_spend",
    label: "광고비",
    purpose: "광고비, 노출, 클릭, CTR, CPC, 전환율, 획득비용, ROAS 계산의 기준 데이터",
    primaryDateField: "spend_date",
    dedupeKey: "spend_date+channel+campaign_id+ad_group_id",
    fields: [
      { key: "spend_date", label: "집행일", type: "date", required: true, description: "광고비가 집행된 날짜", example: "2026-07-11" },
      { key: "channel", label: "매체", type: "enum", required: true, description: "광고 또는 유입 매체", allowedValues: marketingChannelValues, example: "네이버 검색광고" },
      { key: "campaign_id", label: "캠페인ID", type: "string", required: false, description: "캠페인 단위 성과 분석용", example: "NAVER-ACCIDENT-01" },
      { key: "ad_group_id", label: "광고그룹ID", type: "string", required: false, description: "광고그룹 단위 성과 분석용", example: "ACCIDENT-KEYWORD-A" },
      { key: "creative_id", label: "소재ID", type: "string", required: false, description: "소재별 성과 분석용", example: "CREATIVE-07" },
      { key: "cost", label: "광고비", type: "money", required: true, description: "해당 날짜와 매체의 광고비", example: "280000" },
      { key: "impressions", label: "노출수", type: "number", required: false, description: "광고 노출 수", example: "18400" },
      { key: "clicks", label: "클릭수", type: "number", required: false, description: "광고 클릭 수", example: "742" },
      { key: "conversions", label: "광고 전환수", type: "number", required: false, description: "광고 플랫폼에서 집계한 전환 수. 비어 있으면 실제 내원 수를 전환으로 사용", example: "18" },
    ],
  },
];

export const importQualityRules = [
  "필수 컬럼이 비어 있으면 업로드를 중단하고 누락 위치를 표시한다.",
  "동일 dedupeKey가 반복되면 중복 후보로 분리하고 원본 행은 보존한다.",
  "날짜는 KST 기준으로 해석하고 기간 필터와 같은 기준을 사용한다.",
  "진료과목, 내원경로, 매체 값은 허용 목록에 매핑하고 매핑되지 않은 값은 기타 또는 확인필요로 분리한다.",
  "매출과 광고비는 음수 값을 허용하지 않으며 환불은 refund_amount로 분리한다.",
  "AI 요약 보고서에는 원본 개인정보 컬럼을 전달하지 않고 집계 KPI만 전달한다.",
] as const;

export function getImportTable(key: ImportTableKey) {
  return importTables.find((table) => table.key === key);
}

export function requiredFieldsFor(tableKey: ImportTableKey) {
  return getImportTable(tableKey)?.fields.filter((field) => field.required).map((field) => field.key) ?? [];
}
