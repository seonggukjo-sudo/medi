export type PeriodKey = "1일" | "최근 7일" | "최근 30일" | "지난달" | "이번달" | "직접입력";
export type MetricDeltaMode = "percent" | "point";
export type SectionName = "KPI 요약" | "상담·내원" | "마케팅 성과" | "AI 요약 보고서" | "데이터 업로드" | "설정";

export type MetricSummary = {
  value: number;
  delta: number;
  deltaMode: MetricDeltaMode;
  note: string;
};

export type SummaryMetrics = {
  inquiry: MetricSummary;
  reserve: MetricSummary;
  visit: MetricSummary;
  sales: MetricSummary;
  spend: MetricSummary;
  roas: MetricSummary;
};

export type InsightTrend = {
  label: string;
  inquiry: number;
  reserve: number;
  visit: number;
  sales: number;
};

export type PeriodDefinition = {
  compareLabel: string;
  dateRange: string;
  metrics: SummaryMetrics;
  insightTitle: string;
  insightCopy: string;
  trends: InsightTrend[];
};

export type DepartmentSummary = {
  name: string;
  inquiries: number;
  reservations: number;
  newVisits: number;
};

export type VisitRoute = {
  source: string;
  values: Record<string, number>;
};

export type MarketingChannelSummary = {
  name: string;
  type: string;
  spend: number;
  inquiries: number;
  reservations: number;
  visits: number;
  sales: number;
  roas: number;
  cpa: number;
  note: string;
  color: string;
};

export type TreatmentSummary = {
  department: string;
  newPatients: number;
  returningPatients: number;
  totalVisits: number;
  revenue: number;
  followUpRate: number;
  noShowRate: number;
};

export type AiReportBlock = {
  title: string;
  summary: string;
  evidence: string;
  priority: "높음" | "중간" | "관찰";
};

export const periodOrder: PeriodKey[] = ["1일", "최근 7일", "최근 30일", "지난달", "이번달", "직접입력"];

export const sections: SectionName[] = ["KPI 요약", "상담·내원", "마케팅 성과", "AI 요약 보고서"];

export const departments = ["교통사고", "수술후재활", "암면역", "다이어트", "성장", "기타"];

export const periodDefinitions: Record<PeriodKey, PeriodDefinition> = {
  "1일": {
    compareLabel: "전일 대비",
    dateRange: "2026.07.11",
    metrics: {
      inquiry: { value: 41, delta: 8.5, deltaMode: "percent", note: "유입 문의" },
      reserve: { value: 26, delta: 4.0, deltaMode: "percent", note: "문의 대비 예약" },
      visit: { value: 19, delta: 2.2, deltaMode: "percent", note: "예약 대비 내원" },
      sales: { value: 5_900_000, delta: 6.8, deltaMode: "percent", note: "전일 매출 비교" },
      spend: { value: 890_000, delta: -1.6, deltaMode: "percent", note: "전일 광고비 비교" },
      roas: { value: 663, delta: 18, deltaMode: "point", note: "광고 기여 매출 기준" },
    },
    insightTitle: "오늘은 문의 증가 대비 예약 전환이 안정적으로 유지되고 있습니다.",
    insightCopy: "오전 유입이 늘었고 오후 예약 확정률도 유지되었습니다.",
    trends: [
      { label: "09시", inquiry: 24, reserve: 16, visit: 11, sales: 21 },
      { label: "11시", inquiry: 31, reserve: 20, visit: 14, sales: 28 },
      { label: "13시", inquiry: 29, reserve: 18, visit: 13, sales: 24 },
      { label: "15시", inquiry: 34, reserve: 23, visit: 17, sales: 31 },
      { label: "17시", inquiry: 41, reserve: 26, visit: 19, sales: 38 },
    ],
  },
  "최근 7일": {
    compareLabel: "직전 7일 대비",
    dateRange: "2026.07.05 - 2026.07.11",
    metrics: {
      inquiry: { value: 284, delta: 12.4, deltaMode: "percent", note: "유입 문의" },
      reserve: { value: 176, delta: 7.9, deltaMode: "percent", note: "문의 대비 예약" },
      visit: { value: 139, delta: 6.3, deltaMode: "percent", note: "예약 대비 내원" },
      sales: { value: 42_800_000, delta: 9.8, deltaMode: "percent", note: "직전 7일 매출 비교" },
      spend: { value: 7_200_000, delta: 3.2, deltaMode: "percent", note: "직전 7일 광고비 비교" },
      roas: { value: 594, delta: 36, deltaMode: "point", note: "광고 기여 매출 기준" },
    },
    insightTitle: "최근 7일은 문의 증가가 실제 내원과 매출 증가로 이어진 구간입니다.",
    insightCopy: "네이버 검색과 카카오 유입이 문의 증가를 이끌었고 예약 확정률도 안정적입니다.",
    trends: [
      { label: "1일", inquiry: 48, reserve: 31, visit: 24, sales: 36 },
      { label: "2일", inquiry: 56, reserve: 36, visit: 28, sales: 40 },
      { label: "3일", inquiry: 51, reserve: 32, visit: 26, sales: 37 },
      { label: "4일", inquiry: 68, reserve: 41, visit: 33, sales: 45 },
      { label: "5일", inquiry: 72, reserve: 46, visit: 38, sales: 51 },
      { label: "6일", inquiry: 64, reserve: 39, visit: 31, sales: 43 },
      { label: "7일", inquiry: 82, reserve: 49, visit: 41, sales: 57 },
    ],
  },
  "최근 30일": {
    compareLabel: "직전 30일 대비",
    dateRange: "2026.06.12 - 2026.07.11",
    metrics: {
      inquiry: { value: 1_284, delta: 14.1, deltaMode: "percent", note: "유입 문의" },
      reserve: { value: 802, delta: 9.5, deltaMode: "percent", note: "문의 대비 예약" },
      visit: { value: 636, delta: 8.2, deltaMode: "percent", note: "예약 대비 내원" },
      sales: { value: 193_600_000, delta: 11.4, deltaMode: "percent", note: "직전 30일 매출 비교" },
      spend: { value: 32_500_000, delta: 5.1, deltaMode: "percent", note: "직전 30일 광고비 비교" },
      roas: { value: 596, delta: 28, deltaMode: "point", note: "광고 기여 매출 기준" },
    },
    insightTitle: "최근 30일은 광고비 증가보다 매출 증가폭이 더 큰 우상향 구간입니다.",
    insightCopy: "문의와 예약 볼륨이 모두 늘었고 채널 효율도 안정적으로 유지되었습니다.",
    trends: [
      { label: "1주", inquiry: 53, reserve: 34, visit: 25, sales: 33 },
      { label: "2주", inquiry: 61, reserve: 39, visit: 30, sales: 37 },
      { label: "3주", inquiry: 72, reserve: 46, visit: 35, sales: 43 },
      { label: "4주", inquiry: 83, reserve: 51, visit: 41, sales: 49 },
      { label: "5주", inquiry: 95, reserve: 60, visit: 47, sales: 56 },
    ],
  },
  "지난달": {
    compareLabel: "전전월 대비",
    dateRange: "2026.06.01 - 2026.06.30",
    metrics: {
      inquiry: { value: 1_038, delta: 4.2, deltaMode: "percent", note: "유입 문의" },
      reserve: { value: 668, delta: 3.6, deltaMode: "percent", note: "문의 대비 예약" },
      visit: { value: 516, delta: 2.9, deltaMode: "percent", note: "예약 대비 내원" },
      sales: { value: 157_500_000, delta: 4.7, deltaMode: "percent", note: "전전월 매출 비교" },
      spend: { value: 28_100_000, delta: 1.9, deltaMode: "percent", note: "전전월 광고비 비교" },
      roas: { value: 560, delta: 14, deltaMode: "point", note: "광고 기여 매출 기준" },
    },
    insightTitle: "지난달은 채널 효율을 유지하면서 예약 전환이 안정적으로 이어진 달입니다.",
    insightCopy: "문의량은 완만하게 증가했고 매출도 같이 상승했습니다.",
    trends: [
      { label: "1주", inquiry: 58, reserve: 36, visit: 28, sales: 35 },
      { label: "2주", inquiry: 63, reserve: 41, visit: 31, sales: 40 },
      { label: "3주", inquiry: 69, reserve: 45, visit: 34, sales: 44 },
      { label: "4주", inquiry: 74, reserve: 48, visit: 39, sales: 48 },
    ],
  },
  "이번달": {
    compareLabel: "지난달 동기간 대비",
    dateRange: "2026.07.01 - 2026.07.11",
    metrics: {
      inquiry: { value: 1_128, delta: 8.7, deltaMode: "percent", note: "유입 문의" },
      reserve: { value: 704, delta: 6.1, deltaMode: "percent", note: "문의 대비 예약" },
      visit: { value: 561, delta: 5.4, deltaMode: "percent", note: "예약 대비 내원" },
      sales: { value: 171_200_000, delta: 8.9, deltaMode: "percent", note: "지난달 동기간 매출 비교" },
      spend: { value: 29_400_000, delta: 3.8, deltaMode: "percent", note: "지난달 동기간 광고비 비교" },
      roas: { value: 582, delta: 22, deltaMode: "point", note: "광고 기여 매출 기준" },
    },
    insightTitle: "이번달은 문의와 예약이 함께 증가하며 월초 성과가 좋은 편입니다.",
    insightCopy: "성과가 채널 전반에서 고르게 올라오고 재방문 유입도 늘고 있습니다.",
    trends: [
      { label: "1주", inquiry: 62, reserve: 39, visit: 30, sales: 38 },
      { label: "2주", inquiry: 71, reserve: 45, visit: 36, sales: 45 },
      { label: "3주", inquiry: 84, reserve: 54, visit: 41, sales: 52 },
      { label: "4주", inquiry: 93, reserve: 59, visit: 46, sales: 58 },
    ],
  },
  "직접입력": {
    compareLabel: "직전 동일 기간 대비",
    dateRange: "2026.07.01 - 2026.07.11",
    metrics: {
      inquiry: { value: 428, delta: 10.2, deltaMode: "percent", note: "유입 문의" },
      reserve: { value: 261, delta: 7.4, deltaMode: "percent", note: "문의 대비 예약" },
      visit: { value: 207, delta: 4.9, deltaMode: "percent", note: "예약 대비 내원" },
      sales: { value: 63_500_000, delta: 8.1, deltaMode: "percent", note: "직전 동일 기간 매출 비교" },
      spend: { value: 10_200_000, delta: 2.6, deltaMode: "percent", note: "직전 동일 기간 광고비 비교" },
      roas: { value: 623, delta: 31, deltaMode: "point", note: "광고 기여 매출 기준" },
    },
    insightTitle: "직접 선택한 구간에서도 문의 대비 예약 효율은 안정적인 흐름입니다.",
    insightCopy: "캠페인 영향이 섞여 있어 채널별 성과 차이가 더 분명하게 보입니다.",
    trends: [
      { label: "1구간", inquiry: 49, reserve: 31, visit: 23, sales: 31 },
      { label: "2구간", inquiry: 58, reserve: 35, visit: 28, sales: 37 },
      { label: "3구간", inquiry: 65, reserve: 41, visit: 33, sales: 42 },
      { label: "4구간", inquiry: 72, reserve: 46, visit: 37, sales: 49 },
    ],
  },
};

export const departmentSummaries: DepartmentSummary[] = [
  { name: "교통사고", inquiries: 96, reservations: 63, newVisits: 42 },
  { name: "수술후재활", inquiries: 58, reservations: 36, newVisits: 24 },
  { name: "암면역", inquiries: 44, reservations: 27, newVisits: 18 },
  { name: "다이어트", inquiries: 39, reservations: 21, newVisits: 13 },
  { name: "성장", inquiries: 28, reservations: 19, newVisits: 12 },
  { name: "기타", inquiries: 19, reservations: 10, newVisits: 7 },
];

export const visitRoutes: VisitRoute[] = [
  { source: "네이버검색", values: { 교통사고: 18, 수술후재활: 9, 암면역: 6, 다이어트: 7, 성장: 5, 기타: 3 } },
  { source: "다음검색", values: { 교통사고: 4, 수술후재활: 3, 암면역: 2, 다이어트: 2, 성장: 1, 기타: 1 } },
  { source: "구글검색", values: { 교통사고: 3, 수술후재활: 4, 암면역: 5, 다이어트: 2, 성장: 2, 기타: 1 } },
  { source: "카페(청라맘스)", values: { 교통사고: 5, 수술후재활: 3, 암면역: 1, 다이어트: 4, 성장: 2, 기타: 1 } },
  { source: "카페(검단맘블리)", values: { 교통사고: 4, 수술후재활: 2, 암면역: 1, 다이어트: 3, 성장: 2, 기타: 1 } },
  { source: "소개/추천", values: { 교통사고: 6, 수술후재활: 2, 암면역: 2, 다이어트: 1, 성장: 0, 기타: 0 } },
  { source: "워크인", values: { 교통사고: 1, 수술후재활: 1, 암면역: 0, 다이어트: 1, 성장: 0, 기타: 1 } },
  { source: "기타", values: { 교통사고: 1, 수술후재활: 0, 암면역: 1, 다이어트: 0, 성장: 0, 기타: 0 } },
];

export const marketingChannels: MarketingChannelSummary[] = [
  { name: "네이버 검색광고", type: "검색", spend: 2_800_000, inquiries: 112, reservations: 73, visits: 61, sales: 19_200_000, roas: 686, cpa: 25_000, note: "문의와 내원 모두 가장 큰 주력 매체", color: "teal" },
  { name: "카카오 채널", type: "메신저", spend: 1_650_000, inquiries: 72, reservations: 46, visits: 38, sales: 10_400_000, roas: 630, cpa: 22_900, note: "예약 전환이 안정적인 보조 주력 매체", color: "blue" },
  { name: "메타 광고", type: "SNS", spend: 1_420_000, inquiries: 58, reservations: 31, visits: 22, sales: 5_900_000, roas: 415, cpa: 24_500, note: "문의는 만들지만 내원 전환 관리 필요", color: "orange" },
  { name: "네이버 플레이스", type: "로컬", spend: 960_000, inquiries: 31, reservations: 22, visits: 18, sales: 4_700_000, roas: 490, cpa: 31_000, note: "근거리 환자 유입 효율 확인 필요", color: "sand" },
  { name: "지역 카페", type: "커뮤니티", spend: 620_000, inquiries: 26, reservations: 15, visits: 10, sales: 2_800_000, roas: 452, cpa: 23_800, note: "다이어트·성장 문의 품질 분리 필요", color: "slate" },
  { name: "소개/추천", type: "오가닉", spend: 120_000, inquiries: 18, reservations: 14, visits: 12, sales: 3_600_000, roas: 3000, cpa: 6_700, note: "비용 대비 효율이 가장 높은 유입", color: "green" },
];

export const treatmentSummaries: TreatmentSummary[] = [
  { department: "교통사고", newPatients: 42, returningPatients: 96, totalVisits: 138, revenue: 38_400_000, followUpRate: 72.5, noShowRate: 8.4 },
  { department: "수술후재활", newPatients: 24, returningPatients: 74, totalVisits: 98, revenue: 29_100_000, followUpRate: 76.8, noShowRate: 6.1 },
  { department: "암면역", newPatients: 18, returningPatients: 61, totalVisits: 79, revenue: 34_700_000, followUpRate: 81.2, noShowRate: 4.8 },
  { department: "다이어트", newPatients: 13, returningPatients: 35, totalVisits: 48, revenue: 12_600_000, followUpRate: 58.4, noShowRate: 12.9 },
  { department: "성장", newPatients: 12, returningPatients: 31, totalVisits: 43, revenue: 9_800_000, followUpRate: 69.1, noShowRate: 7.6 },
  { department: "기타", newPatients: 7, returningPatients: 18, totalVisits: 25, revenue: 4_600_000, followUpRate: 52.0, noShowRate: 10.4 },
];

export const aiReportBlocks: AiReportBlock[] = [
  { title: "문의 증가가 내원 증가로 연결", summary: "최근 7일 문의는 직전 기간 대비 12.4% 증가했고, 내원도 6.3% 증가했습니다.", evidence: "문의 284건, 예약 176건, 내원 139건", priority: "높음" },
  { title: "네이버 검색광고는 유지 또는 소폭 확대", summary: "네이버 검색광고는 내원 61명, ROAS 686%로 볼륨과 효율이 모두 높습니다.", evidence: "광고비 280만원, 매출 1,920만원", priority: "높음" },
  { title: "메타 광고는 전환 구간 점검", summary: "문의는 발생하지만 내원 전환이 상대적으로 낮습니다.", evidence: "문의 58건, 내원 22명, ROAS 415%", priority: "중간" },
  { title: "다이어트와 성장 과목은 지역 커뮤니티 분리 분석", summary: "카페별 문의 품질과 실제 내원 연결을 분리해 보면 예산 판단이 쉬워집니다.", evidence: "카페 유입 내원 29명", priority: "관찰" },
];

export function rate(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function formatMoney(value: number) {
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`;
}

export function formatMetric(label: string, value: number) {
  if (label === "매출" || label === "광고비") return formatMoney(value);
  if (label === "ROAS") return `${value}%`;
  return value.toLocaleString("ko-KR");
}

export function formatDelta(delta: number, mode: MetricDeltaMode) {
  const sign = delta > 0 ? "+" : "";
  return mode === "point" ? `${sign}${delta}%p` : `${sign}${delta}%`;
}
