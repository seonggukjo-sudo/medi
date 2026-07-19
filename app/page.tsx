"use client";

import { startTransition, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { validateImportRows, type ImportRow } from "@/lib/import-validator";
import { calculateImportedKpis, type ImportedDashboardRows, type ImportedKpiResult } from "@/lib/kpi-calculator";
import { importTables, type ImportFieldType, type ImportTableKey } from "@/lib/data-import-contract";

type MenuKey = "kpi" | "consult" | "ads" | "ga4" | "data" | "settings" | "mypage";
type PeriodOption = "1일" | "최근 7일" | "최근 30일" | "지난달" | "이번달" | "직접입력";
type CompareOption = "직전 동일 기간" | "전주 동일 기간" | "전월 동일 기간";

type Tone = "green" | "violet" | "orange" | "blue";

type MetricCard = {
  label: string;
  value: string;
  delta: string;
  previous: string;
  icon: string;
  tone: Tone;
  goalText?: string;
  goalPassed?: boolean | null;
};

function metricDescription(label: string) {
  if (label.includes("문의")) return "고객이 남긴 상담·문의 건수입니다.";
  if (label.includes("예약")) return "상담 후 확정된 예약 건수입니다.";
  if (label.includes("내원")) return "실제로 방문을 완료한 환자 수입니다.";
  if (label.includes("광고비")) return "선택한 기간에 사용한 광고비입니다.";
  if (label.includes("매출")) return "결제와 환불을 반영한 순매출입니다.";
  if (label.includes("ROAS")) return "광고비 대비 발생한 매출의 비율입니다.";
  if (label.includes("정상")) return "검수 후 대시보드에 반영된 데이터 비율입니다.";
  if (label.includes("검수")) return "아직 확인이 필요한 업로드 데이터입니다.";
  if (label.includes("오류")) return "필수값이나 형식 오류가 발견된 데이터입니다.";
  if (label.includes("업로드")) return "오늘 새로 등록된 데이터 파일 수입니다.";
  if (label.includes("노출")) return "광고가 사용자 화면에 노출된 횟수입니다.";
  if (label.includes("클릭")) return "광고를 클릭한 횟수입니다.";
  if (label.includes("전환")) return "광고를 통해 목표 행동으로 이어진 횟수입니다.";
  if (label.includes("CTR")) return "노출 중 클릭으로 이어진 비율입니다.";
  if (label.includes("CPC")) return "광고 클릭 1회에 사용한 평균 비용입니다.";
  return "선택한 기간의 핵심 운영 지표입니다.";
}

type ReferralRow = {
  name: string;
  visit: string;
  share: string;
};

type UploadRow = {
  name: string;
  type: string;
  dataset?: string;
  periodStart?: string;
  periodEnd?: string;
  status: string;
  updated: string;
  uploadedBy?: string;
  rowCount?: number;
  errorCount?: number;
  warningCount?: number;
};

type DailyDataRow = {
  date: string;
  inquiries: number;
  reservations: number;
  visits: number;
  sales: number;
  adSpend: number;
};

type Ga4ApiData = {
  configured: boolean;
  source: "ga4";
  warnings?: string[];
  range: { start: string; end: string };
  summary: {
    sessions: number;
    activeUsers: number;
    engagedSessions: number;
    engagementRate: number;
    keyEvents: number;
    conversionRate: number;
    newUsers: number;
    returningUsers: number;
    utmMissingSessions: number;
    pageViews: number;
    averageSessionDuration: number;
    eventCount: number;
  };
  channels: Array<{ channel: string; sessions: number; users: number; engaged: number; conversions: number; rate: number }>;
  landingPages: Array<{ page: string; sessions: number; users: number; engagement: number; keyEvents: number }>;
  landingConversions: Array<{ page: string; event: string; count: number; users: number; keyEvents: number }>;
  events: Array<{ event: string; count: number; users: number; keyEvent: string }>;
  devices: Array<{ device: string; users: number; sessions: number; share: number; conversionRate: number }>;
};

type NaverSearchAdData = {
  configured: boolean;
  source: "naver-search-ads";
  range: { start: string; end: string };
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    conversionRate: number;
    conversionCost: number;
  };
  groups: Array<{
    id: string;
    name: string;
    status: string;
    campaignCount: number;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    conversions: number;
    conversionRate: number;
    conversionCost: number;
  }>;
  place: {
    id: string;
    name: string;
    status: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    conversions: number;
    conversionRate: number;
    conversionCost: number;
  };
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    conversions: number;
    conversionRate: number;
    conversionCost: number;
  }>;
  daily: {
    search: NaverAdDailyRow[];
    place: NaverAdDailyRow[];
  };
  syncedAt: string;
};

type NaverAdDailyRow = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionRate: number;
  conversionCost: number;
};

type PlaceRankSnapshot = {
  keywordId: string;
  date: string;
  rank: number | null;
  outsideTop100: boolean;
  status: "measured" | "manual" | "failed";
  source: "authorized-provider" | "manual";
  checkedAt: string;
  trigger?: "scheduled" | "manual";
  message?: string;
};

type PlaceRankKeyword = {
  id: string;
  keyword: string;
  placeUrl: string;
  placeId: string;
  active: boolean;
  createdAt: string;
  providerSlotId?: string;
};

type PlaceRankData = {
  keywords: PlaceRankKeyword[];
  snapshots: PlaceRankSnapshot[];
  range: { start: string; end: string };
  providerConfigured: boolean;
  provider: "rankfree" | "apify" | null;
  collectionRule: "daily-09:00";
  scheduledTime: string;
  collectionAvailable: boolean;
  maxRank: number;
  excludesSponsored: boolean;
  syncedAt: string;
  scheduledImported: number;
  trackingSync?: {
    imported: number;
    matchedSlots: number;
    slotCount: number;
    error?: string;
  };
};

type RankfreeInsights = {
  connected: boolean;
  source?: "rankfree";
  sourceNote?: string;
  keywordStatus: "available" | "scope-required" | "unlinked" | "error";
  keywordScope?: "keyword" | "keyword_detail" | null;
  keywordData?: {
    keyword: string;
    monthlyPc: number;
    monthlyMobile: number;
    monthlyTotal: number;
    competition: string;
    related: Array<{ keyword: string; monthlyTotal: number }>;
    monthly: Array<{ label: string; pc: number; mobile: number; total: number }>;
  } | null;
  keywordMessage?: string;
  competitionStatus: "available" | "scope-required" | "not-analyzed" | "unlinked" | "error";
  competition?: { slotId: string; rank: number | null; n1: number | null; n2: number | null; n3: number | null; analyzedAt: string } | null;
  competitionMessage?: string;
  rateLimit?: number | null;
  rateRemaining?: number | null;
  syncedAt?: string;
};

type NaverTrendMetricKey = "impressions" | "clicks" | "spend" | "cpc" | "ctr" | "conversions";

const menuGroups: Array<{
  title: string;
  items: Array<{ key: MenuKey; label: string }>;
}> = [
  {
    title: "대시보드",
    items: [
      { key: "kpi", label: "KPI 요약" },
      { key: "consult", label: "상담 · 내원" },
      { key: "ads", label: "광고 채널" },
      { key: "ga4", label: "GA4 분석" },
    ],
  },
  {
    title: "관리",
    items: [
      { key: "data", label: "데이터 관리" },
      { key: "settings", label: "설정" },
    ],
  },
  {
    title: "계정",
    items: [{ key: "mypage", label: "마이페이지" }],
  },
];

const pageMeta: Record<
  MenuKey,
  { title: string; subtitle: string; primaryAction: string }
> = {
  kpi: {
    title: "KPI 요약",
    subtitle: "상담부터 내원, 매출, 광고비까지 핵심 흐름을 한 번에 확인합니다.",
    primaryAction: "",
  },
  consult: {
    title: "상담 · 내원",
    subtitle: "전화문의, 예약, 신환내원과 진료과목별 흐름을 함께 봅니다.",
    primaryAction: "",
  },
  ads: {
    title: "광고 채널",
    subtitle: "각 매체의 성과, 효율성, 광고비 비중과 추이를 한 화면에서 확인합니다.",
    primaryAction: "",
  },
  ga4: {
    title: "GA4 분석",
    subtitle: "웹사이트 유입, 행동, 전환을 자동 분석하고 AI 실행 제안을 확인합니다.",
    primaryAction: "",
  },
  data: {
    title: "데이터 관리",
    subtitle: "업로드, 검수, 연동 상태를 정리하고 운영 데이터를 안정적으로 관리합니다.",
    primaryAction: "+ 업로드",
  },
  settings: {
    title: "설정",
    subtitle: "병원 정보, 표시 기준, 알림, 권한을 관리합니다.",
    primaryAction: "",
  },
  mypage: {
    title: "마이페이지",
    subtitle: "내 계정과 로그인 환경을 확인하고 관리합니다.",
    primaryAction: "",
  },
};

const templatePageGroups = [
  { page: "KPI 요약", tables: "상담/문의 · 예약 · 내원 · 매출/결제 · 광고비", output: "문의, 예약, 신환, 매출, 광고 효율" },
  { page: "상담 · 내원", tables: "상담/문의 · 예약 · 내원", output: "전화/온라인 문의, 예약률, 신환 내원, 노쇼" },
  { page: "광고 채널", tables: "광고비 + 상담/문의 · 예약 · 내원 · 매출/결제", output: "노출, 클릭, CTR, CPC, 전환, CPA, ROAS" },
] as const;

const importFieldTypeLabels: Record<ImportFieldType, string> = {
  string: "텍스트",
  date: "날짜",
  datetime: "날짜·시간",
  number: "숫자",
  money: "금액",
  enum: "선택값",
};

type UserAccessRow = {
  email: string;
  name: string;
  organization: string;
  role: "최고관리자" | "병원 관리자" | "마케팅" | "상담" | "조회 전용";
  recentAccess: string;
};

type KpiTargetRow = {
  metric: string;
  hospital: string;
  department: string;
  channel: string;
};

const initialUsers: UserAccessRow[] = [
  { email: "admin@hospital.local", name: "김관리", organization: "서울 본원", role: "최고관리자", recentAccess: "접속 기록 없음" },
];

type DataQuality = {
  connected: boolean;
  totals: { inquiries: number; reservations: number; visits: number; sales: number; adSpend: number };
  daily: DailyDataRow[];
  overrides?: Array<DailyDataRow & { updatedAt?: string; updatedBy?: string }>;
  overrideHistory?: Array<DailyDataRow & { updatedAt?: string; updatedBy?: string; reason?: string }>;
  uploadSummary: { total: number; validated: number; review: number; errors: number };
  warnings: { missingLinks: number; duplicates: number };
  uploads: Array<{ batchId: string; uploadedAt: string; uploadedBy?: string; status: string; rowCount: number; errorCount: number; warningCount: number; fileName?: string; tableKey?: ImportTableKey; periodStart?: string; periodEnd?: string }>;
  reconciliation: Array<{ metric: string; total: number; detailTotal: number; passed: boolean }>;
};

type SettingsHistoryRow = {
  userId: string;
  action: string;
  targetId?: string;
  createdAt: string;
  metadata?: { userCount?: number; ownerCount?: number; email?: string; name?: string; beforeRole?: string | null; afterRole?: string | null; metric?: string; beforeValue?: string; afterValue?: string; detail?: string };
};

const settingsActionLabels: Record<string, string> = {
  settings_saved: "설정 저장",
  user_added: "사용자 추가",
  user_removed: "사용자 삭제",
  user_role_changed: "권한 변경",
  user_profile_changed: "사용자 정보 변경",
  kpi_target_changed: "KPI 목표 변경",
  ai_settings_changed: "AI 분석 기준 변경",
};

const initialKpiTargets: KpiTargetRow[] = [
  { metric: "예약률", hospital: "18%", department: "교통사고 20%", channel: "네이버 19%" },
  { metric: "예약→내원율", hospital: "80%", department: "재활 82%", channel: "플레이스 81%" },
  { metric: "문의→내원율", hospital: "14%", department: "다이어트 16%", channel: "카카오 13%" },
  { metric: "CPL", hospital: "25,000원", department: "교통사고 22,000원", channel: "네이버 23,000원" },
  { metric: "예약 CPA", hospital: "40,000원", department: "재활 38,000원", channel: "플레이스 36,000원" },
  { metric: "내원 CPA", hospital: "60,000원", department: "다이어트 58,000원", channel: "네이버 55,000원" },
  { metric: "ROAS", hospital: "550%", department: "암면역 600%", channel: "네이버 620%" },
  { metric: "노쇼율", hospital: "12% 이하", department: "재활 10% 이하", channel: "전체 동일" },
];

const kpiCards: MetricCard[] = [
  { label: "전체 문의", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "green" },
  { label: "예약", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "violet" },
  { label: "내원", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "orange" },
  { label: "광고비", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "blue" },
  { label: "매출", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "green" },
  { label: "ROAS", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "violet" },
];

const consultCards: MetricCard[] = [
  { label: "전체 문의", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "green" },
  { label: "전체 예약", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "violet" },
  { label: "예약률", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "orange" },
  { label: "신환수", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "blue" },
];

const adCards: MetricCard[] = [
  { label: "총 광고비", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "green" },
  { label: "노출", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "blue" },
  { label: "클릭", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "violet" },
  { label: "CTR", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "orange" },
  { label: "CPC", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "blue" },
  { label: "전환", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "green" },
  { label: "전환율", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "violet" },
  { label: "ROAS", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "orange" },
];

const adChannelShare = [
  { label: "네이버 검색", value: 41.2, color: "#2ec4a8", amount: "324만원" },
  { label: "네이버 플레이스", value: 18.3, color: "#4b80f7", amount: "144만원" },
  { label: "카카오", value: 15.3, color: "#f7b23b", amount: "120만원" },
  { label: "홈페이지", value: 12.5, color: "#d95d9f", amount: "98만원" },
  { label: "기타(SNS/배너)", value: 12.7, color: "#8e63d6", amount: "100만원" },
];

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatPlaceRankCheckedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "측정 시각 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRankMovement(delta: number | null) {
  if (delta === null) return "비교 기록 없음";
  if (delta > 0) return `${delta}계단 상승`;
  if (delta < 0) return `${Math.abs(delta)}계단 하락`;
  return "순위 동일";
}

function shiftIsoDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return formatIsoDate(value);
}

function shiftIsoMonth(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return formatIsoDate(target);
}

function currentSeoulDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dynamicPeriodRange(option: Exclude<PeriodOption, "직접입력">) {
  const today = currentSeoulDate();
  const [year, month] = today.split("-").map(Number);
  const thisMonthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const previousMonthEnd = shiftIsoDate(thisMonthStart, -1);
  const previousMonthStart = `${previousMonthEnd.slice(0, 7)}-01`;
  const ranges: Record<Exclude<PeriodOption, "직접입력">, { start: string; end: string }> = {
    "1일": { start: today, end: today },
    "최근 7일": { start: shiftIsoDate(today, -6), end: today },
    "최근 30일": { start: shiftIsoDate(today, -29), end: today },
    "지난달": { start: previousMonthStart, end: previousMonthEnd },
    "이번달": { start: thisMonthStart, end: today },
  };
  return ranges[option];
}

function displayDateRange(start: string, end: string) {
  const format = (value: string) => value.replaceAll("-", ".");
  return start === end ? format(start) : `${format(start)} ~ ${format(end)}`;
}

const periodOptionDefinitions: Array<{ label: PeriodOption; range: string; compare: string }> = [
  { label: "1일", range: displayDateRange(dynamicPeriodRange("1일").start, dynamicPeriodRange("1일").end), compare: "vs 전일" },
  { label: "최근 7일", range: displayDateRange(dynamicPeriodRange("최근 7일").start, dynamicPeriodRange("최근 7일").end), compare: "vs 이전 7일" },
  { label: "최근 30일", range: displayDateRange(dynamicPeriodRange("최근 30일").start, dynamicPeriodRange("최근 30일").end), compare: "vs 이전 30일" },
  { label: "지난달", range: displayDateRange(dynamicPeriodRange("지난달").start, dynamicPeriodRange("지난달").end), compare: "vs 전월" },
  { label: "이번달", range: displayDateRange(dynamicPeriodRange("이번달").start, dynamicPeriodRange("이번달").end), compare: "vs 전월 동기간" },
  { label: "직접입력", range: "기간을 선택하세요", compare: "이전 동일 기간" },
];

const compareOptions: CompareOption[] = ["직전 동일 기간", "전주 동일 기간", "전월 동일 기간"];

function resolveComparisonDateRange(range: { start: string; end: string }, option: CompareOption) {
  if (option === "전주 동일 기간") return { start: shiftIsoDate(range.start, -7), end: shiftIsoDate(range.end, -7) };
  if (option === "전월 동일 기간") return { start: shiftIsoMonth(range.start, -1), end: shiftIsoMonth(range.end, -1) };
  const days = daysBetween(range.start, range.end);
  const end = shiftIsoDate(range.start, -1);
  return { start: shiftIsoDate(end, -(days - 1)), end };
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCsvRows(csv: string): ImportRow[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function emptyImportedRows(): ImportedDashboardRows {
  return { leads: [], appointments: [], visits: [], payments: [], adSpend: [] };
}

function aggregateDailyData(rows: ImportedDashboardRows): DailyDataRow[] {
  const grouped = new Map<string, DailyDataRow>();
  const get = (dateValue: unknown) => String(dateValue ?? "").slice(0, 10);
  const numberValue = (value: unknown) => Number(String(value ?? "").replaceAll(",", "")) || 0;
  const ensure = (date: string) => {
    if (!date) return null;
    const current = grouped.get(date) ?? { date, inquiries: 0, reservations: 0, visits: 0, sales: 0, adSpend: 0 };
    grouped.set(date, current);
    return current;
  };

  rows.leads.forEach((row) => { const current = ensure(get(row.created_at)); if (current) current.inquiries += 1; });
  rows.appointments.forEach((row) => { const current = ensure(get(row.booked_at)); if (current) current.reservations += 1; });
  rows.visits.forEach((row) => { const current = ensure(get(row.visited_at)); if (current) current.visits += 1; });
  rows.payments.forEach((row) => { const current = ensure(get(row.paid_at)); if (current) current.sales += numberValue(row.net_amount); });
  rows.adSpend.forEach((row) => { const current = ensure(get(row.spend_date)); if (current) current.adSpend += numberValue(row.cost); });

  return [...grouped.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function formatImportedMoney(value: number) {
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`;
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return 1;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
}

function chartDateTicks(rows: Array<{ date: string }>, maxLabels = 7) {
  if (rows.length === 0) return [];
  const step = Math.max(1, Math.ceil(rows.length / maxLabels));
  return rows
    .map((row, index) => ({ label: row.date.slice(5).replace("-", "."), index }))
    .filter((_, index) => index % step === 0 || index === rows.length - 1);
}

function resolvePeriodDateRange(option: PeriodOption, customStart: string, customEnd: string) {
  if (option === "직접입력") return { start: customStart, end: customEnd };
  return dynamicPeriodRange(option);
}

function filterRowsByDate(rows: ImportRow[], key: string, start: string, end: string) {
  return rows.filter((row) => {
    const date = String(row[key] ?? "").slice(0, 10);
    return date >= start && date <= end;
  });
}

function scaleMetricValue(value: string, label: string, ratio: number) {
  const shouldScale = ["문의", "예약", "내원", "신환", "광고비", "매출", "노출", "클릭", "전환", "업로드"].some((keyword) => label.includes(keyword));
  if (!shouldScale || value === "-" || value.includes("업로드")) return value;
  const match = value.match(/^([\d,]+)(.*)$/);
  if (!match) return value;
  return `${Math.max(0, Math.round(Number(match[1].replaceAll(",", "")) * ratio)).toLocaleString("ko-KR")}${match[2]}`;
}

function pathFromSeries(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : padding + (innerWidth / (values.length - 1)) * index;
      const normalized = (value - min) / range;
      const y = padding + innerHeight - normalized * innerHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function pointsFromSeries(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : padding + (innerWidth / (values.length - 1)) * index;
    const normalized = (value - min) / range;
    const y = padding + innerHeight - normalized * innerHeight;
    return { x, y };
  });
}

function pearsonCorrelation(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 3) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0);
  const leftVariance = left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0);
  const rightVariance = right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0);
  const denominator = Math.sqrt(leftVariance * rightVariance);
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}

function donutGradient(items: Array<{ value: number; color: string }>) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  let current = 0;

  return `conic-gradient(${items
    .map((item) => {
      const start = current;
      current += (item.value / total) * 100;
      return `${item.color} ${start}% ${current}%`;
    })
    .join(", ")})`;
}

function Sparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const path = useMemo(() => pathFromSeries(values, 140, 48, 6), [values]);
  const points = useMemo(() => pointsFromSeries(values, 140, 48, 6), [values]);

  return (
    <svg viewBox="0 0 140 48" className="sparkline" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="2.8" fill={color} stroke="#fff" strokeWidth="2" />
      ))}
    </svg>
  );
}

function MetricCardView({ card, onClick }: { card: MetricCard; onClick?: () => void }) {
  const isDown = card.delta.startsWith("-");
  return (
    <article className={`kpi-card ${onClick ? "kpi-card-clickable" : ""}`} onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) onClick(); }} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      <h3>{card.label}</h3>
      <strong>{card.value}</strong>
      <span className={isDown ? "delta down" : "delta up"}>{isDown ? "↘" : "↗"} {card.delta}</span>
      <small>{card.previous}</small>
      {card.goalText ? <small className={`metric-goal ${card.goalPassed === null ? "pending" : card.goalPassed ? "pass" : "fail"}`}>{card.goalText}</small> : null}
    </article>
  );
}

function ChartHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      {right}
    </div>
  );
}

function EvidenceLabel({ range, compare, status }: { range: string; compare: string; status: string }) {
  return (
    <div className="common-period-strip" role="status">
      <span className="period-strip-item"><b>집계 기간</b>{range}</span>
      <span className="period-strip-item"><b>비교 기간</b>{compare}</span>
      <span className={`period-strip-status ${status === "정상 연동" ? "good" : status === "부분 연동" ? "partial" : "empty"}`}><i />{status}</span>
    </div>
  );
}

function MiniTrendCard({
  title,
  value,
  delta,
  values,
  color,
}: {
  title: string;
  value: string;
  delta: string;
  values: number[];
  color: string;
}) {
  return (
    <article className="summary-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <b className={delta.startsWith("-") ? "down" : "up"}>{delta}</b>
      <Sparkline values={values} color={color} />
    </article>
  );
}

const naverTrendMetricOptions: Array<{ key: NaverTrendMetricKey; label: string; color: string }> = [
  { key: "impressions", label: "노출수", color: "#f0442e" },
  { key: "clicks", label: "클릭수", color: "#3d74e7" },
  { key: "spend", label: "광고비", color: "#13a47b" },
  { key: "cpc", label: "평균 CPC", color: "#f39200" },
  { key: "ctr", label: "CTR", color: "#8a64df" },
  { key: "conversions", label: "전환수", color: "#d0528f" },
];

function formatTrendAxisValue(value: number, metric: NaverTrendMetricKey) {
  if (metric === "ctr") return `${Math.round(value * 10) / 10}%`;
  if (metric === "spend" || metric === "cpc") return value >= 10_000 ? `${Math.round(value / 10_000)}만` : Math.round(value).toLocaleString("ko-KR");
  return Math.round(value).toLocaleString("ko-KR");
}

function NaverAdTrendChart({
  title,
  range,
  rows,
  primaryMetric,
  secondaryMetric,
  onPrimaryMetricChange,
  onSecondaryMetricChange,
}: {
  title: string;
  range: string;
  rows: NaverAdDailyRow[];
  primaryMetric: NaverTrendMetricKey;
  secondaryMetric: NaverTrendMetricKey;
  onPrimaryMetricChange: (metric: NaverTrendMetricKey) => void;
  onSecondaryMetricChange: (metric: NaverTrendMetricKey) => void;
}) {
  const primary = naverTrendMetricOptions.find((option) => option.key === primaryMetric) ?? naverTrendMetricOptions[0];
  const secondary = naverTrendMetricOptions.find((option) => option.key === secondaryMetric) ?? naverTrendMetricOptions[3];
  const primaryMax = Math.max(1, ...rows.map((row) => row[primaryMetric]));
  const secondaryMax = Math.max(1, ...rows.map((row) => row[secondaryMetric]));
  const x = (index: number) => rows.length <= 1 ? 300 : 58 + (index / (rows.length - 1)) * 484;
  const y = (value: number, max: number) => 182 - (value / max) * 142;
  const points = (metric: NaverTrendMetricKey, max: number) => rows.map((row, index) => `${x(index)},${y(row[metric], max)}`).join(" ");
  const tickStep = Math.max(1, Math.ceil(rows.length / 7));

  return (
    <div className="naver-trend-card">
      <div className="naver-trend-head">
        <div><h3>{title}</h3><p>{range} 일자별 실데이터 추이</p></div>
        <div className="naver-trend-selectors">
          <label style={{ "--metric-color": primary.color } as CSSProperties}><span>{primary.label}</span><select value={primaryMetric} onChange={(event) => onPrimaryMetricChange(event.target.value as NaverTrendMetricKey)}>{naverTrendMetricOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          <label style={{ "--metric-color": secondary.color } as CSSProperties}><span>{secondary.label}</span><select value={secondaryMetric} onChange={(event) => onSecondaryMetricChange(event.target.value as NaverTrendMetricKey)}>{naverTrendMetricOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
        </div>
      </div>
      {rows.length > 0 ? (
        <svg className="naver-trend-chart" viewBox="0 0 600 225" role="img" aria-label={`${title} ${primary.label} 및 ${secondary.label} 추이`}>
          {[0, 1, 2, 3].map((tick) => {
            const chartY = 40 + tick * (142 / 3);
            return <g key={tick}><line x1="58" x2="542" y1={chartY} y2={chartY} className="naver-trend-grid-line" /><text x="50" y={chartY + 4} textAnchor="end" className="naver-trend-axis">{formatTrendAxisValue(primaryMax * (1 - tick / 3), primaryMetric)}</text><text x="550" y={chartY + 4} className="naver-trend-axis">{formatTrendAxisValue(secondaryMax * (1 - tick / 3), secondaryMetric)}</text></g>;
          })}
          <polyline points={points(primaryMetric, primaryMax)} fill="none" stroke={primary.color} className="naver-trend-series" />
          <polyline points={points(secondaryMetric, secondaryMax)} fill="none" stroke={secondary.color} className="naver-trend-series" />
          {rows.map((row, index) => <g key={row.date}><circle cx={x(index)} cy={y(row[primaryMetric], primaryMax)} r="3.5" fill={primary.color} /><circle cx={x(index)} cy={y(row[secondaryMetric], secondaryMax)} r="3.5" fill={secondary.color} />{(index % tickStep === 0 || index === rows.length - 1) ? <text x={x(index)} y="207" textAnchor="middle" className="naver-trend-date">{`${Number(row.date.slice(5, 7))}.${Number(row.date.slice(8, 10))}.`}</text> : null}</g>)}
        </svg>
      ) : <div className="naver-trend-empty">선택 기간의 일자별 광고 데이터가 없습니다.</div>}
    </div>
  );
}

export default function Home() {
  const [isClientReady, setIsClientReady] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("kpi");
  const [pendingMenu, setPendingMenu] = useState<MenuKey | null>(null);
  const [customStartDate, setCustomStartDate] = useState(() => dynamicPeriodRange("최근 7일").start);
  const [customEndDate, setCustomEndDate] = useState(() => dynamicPeriodRange("최근 7일").end);
  const [period, setPeriod] = useState<PeriodOption>("최근 7일");
  const [compareOption, setCompareOption] = useState<CompareOption>("직전 동일 기간");
  const [hospitalName, setHospitalName] = useState("메디인사이트");
  const [hospitalLocation, setHospitalLocation] = useState("서울 본원");
  const [settingsLocale, setSettingsLocale] = useState("한국어");
  const [settingsPeriod, setSettingsPeriod] = useState<PeriodOption>("최근 7일");
  const [settingsCompare, setSettingsCompare] = useState<CompareOption>("직전 동일 기간");
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [users, setUsers] = useState<UserAccessRow[]>(initialUsers);
  const [kpiTargets, setKpiTargets] = useState<KpiTargetRow[]>(initialKpiTargets);
  const [aiSettings, setAiSettings] = useState({
    enabled: true,
    frequency: "매일 오전 9시",
    compare: "전주 동일기간",
    anomaly: "10% 이상",
    recommendation: "핵심 3개",
  });
  const [ga4Automation, setGa4Automation] = useState(true);
  const [ga4Data, setGa4Data] = useState<Ga4ApiData | null>(null);
  const [ga4LoadState, setGa4LoadState] = useState<"loading" | "live" | "error">("loading");
  const [ga4LoadMessage, setGa4LoadMessage] = useState("GA4 실데이터를 불러오는 중입니다.");
  const [ga4RefreshKey, setGa4RefreshKey] = useState(0);
  const [ga4LastSyncedAt, setGa4LastSyncedAt] = useState("");
  const [naverSearchAdData, setNaverSearchAdData] = useState<NaverSearchAdData | null>(null);
  const [naverSearchAdLoadState, setNaverSearchAdLoadState] = useState<"loading" | "live" | "error">("loading");
  const [naverSearchAdMessage, setNaverSearchAdMessage] = useState("네이버 검색광고 데이터를 불러오는 중입니다.");
  const [naverSearchAdLastSyncedAt, setNaverSearchAdLastSyncedAt] = useState("");
  const [naverSearchAdRefreshKey, setNaverSearchAdRefreshKey] = useState(0);
  const [searchTrendPrimary, setSearchTrendPrimary] = useState<NaverTrendMetricKey>("impressions");
  const [searchTrendSecondary, setSearchTrendSecondary] = useState<NaverTrendMetricKey>("cpc");
  const [placeTrendPrimary, setPlaceTrendPrimary] = useState<NaverTrendMetricKey>("impressions");
  const [placeTrendSecondary, setPlaceTrendSecondary] = useState<NaverTrendMetricKey>("cpc");
  const [placeRankData, setPlaceRankData] = useState<PlaceRankData | null>(null);
  const [placeRankLoadState, setPlaceRankLoadState] = useState<"loading" | "live" | "error">("loading");
  const [placeRankMessage, setPlaceRankMessage] = useState("플레이스 자연 노출 순위를 불러오는 중입니다.");
  const [placeRankRefreshKey, setPlaceRankRefreshKey] = useState(0);
  const [placeRankKeyword, setPlaceRankKeyword] = useState("");
  const [placeRankUrl, setPlaceRankUrl] = useState("");
  const [placeRankEditingId, setPlaceRankEditingId] = useState("");
  const [selectedPlaceRankId, setSelectedPlaceRankId] = useState("");
  const [manualPlaceRank, setManualPlaceRank] = useState("");
  const [placeRankSaving, setPlaceRankSaving] = useState(false);
  const [rankfreeInsights, setRankfreeInsights] = useState<RankfreeInsights | null>(null);
  const [rankfreeInsightsState, setRankfreeInsightsState] = useState<"idle" | "loading" | "live" | "error">("idle");
  const periodOptions = periodOptionDefinitions.map((option) => ({
    ...option,
    range: option.label === "직접입력"
      ? option.range
      : displayDateRange(dynamicPeriodRange(option.label).start, dynamicPeriodRange(option.label).end),
  }));
  const [kpiTrendMode, setKpiTrendMode] = useState<"daily" | "weekly">("daily");
  const [consultTrendMode, setConsultTrendMode] = useState<"weekly" | "monthly">("weekly");
  const [adTrendMode, setAdTrendMode] = useState<"daily" | "weekly" | "monthly">("daily");
  const [adMetricMode, setAdMetricMode] = useState<"spend" | "conversion">("spend");
  const [adEfficiencyMonthMode, setAdEfficiencyMonthMode] = useState<"current" | "previous">("current");
  const [notifications, setNotifications] = useState({ errors: true, summary: true, changes: false });
  const [uploadedFiles, setUploadedFiles] = useState<UploadRow[]>([]);
  const [validationResults, setValidationResults] = useState<string>("");
  const [importedRows, setImportedRows] = useState<ImportedDashboardRows>(emptyImportedRows());
  const [aiEvidenceOpen, setAiEvidenceOpen] = useState(false);
  const [selectedKpiLabel, setSelectedKpiLabel] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated" | "forbidden" | "unavailable">("checking");
  const [authMessage, setAuthMessage] = useState("로그인과 병원 접근 권한을 확인하고 있습니다.");
  const [authRetryKey, setAuthRetryKey] = useState(0);
  const [loginEmail, setLoginEmail] = useState("admin@hospital.local");
  const [templateType, setTemplateType] = useState<ImportTableKey>("leads");
  const [dailyData, setDailyData] = useState<DailyDataRow[]>([]);
  const [isDataDirty, setIsDataDirty] = useState(false);
  const [editedDailyDates, setEditedDailyDates] = useState<string[]>([]);
  const [dailySaveState, setDailySaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dailyEditReason, setDailyEditReason] = useState("");
  const [dataVisibleCount, setDataVisibleCount] = useState<7 | 14 | 30>(7);
  const [dataSort, setDataSort] = useState<"latest" | "inquiries" | "sales">("latest");
  const [dataSourceState, setDataSourceState] = useState<"loading" | "live" | "empty" | "error">("loading");
  const [dataRefreshAt, setDataRefreshAt] = useState("");
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [accessRole, setAccessRole] = useState("조회 전용");
  const [canManageSettings, setCanManageSettings] = useState(false);
  const [canManageData, setCanManageData] = useState(false);
  const [settingsHistory, setSettingsHistory] = useState<SettingsHistoryRow[]>([]);
  const [settingsSaveState, setSettingsSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dailyEditBackupRef = useRef<DailyDataRow[] | null>(null);

  useEffect(() => {
    if (!isDataDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDataDirty]);

  useEffect(() => {
    queueMicrotask(() => setIsClientReady(true));
  }, []);

  const importedDataCounts = [
    { label: "상담 데이터", key: "leads" as const, count: importedRows.leads.length },
    { label: "예약 데이터", key: "appointments" as const, count: importedRows.appointments.length },
    { label: "내원 데이터", key: "visits" as const, count: importedRows.visits.length },
    { label: "매출 데이터", key: "payments" as const, count: importedRows.payments.length },
    { label: "광고비 데이터", key: "adSpend" as const, count: importedRows.adSpend.length },
  ];
  const importedTotal = importedDataCounts.reduce((sum, item) => sum + item.count, 0);
  const selectedImportContract = importTables.find((table) => table.key === templateType) ?? importTables[0];
  const isCustomPeriod = period === periodOptions[5].label;
  const activeDateRange = resolvePeriodDateRange(period, customStartDate, customEndDate);
  const activePeriodDays = daysBetween(activeDateRange.start, activeDateRange.end);
  const comparisonDateRange = resolveComparisonDateRange(activeDateRange, compareOption);
  const selectedPeriodDefinition = periodOptions.find((option) => option.label === period) ?? periodOptions[1];
  const periodDefinition = {
    ...selectedPeriodDefinition,
    range: displayDateRange(activeDateRange.start, activeDateRange.end),
    compare: `vs ${compareOption}`,
  };
  const comparisonRangeLabel = `${comparisonDateRange.start} ~ ${comparisonDateRange.end}`;
  const hasImportedRows = Object.values(importedRows).some((rows) => rows.length > 0);
  // Never manufacture period values by scaling a sample week. Every displayed
  // value must come from rows that actually belong to the selected period.
  const periodScale = 1;
  const scaledCount = (value: number) => Math.round(value * periodScale).toLocaleString("ko-KR");

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetch("/api/settings", { cache: "no-store", signal: controller.signal }).then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          const error = new Error(body.error || "설정을 불러오지 못했습니다.") as Error & { status?: number };
          error.status = response.status;
          throw error;
        }
        return body;
      }),
      fetch("/api/dashboard-data", { cache: "no-store", signal: controller.signal }).then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          const error = new Error(body.error || "운영 데이터를 불러오지 못했습니다.") as Error & { status?: number };
          error.status = response.status;
          throw error;
        }
        return body;
      }),
    ]).then(([settingsResult, dataResult]) => {
      if (settingsResult.status === "rejected") throw settingsResult.reason;
      const settingsBody = settingsResult.value;
      startTransition(() => {
        const saved = settingsBody.settings || {};
        setHospitalName(saved.hospitalName || "메디인사이트");
        setHospitalLocation(saved.hospitalLocation || "서울 본원");
        setSettingsLocale(saved.locale || "한국어");
        setSettingsPeriod(saved.defaultPeriod || "최근 7일");
        const savedCompare = compareOptions.includes(saved.compare as CompareOption) ? saved.compare as CompareOption : "직전 동일 기간";
        setSettingsCompare(savedCompare);
        setCompareOption(savedCompare);
        if (saved.notifications) setNotifications(saved.notifications);
        if (Array.isArray(saved.kpiTargets) && saved.kpiTargets.length > 0) setKpiTargets(saved.kpiTargets);
        if (saved.aiSettings) setAiSettings(saved.aiSettings);
        if (typeof saved.ga4Automation === "boolean") setGa4Automation(saved.ga4Automation);
        if (Array.isArray(settingsBody.users)) setUsers(settingsBody.users);
        setSettingsHistory(settingsBody.history || []);
        setLoginEmail(settingsBody.access.email);
        setAccessRole(settingsBody.access.roleLabel);
        setCanManageSettings(Boolean(settingsBody.access.canManageSettings));
        setCanManageData(Boolean(settingsBody.access.canManageData));
        setIsAuthenticated(true);
        setAuthState("authenticated");
        setAuthMessage("");
        if (dataResult.status === "fulfilled") {
          const dataBody = dataResult.value;
          setImportedRows(dataBody.rows as ImportedDashboardRows);
          const aggregated = aggregateDailyData(dataBody.rows as ImportedDashboardRows);
          setDailyData(dataBody.connected ? aggregated : []);
          setDataSourceState(dataBody.connected ? "live" : "empty");
          setDataRefreshAt(new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date()));
        } else {
          setDataSourceState("error");
          setValidationResults(dataResult.reason instanceof Error ? dataResult.reason.message : "운영 데이터 연결을 확인해 주세요.");
        }
      });
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const status = (error as Error & { status?: number }).status;
      setIsAuthenticated(false);
      setAuthState(status === 401 ? "unauthenticated" : status === 403 ? "forbidden" : "unavailable");
      setAuthMessage(error instanceof Error ? error.message : "로그인 상태를 확인하지 못했습니다.");
      setDataSourceState("error");
      setValidationResults(error instanceof Error ? error.message : "데이터 연결을 확인해 주세요.");
    });
    return () => controller.abort();
  }, [authRetryKey]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const controller = new AbortController();
    const loadQuality = (start: string, end: string) => fetch(`/api/data-quality?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "데이터 품질 검사를 실행하지 못했습니다.");
        return body as DataQuality;
      });
    Promise.all([
      loadQuality(activeDateRange.start, activeDateRange.end),
      loadQuality(comparisonDateRange.start, comparisonDateRange.end),
    ])
      .then(([body, comparisonBody]) => {
        startTransition(() => {
          setDataQuality(body);
          const mergedDaily = new Map([...comparisonBody.daily, ...body.daily].map((row) => [row.date, row]));
          setDailyData(body.connected || comparisonBody.connected ? [...mergedDaily.values()].sort((a, b) => b.date.localeCompare(a.date)) : []);
          setUploadedFiles(body.uploads.map((row) => ({
            name: row.fileName || row.batchId.slice(0, 8),
            type: row.fileName?.split(".").pop()?.toUpperCase() || "CSV",
            dataset: importTables.find((table) => table.key === row.tableKey)?.label || row.tableKey || "데이터",
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            status: row.status === "validated" ? "정상 반영" : row.status === "needs_review" ? "검수 대기" : "오류 확인",
            updated: new Date(row.uploadedAt).toLocaleString("ko-KR"),
            uploadedBy: row.uploadedBy ?? "-",
            rowCount: row.rowCount,
            errorCount: row.errorCount,
            warningCount: row.warningCount,
          })));
          if (body.connected) setDataSourceState("live");
          setDataRefreshAt(new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date()));
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setValidationResults(error instanceof Error ? error.message : "데이터 품질 검사를 실행하지 못했습니다.");
      });
    return () => controller.abort();
  }, [activeDateRange.start, activeDateRange.end, authState, comparisonDateRange.start, comparisonDateRange.end]);

  useEffect(() => {
    if (!ga4Automation || authState !== "authenticated") return;
    const refresh = () => setGa4RefreshKey((value) => value + 1);
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authState, ga4Automation]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const refresh = () => setNaverSearchAdRefreshKey((value) => value + 1);
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authState]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      startTransition(() => {
        setGa4LoadState("loading");
        setGa4LoadMessage(`${activeDateRange.start} ~ ${activeDateRange.end} 데이터를 조회하고 있습니다.`);
      });
    });

    fetch(`/api/ga4?start=${encodeURIComponent(activeDateRange.start)}&end=${encodeURIComponent(activeDateRange.end)}&refresh=${ga4RefreshKey}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json() as Ga4ApiData | { error?: string };
        if (!response.ok || !("source" in body)) {
          throw new Error("error" in body && body.error ? body.error : "GA4 데이터를 불러오지 못했습니다.");
        }
        return body;
      })
      .then((body) => {
        startTransition(() => {
          setGa4Data(body);
          setGa4LoadState("live");
          setGa4LastSyncedAt(new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()));
          setGa4LoadMessage(body.warnings?.length
            ? `${body.range.start} ~ ${body.range.end} 핵심 실데이터 반영 · 일부 세부 보고서 확인 필요`
            : `${body.range.start} ~ ${body.range.end} 실데이터가 반영되었습니다. 5분마다 자동 동기화됩니다.`);
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGa4LoadState("error");
        setGa4LoadMessage(`${error instanceof Error ? error.message : "GA4 연결을 확인해 주세요."} 마지막 정상 데이터를 유지합니다.`);
      });

    return () => controller.abort();
  }, [activeDateRange.start, activeDateRange.end, authState, ga4RefreshKey]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      startTransition(() => {
        setNaverSearchAdLoadState("loading");
        setNaverSearchAdMessage(`${activeDateRange.start} ~ ${activeDateRange.end} 네이버 광고 데이터를 동기화하고 있습니다.`);
      });
    });

    fetch(`/api/naver-search-ads?start=${encodeURIComponent(activeDateRange.start)}&end=${encodeURIComponent(activeDateRange.end)}&refresh=${naverSearchAdRefreshKey}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json() as NaverSearchAdData | { error?: string };
        if (!response.ok || !("source" in body)) {
          throw new Error("error" in body && body.error ? body.error : "네이버 검색광고 데이터를 불러오지 못했습니다.");
        }
        return body;
      })
      .then((body) => {
        startTransition(() => {
          setNaverSearchAdData(body);
          setNaverSearchAdLoadState("live");
          const syncedAt = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(body.syncedAt));
          setNaverSearchAdLastSyncedAt(syncedAt);
          setNaverSearchAdMessage(`${body.range.start} ~ ${body.range.end} 실데이터 반영 · 마지막 동기화 ${syncedAt} · 5분 자동 갱신`);
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNaverSearchAdLoadState("error");
        setNaverSearchAdMessage(`${error instanceof Error ? error.message : "네이버 검색광고 연결을 확인해 주세요."} 마지막 정상 데이터는 유지합니다.`);
      });

    return () => controller.abort();
  }, [activeDateRange.start, activeDateRange.end, authState, naverSearchAdRefreshKey]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    let timer = 0;
    const scheduleNextPlaceRankRefresh = () => {
      const now = new Date();
      const seoulNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const nextRun = new Date(seoulNow);
      nextRun.setHours(9, 0, 0, 0);
      if (nextRun <= seoulNow) nextRun.setDate(nextRun.getDate() + 1);
      timer = window.setTimeout(() => {
        setPlaceRankRefreshKey((value) => value + 1);
        scheduleNextPlaceRankRefresh();
      }, Math.max(1_000, nextRun.getTime() - seoulNow.getTime()));
    };
    scheduleNextPlaceRankRefresh();
    return () => window.clearTimeout(timer);
  }, [authState]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) startTransition(() => setPlaceRankLoadState("loading"));
    });
    fetch(`/api/place-rank?start=${encodeURIComponent(activeDateRange.start)}&end=${encodeURIComponent(activeDateRange.end)}&collect=today&refresh=${placeRankRefreshKey}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json() as PlaceRankData | { error?: string };
        if (!response.ok || !("keywords" in body)) throw new Error("error" in body && body.error ? body.error : "플레이스 순위 데이터를 불러오지 못했습니다.");
        return body;
      })
      .then((body) => {
        startTransition(() => {
          setPlaceRankData(body);
          setPlaceRankLoadState("live");
          setSelectedPlaceRankId((current) => body.keywords.some((row) => row.id === current) ? current : body.keywords[0]?.id ?? "");
          setPlaceRankMessage(body.providerConfigured
            ? body.trackingSync?.error
              ? `추적 동기화 확인 필요 · ${body.trackingSync.error}`
              : `랭크프리 추적 ${body.trackingSync?.matchedSlots ?? 0}/${body.keywords.length}개 연결 · 매일 09:00 자동 반영`
            : "자동 측정 공급자 미연동 · 수동 기록은 즉시 사용할 수 있습니다.");
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPlaceRankLoadState("error");
        setPlaceRankMessage(error instanceof Error ? error.message : "플레이스 순위 연결을 확인해 주세요.");
      });
    return () => controller.abort();
  }, [activeDateRange.start, activeDateRange.end, authState, placeRankRefreshKey]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const selected = placeRankData?.keywords.find((row) => row.id === selectedPlaceRankId) ?? placeRankData?.keywords[0];
    if (!selected || !placeRankData?.providerConfigured) {
      setRankfreeInsights(null);
      setRankfreeInsightsState("idle");
      return;
    }
    const controller = new AbortController();
    setRankfreeInsightsState("loading");
    fetch(`/api/rankfree-insights?keyword=${encodeURIComponent(selected.keyword)}&placeId=${encodeURIComponent(selected.placeId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json() as RankfreeInsights | { error?: string };
        if (!response.ok || !("keywordStatus" in body)) throw new Error("error" in body && body.error ? body.error : "플레이스 분석을 불러오지 못했습니다.");
        return body;
      })
      .then((body) => {
        setRankfreeInsights(body);
        setRankfreeInsightsState("live");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRankfreeInsights(null);
        setRankfreeInsightsState("error");
      });
    return () => controller.abort();
  }, [authState, placeRankData, selectedPlaceRankId]);

  const savePlaceRankKeyword = async () => {
    if (!placeRankKeyword.trim() || !placeRankUrl.trim()) {
      setPlaceRankMessage("검색 키워드와 네이버 플레이스 주소를 모두 입력해 주세요.");
      return;
    }
    setPlaceRankSaving(true);
    try {
      const response = await fetch("/api/place-rank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", id: placeRankEditingId || undefined, keyword: placeRankKeyword, placeUrl: placeRankUrl }),
      });
      const body = await response.json() as { keyword?: PlaceRankKeyword; error?: string };
      if (!response.ok) throw new Error(body.error || "키워드를 저장하지 못했습니다.");
      setPlaceRankKeyword("");
      setPlaceRankUrl("");
      setPlaceRankEditingId("");
      if (body.keyword) setSelectedPlaceRankId(body.keyword.id);
      setPlaceRankRefreshKey((value) => value + 1);
      setPlaceRankMessage("키워드를 저장했습니다. 오늘 순위 기록을 시작합니다.");
    } catch (error) {
      setPlaceRankMessage(error instanceof Error ? error.message : "키워드를 저장하지 못했습니다.");
    } finally {
      setPlaceRankSaving(false);
    }
  };

  const runPlaceRankAction = async (action: "collect" | "record" | "delete", id: string, options?: { rank?: number; outsideTop100?: boolean }) => {
    setPlaceRankSaving(true);
    try {
      const response = await fetch("/api/place-rank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id, ...options }),
      });
      const body = await response.json() as { error?: string; stable?: boolean };
      if (!response.ok) throw new Error(body.error || "순위 작업을 완료하지 못했습니다.");
      setManualPlaceRank("");
      setPlaceRankRefreshKey((value) => value + 1);
      setPlaceRankMessage(action === "delete" ? "추적 키워드를 삭제했습니다." : action === "collect" ? "수동 측정값으로 오늘 자동 측정값을 교체했습니다." : "오늘 순위를 저장했습니다.");
    } catch (error) {
      setPlaceRankMessage(error instanceof Error ? error.message : "순위 작업을 완료하지 못했습니다.");
    } finally {
      setPlaceRankSaving(false);
    }
  };

  const updateDailyData = (date: string, field: keyof Omit<DailyDataRow, "date">, value: string) => {
    const numericValue = Math.max(0, Number(value.replace(/[^0-9]/g, "")) || 0);
    setDailyData((current) => {
      if (!dailyEditBackupRef.current) dailyEditBackupRef.current = current.map((row) => ({ ...row }));
      return current.map((row) => row.date === date ? { ...row, [field]: numericValue } : row);
    });
    setEditedDailyDates((current) => current.includes(date) ? current : [...current, date]);
    setIsDataDirty(true);
    setDailySaveState("idle");
  };

  const restoreDailyData = (row: DailyDataRow) => {
    if (!canManageData) return;
    setDailyData((current) => {
      if (!dailyEditBackupRef.current) dailyEditBackupRef.current = current.map((item) => ({ ...item }));
      const restored = { date: row.date, inquiries: row.inquiries, reservations: row.reservations, visits: row.visits, sales: row.sales, adSpend: row.adSpend };
      return current.some((item) => item.date === row.date)
        ? current.map((item) => item.date === row.date ? restored : item)
        : [...current, restored];
    });
    setEditedDailyDates((current) => current.includes(row.date) ? current : [...current, row.date]);
    setIsDataDirty(true);
    setDailySaveState("idle");
    setDailyEditReason(`과거 기록 복원 · ${row.date}`);
    setValidationResults(`${row.date} 과거 값을 편집 테이블에 복원했습니다. 저장 버튼을 눌러 최종 반영해 주세요.`);
    window.requestAnimationFrame(() => document.getElementById("daily-data-table")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const formatWon = (value: number) => `${value.toLocaleString("ko-KR")}원`;

  const visibleDailyData = useMemo(() => {
    const filteredRows = dailyData.filter((row) => row.date >= activeDateRange.start && row.date <= activeDateRange.end);
    const rows = [...filteredRows].sort((a, b) => {
      if (dataSort === "inquiries") return b.inquiries - a.inquiries;
      if (dataSort === "sales") return b.sales - a.sales;
      return b.date.localeCompare(a.date);
    });
    const periodLimit = activePeriodDays >= 30 ? rows.length : activePeriodDays;
    return rows.slice(0, Math.min(dataVisibleCount, periodLimit));
  }, [dailyData, dataSort, dataVisibleCount, activePeriodDays, activeDateRange.start, activeDateRange.end]);

  const saveDailyData = async () => {
    if (!canManageData || !editedDailyDates.length) return;
    if (dailyEditReason.trim().length < 2) {
      setValidationResults("저장 전에 수정 사유를 2자 이상 입력해 주세요.");
      return;
    }
    setDailySaveState("saving");
    try {
      const rows = dailyData.filter((row) => editedDailyDates.includes(row.date));
      const response = await fetch("/api/daily-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows, reason: dailyEditReason.trim() }),
      });
      const body = await response.json() as { saved?: number; error?: string };
      if (!response.ok) throw new Error(body.error || "일자별 수정값을 저장하지 못했습니다.");
      setEditedDailyDates([]);
      setIsDataDirty(false);
      setDailyEditReason("");
      dailyEditBackupRef.current = null;
      setDailySaveState("saved");
      setValidationResults(`일자별 수정값 ${body.saved ?? rows.length}건을 서버에 저장하고 변경 이력에 기록했습니다.`);
    } catch (error) {
      setDailySaveState("error");
      setValidationResults(error instanceof Error ? error.message : "일자별 수정값을 저장하지 못했습니다.");
    }
  };

  const applyDataDateRange = () => {
    if (!customStartDate || !customEndDate || customStartDate > customEndDate) {
      setValidationResults("조회 시작일과 종료일을 올바르게 입력해 주세요.");
      return;
    }
    setPeriod("직접입력");
    setValidationResults(`${customStartDate} ~ ${customEndDate} 업로드 데이터를 조회합니다.`);
  };

  const normalizedUserEmails = users.map((user) => user.email.trim().toLowerCase());
  const duplicateUserEmail = normalizedUserEmails.find((email, index) => email && normalizedUserEmails.indexOf(email) !== index);
  const invalidUser = users.find((user) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email.trim()) || !user.name.trim());
  const userAccessValidation = users.length === 0
    ? "최소 1명의 사용자가 필요합니다."
    : invalidUser
      ? "모든 사용자의 이름과 올바른 이메일을 입력해 주세요."
      : duplicateUserEmail
        ? `중복 사용자 이메일이 있습니다: ${duplicateUserEmail}`
        : !users.some((user) => user.role === "최고관리자")
          ? "최고관리자를 최소 1명 유지해야 합니다."
          : "";

  const saveSettings = async () => {
    if (!canManageSettings) return;
    if (userAccessValidation) {
      setValidationResults(userAccessValidation);
      return;
    }
    setSettingsSaveState("saving");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          settings: { hospitalName, hospitalLocation, locale: settingsLocale, defaultPeriod: settingsPeriod, compare: settingsCompare, notifications, kpiTargets, aiSettings, ga4Automation },
          users,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "설정을 저장하지 못했습니다.");
      setPeriod(settingsPeriod);
      setCompareOption(settingsCompare);
      setIsSettingsDirty(false);
      setSettingsSaveState("saved");
      setValidationResults("설정이 서버에 영구 저장되고 변경 이력에 기록되었습니다.");
      setSettingsHistory((current) => [{ userId: loginEmail, action: "settings_saved", createdAt: body.updatedAt, metadata: { userCount: users.length } }, ...current].slice(0, 20));
    } catch (error) {
      setSettingsSaveState("error");
      setValidationResults(error instanceof Error ? error.message : "설정을 저장하지 못했습니다.");
    }
  };

  const downloadTemplate = () => {
    const contract = importTables.find((table) => table.key === templateType);
    if (!contract) return;
    const headers = contract.fields.map((field) => field.key);
    const exampleRow = contract.fields.map((field) => field.example.replaceAll(",", "，"));
    const csv = `\uFEFF${headers.join(",")}\n${exampleRow.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${contract.key}_upload_template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setValidationResults(`${contract.label} 업로드 템플릿을 다운로드했습니다. 예시 행을 지운 뒤 같은 열 이름으로 업로드해 주세요.`);
  };

  const handleUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toUpperCase() || "CSV";
    setUploadedFiles((current) => [
      {
        name: file.name,
        type: extension,
        dataset: "검수 중",
        status: "검수 대기",
        updated: "방금 전",
      },
      ...current.filter((row) => row.name !== file.name.replace(/\.[^.]+$/, "")),
    ]);
    if (extension !== "CSV") {
      setValidationResults(`${file.name} 파일을 선택했습니다. 현재 미리보기에서는 CSV 파일을 먼저 검수합니다.`);
      event.target.value = "";
      return;
    }

    const tableKey = file.name.toLowerCase().includes("appointment")
      ? "appointments"
      : file.name.toLowerCase().includes("visit")
        ? "visits"
        : file.name.toLowerCase().includes("payment")
          ? "payments"
          : file.name.toLowerCase().includes("ad_spend") || file.name.toLowerCase().includes("ad-spend")
            ? "ad_spend"
            : "leads";
    const csvText = await file.text();
    const rows = parseCsvRows(csvText);
    const validation = validateImportRows(tableKey, rows);
    if (validation.errorCount > 0) {
      setValidationResults(`${file.name} 검수 오류 ${validation.errorCount}건 · 오류를 수정한 뒤 다시 업로드해 주세요.`);
      event.target.value = "";
      return;
    }
    try {
      const formData = new FormData();
      formData.set("tableKey", tableKey);
      formData.set("file", new File([csvText], file.name, { type: file.type || "text/csv" }));
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "업로드를 저장하지 못했습니다.");
      const dataResponse = await fetch("/api/dashboard-data", { cache: "no-store" });
      const dataBody = await dataResponse.json();
      if (!dataResponse.ok) throw new Error(dataBody.error || "저장된 데이터를 다시 불러오지 못했습니다.");
      setImportedRows(dataBody.rows as ImportedDashboardRows);
      setDailyData(aggregateDailyData(dataBody.rows as ImportedDashboardRows));
      setDataSourceState(dataBody.connected ? "live" : "empty");
      setUploadedFiles((current) => current.map((row, index) => index === 0 ? { ...row, status: "정상 반영", updated: "방금 전" } : row));
      setValidationResults(`${file.name} 정상 검수 ${validation.validRows}건 · 원본은 R2, 집계 데이터는 D1에 영구 저장되었습니다.`);
    } catch (error) {
      setUploadedFiles((current) => current.map((row, index) => index === 0 ? { ...row, status: "오류 확인", updated: "방금 전" } : row));
      setValidationResults(error instanceof Error ? error.message : "업로드를 저장하지 못했습니다.");
    }
    event.target.value = "";
  };

  const actualKpiResult = useMemo<ImportedKpiResult | null>(() => {
    if (!hasImportedRows) return null;
    const filteredRows: ImportedDashboardRows = {
      leads: filterRowsByDate(importedRows.leads, "created_at", activeDateRange.start, activeDateRange.end),
      appointments: filterRowsByDate(importedRows.appointments, "booked_at", activeDateRange.start, activeDateRange.end),
      visits: filterRowsByDate(importedRows.visits, "visited_at", activeDateRange.start, activeDateRange.end),
      payments: filterRowsByDate(importedRows.payments, "paid_at", activeDateRange.start, activeDateRange.end),
      adSpend: filterRowsByDate(importedRows.adSpend, "spend_date", activeDateRange.start, activeDateRange.end),
    };
    return calculateImportedKpis(filteredRows, {
      noShowAppointments: filterRowsByDate(importedRows.appointments, "scheduled_at", activeDateRange.start, activeDateRange.end),
      allVisits: filteredRows.visits,
    });
  }, [importedRows, hasImportedRows, activeDateRange.start, activeDateRange.end]);

  const previousKpiResult = useMemo<ImportedKpiResult | null>(() => {
    if (!hasImportedRows) return null;
    const filteredRows: ImportedDashboardRows = {
      leads: filterRowsByDate(importedRows.leads, "created_at", comparisonDateRange.start, comparisonDateRange.end),
      appointments: filterRowsByDate(importedRows.appointments, "booked_at", comparisonDateRange.start, comparisonDateRange.end),
      visits: filterRowsByDate(importedRows.visits, "visited_at", comparisonDateRange.start, comparisonDateRange.end),
      payments: filterRowsByDate(importedRows.payments, "paid_at", comparisonDateRange.start, comparisonDateRange.end),
      adSpend: filterRowsByDate(importedRows.adSpend, "spend_date", comparisonDateRange.start, comparisonDateRange.end),
    };
    return calculateImportedKpis(filteredRows, {
      noShowAppointments: filterRowsByDate(importedRows.appointments, "scheduled_at", comparisonDateRange.start, comparisonDateRange.end),
      allVisits: filteredRows.visits,
    });
  }, [importedRows, hasImportedRows, comparisonDateRange.start, comparisonDateRange.end]);

  const displayedConsultCards = useMemo(() => {
    if (!actualKpiResult) return consultCards.map((card) => ({ ...card, value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시" }));
    const summary = actualKpiResult.summary;
    return [
      { ...consultCards[0], value: scaleMetricValue(summary.inquiry.toLocaleString("ko-KR"), consultCards[0].label, periodScale) },
      { ...consultCards[1], value: scaleMetricValue(summary.reservation.toLocaleString("ko-KR"), consultCards[1].label, periodScale) },
      { ...consultCards[2], value: summary.reservationRate === null ? "-" : `${summary.reservationRate}%` },
      { ...consultCards[3], value: scaleMetricValue(summary.newVisit.toLocaleString("ko-KR"), consultCards[3].label, periodScale) },
    ];
  }, [actualKpiResult, periodScale]);

  const cpaCard: MetricCard = {
    label: "전환당 비용 (CPA)",
    value: "-",
    delta: "데이터 미연동",
    previous: "실데이터 연결 후 표시",
    icon: "",
    tone: "orange",
  };

  const automatedNaverSourceRows = useMemo(() => {
    if (naverSearchAdLoadState !== "live" || !naverSearchAdData) return [];
    return [
      { ...naverSearchAdData.summary, name: "네이버 검색광고", automated: true },
      { ...naverSearchAdData.place, name: "네이버 플레이스 광고", automated: true },
    ];
  }, [naverSearchAdData, naverSearchAdLoadState]);

  const mergedAdSourceRows = useMemo(() => {
    const channelKey = (name: string) => {
      const normalized = name.toLowerCase().replaceAll(" ", "");
      if (normalized.includes("네이버") && normalized.includes("플레이스")) return "naver-place";
      if (normalized.includes("네이버") && normalized.includes("검색")) return "naver-search";
      return normalized;
    };
    const automatedByKey = new Map(automatedNaverSourceRows.map((row) => [channelKey(row.name), row]));
    const attributedRows = (actualKpiResult?.channels ?? [])
      .filter((row) => row.adSpend > 0 || automatedByKey.has(channelKey(row.channel)))
      .map((row) => {
        const automated = automatedByKey.get(channelKey(row.channel));
        return {
          name: row.channel,
          spend: automated?.spend ?? row.adSpend,
          impressions: automated?.impressions ?? row.impressions,
          clicks: automated?.clicks ?? row.clicks,
          conversions: automated?.conversions ?? row.conversions,
          inquiries: row.inquiries,
          reservations: row.reservations,
          visits: row.visits,
          sales: row.sales,
          automated: Boolean(automated),
        };
      });
    const represented = new Set(attributedRows.map((row) => channelKey(row.name)));
    const automationOnlyRows = automatedNaverSourceRows
      .filter((row) => !represented.has(channelKey(row.name)))
      .map((row) => ({
        ...row,
        inquiries: 0,
        reservations: 0,
        visits: 0,
        sales: 0,
        automated: true,
      }));
    return [...attributedRows, ...automationOnlyRows];
  }, [actualKpiResult, automatedNaverSourceRows]);

  const mergedAdSourceTotals = useMemo(() => mergedAdSourceRows.reduce((sum, row) => ({
    spend: sum.spend + row.spend,
    impressions: sum.impressions + row.impressions,
    clicks: sum.clicks + row.clicks,
    conversions: sum.conversions + row.conversions,
    inquiries: sum.inquiries + row.inquiries,
    reservations: sum.reservations + row.reservations,
    visits: sum.visits + row.visits,
    sales: sum.sales + row.sales,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, inquiries: 0, reservations: 0, visits: 0, sales: 0 }), [mergedAdSourceRows]);

  const displayedAdCards = useMemo(() => {
    if (!actualKpiResult) return [...adCards.slice(0, 7), cpaCard, adCards[7]].map((card) => ({ ...card, value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시" }));
    const summary = actualKpiResult.summary;
    return [
      { ...adCards[0], value: scaleMetricValue(formatImportedMoney(summary.adSpend), adCards[0].label, periodScale) },
      { ...adCards[1], value: "업로드 집계" },
      { ...adCards[2], value: scaleMetricValue(summary.inquiry.toLocaleString("ko-KR"), adCards[2].label, periodScale) },
      { ...adCards[3], value: summary.inquiry === 0 ? "-" : `${Math.round((summary.inquiry / Math.max(summary.adSpend, 1)) * 10000) / 100}%` },
      { ...adCards[4], value: summary.cpl === null ? "-" : `${summary.cpl.toLocaleString("ko-KR")}원` },
      { ...adCards[5], value: scaleMetricValue(summary.visit.toLocaleString("ko-KR"), adCards[5].label, periodScale) },
      { ...adCards[6], value: summary.reservationVisitRate === null ? "-" : `${summary.reservationVisitRate}%` },
      { ...cpaCard, value: summary.cpv === null ? "-" : `${summary.cpv.toLocaleString("ko-KR")}원` },
      { ...adCards[7], value: summary.roas === null ? "-" : `${summary.roas}%` },
    ];
  }, [actualKpiResult, periodScale]);

  const requestedAdCards = useMemo<MetricCard[]>(() => {
    const spend = mergedAdSourceTotals.spend;
    const inquiry = mergedAdSourceTotals.inquiries;
    const reservation = mergedAdSourceTotals.reservations;
    const visit = mergedAdSourceTotals.visits;
    const cpl = inquiry === 0 ? null : Math.round(spend / inquiry);
    const reservationCpa = reservation === 0 ? null : Math.round(spend / reservation);
    const visitCpa = visit === 0 ? null : Math.round(spend / visit);
    const won = (value: number | null) => value === null ? "-" : `${value.toLocaleString("ko-KR")}원`;
    if (spend === 0) return ["총 광고비", "광고 문의", "광고 예약", "광고 내원", "CPL", "예약 CPA", "내원 CPA", "ROAS"].map((label, index) => ({ label, value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: (["green", "blue", "violet", "orange", "blue", "violet", "orange", "green"] as Tone[])[index] }));
    const roas = mergedAdSourceTotals.sales > 0 ? Math.round((mergedAdSourceTotals.sales / spend) * 100) : null;
    return [
      { label: "총 광고비", value: won(spend), delta: automatedNaverSourceRows.length ? "자동화 반영" : "기간 집계", previous: "업로드 + 네이버 자동화 중복 제거 합계", icon: "", tone: "green" },
      { label: "광고 문의", value: inquiry.toLocaleString("ko-KR"), delta: "기간 집계", previous: "광고 채널 유입 문의", icon: "", tone: "blue" },
      { label: "광고 예약", value: reservation.toLocaleString("ko-KR"), delta: "기간 집계", previous: "광고 문의 후 예약", icon: "", tone: "violet" },
      { label: "광고 내원", value: visit.toLocaleString("ko-KR"), delta: "기간 집계", previous: "광고 유입 실제 내원", icon: "", tone: "orange" },
      { label: "CPL", value: won(cpl), delta: "자동 계산", previous: "광고비 ÷ 광고 문의", icon: "", tone: "blue" },
      { label: "예약 CPA", value: won(reservationCpa), delta: "자동 계산", previous: "광고비 ÷ 광고 예약", icon: "", tone: "violet" },
      { label: "내원 CPA", value: won(visitCpa), delta: "자동 계산", previous: "광고비 ÷ 광고 내원", icon: "", tone: "orange" },
      { label: "ROAS", value: roas === null ? "-" : `${roas}%`, delta: "자동 계산", previous: "광고 매출 ÷ 통합 광고비", icon: "", tone: "green" },
    ];
  }, [automatedNaverSourceRows.length, mergedAdSourceTotals]);

  const displayedConsultRows = useMemo(() => {
    if (!actualKpiResult) return [];
    return actualKpiResult.departments.map((row) => ({
      name: row.department,
      phone: row.phoneInquiries.toLocaleString("ko-KR"),
      reserve: row.phoneReservations.toLocaleString("ko-KR"),
      reserveRate: row.phoneInquiries === 0 ? "-" : `${Math.round((row.phoneReservations / row.phoneInquiries) * 1000) / 10}%`,
      visit: row.newVisits.toLocaleString("ko-KR"),
    }));
  }, [actualKpiResult, periodScale]);

  const displayedOnlineConsultRows = useMemo(() => {
    if (!actualKpiResult) return [];
    return actualKpiResult.departments.map((row) => [
      row.department,
      row.onlineInquiries.toLocaleString("ko-KR"),
      row.onlineReservations.toLocaleString("ko-KR"),
      row.onlineInquiries === 0 ? "-" : `${Math.round((row.onlineReservations / row.onlineInquiries) * 1000) / 10}%`,
    ]);
  }, [actualKpiResult, periodScale]);

  const displayedNewPatientByDepartment = useMemo(() => {
    if (!actualKpiResult) return [];
    return actualKpiResult.departments.map((row) => ({ name: row.department, value: row.newVisits }));
  }, [actualKpiResult]);

  const displayedReferralRows = useMemo<ReferralRow[]>(() => {
    if (!actualKpiResult) return [];
    return actualKpiResult.referrals.map((row) => ({
      name: row.source,
      visit: row.newVisits.toLocaleString("ko-KR"),
      share: row.share === null ? "-" : `${row.share}%`,
    }));
  }, [actualKpiResult]);

  const referralDisplayRows = displayedReferralRows;

  const onlineChannelSummary = useMemo(() => {
    const initial = { naver: 0, kakao: 0, homepage: 0 };
    return (actualKpiResult?.channels ?? []).reduce((sum, row) => {
      const channel = row.channel.toLowerCase();
      if (channel.includes("네이버") || channel.includes("naver")) sum.naver += row.onlineInquiries;
      else if (channel.includes("카카오") || channel.includes("kakao")) sum.kakao += row.onlineInquiries;
      else if (channel.includes("홈페이지") || channel.includes("website") || channel.includes("자사몰")) sum.homepage += row.onlineInquiries;
      return sum;
    }, initial);
  }, [actualKpiResult]);

  const previousOnlineChannelSummary = useMemo(() => {
    const initial = { naver: 0, kakao: 0, homepage: 0 };
    return (previousKpiResult?.channels ?? []).reduce((sum, row) => {
      const channel = row.channel.toLowerCase();
      if (channel.includes("네이버") || channel.includes("naver")) sum.naver += row.onlineInquiries;
      else if (channel.includes("카카오") || channel.includes("kakao")) sum.kakao += row.onlineInquiries;
      else if (channel.includes("홈페이지") || channel.includes("website") || channel.includes("자사몰")) sum.homepage += row.onlineInquiries;
      return sum;
    }, initial);
  }, [previousKpiResult]);

  const displayedChannelRows = useMemo(() => {
    return mergedAdSourceRows.map((row) => ({
      name: row.name,
      spend: formatImportedMoney(row.spend),
      inquiry: `${row.inquiries.toLocaleString("ko-KR")}건`,
      reserve: `${row.reservations.toLocaleString("ko-KR")}건`,
      visit: `${row.visits.toLocaleString("ko-KR")}건`,
      conversion: row.inquiries === 0 ? "-" : `${Math.round((row.visits / row.inquiries) * 1000) / 10}%`,
      sales: formatImportedMoney(row.sales),
      roas: row.spend > 0 && row.sales > 0 ? `${Math.round((row.sales / row.spend) * 100)}%` : "-",
    }));
  }, [mergedAdSourceRows]);

  const requestedAdChannelRows = useMemo(() => {
    const formatRow = (name: string, spend: number, inquiry: number, reservation: number, visit: number, roas: number | null) => ({
      name,
      spend: `${spend.toLocaleString("ko-KR")}원`,
      inquiry: inquiry.toLocaleString("ko-KR"),
      reservation: reservation.toLocaleString("ko-KR"),
      visit: visit.toLocaleString("ko-KR"),
      cpl: inquiry === 0 ? "-" : `${Math.round(spend / inquiry).toLocaleString("ko-KR")}원`,
      reservationCpa: reservation === 0 ? "-" : `${Math.round(spend / reservation).toLocaleString("ko-KR")}원`,
      visitCpa: visit === 0 ? "-" : `${Math.round(spend / visit).toLocaleString("ko-KR")}원`,
      roas: roas === null ? "-" : `${roas}%`,
    });
    if (mergedAdSourceRows.length) {
      return mergedAdSourceRows.map((row) => formatRow(
        row.name,
        row.spend,
        row.inquiries,
        row.reservations,
        row.visits,
        row.spend > 0 && row.sales > 0 ? Math.round((row.sales / row.spend) * 100) : null,
      ));
    }
    return [];
  }, [mergedAdSourceRows]);

  const rawAdChannelRows = useMemo(() => {
    const formatRow = (name: string, spend: number, impressions: number, clicks: number, conversions: number) => ({
      name,
      spend: `${spend.toLocaleString("ko-KR")}원`,
      impressions: impressions.toLocaleString("ko-KR"),
      clicks: clicks.toLocaleString("ko-KR"),
      ctr: impressions === 0 ? "-" : `${Math.round((clicks / impressions) * 10000) / 100}%`,
      cpc: clicks === 0 ? "-" : `${Math.round(spend / clicks).toLocaleString("ko-KR")}원`,
      conversions: conversions.toLocaleString("ko-KR"),
      conversionRate: clicks === 0 ? "-" : `${Math.round((conversions / clicks) * 10000) / 100}%`,
      conversionCost: conversions === 0 ? "-" : `${Math.round(spend / conversions).toLocaleString("ko-KR")}원`,
    });
    return mergedAdSourceRows.map((row) => ({
      ...formatRow(row.name, row.spend, row.impressions, row.clicks, row.conversions),
      automated: row.automated,
    }));
  }, [mergedAdSourceRows]);

  const kpiAdFunnelCards = useMemo<MetricCard[]>(() => {
    if (!mergedAdSourceRows.length) return ["광고비", "광고 노출", "광고 클릭", "CTR", "광고 전환", "전환당 비용"].map((label, index) => ({ label, value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: (["green", "blue", "violet", "orange", "blue", "green"] as Tone[])[index] }));
    const spend = mergedAdSourceTotals.spend;
    const impressions = mergedAdSourceTotals.impressions;
    const clicks = mergedAdSourceTotals.clicks;
    const conversions = mergedAdSourceTotals.conversions;
    const ctr = impressions === 0 ? null : Math.round((clicks / impressions) * 10000) / 100;
    const conversionCost = conversions === 0 ? null : Math.round(spend / conversions);
    return [
      { label: "광고비", value: `${spend.toLocaleString("ko-KR")}원`, delta: automatedNaverSourceRows.length ? "자동화 반영" : "기간 집계", previous: "매체별 광고비 합계", icon: "", tone: "green" },
      { label: "광고 노출", value: impressions.toLocaleString("ko-KR"), delta: "기간 집계", previous: "매체별 노출 합계", icon: "", tone: "blue" },
      { label: "광고 클릭", value: clicks.toLocaleString("ko-KR"), delta: "기간 집계", previous: "매체별 클릭 합계", icon: "", tone: "violet" },
      { label: "CTR", value: ctr === null ? "-" : `${ctr}%`, delta: "자동 계산", previous: "클릭 ÷ 노출", icon: "", tone: "orange" },
      { label: "광고 전환", value: conversions.toLocaleString("ko-KR"), delta: "기간 집계", previous: "광고 전환 또는 실제 내원", icon: "", tone: "blue" },
      { label: "전환당 비용", value: conversionCost === null ? "-" : `${conversionCost.toLocaleString("ko-KR")}원`, delta: "자동 계산", previous: "광고비 ÷ 전환", icon: "", tone: "green" },
    ];
  }, [automatedNaverSourceRows.length, mergedAdSourceRows.length, mergedAdSourceTotals]);

  const kpiRecommendations = useMemo(() => {
    const channels = mergedAdSourceRows;
    const summary = actualKpiResult?.summary;
    if (!summary) return [{ title: "분석 보류", detail: `${periodDefinition.range}에 상담·예약·내원 원천 데이터가 없어 실행 제안을 생성하지 않습니다.` }];
    if (summary.reservationRate === null || summary.reservationVisitRate === null || summary.walkInRate === null || summary.noShowRate === null) {
      return [{ title: "분석 보류", detail: `${periodDefinition.range}의 전환율 계산에 필요한 문의·예약·내원 데이터가 부족합니다.` }];
    }
    const detailMismatch = actualKpiResult.departments.reduce((sum, row) => sum + row.inquiries, 0) !== summary.inquiry
      || actualKpiResult.departments.reduce((sum, row) => sum + row.reservations, 0) !== summary.reservation
      || actualKpiResult.departments.reduce((sum, row) => sum + row.newVisits, 0) !== summary.newVisit;
    if (detailMismatch) return [{ title: "합계 검증 필요", detail: `${periodDefinition.range}의 기간 합계와 진료과목 합계가 일치하지 않아 원인 분석과 실행 제안을 보류합니다.` }];
    const channelEfficiency = channels
      .filter((row) => row.spend > 0 && row.sales > 0)
      .map((row) => ({ ...row, roas: Math.round((row.sales / row.spend) * 100), conversionCost: row.conversions > 0 ? Math.round(row.spend / row.conversions) : null }));
    const topRoas = [...channelEfficiency].sort((a, b) => b.roas - a.roas)[0];
    const bestCost = [...channelEfficiency].filter((row) => row.conversionCost !== null).sort((a, b) => (a.conversionCost ?? Infinity) - (b.conversionCost ?? Infinity))[0];
    const noShowRate = summary.noShowRate;
    const reservationRate = summary.reservationRate;
    const reservationVisitRate = summary.reservationVisitRate;
    const walkInRate = summary.walkInRate;
    const reservationTarget = Number(kpiTargets.find((target) => target.metric === "예약률")?.hospital.replace(/[^0-9.]/g, "") || 0);
    const targetGap = reservationTarget > 0 ? Math.round((reservationRate - reservationTarget) * 10) / 10 : null;
    const comparisonPeriod = compareOption;
    const bottleneck = reservationRate < 15
      ? `예약률 ${reservationRate}%로 문의에서 예약으로 넘어가는 구간`
      : reservationVisitRate < 70
        ? `예약→내원율 ${reservationVisitRate}%로 예약 이후 실제 방문으로 이어지는 구간`
        : `비예약 내원율 ${walkInRate}%로 예약 없이 방문하는 구간`;
    return [
      {
        title: "핵심 전환 병목 우선 개선",
        detail: `${bottleneck}을 1순위로 봅니다.${targetGap === null ? "" : ` 병원 목표 ${reservationTarget}% 대비 ${targetGap >= 0 ? "+" : ""}${targetGap}%p입니다.`} ${comparisonPeriod} 대비 단계별 이탈을 분리해 상담 스크립트와 예약 후 리마인드 대상을 조정합니다.`,
      },
      {
        title: `${topRoas?.name ?? "광고 귀속 확인"} 성과 기반 예산 재배분`,
        detail: topRoas && bestCost ? `ROAS ${topRoas.roas}%인 ${topRoas.name}의 예산을 유지하고, 전환당 비용 ${bestCost.conversionCost?.toLocaleString("ko-KR")}원인 ${bestCost.name}과 비교해 효율 구간 중심으로 조정합니다.` : "매출 귀속 또는 전환 데이터가 부족해 매체별 증액 제안을 보류합니다.",
      },
      {
        title: "노쇼·비예약 내원 이중 관리",
        detail: `노쇼율 ${noShowRate}%와 비예약 내원율 ${walkInRate}%를 별도 KPI로 관리합니다. 예약자는 전일·당일 확인을 적용하고, 비예약 내원자는 유입경로와 상담 가능 시간을 기록해 예약 전환 개선에 활용합니다.`,
      },
    ];
  }, [actualKpiResult, compareOption, kpiTargets, mergedAdSourceRows, periodDefinition.range]);

  const activeAdChannelShare = useMemo(() => {
    if (!mergedAdSourceRows.length) return [];
    const totalSpend = mergedAdSourceTotals.spend || 1;
    return mergedAdSourceRows.map((row, index) => ({
      label: row.name,
      value: Math.round((row.spend / totalSpend) * 1000) / 10,
      color: adChannelShare[index % adChannelShare.length].color,
      amount: formatImportedMoney(row.spend),
    }));
  }, [mergedAdSourceRows, mergedAdSourceTotals.spend]);

  const fallbackCurrentSummary = useMemo(() => {
    const inquiry = 0;
    const reservation = 0;
    const newVisit = 0;
    const bookedVisit = 0;
    const walkInVisit = 0;
    const noShow = 0;
    return {
      inquiry,
      phoneInquiry: 0,
      phoneReservation: 0,
      onlineInquiry: 0,
      onlineReservation: 0,
      reservation,
      reservationRate: inquiry === 0 ? null : Math.round((reservation / inquiry) * 1000) / 10,
      newVisit,
      bookedVisit,
      walkInVisit,
      walkInRate: newVisit === 0 ? null : Math.round((walkInVisit / newVisit) * 1000) / 10,
      noShowEligible: 0,
      noShowRate: reservation === 0 ? null : Math.round((noShow / reservation) * 1000) / 10,
      reservationVisitRate: reservation === 0 ? null : Math.round((bookedVisit / reservation) * 1000) / 10,
      inquiryVisitRate: inquiry === 0 ? null : Math.round((newVisit / inquiry) * 1000) / 10,
      sales: 0,
      adSpend: 0,
    };
  }, []);
  const fallbackPreviousSummary = {
    inquiry: 0,
    phoneInquiry: 0,
    phoneReservation: 0,
    onlineInquiry: 0,
    onlineReservation: 0,
    reservation: 0,
    reservationRate: null,
    newVisit: 0,
    bookedVisit: 0,
    walkInVisit: 0,
    walkInRate: null,
    noShowEligible: 0,
    noShowRate: null,
    reservationVisitRate: null,
    inquiryVisitRate: null,
    sales: 0,
    adSpend: 0,
  };
  const currentSummary = actualKpiResult?.summary ?? fallbackCurrentSummary;
  const previousSummary = previousKpiResult?.summary ?? fallbackPreviousSummary;
  const comparisonLabel = compareOption;
  const countDelta = (current: number, previous: number) => previous === 0 ? "-" : `${current >= previous ? "+" : ""}${Math.round(((current - previous) / previous) * 1000) / 10}%`;
  const rateDelta = (current: number | null, previous: number | null) => current === null || previous === null ? "-" : `${current - previous >= 0 ? "+" : ""}${Math.round((current - previous) * 10) / 10}%p`;

  const displayedKpiCards = useMemo(() => {
    if (!actualKpiResult) return kpiCards.map((card) => ({ ...card, value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시" }));
    const summary = actualKpiResult.summary;
    return [
      { ...kpiCards[0], value: scaleMetricValue(summary.inquiry.toLocaleString("ko-KR"), kpiCards[0].label, periodScale) },
      { ...kpiCards[1], value: scaleMetricValue(summary.reservation.toLocaleString("ko-KR"), kpiCards[1].label, periodScale) },
      { ...kpiCards[2], value: scaleMetricValue(summary.visit.toLocaleString("ko-KR"), kpiCards[2].label, periodScale) },
      { ...kpiCards[3], value: scaleMetricValue(formatImportedMoney(summary.adSpend), kpiCards[3].label, periodScale) },
      { ...kpiCards[4], value: scaleMetricValue(formatImportedMoney(summary.sales), kpiCards[4].label, periodScale) },
      { ...kpiCards[5], value: summary.roas === null ? "-" : `${summary.roas}%` },
    ];
  }, [actualKpiResult, periodScale]);

  const mainMetricCards = useMemo<MetricCard[]>(() => {
    if (!actualKpiResult) return kpiCards.slice(0, 1).concat([
      { label: "전체 예약", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "violet" },
      { label: "예약률", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "orange" },
      { label: "신환 내원", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "blue" },
      { label: "예약 내원", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "green" },
      { label: "비예약 내원", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "violet" },
      { label: "비예약 내원율", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "orange" },
      { label: "노쇼율", value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: "blue" },
    ]);
    const summary = currentSummary;
    const previous = previousSummary;
    const value = (number: number | null | undefined) => number === null || number === undefined ? "-" : Math.round(number).toLocaleString("ko-KR");
    const rate = (number: number | null | undefined) => number === null || number === undefined ? "-" : `${number}%`;
    return [
      { label: "전체 문의", value: value(summary.inquiry), delta: countDelta(summary.inquiry, previous.inquiry), previous: `${comparisonLabel} · 전화 + 온라인 문의`, icon: "", tone: "green" },
      { label: "전체 예약", value: value(summary.reservation), delta: countDelta(summary.reservation, previous.reservation), previous: `${comparisonLabel} · 예약 완료 건수`, icon: "", tone: "violet" },
      { label: "예약률", value: rate(summary.reservationRate), delta: rateDelta(summary.reservationRate, previous.reservationRate), previous: `${comparisonLabel} · 예약 ÷ 유효 문의`, icon: "", tone: "orange" },
      { label: "신환 내원", value: value(summary.newVisit), delta: countDelta(summary.newVisit, previous.newVisit), previous: `${comparisonLabel} · 전체 신규 환자`, icon: "", tone: "blue" },
      { label: "예약 내원", value: value(summary.bookedVisit), delta: countDelta(summary.bookedVisit, previous.bookedVisit), previous: `${comparisonLabel} · 예약 후 실제 내원`, icon: "", tone: "green" },
      { label: "비예약 내원", value: value(summary.walkInVisit), delta: countDelta(summary.walkInVisit, previous.walkInVisit), previous: `${comparisonLabel} · 예약 없이 직접 내원`, icon: "", tone: "violet" },
      { label: "비예약 내원율", value: rate(summary.walkInRate), delta: rateDelta(summary.walkInRate, previous.walkInRate), previous: `${comparisonLabel} · 비예약 내원 ÷ 신환 내원`, icon: "", tone: "orange" },
      { label: "노쇼율", value: rate(summary.noShowRate), delta: rateDelta(summary.noShowRate, previous.noShowRate), previous: `${comparisonLabel} · 예정일 경과 미내원 ÷ 방문예정 예약`, icon: "", tone: "blue" },
    ];
  }, [comparisonLabel, countDelta, currentSummary, previousSummary, rateDelta]);

  const kpiGoalStatus = useMemo(() => {
    const summary = actualKpiResult?.summary;
    const adSpend = mergedAdSourceRows.length ? mergedAdSourceTotals.spend : summary?.adSpend ?? 0;
    const values: Record<string, number | null | undefined> = {
      "예약률": summary?.reservationRate,
      "예약→내원율": summary?.reservationVisitRate,
      "문의→내원율": summary?.inquiryVisitRate,
      "CPL": summary && summary.inquiry > 0 ? Math.round(adSpend / summary.inquiry) : null,
      "예약 CPA": summary && summary.reservation > 0 ? Math.round(adSpend / summary.reservation) : null,
      "내원 CPA": summary && summary.newVisit > 0 ? Math.round(adSpend / summary.newVisit) : null,
      "ROAS": summary && adSpend > 0 ? Math.round((summary.sales / adSpend) * 1000) / 10 : null,
      "노쇼율": summary?.noShowRate,
    };
    return kpiTargets.map((target) => {
      const current = values[target.metric];
      const goal = Number(target.hospital.replace(/[^0-9.]/g, ""));
      const lowerIsBetter = ["CPL", "예약 CPA", "내원 CPA", "노쇼율"].includes(target.metric);
      const passed = current !== null && current !== undefined && Number.isFinite(goal) ? (lowerIsBetter ? current <= goal : current >= goal) : null;
      return { ...target, current, goal, passed };
    });
  }, [actualKpiResult, kpiTargets, mergedAdSourceRows.length, mergedAdSourceTotals.spend]);

  const kpiGoalEvidence = useMemo(() => kpiGoalStatus
    .filter((item) => item.current !== null && item.current !== undefined)
    .slice(0, 4)
    .map((item) => `${item.metric} 현재 ${item.current}${item.metric.includes("율") || item.metric === "ROAS" ? "%" : ""} / 목표 ${item.hospital} / ${item.passed === null ? "판정 보류" : item.passed ? "목표 달성" : "목표 미달"}`)
    .join(" · "), [kpiGoalStatus]);

  const goalAwareMainMetricCards = useMemo(() => mainMetricCards.map((card) => {
    const goal = kpiGoalStatus.find((item) => item.metric === card.label);
    if (!goal) return card;
    return {
      ...card,
      goalText: goal.passed === null ? `목표 ${goal.hospital} · 평가 대기` : `목표 ${goal.hospital} · ${goal.passed ? "달성" : "미달"}`,
      goalPassed: goal.passed,
    };
  }), [kpiGoalStatus, mainMetricCards]);

  const executiveKpiCards = useMemo<MetricCard[]>(() => {
    if (!actualKpiResult) return ["전체 문의", "전체 예약", "예약률", "신환 내원", "문의→내원율", "총 매출", "총 광고비", "ROAS"].map((label, index) => ({ label, value: "-", delta: "데이터 미연동", previous: "실데이터 연결 후 표시", icon: "", tone: (["green", "violet", "orange", "blue", "green", "violet", "orange", "blue"] as Tone[])[index] }));
    const current = actualKpiResult.summary;
    const previous = previousKpiResult?.summary ?? fallbackPreviousSummary;
    const adSpend = mergedAdSourceRows.length ? mergedAdSourceTotals.spend : current.adSpend;
    const previousAdSpend = previous.adSpend ?? 0;
    const roas = adSpend > 0 && current.sales > 0 ? Math.round((current.sales / adSpend) * 1000) / 10 : null;
    const previousRoas = previousAdSpend > 0 && (previous.sales ?? 0) > 0 ? Math.round(((previous.sales ?? 0) / previousAdSpend) * 1000) / 10 : null;
    const value = (number: number) => number.toLocaleString("ko-KR");
    const rate = (number: number | null) => number === null ? "-" : `${number}%`;
    const cards: MetricCard[] = [
      { label: "전체 문의", value: value(current.inquiry), delta: countDelta(current.inquiry, previous.inquiry), previous: `${comparisonLabel} · 전화 + 온라인 유효 문의`, icon: "", tone: "green" },
      { label: "전체 예약", value: value(current.reservation), delta: countDelta(current.reservation, previous.reservation), previous: `${comparisonLabel} · 예약 완료`, icon: "", tone: "violet" },
      { label: "예약률", value: rate(current.reservationRate), delta: rateDelta(current.reservationRate, previous.reservationRate), previous: `${comparisonLabel} · 예약 ÷ 유효 문의`, icon: "", tone: "orange" },
      { label: "신환 내원", value: value(current.newVisit), delta: countDelta(current.newVisit, previous.newVisit), previous: `${comparisonLabel} · 신규 환자`, icon: "", tone: "blue" },
      { label: "문의→내원율", value: rate(current.inquiryVisitRate), delta: rateDelta(current.inquiryVisitRate, previous.inquiryVisitRate), previous: `${comparisonLabel} · 신환 내원 ÷ 유효 문의`, icon: "", tone: "green" },
      { label: "총 매출", value: formatImportedMoney(current.sales), delta: countDelta(current.sales, previous.sales), previous: `${comparisonLabel} · 순매출`, icon: "", tone: "violet" },
      { label: "총 광고비", value: formatImportedMoney(adSpend), delta: countDelta(adSpend, previousAdSpend), previous: `${comparisonLabel} · 광고 원천 데이터`, icon: "", tone: "orange" },
      { label: "ROAS", value: rate(roas), delta: rateDelta(roas, previousRoas), previous: `${comparisonLabel} · 매출 ÷ 광고비`, icon: "", tone: "blue" },
    ];
    return cards.map((card) => {
      const goal = kpiGoalStatus.find((item) => item.metric === card.label);
      return goal ? { ...card, goalText: `목표 ${goal.hospital} · ${goal.passed ? "달성" : "미달"}`, goalPassed: goal.passed } : card;
    });
  }, [actualKpiResult, comparisonLabel, countDelta, kpiGoalStatus, mergedAdSourceRows.length, mergedAdSourceTotals.spend, previousKpiResult, rateDelta]);

  const selectedKpiDetail = useMemo(() => {
    if (!selectedKpiLabel) return null;
    const card = executiveKpiCards.find((item) => item.label === selectedKpiLabel);
    if (!card) return null;
    const definitions: Record<string, { formula: string; sources: string; validation: string }> = {
      "전체 문의": { formula: "전화 유효 문의 + 온라인 유효 문의", sources: "CRM 상담·문의 원천", validation: "진료과목별 문의 합계와 대사" },
      "전체 예약": { formula: "선택 기간의 예약 완료 건수", sources: "CRM 예약 원천", validation: "진료과목별 예약 합계와 대사" },
      "예약률": { formula: "전체 예약 ÷ 전체 유효 문의 × 100", sources: "CRM 상담·문의 + 예약 원천", validation: "문의가 0이면 평가 보류" },
      "신환 내원": { formula: "선택 기간의 전체 신규 환자", sources: "CRM 내원 원천", validation: "진료과목·내원경로 합계와 대사" },
      "문의→내원율": { formula: "신환 내원 ÷ 전체 유효 문의 × 100", sources: "CRM 상담·문의 + 내원 원천", validation: "동일 기간 집계 여부 확인" },
      "총 매출": { formula: "결제 금액 - 환불 금액", sources: "CRM 결제·환불 원천", validation: "일자별 매출 합계와 대사" },
      "총 광고비": { formula: "선택 기간 매체별 광고비 합계", sources: "네이버 검색광고·플레이스·업로드 광고 원천", validation: "매체별 광고비 합계와 대사" },
      "ROAS": { formula: "총 매출 ÷ 총 광고비 × 100", sources: "CRM 결제·환불 + 광고 매체 원천", validation: "광고비가 0이면 평가 보류" },
    };
    const definition = definitions[card.label] ?? { formula: "선택 기간 집계", sources: "연결된 원천 데이터", validation: "기간 합계와 세부 합계 대사" };
    return {
      card,
      ...definition,
      reconciliation: reconciliationWarning ? "합계 불일치 · 데이터 관리 확인 필요" : "기간 합계와 세부 합계 일치",
    };
  }, [executiveKpiCards, reconciliationWarning, selectedKpiLabel]);

  const kpiDecisionData = useMemo(() => {
    const summary = actualKpiResult?.summary;
    const totals = {
      inquiries: summary?.inquiry ?? 0,
      reservations: summary?.reservation ?? 0,
      visits: summary?.newVisit ?? 0,
      sales: summary?.sales ?? 0,
      adSpend: mergedAdSourceRows.length ? mergedAdSourceTotals.spend : summary?.adSpend ?? 0,
    };
    const rate = (part: number, total: number) => total > 0 ? Math.round((part / total) * 1000) / 10 : null;
    const values: Record<string, number | null> = {
      "예약률": rate(totals.reservations, totals.inquiries),
      "문의→내원율": rate(totals.visits, totals.inquiries),
      "내원 CPA": totals.visits > 0 ? Math.round(totals.adSpend / totals.visits) : null,
      "ROAS": rate(totals.sales, totals.adSpend),
    };
    const goals = ["예약률", "문의→내원율", "내원 CPA", "ROAS"].map((metric) => {
      const target = kpiTargets.find((item) => item.metric === metric);
      const current = values[metric];
      const goal = Number(target?.hospital.replace(/[^0-9.]/g, "") ?? "");
      const lowerIsBetter = metric === "내원 CPA";
      const passed = current !== null && Number.isFinite(goal) ? (lowerIsBetter ? current <= goal : current >= goal) : null;
      const achievement = current === null || !Number.isFinite(goal) || goal === 0
        ? 0
        : Math.min(140, Math.round((lowerIsBetter ? goal / current : current / goal) * 100));
      return { metric, current, target: target?.hospital ?? "설정 필요", passed, achievement, lowerIsBetter };
    });
    return { totals, goals };
  }, [actualKpiResult, kpiTargets, mergedAdSourceRows.length, mergedAdSourceTotals.spend]);

  const consultRecommendations = useMemo(() => {
    const summary = currentSummary;
    const departments = actualKpiResult?.departments ?? [];
    if (!actualKpiResult) return [{ title: "분석 보류", detail: `${periodDefinition.range}에 상담·예약·내원 원천 데이터가 없습니다.` }];
    const reconciled = departments.reduce((sum, row) => sum + row.inquiries, 0) === summary.inquiry
      && departments.reduce((sum, row) => sum + row.reservations, 0) === summary.reservation
      && departments.reduce((sum, row) => sum + row.newVisits, 0) === summary.newVisit;
    if (!reconciled) return [{ title: "합계 검증 필요", detail: `${periodDefinition.range}의 진료과목 합계가 전체 합계와 일치하지 않아 상담 실행 제안을 보류합니다.` }];
    const topDepartment = [...departments].sort((a, b) => b.inquiries - a.inquiries)[0];
    const conversionDepartments = departments.filter((row) => row.inquiries > 0).map((row) => ({ ...row, rate: row.reservations / row.inquiries * 100 }));
    const bestDepartment = [...conversionDepartments].sort((a, b) => b.rate - a.rate)[0];
    const phoneRate = summary.phoneInquiry > 0 ? summary.phoneReservation / summary.phoneInquiry * 100 : 0;
    const onlineRate = summary.onlineInquiry > 0 ? summary.onlineReservation / summary.onlineInquiry * 100 : 0;
    const channelGap = Math.abs(phoneRate - onlineRate);
    return [
      { title: `${topDepartment?.department ?? "문의 집중 진료과목"} 상담 슬롯 우선 배정`, detail: `선택 기간 문의 ${topDepartment?.inquiries ?? summary.inquiry}건으로 수요가 가장 집중된 영역입니다. 피크 시간대 상담 인력을 우선 배치해 응답 지연과 예약 누락을 줄입니다.` },
      { title: "전화·온라인 전환 격차 보정", detail: `전화 예약률 ${phoneRate.toFixed(1)}%, 온라인 예약률 ${onlineRate.toFixed(1)}%로 ${channelGap.toFixed(1)}%p 차이가 납니다. 낮은 채널의 첫 응대 질문과 예약 링크 노출을 상향 표준화합니다.` },
      { title: `${bestDepartment?.department ?? "진료과목"} 예약 전환 패턴 확산`, detail: `${bestDepartment?.department ?? "상위 진료과목"}의 문의→예약률 ${bestDepartment ? bestDepartment.rate.toFixed(1) : "-"}%을 기준으로 상담 질문, 예상 대기시간, 예약 확정 문구를 전 진료과목에 재적용합니다.` },
    ];
  }, [actualKpiResult, currentSummary, periodDefinition.range]);

  const adRecommendations = useMemo(() => {
    const channels = mergedAdSourceRows.map((row) => ({
      ...row,
      roas: row.spend > 0 && row.sales > 0 ? Math.round((row.sales / row.spend) * 100) : null,
      cpl: row.inquiries > 0 ? Math.round(row.spend / row.inquiries) : null,
    }));
    if (!channels.length) return [{ title: "분석 보류", detail: `${periodDefinition.range}에 연결된 광고 원천 데이터가 없습니다.` }];
    const attributed = channels.filter((row) => row.roas !== null);
    const topRoas = [...attributed].sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];
    const spendRisk = [...attributed].sort((a, b) => b.spend - a.spend).find((row) => (row.roas ?? 0) < (topRoas?.roas ?? 0) * 0.7);
    const ctr = mergedAdSourceTotals.impressions > 0 ? mergedAdSourceTotals.clicks / mergedAdSourceTotals.impressions * 100 : null;
    const cpl = mergedAdSourceTotals.inquiries > 0 ? Math.round(mergedAdSourceTotals.spend / mergedAdSourceTotals.inquiries) : null;
    return [
      { title: `${topRoas?.name ?? "매출 귀속 확인"} 성과 구간 검토`, detail: topRoas ? `ROAS ${topRoas.roas}%인 매체의 전환 검색어·소재·시간대를 확인해 검증된 세그먼트에만 점진적으로 확장합니다.` : "매체별 매출 귀속 데이터가 없어 예산 증액 제안을 보류합니다." },
      { title: `${spendRisk?.name ?? "저효율 고지출 매체"} 예산 보호선 설정`, detail: spendRisk ? `광고비 ${spendRisk.spend.toLocaleString("ko-KR")}원 대비 ROAS ${spendRisk.roas ?? "-"}%로 상위 매체보다 낮습니다. 일예산 상한과 CPA 경보를 설정합니다.` : "지출 규모와 효율을 함께 비교할 수 있도록 광고 문의·예약·내원 귀속값을 유지합니다." },
      { title: "클릭 이후 전환 품질 개선", detail: `CTR ${ctr === null ? "-" : ctr.toFixed(2)}%, CPL ${cpl === null ? "-" : `${cpl.toLocaleString("ko-KR")}원`}을 함께 보며 클릭만 늘리는 소재보다 예약·내원으로 이어지는 랜딩과 문의 폼을 우선 개선합니다.` },
    ];
  }, [mergedAdSourceRows, mergedAdSourceTotals, periodDefinition.range]);

  const reportHeadline = actualKpiResult
    ? `업로드 데이터 기준 문의 ${actualKpiResult.summary.inquiry.toLocaleString("ko-KR")}건, 내원 ${actualKpiResult.summary.visit.toLocaleString("ko-KR")}건을 확인했습니다.`
    : "선택 기간에 연결된 실데이터가 없어 요약을 보류합니다.";
  const reportExportText = actualKpiResult
    ? `${reportHeadline}\n광고비 ${formatImportedMoney(actualKpiResult.summary.adSpend)}, 매출 ${formatImportedMoney(actualKpiResult.summary.sales)}, ROAS ${actualKpiResult.summary.roas ?? "-"}%.\nAI는 원인을 단정하지 않고 집계된 KPI를 근거로 다음 실행 우선순위를 제안합니다.`
    : `${reportHeadline}\n기준 기간: ${activeDateRange.start} ~ ${activeDateRange.end}. 원천 데이터 연결 후 다시 분석하세요.`;

  const copyAiReport = async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(reportExportText);
    }
  };

  const commonDataStatus = dataSourceState === "live"
    ? (dataQuality && (dataQuality.warnings.missingLinks > 0 || dataQuality.warnings.duplicates > 0 || dataQuality.reconciliation.some((row) => !row.passed)) ? "부분 연동" : "정상 연동")
    : dataSourceState === "loading" ? "연결 확인 중" : "미연동";
  const dimensionReconciliation = actualKpiResult
    ? [
      { metric: "departmentInquiries", total: actualKpiResult.summary.inquiry, detailTotal: actualKpiResult.departments.reduce((sum, row) => sum + row.inquiries, 0) },
      { metric: "departmentPhoneInquiries", total: actualKpiResult.summary.phoneInquiry, detailTotal: actualKpiResult.departments.reduce((sum, row) => sum + row.phoneInquiries, 0) },
      { metric: "departmentOnlineInquiries", total: actualKpiResult.summary.onlineInquiry, detailTotal: actualKpiResult.departments.reduce((sum, row) => sum + row.onlineInquiries, 0) },
      { metric: "departmentReservations", total: actualKpiResult.summary.reservation, detailTotal: actualKpiResult.departments.reduce((sum, row) => sum + row.reservations, 0) },
      { metric: "departmentPhoneReservations", total: actualKpiResult.summary.phoneReservation, detailTotal: actualKpiResult.departments.reduce((sum, row) => sum + row.phoneReservations, 0) },
      { metric: "departmentOnlineReservations", total: actualKpiResult.summary.onlineReservation, detailTotal: actualKpiResult.departments.reduce((sum, row) => sum + row.onlineReservations, 0) },
      { metric: "departmentNewVisits", total: actualKpiResult.summary.newVisit, detailTotal: actualKpiResult.departments.reduce((sum, row) => sum + row.newVisits, 0) },
      { metric: "channelInquiries", total: actualKpiResult.summary.inquiry, detailTotal: actualKpiResult.channels.reduce((sum, row) => sum + row.inquiries, 0) },
      { metric: "channelReservations", total: actualKpiResult.summary.reservation, detailTotal: actualKpiResult.channels.reduce((sum, row) => sum + row.reservations, 0) },
      { metric: "referralNewVisits", total: actualKpiResult.summary.newVisit, detailTotal: actualKpiResult.referrals.reduce((sum, row) => sum + row.newVisits, 0) },
    ].map((row) => ({ ...row, passed: row.total === row.detailTotal }))
    : [];
  const reconciliationRows = [...(dataQuality?.reconciliation ?? []), ...dimensionReconciliation];
  const reconciliationWarning = reconciliationRows.some((row) => !row.passed);
  const reconciliationState = (metrics: string[]) => {
    const rows = dimensionReconciliation.filter((row) => metrics.includes(row.metric));
    return rows.length > 0 && rows.every((row) => row.passed);
  };
  const newPatientSummary = (() => {
    const current = actualKpiResult?.summary.newVisit ?? 0;
    const previous = previousKpiResult?.summary.newVisit ?? 0;
    const change = previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
    return {
      current,
      previous,
      delta: change === null ? "-" : `${change >= 0 ? "+" : ""}${change}%`,
      trendClass: change === null || change >= 0 ? "up" : "down",
      compareLabel: periodDefinition.compare.replace(/^vs\s*/, ""),
    maxDepartmentValue: Math.max(1, ...displayedNewPatientByDepartment.map((item) => item.value)),
    };
  })();
  const aiPeriodSummary = {
     kpi: actualKpiResult ? `${periodDefinition.range} 기준 전체 문의 ${executiveKpiCards[0]?.value ?? "-"}, 예약 ${executiveKpiCards[1]?.value ?? "-"}, 신환 내원 ${executiveKpiCards[3]?.value ?? "-"}, ROAS ${executiveKpiCards[7]?.value ?? "-"}입니다. 비교 기준은 ${comparisonRangeLabel}입니다.` : `${periodDefinition.range}에 연결된 실데이터가 없어 KPI 분석을 보류합니다.`,
     consult: actualKpiResult ? `${periodDefinition.range} 기준 전화·온라인 문의를 합산한 예약 흐름입니다. 현재 신환 내원은 ${displayedConsultCards[3]?.value ?? "-"}이며 비교 기간은 ${comparisonRangeLabel}입니다.` : `${periodDefinition.range}에 상담·내원 원천 데이터가 없어 전환 분석을 보류합니다.`,
     ads: mergedAdSourceRows.length ? `${periodDefinition.range} 기준 총 광고비 ${requestedAdCards[0]?.value ?? "-"}, 노출 ${kpiAdFunnelCards[1]?.value ?? "-"}, 클릭 ${kpiAdFunnelCards[2]?.value ?? "-"}, 전환 ${kpiAdFunnelCards[4]?.value ?? "-"}, ROAS ${requestedAdCards[7]?.value ?? "-"}입니다.` : `${periodDefinition.range}에 광고 원천 데이터가 없어 효율 분석을 보류합니다.`,
  };
  const aiEvidence = {
    kpi: `${periodDefinition.range} · 비교 ${comparisonRangeLabel} · 전체 문의 ${executiveKpiCards[0]?.value ?? "-"} · 전체 예약 ${executiveKpiCards[1]?.value ?? "-"} · 전체 내원 ${executiveKpiCards[3]?.value ?? "-"} · ROAS ${executiveKpiCards[7]?.value ?? "-"}`,
    consult: `${periodDefinition.range} · 비교 ${comparisonRangeLabel} · 문의 ${displayedConsultCards[0]?.value ?? "-"} · 예약 ${displayedConsultCards[1]?.value ?? "-"} · 예약률 ${displayedConsultCards[2]?.value ?? "-"} · 신환 ${displayedConsultCards[3]?.value ?? "-"}`,
    ads: `${periodDefinition.range} · 비교 ${comparisonRangeLabel} · 총 광고비 ${requestedAdCards[0]?.value ?? "-"} · 노출 ${kpiAdFunnelCards[1]?.value ?? "-"} · 클릭 ${kpiAdFunnelCards[2]?.value ?? "-"} · 전환 ${kpiAdFunnelCards[4]?.value ?? "-"} · ROAS ${requestedAdCards[7]?.value ?? "-"}`,
  };
  const aiEvidenceWithGoals = {
    ...aiEvidence,
    kpi: `${aiEvidence.kpi}${kpiGoalEvidence ? ` · 목표 대비 ${kpiGoalEvidence}` : ""}`,
  };
  const activeKpiRows = useMemo(
    () => dailyData.filter((row) => row.date >= activeDateRange.start && row.date <= activeDateRange.end).sort((a, b) => a.date.localeCompare(b.date)),
    [dailyData, activeDateRange.start, activeDateRange.end],
  );
  const activeKpiInquiryTrend = useMemo(
    () => activeKpiRows.map((row) => row.inquiries),
    [activeKpiRows, kpiTrendMode],
  );
  const activeKpiVisitTrend = useMemo(
    () => activeKpiRows.map((row) => row.visits),
    [activeKpiRows, kpiTrendMode],
  );
  const activeKpiReservationTrend = useMemo(
    () => activeKpiRows.map((row) => row.reservations),
    [activeKpiRows, kpiTrendMode],
  );
  const activeKpiSalesTrend = useMemo(() => activeKpiRows.map((row) => row.sales), [activeKpiRows]);
  const activeKpiSpendTrend = useMemo(() => activeKpiRows.map((row) => row.adSpend), [activeKpiRows]);
  const activeKpiRoasTrend = useMemo(() => activeKpiRows.map((row) => row.adSpend > 0 ? Math.round((row.sales / row.adSpend) * 100) : 0), [activeKpiRows]);
  const marketingCorrelationRows = useMemo(() => {
    const definitions = [
      { label: "광고비 ↔ 문의", left: activeKpiRows.map((row) => row.adSpend), right: activeKpiRows.map((row) => row.inquiries), use: "광고 지출과 상담 유입의 동행 여부" },
      { label: "문의 ↔ 예약", left: activeKpiRows.map((row) => row.inquiries), right: activeKpiRows.map((row) => row.reservations), use: "상담 수요가 예약으로 이어지는 안정성" },
      { label: "예약 ↔ 내원", left: activeKpiRows.map((row) => row.reservations), right: activeKpiRows.map((row) => row.visits), use: "예약 이후 실제 방문 연결 정도" },
      { label: "광고비 ↔ 매출", left: activeKpiRows.map((row) => row.adSpend), right: activeKpiRows.map((row) => row.sales), use: "지출과 당일 매출의 동행 여부" },
    ];
    return definitions.map((item) => {
      const coefficient = pearsonCorrelation(item.left, item.right);
      const strength = coefficient === null
        ? "분석 보류"
        : Math.abs(coefficient) >= 0.7
          ? "강한 관계"
          : Math.abs(coefficient) >= 0.4
            ? "보통 관계"
            : "약한 관계";
      const direction = coefficient === null ? "데이터 변동 부족" : coefficient >= 0 ? "같은 방향" : "반대 방향";
      return { ...item, coefficient, strength, direction };
    });
  }, [activeKpiRows]);
  const activeKpiWeekdays = useMemo(() => {
    const labels = ["월", "화", "수", "목", "금", "토", "일"];
    return labels.map((label, index) => {
      const rows = activeKpiRows.filter((row) => (new Date(`${row.date}T00:00:00`).getDay() + 6) % 7 === index);
      const average = (field: "inquiries" | "reservations" | "visits") => rows.length
        ? Math.round(rows.reduce((sum, row) => sum + row[field], 0) / rows.length)
        : 0;
      return { label, inquiries: average("inquiries"), reservations: average("reservations"), visits: average("visits") };
    });
  }, [activeKpiRows]);
  const consultDailyRows = useMemo(() => {
    const filtered = dailyData.filter((row) => row.date >= activeDateRange.start && row.date <= activeDateRange.end);
    return [...filtered].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  }, [dailyData, activeDateRange.start, activeDateRange.end]);
  const activeConsultInquiryTrend = useMemo(
    () => consultDailyRows.length > 0 ? consultDailyRows.map((row) => row.inquiries) : [],
    [consultDailyRows],
  );
  const activeConsultReserveTrend = useMemo(
    () => consultDailyRows.length > 0 ? consultDailyRows.map((row) => row.reservations) : [],
    [consultDailyRows],
  );
  const activeConsultVisitTrend = useMemo(
    () => consultDailyRows.length > 0 ? consultDailyRows.map((row) => row.visits) : [],
    [consultDailyRows],
  );
  const activeConsultReservationRateTrend = useMemo(
    () => consultDailyRows.map((row) => row.inquiries ? Math.round((row.reservations / row.inquiries) * 1000) / 10 : 0),
    [consultDailyRows],
  );
  const activeAdDailyRows = useMemo(() => {
    const byDate = new Map<string, NaverAdDailyRow>();
    [...(naverSearchAdData?.daily.search ?? []), ...(naverSearchAdData?.daily.place ?? [])].forEach((row) => {
      const current = byDate.get(row.date) ?? { date: row.date, spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, conversions: 0, conversionRate: 0, conversionCost: 0 };
      current.spend += row.spend;
      current.impressions += row.impressions;
      current.clicks += row.clicks;
      current.conversions += row.conversions;
      byDate.set(row.date, current);
    });
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({
      ...row,
      ctr: row.impressions > 0 ? Math.round((row.clicks / row.impressions) * 10000) / 100 : 0,
      cpc: row.clicks > 0 ? Math.round(row.spend / row.clicks) : 0,
      conversionRate: row.clicks > 0 ? Math.round((row.conversions / row.clicks) * 10000) / 100 : 0,
      conversionCost: row.conversions > 0 ? Math.round(row.spend / row.conversions) : 0,
    }));
  }, [naverSearchAdData]);
  const activeAdImpressionTrend = useMemo(() => activeAdDailyRows.map((row) => row.impressions), [activeAdDailyRows]);
  const activeAdClickTrend = useMemo(() => activeAdDailyRows.map((row) => row.clicks), [activeAdDailyRows]);
  const activeAdCpcTrend = useMemo(() => activeAdDailyRows.map((row) => row.cpc), [activeAdDailyRows]);

  const kpiInquiryPath = useMemo(() => pathFromSeries(activeKpiInquiryTrend, 600, 220, 26), [activeKpiInquiryTrend]);
  const kpiReservationPath = useMemo(() => pathFromSeries(activeKpiReservationTrend, 600, 220, 26), [activeKpiReservationTrend]);
  const kpiVisitPath = useMemo(() => pathFromSeries(activeKpiVisitTrend, 600, 220, 26), [activeKpiVisitTrend]);
  const kpiInquiryPoints = useMemo(() => pointsFromSeries(activeKpiInquiryTrend, 600, 220, 26), [activeKpiInquiryTrend]);
  const kpiReservationPoints = useMemo(() => pointsFromSeries(activeKpiReservationTrend, 600, 220, 26), [activeKpiReservationTrend]);
  const kpiVisitPoints = useMemo(() => pointsFromSeries(activeKpiVisitTrend, 600, 220, 26), [activeKpiVisitTrend]);
  const kpiSalesPath = useMemo(() => pathFromSeries(activeKpiSalesTrend, 600, 220, 26), [activeKpiSalesTrend]);
  const kpiSpendPath = useMemo(() => pathFromSeries(activeKpiSpendTrend, 600, 220, 26), [activeKpiSpendTrend]);
  const kpiRoasPath = useMemo(() => pathFromSeries(activeKpiRoasTrend, 600, 220, 26), [activeKpiRoasTrend]);
  const kpiSalesPoints = useMemo(() => pointsFromSeries(activeKpiSalesTrend, 600, 220, 26), [activeKpiSalesTrend]);
  const kpiSpendPoints = useMemo(() => pointsFromSeries(activeKpiSpendTrend, 600, 220, 26), [activeKpiSpendTrend]);
  const kpiRoasPoints = useMemo(() => pointsFromSeries(activeKpiRoasTrend, 600, 220, 26), [activeKpiRoasTrend]);

  const consultInquiryPath = useMemo(() => pathFromSeries(activeConsultInquiryTrend, 600, 220, 26), [activeConsultInquiryTrend]);
  const consultReservePath = useMemo(() => pathFromSeries(activeConsultReserveTrend, 600, 220, 26), [activeConsultReserveTrend]);
  const consultVisitPath = useMemo(() => pathFromSeries(activeConsultVisitTrend, 600, 220, 26), [activeConsultVisitTrend]);
  const consultInquiryPoints = useMemo(() => pointsFromSeries(activeConsultInquiryTrend, 600, 220, 26), [activeConsultInquiryTrend]);
  const consultReservePoints = useMemo(() => pointsFromSeries(activeConsultReserveTrend, 600, 220, 26), [activeConsultReserveTrend]);
  const consultVisitPoints = useMemo(() => pointsFromSeries(activeConsultVisitTrend, 600, 220, 26), [activeConsultVisitTrend]);

  const adImpressionPath = useMemo(() => pathFromSeries(activeAdImpressionTrend, 600, 220, 26), [activeAdImpressionTrend]);
  const adClickPath = useMemo(() => pathFromSeries(activeAdClickTrend, 600, 220, 26), [activeAdClickTrend]);
  const adCpcPath = useMemo(() => pathFromSeries(activeAdCpcTrend, 600, 220, 26), [activeAdCpcTrend]);
  const adImpressionPoints = useMemo(() => pointsFromSeries(activeAdImpressionTrend, 600, 220, 26), [activeAdImpressionTrend]);
  const adClickPoints = useMemo(() => pointsFromSeries(activeAdClickTrend, 600, 220, 26), [activeAdClickTrend]);
  const adCpcPoints = useMemo(() => pointsFromSeries(activeAdCpcTrend, 600, 220, 26), [activeAdCpcTrend]);

  const displayedAdChannelShare = useMemo(() => adMetricMode === "spend"
    ? activeAdChannelShare
    : activeAdChannelShare.map((item, index) => ({ ...item, value: [47.7, 43.8, 41.7, 42.9, 37.5][index] ?? item.value, amount: `${[47.7, 43.8, 41.7, 42.9, 37.5][index] ?? item.value}%` })),
    [activeAdChannelShare, adMetricMode]);

  const adDonut = useMemo(() => donutGradient(displayedAdChannelShare), [displayedAdChannelShare]);
  const adSpendDonut = useMemo(() => donutGradient(activeAdChannelShare), [activeAdChannelShare]);
  const referralDonut = useMemo(
    () => donutGradient(referralDisplayRows.map((row, index) => ({
      value: Number(row.visit.replaceAll(",", "")) || 0,
      color: ["#2ec4a8", "#4b80f7", "#f7b23b", "#d95d9f", "#8e63d6"][index % 5],
    }))),
    [referralDisplayRows],
  );

  const weekdayMonthlyAverages = useMemo(() => {
    const labels = ["월", "화", "수", "목", "금", "토", "일"];
    const averageFor = (range: { start: string; end: string }, weekdayIndex: number, field: "inquiries" | "visits") => {
      const values = dailyData
        .filter((row) => {
          const date = new Date(`${row.date}T00:00:00`);
          const mondayFirstDay = (date.getDay() + 6) % 7;
          return row.date >= range.start && row.date <= range.end && mondayFirstDay === weekdayIndex;
        })
        .map((row) => row[field]);
      return values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    };

    return labels.map((label, index) => ({
      label,
      previousInquiries: averageFor(comparisonDateRange, index, "inquiries"),
      currentInquiries: averageFor(activeDateRange, index, "inquiries"),
      previousVisits: averageFor(comparisonDateRange, index, "visits"),
      currentVisits: averageFor(activeDateRange, index, "visits"),
    }));
  }, [dailyData, activeDateRange.start, activeDateRange.end, comparisonDateRange.start, comparisonDateRange.end]);

  const weekdayInquiryMax = Math.max(1, ...weekdayMonthlyAverages.flatMap((item) => [item.previousInquiries, item.currentInquiries]));
  const weekdayVisitMax = Math.max(1, ...weekdayMonthlyAverages.flatMap((item) => [item.previousVisits, item.currentVisits]));

  const adWeekdayEfficiency = useMemo(() => {
    const labels = ["월", "화", "수", "목", "금", "토", "일"];
    const targetRange = adEfficiencyMonthMode === "current" ? activeDateRange : comparisonDateRange;
    return labels.map((label, index) => {
      const rows = dailyData.filter((row) => {
        const date = new Date(`${row.date}T00:00:00`);
        return row.date >= targetRange.start && row.date <= targetRange.end && (date.getDay() + 6) % 7 === index;
      });
      const totals = rows.reduce((acc, row) => ({
        spend: acc.spend + row.adSpend,
        inquiries: acc.inquiries + row.inquiries,
        reservations: acc.reservations + row.reservations,
        visits: acc.visits + row.visits,
        sales: acc.sales + row.sales,
      }), { spend: 0, inquiries: 0, reservations: 0, visits: 0, sales: 0 });
      return {
        label,
        cpl: totals.inquiries === 0 ? 0 : Math.round(totals.spend / totals.inquiries),
        reservationCpa: totals.reservations === 0 ? 0 : Math.round(totals.spend / totals.reservations),
        visitCpa: totals.visits === 0 ? 0 : Math.round(totals.spend / totals.visits),
        roas: totals.spend === 0 ? 0 : Math.round((totals.sales / totals.spend) * 100),
      };
    });
  }, [dailyData, adEfficiencyMonthMode, activeDateRange.start, activeDateRange.end, comparisonDateRange.start, comparisonDateRange.end]);

  const adEfficiencyMax = {
    cpl: Math.max(1, ...adWeekdayEfficiency.map((item) => item.cpl)),
    reservationCpa: Math.max(1, ...adWeekdayEfficiency.map((item) => item.reservationCpa)),
    visitCpa: Math.max(1, ...adWeekdayEfficiency.map((item) => item.visitCpa)),
    roas: Math.max(1, ...adWeekdayEfficiency.map((item) => item.roas)),
  };

  const ga4Scale = activePeriodDays / 7;
  const ga4Cards = useMemo<MetricCard[]>(() => {
    if (ga4Data) {
      const summary = ga4Data.summary;
      const minutes = Math.floor(summary.averageSessionDuration / 60);
      const seconds = Math.round(summary.averageSessionDuration % 60);
      return [
        { label: "세션", value: summary.sessions.toLocaleString("ko-KR"), delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "green" },
        { label: "활성 사용자", value: summary.activeUsers.toLocaleString("ko-KR"), delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "blue" },
        { label: "참여 세션", value: summary.engagedSessions.toLocaleString("ko-KR"), delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "violet" },
        { label: "참여율", value: `${summary.engagementRate}%`, delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "orange" },
        { label: "주요 전환", value: summary.keyEvents.toLocaleString("ko-KR"), delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "blue" },
        { label: "웹 전환율", value: `${summary.conversionRate}%`, delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "green" },
        { label: "신규 사용자", value: summary.newUsers.toLocaleString("ko-KR"), delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "violet" },
        { label: "페이지 조회수", value: summary.pageViews.toLocaleString("ko-KR"), delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "orange" },
        { label: "평균 참여 시간", value: `${minutes}분 ${seconds}초`, delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "blue" },
        { label: "이벤트 수", value: summary.eventCount.toLocaleString("ko-KR"), delta: "실데이터", previous: periodDefinition.compare, icon: "", tone: "green" },
      ];
    }
    return ["세션", "활성 사용자", "참여 세션", "참여율", "주요 전환", "웹 전환율", "신규 사용자", "페이지 조회수", "평균 참여 시간", "이벤트 수"].map((label, index) => ({
      label,
      value: "-",
      delta: "데이터 미연동",
      previous: "GA4 연결 후 비교",
      icon: "",
      tone: (["green", "blue", "violet", "orange", "blue", "green", "violet", "orange", "blue", "green"] as Tone[])[index],
    }));
  }, [ga4Data, ga4Scale, periodDefinition.compare]);

  const ga4ChannelRows = useMemo(() => ga4Data?.channels ?? [], [ga4Data]);
  const ga4ChannelSessionTotal = ga4ChannelRows.reduce((sum, row) => sum + row.sessions, 0);
  const ga4SessionsReconciled = !ga4Data || ga4ChannelSessionTotal === ga4Data.summary.sessions;

  const ga4Recommendations = useMemo(() => {
    const topConversion = [...ga4ChannelRows].sort((a, b) => b.rate - a.rate)[0];
    const lowEngagement = [...ga4ChannelRows].sort((a, b) => a.engaged - b.engaged)[0];
    if (!ga4Data || ga4ChannelRows.length === 0) return [
      { title: "GA4 데이터 연결 대기", detail: "선택 기간의 GA4 원천 데이터가 없어 원인 분석과 실행 제안을 보류합니다." },
    ];
    if (!ga4SessionsReconciled) return [
      { title: "GA4 합계 검증 필요", detail: `전체 세션 ${ga4Data.summary.sessions.toLocaleString("ko-KR")}건과 채널 합계 ${ga4ChannelSessionTotal.toLocaleString("ko-KR")}건이 일치하지 않아 채널 원인 분석을 보류합니다.` },
    ];
    if (ga4Data.summary.keyEvents === 0) return [
      { title: "주요 전환 이벤트 설정", detail: `선택 기간 이벤트 ${ga4Data.summary.eventCount.toLocaleString("ko-KR")}건은 수집됐지만 주요 전환은 0건입니다. 전화·카카오·예약 완료 이벤트를 GA4 주요 이벤트로 지정합니다.` },
      { title: "UTM 누락 세션 보완", detail: `UTM 미설정 세션 ${ga4Data.summary.utmMissingSessions.toLocaleString("ko-KR")}건의 광고 소재와 랜딩 URL에 표준 UTM을 적용합니다.` },
      { title: "웹 전환과 상담 데이터 연결 준비", detail: "이벤트 이름을 표준화한 뒤 문의ID 없이 날짜·채널·랜딩페이지 기준으로 상담 데이터와 대조합니다." },
    ];
    return [
      { title: `${topConversion?.channel ?? "상위 채널"} 전환 경로 유지`, detail: `웹 전환율 ${topConversion?.rate ?? 0}%로 가장 높아 랜딩페이지와 예약 버튼 구조를 유지합니다.` },
      { title: `${lowEngagement?.channel ?? "채널"} 랜딩 개선`, detail: `참여율 ${lowEngagement?.engaged ?? 0}%로 가장 낮아 첫 화면 메시지와 CTA를 점검합니다.` },
      { title: "웹 전환과 상담 데이터 대조", detail: `GA4 주요 전환 ${ga4Cards[4]?.value ?? "-"}건을 상담 문의ID와 대조해 누락 전환을 확인합니다.` },
    ];
  }, [ga4ChannelRows, ga4Cards, ga4ChannelSessionTotal, ga4Data, ga4SessionsReconciled]);

  const ga4LandingRows = useMemo(() => ga4Data?.landingPages ?? [], [ga4Data]);
  const ga4LandingConversionRows = useMemo(() => {
    const conversionPattern = /(phone|tel|call|kakao|reservation|booking|appointment|form_submit|generate_lead)/i;
    return (ga4Data?.landingConversions ?? [])
      .filter((row) => conversionPattern.test(row.event))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [ga4Data]);

  const ga4EventRows = useMemo(() => ga4Data?.events ?? [], [ga4Data]);

  const ga4ConversionReadiness = useMemo(() => {
    const definitions = [
      { label: "전화 문의", pattern: /(phone|tel|call)/i, recommendation: "전화번호 클릭 이벤트 추가" },
      { label: "카카오 문의", pattern: /kakao/i, recommendation: "카카오 상담 클릭 이벤트 추가" },
      { label: "예약 완료", pattern: /(reservation|booking|appointment|form_submit|generate_lead)/i, recommendation: "예약 완료 이벤트 추가" },
    ];
    return definitions.map((definition) => {
      const matched = ga4EventRows.filter((row) => definition.pattern.test(row.event));
      const count = matched.reduce((sum, row) => sum + row.count, 0);
      const keyEvent = matched.some((row) => row.keyEvent === "주요 전환");
      return {
        ...definition,
        count,
        keyEvent,
        eventNames: matched.map((row) => row.event).join(", "),
      };
    });
  }, [ga4EventRows]);

  const ga4DeviceRows = useMemo(() => ga4Data?.devices ?? [], [ga4Data]);

  const marketingFlowStages = [
    { label: "광고 노출", value: mergedAdSourceRows.length ? mergedAdSourceTotals.impressions.toLocaleString("ko-KR") : "미연동", source: "광고 매체" },
    { label: "광고 클릭", value: mergedAdSourceRows.length ? mergedAdSourceTotals.clicks.toLocaleString("ko-KR") : "미연동", source: "광고 매체" },
    { label: "웹 전환", value: ga4Data ? ga4Data.summary.keyEvents.toLocaleString("ko-KR") : "미연동", source: "GA4" },
    { label: "유효 문의", value: actualKpiResult ? currentSummary.inquiry.toLocaleString("ko-KR") : "미연동", source: "CRM" },
    { label: "예약", value: actualKpiResult ? currentSummary.reservation.toLocaleString("ko-KR") : "미연동", source: "CRM" },
    { label: "신환 내원", value: actualKpiResult ? currentSummary.newVisit.toLocaleString("ko-KR") : "미연동", source: "CRM" },
    { label: "매출", value: actualKpiResult ? formatImportedMoney(currentSummary.sales) : "미연동", source: "CRM" },
  ];

  const channelDecisionRows = mergedAdSourceRows.map((row) => {
    const cpl = row.inquiries > 0 ? Math.round(row.spend / row.inquiries) : null;
    const reservationCpa = row.reservations > 0 ? Math.round(row.spend / row.reservations) : null;
    const visitCpa = row.visits > 0 ? Math.round(row.spend / row.visits) : null;
    const roas = row.spend > 0 && row.sales > 0 ? Math.round((row.sales / row.spend) * 100) : null;
    const action = row.inquiries === 0
      ? "문의 귀속 확인"
      : row.sales === 0
        ? "매출 귀속 확인"
        : roas !== null && roas >= 500
          ? "유지 · 확대 검토"
          : visitCpa !== null
            ? "내원 CPA 개선"
            : "내원 연결 확인";
    return { ...row, cpl, reservationCpa, visitCpa, roas, action };
  });

  const channelFunnelRows = mergedAdSourceRows.map((row) => {
    const validRate = (part: number, total: number) => total > 0 && part <= total
      ? Math.round((part / total) * 1000) / 10
      : null;
    const stages = [
      { label: "클릭→문의", rate: validRate(row.inquiries, row.clicks) },
      { label: "문의→예약", rate: validRate(row.reservations, row.inquiries) },
      { label: "예약→내원", rate: validRate(row.visits, row.reservations) },
    ];
    const validStages = stages.filter((stage): stage is { label: string; rate: number } => stage.rate !== null);
    const bottleneck = [...validStages].sort((a, b) => a.rate - b.rate)[0] ?? null;
    return {
      ...row,
      clickToInquiry: stages[0].rate,
      inquiryToReservation: stages[1].rate,
      reservationToVisit: stages[2].rate,
      bottleneck,
      complete: validStages.length === stages.length,
    };
  });

  const ga4CrmBridge = {
    webConversions: ga4Data?.summary.keyEvents ?? null,
    crmInquiries: actualKpiResult?.summary.inquiry ?? null,
    crmReservations: actualKpiResult?.summary.reservation ?? null,
    utmMissing: ga4Data?.summary.utmMissingSessions ?? null,
    ready: Boolean(ga4Data && actualKpiResult && ga4SessionsReconciled),
  };

  const requestMenuChange = (menu: MenuKey) => {
    if (activeMenu === "data" && menu !== "data" && isDataDirty) {
      setPendingMenu(menu);
      return;
    }
    setActiveMenu(menu);
  };

  const discardDailyChangesAndNavigate = () => {
    if (dailyEditBackupRef.current) setDailyData(dailyEditBackupRef.current);
    dailyEditBackupRef.current = null;
    setEditedDailyDates([]);
    setIsDataDirty(false);
    setDailyEditReason("");
    setDailySaveState("idle");
    const nextMenu = pendingMenu;
    setPendingMenu(null);
    if (nextMenu) setActiveMenu(nextMenu);
  };

  const dataTrustSummary = {
    connectedSources: importedDataCounts.filter((item) => item.count > 0).length,
    totalSources: importedDataCounts.length,
    missingLinks: dataQuality?.warnings.missingLinks ?? 0,
    duplicates: dataQuality?.warnings.duplicates ?? 0,
    mismatches: reconciliationRows.filter((row) => !row.passed).length,
  };

  const renderKpi = () => (
    <>
      <section className="panel kpi-panel">
        <div className="section-title">마케팅 · CRM 경영 핵심 KPI</div>
        <p className="section-helper">광고 유입부터 문의·예약·내원·매출까지 동일한 선택 기간과 계산식으로 연결한 핵심 지표입니다.</p>
        <div className="kpi-grid">
          {executiveKpiCards.map((card) => (
            <MetricCardView key={card.label} card={card} onClick={() => setSelectedKpiLabel(card.label)} />
          ))}
        </div>
        <div className="marketing-flow-strip" aria-label="마케팅 CRM 전체 흐름">
          {marketingFlowStages.map((stage, index) => (
            <div className="marketing-flow-stage" key={stage.label}>
              <span>{stage.label}</span>
              <strong>{stage.value}</strong>
              <small>{stage.source}</small>
              {index < marketingFlowStages.length - 1 ? <i aria-hidden="true">→</i> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="kpi-decision-grid">
        <article className="panel kpi-funnel-panel">
          <ChartHeader title="문의 → 예약 → 내원 전환 퍼널" />
          <p className="section-helper">각 단계의 전환 규모와 이탈 건수를 선택 기간 합계로 표시합니다.</p>
          <div className="kpi-funnel">
            {[
              { label: "전체 문의", value: kpiDecisionData.totals.inquiries, color: "teal" },
              { label: "전체 예약", value: kpiDecisionData.totals.reservations, color: "violet" },
              { label: "전체 내원", value: kpiDecisionData.totals.visits, color: "blue" },
            ].map((step, index, steps) => {
              const base = Math.max(1, steps[0].value);
              const previous = index === 0 ? null : steps[index - 1].value;
              const conversion = index === 0 ? 100 : Math.round((step.value / Math.max(1, previous ?? 1)) * 1000) / 10;
              return (
                <div className="kpi-funnel-step" key={step.label}>
                  <div><span>{step.label}</span><strong>{step.value.toLocaleString("ko-KR")}건</strong><small>{index === 0 ? "유입 기준 100%" : `이전 단계 전환 ${conversion}% · 이탈 ${Math.max(0, (previous ?? 0) - step.value).toLocaleString("ko-KR")}건`}</small></div>
                  <div className="kpi-funnel-track"><i className={step.color} style={{ width: `${Math.max(8, (step.value / base) * 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel kpi-goal-panel">
          <ChartHeader title="목표 대비 달성률" />
          <p className="section-helper">설정에 저장된 병원 전체 목표와 현재 실적을 자동 비교합니다.</p>
          <div className="kpi-goal-list">
            {kpiDecisionData.goals.map((goal) => (
              <div className="kpi-goal-row" key={goal.metric}>
                <div><span>{goal.metric}</span><strong>{goal.current === null ? "미집계" : goal.metric.includes("CPA") ? `${goal.current.toLocaleString("ko-KR")}원` : `${goal.current}%`}</strong><small>목표 {goal.target}</small></div>
                <div className="kpi-goal-progress"><i className={goal.passed ? "pass" : "fail"} style={{ width: `${Math.min(100, goal.achievement)}%` }} /></div>
                <b className={goal.passed ? "pass" : goal.passed === null ? "pending" : "fail"}>{goal.passed === null ? "평가 대기" : goal.passed ? `달성 ${goal.achievement}%` : `미달 ${goal.achievement}%`}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={`panel ai-panel ${!aiSettings.enabled ? "ai-disabled" : ""}`}>
        <div className="ai-head">
          <div className="ai-head-left">
            <span className="ai-pill">AI PERFORMANCE BRIEF</span>
            <span className="ai-period-label">{periodDefinition.range} 기준</span>
            <h2>{periodDefinition.label} KPI 요약</h2>
          </div>
          <div className="ai-head-right">
            <span>{dataRefreshAt ? `${dataRefreshAt} 집계 완료` : "집계 완료"} · 검증된 데이터만 사용</span>
          </div>
        </div>

        <div className="ai-body">
          <p className="ai-period-insight">{aiPeriodSummary.kpi}</p>
          <div className="ai-summary">
            <h3>한눈에 보는 결과</h3>
            <p>
              <strong>{periodDefinition.label} 전체 문의 {executiveKpiCards[0]?.value ?? "-"}, 예약 {executiveKpiCards[1]?.value ?? "-"}, 전체 내원 {executiveKpiCards[3]?.value ?? "-"}</strong>으로 집계되었습니다.
              {mergedAdSourceRows.length ? ` 광고 원천 데이터는 노출 ${kpiAdFunnelCards[1]?.value ?? "-"}, 클릭 ${kpiAdFunnelCards[2]?.value ?? "-"}, 전환 ${kpiAdFunnelCards[4]?.value ?? "-"}이며 효율 지표까지 함께 반영했습니다.` : " 광고 원천 데이터는 미연동 상태입니다."}
            </p>
            <div className="chip-row">
              <span>예약률 {executiveKpiCards[2]?.value ?? "-"}</span>
              <span>문의→내원율 {executiveKpiCards[4]?.value ?? "-"}</span>
              <span>ROAS {executiveKpiCards[7]?.value ?? "-"}</span>
            </div>
            <div className="ai-notes">
              <div>상담·예약·신환 데이터와 광고 노출·클릭·전환 데이터를 같은 기간으로 비교했습니다.</div>
              <div>{kpiRecommendations[0]?.detail}</div>
              <div>{kpiRecommendations[1]?.detail}</div>
            </div>
          </div>

          <div className="ai-actions">
            <h3>문제 · 근거 · 실행 제안</h3>
            {kpiRecommendations.map((item, index) => (
              <div className="recommendation" key={item.title}>
                <b>{index + 1}</b>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                  <small className="recommendation-meta">근거 {periodDefinition.range} · 목표 기준 {kpiGoalEvidence || "설정 필요"} · 기한 다음 비교 기간</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="ai-footer">
          <span>AI 요약은 원인을 단정하지 않으며, 모든 수치는 서버 집계 결과를 사용합니다.</span>
          <button type="button" onClick={() => setAiEvidenceOpen((open) => !open)}>{aiEvidenceOpen ? "근거 데이터 닫기 ↑" : "근거 데이터 보기 ↓"}</button>
        </footer>
        {aiEvidenceOpen ? <div className="ai-evidence"><strong>근거 데이터 · {periodDefinition.range}</strong><span>{aiEvidenceWithGoals.kpi}</span><small>선택한 기준일의 KPI 집계값과 목표 설정에서 계산된 값입니다.</small></div> : null}
      </section>

      <section className="chart-grid">
        <article className="panel chart-panel">
          <ChartHeader
            title="문의 → 예약 → 내원 기간 추이"
            right={
              <div className="panel-actions">
                <button className={`pill ${kpiTrendMode === "daily" ? "active" : ""}`} type="button" onClick={() => setKpiTrendMode("daily")}>
                  일간
                </button>
                <button className={`pill ${kpiTrendMode === "weekly" ? "active" : ""}`} type="button" onClick={() => setKpiTrendMode("weekly")}>
                  주간
                </button>
              </div>
            }
          />

          <div className="line-legend">
            <span>
              <i className="legend-dot green" />
              문의
            </span>
            <span>
              <i className="legend-dot violet" />
              예약
            </span>
            <span>
              <i className="legend-dot blue" />
              내원
            </span>
          </div>

          <svg className="line-chart" viewBox="0 0 600 220" role="img" aria-label="문의와 내원 추이">
            {Array.from({ length: 5 }).map((_, index) => {
              const y = 32 + index * 38;
              return <line key={y} x1="28" x2="574" y1={y} y2={y} className="grid-line" />;
            })}

            <path d={kpiInquiryPath} className="series-line series-green" />
            <path d={kpiReservationPath} className="series-line series-violet" />
            <path d={kpiVisitPath} className="series-line series-blue" />

            {kpiInquiryPoints.map((point, index) => (
              <circle key={`inquiry-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-green-fill" />
            ))}
            {kpiVisitPoints.map((point, index) => (
              <circle key={`visit-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-blue-fill" />
            ))}
            {kpiReservationPoints.map((point, index) => (
              <circle key={`reservation-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-violet-fill" />
            ))}

            {chartDateTicks(activeKpiRows).map(({ label, index }) => {
              const x = 26 + (548 / Math.max(1, activeKpiRows.length - 1)) * index;
              return (
                <text key={`${label}-${index}`} x={x} y="206" className="axis-label">
                  {label}
                </text>
              );
            })}
            {!activeKpiRows.length ? <text x="300" y="116" textAnchor="middle" className="axis-empty-label">선택 기간의 일자별 데이터가 없습니다.</text> : null}
          </svg>
        </article>

        <article className="panel chart-panel">
          <ChartHeader title="매출 · 광고비 · ROAS 추이" right={<span className="chart-period-note">{periodDefinition.range}</span>} />
          <div className="line-legend">
            <span><i className="legend-dot orange" />매출</span>
            <span><i className="legend-dot violet" />광고비</span>
            <span><i className="legend-dot blue" />ROAS</span>
          </div>
          <svg className="line-chart" viewBox="0 0 600 220" role="img" aria-label="매출 광고비 ROAS 추이">
            {Array.from({ length: 5 }).map((_, index) => {
              const y = 32 + index * 38;
              return <line key={y} x1="28" x2="574" y1={y} y2={y} className="grid-line" />;
            })}
            <path d={kpiSalesPath} className="series-line series-orange" />
            <path d={kpiSpendPath} className="series-line series-violet" />
            <path d={kpiRoasPath} className="series-line series-blue" />
            {kpiSalesPoints.map((point, index) => <circle key={`sales-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-orange-fill" />)}
            {kpiSpendPoints.map((point, index) => <circle key={`spend-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-violet-fill" />)}
            {kpiRoasPoints.map((point, index) => <circle key={`roas-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-blue-fill" />)}
            {chartDateTicks(activeKpiRows).map(({ label, index }) => {
              const x = 26 + (548 / Math.max(1, activeKpiRows.length - 1)) * index;
              return <text key={`money-${label}-${index}`} x={x} y="206" className="axis-label">{label}</text>;
            })}
            {!activeKpiRows.length ? <text x="300" y="116" textAnchor="middle" className="axis-empty-label">선택 기간의 매출·광고비 데이터가 없습니다.</text> : null}
          </svg>
        </article>
      </section>

      <section className="panel marketing-correlation-panel">
        <ChartHeader title="마케팅 · CRM 상관관계 진단" right={<span className="chart-period-note">{activeKpiRows.length}일 데이터</span>} />
        <p className="table-helper">같은 날짜의 지표가 함께 움직였는지 확인합니다. 상관계수는 원인을 증명하지 않으며, 캠페인 지연 효과와 외부 요인은 별도 검증이 필요합니다.</p>
        <div className="correlation-grid">
          {marketingCorrelationRows.map((row) => (
            <article className={`correlation-card ${row.coefficient === null ? "pending" : row.coefficient < 0 ? "negative" : "positive"}`} key={row.label}>
              <div><span>{row.label}</span><b>{row.strength}</b></div>
              <strong>{row.coefficient === null ? "계산 불가" : row.coefficient.toFixed(2)}</strong>
              <div className="correlation-track"><i style={{ width: `${row.coefficient === null ? 0 : Math.abs(row.coefficient) * 100}%` }} /></div>
              <small>{row.direction} · {row.use}</small>
            </article>
          ))}
        </div>
        <footer className="correlation-footer">
          <span>기준: Pearson 상관계수 · |0.7| 이상 강함 · |0.4| 이상 보통</span>
          <strong>{activeKpiRows.length < 3 ? "최소 3일 데이터가 필요합니다." : "동일 일자 기준이며 인과관계로 해석하지 않습니다."}</strong>
        </footer>
      </section>

      <article className="panel weekly-panel">
        <ChartHeader
          title="요일별 문의 / 예약 / 내원 평균"
        />

        <div className="weekly-chart">
          {activeKpiWeekdays.map((day) => {
            const maxValue = Math.max(1, ...activeKpiWeekdays.flatMap((item) => [item.inquiries, item.reservations, item.visits]));
            return (
              <div className="weekly-column" key={day.label}>
                <div className="weekly-bars">
                  <div className="weekly-bar inquiry" title={`문의 ${day.inquiries}`} style={{ height: `${(day.inquiries / maxValue) * 100}%` }} />
                  <div className="weekly-bar reservation" title={`예약 ${day.reservations}`} style={{ height: `${(day.reservations / maxValue) * 100}%` }} />
                  <div className="weekly-bar visit" title={`내원 ${day.visits}`} style={{ height: `${(day.visits / maxValue) * 100}%` }} />
                </div>
                <span>{day.label}</span>
              </div>
            );
          })}
        </div>

        <div className="weekly-footer">
          <span>
            <i className="legend-dot green" />
            문의
          </span>
          <span>
            <i className="legend-dot violet" />
            예약
          </span>
          <span>
            <i className="legend-dot blue" />
            내원
          </span>
        </div>
      </article>

      <section className="panel table-panel channel-decision-panel">
          <ChartHeader title="매체별 예산 판단 · CRM 전환 성과" right={<span className="chart-period-note">{periodDefinition.range}</span>} />
          <p className="table-helper">광고 원천 수치와 CRM 문의·예약·내원·매출 귀속을 연결해 다음 예산 조정 판단에 필요한 지표만 표시합니다.</p>

          <div className="data-table">
            <div className="table-head channel-decision-head">
              <span>매체</span>
              <span>광고비</span>
              <span>CPL</span>
              <span>예약 CPA</span>
              <span>내원 CPA</span>
              <span>ROAS</span>
              <span>판단</span>
              <span>출처</span>
            </div>

            {channelDecisionRows.map((row) => (
              <div className="table-row channel-decision-row" key={row.name}>
                <b>{row.name}</b>
                <span>{formatWon(row.spend)}</span>
                <span>{row.cpl === null ? "-" : formatWon(row.cpl)}</span>
                <span>{row.reservationCpa === null ? "-" : formatWon(row.reservationCpa)}</span>
                <span>{row.visitCpa === null ? "-" : formatWon(row.visitCpa)}</span>
                <strong>{row.roas === null ? "-" : `${row.roas}%`}</strong>
                <b className={`decision-action ${row.action.includes("확인") ? "review" : row.action.includes("확대") ? "grow" : "improve"}`}>{row.action}</b>
                <span>{row.automated ? "자동 연동" : "업로드"}</span>
              </div>
            ))}
            {!channelDecisionRows.length ? <div className="data-empty-row">선택 기간의 광고비와 CRM 귀속 데이터가 없어 예산 판단을 보류합니다.</div> : null}
          </div>
      </section>
    </>
  );

  const renderConsult = () => (
    <>
      <section className="panel kpi-panel">
        <div className="section-title">상담 · 예약 분석</div>
        <div className="kpi-grid">
          {mainMetricCards.map((card) => (
            <MetricCardView key={card.label} card={card} />
          ))}
        </div>
      </section>

      <section className={`panel ai-panel ${!aiSettings.enabled ? "ai-disabled" : ""}`}>
        <div className="ai-head">
          <div className="ai-head-left">
            <span className="ai-pill">AI PERFORMANCE BRIEF</span>
            <span className="ai-period-label">{periodDefinition.range} 기준</span>
            <h2>{periodDefinition.label} 상담 · 예약 성과 요약</h2>
          </div>
          <div className="ai-head-right">
            <span>{dataRefreshAt ? `${dataRefreshAt} 집계 완료` : "집계 완료"} · 검증된 데이터만 사용</span>
          </div>
        </div>

        <div className="ai-body">
          <p className="ai-period-insight">{aiPeriodSummary.consult}</p>
          <div className="ai-summary">
            <h3>한눈에 보는 결과</h3>
            <p>
              선택 기간 전체 문의 {mainMetricCards[0]?.value ?? "-"} 중 예약 {mainMetricCards[1]?.value ?? "-"}, 신환 내원 {mainMetricCards[3]?.value ?? "-"}으로 연결되었습니다.
              전화·온라인 문의와 진료과목별 예약 흐름을 동일한 기준일로 다시 계산했습니다.
            </p>
            <div className="chip-row">
              <span>전화문의 {currentSummary.phoneInquiry.toLocaleString("ko-KR")}건</span>
              <span>온라인 문의 {currentSummary.onlineInquiry.toLocaleString("ko-KR")}건</span>
              <span>예약률 {mainMetricCards[2]?.value ?? "-"}</span>
            </div>
            <div className="ai-notes">
              {consultRecommendations.map((item) => <div key={item.title}>{item.detail}</div>)}
            </div>
          </div>

          <div className="ai-actions">
            <h3>문제 · 근거 · 실행 제안</h3>
            {consultRecommendations.map((item, index) => (
              <div className="recommendation" key={item.title}>
                <b>{index + 1}</b>
                <div><strong>{item.title}</strong><span>{item.detail}</span><small className="recommendation-meta">근거 {periodDefinition.range} · 담당 상담팀 · 목표 다음 비교 기간 개선 · 기한 다음 비교 기간</small></div>
              </div>
            ))}
          </div>
        </div>

        <footer className="ai-footer">
          <span>상담과 예약은 실제 집계 기반이며, AI는 해석과 우선순위만 제안합니다.</span>
          <button type="button" onClick={() => setAiEvidenceOpen((open) => !open)}>{aiEvidenceOpen ? "근거 데이터 닫기 ↑" : "근거 데이터 보기 ↓"}</button>
        </footer>
        {aiEvidenceOpen ? <div className="ai-evidence"><strong>근거 데이터 · {periodDefinition.range}</strong><span>{aiEvidence.consult}</span><small>선택한 기준일의 상담·예약·내원 집계 결과를 근거로 표시합니다.</small></div> : null}
      </section>

      <section className="consult-detail-grid">
        <article className="panel detail-panel">
          <ChartHeader title="오프라인(전화/방문) 문의 · 예약" />
          <div className="detail-card-grid three-columns">
            <div className="metric-mini-card"><span>전화 문의</span><strong>{actualKpiResult ? currentSummary.phoneInquiry?.toLocaleString("ko-KR") ?? "-" : "-"}</strong><b className="up">{actualKpiResult ? countDelta(currentSummary.phoneInquiry ?? 0, previousSummary.phoneInquiry ?? 0) : "데이터 미연동"}</b><small>{periodDefinition.compare}</small></div>
            <div className="metric-mini-card"><span>전화 예약</span><strong>{actualKpiResult ? currentSummary.phoneReservation?.toLocaleString("ko-KR") ?? "-" : "-"}</strong><b className="up">{actualKpiResult ? countDelta(currentSummary.phoneReservation ?? 0, previousSummary.phoneReservation ?? 0) : "데이터 미연동"}</b><small>{periodDefinition.compare}</small></div>
            <div className="metric-mini-card"><span>예약률</span><strong>{actualKpiResult && currentSummary.phoneInquiry ? `${Math.round((currentSummary.phoneReservation / currentSummary.phoneInquiry) * 1000) / 10}%` : "-"}</strong><b className="up">{actualKpiResult && currentSummary.phoneInquiry ? rateDelta(Math.round((currentSummary.phoneReservation / currentSummary.phoneInquiry) * 1000) / 10, previousSummary.phoneInquiry ? Math.round((previousSummary.phoneReservation / previousSummary.phoneInquiry) * 1000) / 10 : 0) : "데이터 미연동"}</b><small>{periodDefinition.compare}</small></div>
          </div>
        </article>

        <article className="panel detail-panel">
          <ChartHeader title="온라인 문의 · 예약" />
          <div className="detail-card-grid five-columns">
            <div className="metric-mini-card"><span>네이버 문의</span><strong>{actualKpiResult ? onlineChannelSummary.naver.toLocaleString("ko-KR") : "-"}</strong><b>{actualKpiResult ? countDelta(onlineChannelSummary.naver, previousOnlineChannelSummary.naver) : "데이터 미연동"}</b><small>{periodDefinition.compare}</small></div>
            <div className="metric-mini-card"><span>카카오 문의</span><strong>{actualKpiResult ? onlineChannelSummary.kakao.toLocaleString("ko-KR") : "-"}</strong><b>{actualKpiResult ? countDelta(onlineChannelSummary.kakao, previousOnlineChannelSummary.kakao) : "데이터 미연동"}</b><small>{periodDefinition.compare}</small></div>
            <div className="metric-mini-card"><span>홈페이지 문의</span><strong>{actualKpiResult ? onlineChannelSummary.homepage.toLocaleString("ko-KR") : "-"}</strong><b>{actualKpiResult ? countDelta(onlineChannelSummary.homepage, previousOnlineChannelSummary.homepage) : "데이터 미연동"}</b><small>{periodDefinition.compare}</small></div>
            <div className="metric-mini-card"><span>예약 수</span><strong>{actualKpiResult ? currentSummary.onlineReservation?.toLocaleString("ko-KR") ?? "-" : "-"}</strong><b>{actualKpiResult ? countDelta(currentSummary.onlineReservation ?? 0, previousSummary.onlineReservation ?? 0) : "데이터 미연동"}</b><small>{periodDefinition.compare}</small></div>
            <div className="metric-mini-card"><span>예약률</span><strong>{actualKpiResult && currentSummary.onlineInquiry ? `${Math.round((currentSummary.onlineReservation / currentSummary.onlineInquiry) * 1000) / 10}%` : "-"}</strong><b>{actualKpiResult && currentSummary.onlineInquiry ? rateDelta(Math.round((currentSummary.onlineReservation / currentSummary.onlineInquiry) * 1000) / 10, previousSummary.onlineInquiry ? Math.round((previousSummary.onlineReservation / previousSummary.onlineInquiry) * 1000) / 10 : 0) : "데이터 미연동"}</b><small>{periodDefinition.compare}</small></div>
          </div>
        </article>
      </section>

      <section className="consult-definition-grid">
        <article className="panel detail-panel visit-definition-panel">
          <ChartHeader title="신환 내원 지표" />
          <div className="detail-card-grid five-columns">
            <div className="metric-mini-card"><span>신환 내원</span><strong>{mainMetricCards[3]?.value}</strong><small>전체 신규 환자</small></div>
            <div className="metric-mini-card"><span>예약 내원</span><strong>{mainMetricCards[4]?.value}</strong><small>예약 후 실제 내원</small></div>
            <div className="metric-mini-card"><span>비예약 내원</span><strong>{mainMetricCards[5]?.value}</strong><small>예약 없이 직접 내원</small></div>
            <div className="metric-mini-card"><span>비예약 내원율</span><strong>{mainMetricCards[6]?.value}</strong><small>비예약 내원 ÷ 신환 내원</small></div>
            <div className="metric-mini-card"><span>노쇼율</span><strong>{mainMetricCards[7]?.value}</strong><small>예정일 경과 미내원 ÷ 방문예정 예약</small></div>
          </div>
        </article>
      </section>

      <div className="consult-layout-grid">
      <section className="panel table-panel online-consult-panel">
        <ChartHeader title="진료과목별 온라인 문의 · 예약" right={<span className={`reconcile-status ${reconciliationState(["departmentOnlineInquiries", "departmentOnlineReservations"]) ? "pass" : "fail"}`}>{reconciliationState(["departmentOnlineInquiries", "departmentOnlineReservations"]) ? "합계 일치" : "합계 확인 필요"}</span>} />
        <div className="data-table">
          <div className="table-head online-consult-table-head">
            <span>진료과목</span><span>온라인 문의</span><span>예약 수</span><span>예약률</span>
          </div>
          {displayedOnlineConsultRows.map((row) => (
            <div className="table-row online-consult-table-row" key={row[0]}>
              <b>{row[0]}</b><span>{row[1]}</span><span>{row[2]}</span><strong>{row[3]}</strong>
            </div>
          ))}
          <div className="table-total-row"><b>기간 합계</b><strong>{currentSummary.onlineInquiry.toLocaleString("ko-KR")}</strong><strong>{currentSummary.onlineReservation.toLocaleString("ko-KR")}</strong><strong>{currentSummary.onlineInquiry === 0 ? "-" : `${Math.round((currentSummary.onlineReservation / currentSummary.onlineInquiry) * 1000) / 10}%`}</strong></div>
        </div>
      </section>

      <section className="chart-grid">
        <article className="panel table-panel">
          <ChartHeader title="진료과목별 전화문의 / 예약" right={<span className={`reconcile-status ${reconciliationState(["departmentPhoneInquiries", "departmentPhoneReservations"]) ? "pass" : "fail"}`}>{reconciliationState(["departmentPhoneInquiries", "departmentPhoneReservations"]) ? "합계 일치" : "합계 확인 필요"}</span>} />

          <div className="data-table">
            <div className="table-head consult-table-head">
              <span>진료과목</span>
              <span>전화문의</span>
              <span>예약</span>
              <span>예약률</span>
            </div>

            {displayedConsultRows.map((row) => (
              <div className="table-row consult-table-row" key={row.name}>
                <b>{row.name}</b>
                <span>{row.phone}</span>
                <span>{row.reserve}</span>
                <span>{row.reserveRate}</span>
              </div>
            ))}
            <div className="table-total-row"><b>기간 합계</b><strong>{currentSummary.phoneInquiry.toLocaleString("ko-KR")}</strong><strong>{currentSummary.phoneReservation.toLocaleString("ko-KR")}</strong><strong>{currentSummary.phoneInquiry === 0 ? "-" : `${Math.round((currentSummary.phoneReservation / currentSummary.phoneInquiry) * 1000) / 10}%`}</strong></div>
          </div>
        </article>

        <article className="panel donut-panel">
          <ChartHeader title="신환 내원경로" right={<span className={`reconcile-status ${reconciliationState(["referralNewVisits"]) ? "pass" : "fail"}`}>{reconciliationState(["referralNewVisits"]) ? "합계 일치" : "합계 확인 필요"}</span>} />

          <div className="donut-layout">
            <div className="donut-wrap">
              <div className="donut" style={{ background: referralDonut }} />
              <div className="donut-center">
                <span>총 내원수</span>
                <strong>{currentSummary.newVisit.toLocaleString("ko-KR")}건</strong>
              </div>
            </div>

            <div className="donut-legend consult-legend">
              {referralDisplayRows.map((item, index) => (
                <div key={item.name}>
                  <span>
                    <i style={{ background: adChannelShare[index % adChannelShare.length].color }} />
                    {item.name}
                  </span>
                  <b>{item.visit}건</b>
                  <small>{item.share}</small>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="consult-secondary-grid consult-secondary-wide">
        <article className="panel new-patient-panel">
          <ChartHeader title="신환수 현황" right={<span className="chart-period-label">{periodDefinition.range}</span>} />
          <div className="new-patient-total"><span>신환수</span><strong>{newPatientSummary.current.toLocaleString("ko-KR")}</strong><b className={newPatientSummary.trendClass}>{newPatientSummary.delta}</b><small>{newPatientSummary.compareLabel} {newPatientSummary.previous.toLocaleString("ko-KR")}건</small></div>
          <div className="department-bars" aria-label="진료과목별 신환수">
            {displayedNewPatientByDepartment.map((item) => (
              <div className="department-bar-item" key={item.name}>
                <strong>{item.value}</strong>
                <div className="department-bar-track"><i style={{ height: `${(item.value / newPatientSummary.maxDepartmentValue) * 100}%` }} /></div>
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </article>

      </section>

      </div>

      <section className="panel weekday-comparison-panel">
        <ChartHeader title="요일별 문의 · 신환 내원 평균 추이" />
        <div className="weekday-comparison-legend" aria-label="기간 범례">
          <span><i className="previous-month" />비교 기간 {comparisonRangeLabel}</span>
          <span><i className="current-month" />선택 기간 {periodDefinition.range}</span>
        </div>
        <div className="weekday-comparison-grid">
          <article className="weekday-metric-chart">
            <div className="weekday-chart-title"><strong>문의 평균</strong><small>전화 + 온라인 문의</small></div>
            <div className="weekday-bars" aria-label="요일별 문의 평균">
              {weekdayMonthlyAverages.map((item) => (
                <div className="weekday-bar-group" key={`inquiry-${item.label}`}>
                  <div className="weekday-bar-pair">
                    <i className="weekday-bar previous" style={{ height: item.previousInquiries === 0 ? "0%" : `${Math.max(4, (item.previousInquiries / weekdayInquiryMax) * 100)}%` }} title={`비교 기간 ${item.previousInquiries}건`} />
                    <i className="weekday-bar current" style={{ height: item.currentInquiries === 0 ? "0%" : `${Math.max(4, (item.currentInquiries / weekdayInquiryMax) * 100)}%` }} title={`선택 기간 ${item.currentInquiries}건`} />
                  </div>
                  <strong>{item.currentInquiries}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="weekday-metric-chart">
            <div className="weekday-chart-title"><strong>신환 내원 평균</strong><small>실제 신규 환자 내원</small></div>
            <div className="weekday-bars" aria-label="요일별 신환 내원 평균">
              {weekdayMonthlyAverages.map((item) => (
                <div className="weekday-bar-group" key={`visit-${item.label}`}>
                  <div className="weekday-bar-pair">
                    <i className="weekday-bar previous" style={{ height: item.previousVisits === 0 ? "0%" : `${Math.max(4, (item.previousVisits / weekdayVisitMax) * 100)}%` }} title={`비교 기간 ${item.previousVisits}명`} />
                    <i className="weekday-bar current" style={{ height: item.currentVisits === 0 ? "0%" : `${Math.max(4, (item.currentVisits / weekdayVisitMax) * 100)}%` }} title={`선택 기간 ${item.currentVisits}명`} />
                  </div>
                  <strong>{item.currentVisits}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="consult-summary-grid consult-trend-wide">
        <article className="panel chart-panel">
          <ChartHeader
            title="상담 · 예약 · 신환 추이"
            right={
              <div className="panel-actions">
                <button className={`pill ${consultTrendMode === "weekly" ? "active" : ""}`} type="button" onClick={() => setConsultTrendMode("weekly")}>
                  최근 7일
                </button>
                <button className={`pill ${consultTrendMode === "monthly" ? "active" : ""}`} type="button" onClick={() => setConsultTrendMode("monthly")}>
                  월간
                </button>
              </div>
            }
          />

          <div className="line-legend">
            <span>
              <i className="legend-dot green" />
              상담
            </span>
            <span>
              <i className="legend-dot blue" />
              예약
            </span>
            <span>
              <i className="legend-dot violet" />
              신환
            </span>
          </div>

          <svg className="line-chart" viewBox="0 0 600 220" role="img" aria-label="상담 예약 신환 추이">
            {Array.from({ length: 5 }).map((_, index) => {
              const y = 32 + index * 38;
              return <line key={y} x1="28" x2="574" y1={y} y2={y} className="grid-line" />;
            })}

            <path d={consultInquiryPath} className="series-line series-green" />
            <path d={consultReservePath} className="series-line series-blue" />
            <path d={consultVisitPath} className="series-line series-violet" />

            {consultInquiryPoints.map((point, index) => (
              <circle key={`ci-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-green-fill" />
            ))}
            {consultReservePoints.map((point, index) => (
              <circle key={`cr-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-blue-fill" />
            ))}
            {consultVisitPoints.map((point, index) => (
              <circle key={`cv-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-violet-fill" />
            ))}

            {chartDateTicks(consultDailyRows).map(({ label, index }) => {
              const x = 26 + (548 / Math.max(1, consultDailyRows.length - 1)) * index;
              return (
                <text key={`${label}-${index}`} x={x} y="206" className="axis-label">
                  {label}
                </text>
              );
            })}
            {!consultDailyRows.length ? <text x="300" y="116" textAnchor="middle" className="axis-empty-label">선택 기간의 상담·내원 데이터가 없습니다.</text> : null}
          </svg>
        </article>

      </section>
    </>
  );

  const selectedPlaceRankKeyword = placeRankData?.keywords.find((row) => row.id === selectedPlaceRankId) ?? placeRankData?.keywords[0];
  const selectedPlaceRankHistory = selectedPlaceRankKeyword
    ? (placeRankData?.snapshots.filter((row) => row.keywordId === selectedPlaceRankKeyword.id) ?? [])
    : [];
  const sortedSelectedPlaceRankHistory = [...selectedPlaceRankHistory].sort((a, b) => a.date.localeCompare(b.date));
  const latestSelectedPlaceRank = sortedSelectedPlaceRankHistory.at(-1);
  const previousSelectedPlaceRank = sortedSelectedPlaceRankHistory.at(-2);
  const firstSelectedPlaceRank = sortedSelectedPlaceRankHistory.find((row) => row.rank !== null);
  const latestValidSelectedPlaceRank = [...sortedSelectedPlaceRankHistory].reverse().find((row) => row.rank !== null);
  const dailyRankDelta = latestSelectedPlaceRank?.rank && previousSelectedPlaceRank?.rank
    ? previousSelectedPlaceRank.rank - latestSelectedPlaceRank.rank
    : null;
  const periodRankDelta = firstSelectedPlaceRank?.rank && latestValidSelectedPlaceRank?.rank
    ? firstSelectedPlaceRank.rank - latestValidSelectedPlaceRank.rank
    : null;
  const latestPlaceRankByKeyword = new Map((placeRankData?.keywords ?? []).map((keyword) => {
    const rows = (placeRankData?.snapshots ?? []).filter((row) => row.keywordId === keyword.id).sort((a, b) => b.date.localeCompare(a.date));
    return [keyword.id, { latest: rows[0], previous: rows[1] }] as const;
  }));

  const renderAds = () => (
    <>
      <section className="panel kpi-panel">
        <div className="section-title">광고 채널 분석</div>
        <div className="kpi-grid ads-kpi-grid">
          {requestedAdCards.map((card) => (
            <MetricCardView key={card.label} card={card} />
          ))}
        </div>
      </section>

      <section className={`panel ai-panel ${!aiSettings.enabled ? "ai-disabled" : ""}`}>
        <div className="ai-head">
          <div className="ai-head-left">
            <span className="ai-pill">AI PERFORMANCE BRIEF</span>
            <span className="ai-period-label">{periodDefinition.range} 기준</span>
            <h2>{periodDefinition.label} 광고 성과 요약</h2>
          </div>
          <div className="ai-head-right">
            <span>{dataRefreshAt ? `${dataRefreshAt} 집계 완료` : "집계 완료"} · 검증된 데이터만 사용</span>
          </div>
        </div>

        <div className="ai-body">
          <p className="ai-period-insight">{aiPeriodSummary.ads}</p>
          <div className="ai-summary">
            <h3>한눈에 보는 결과</h3>
            <p>
              선택 기간 광고비 {requestedAdCards[0]?.value ?? "-"}로 문의 {requestedAdCards[1]?.value ?? "-"}, 예약 {requestedAdCards[2]?.value ?? "-"}, 내원 {requestedAdCards[3]?.value ?? "-"}을 확보했습니다.
              노출부터 전환까지 같은 기간으로 집계해 매체 효율을 비교했습니다.
            </p>
            <div className="chip-row">
              <span>CTR {kpiAdFunnelCards[3]?.value ?? "-"}</span>
              <span>전환 {kpiAdFunnelCards[4]?.value ?? "-"}</span>
              <span>ROAS {requestedAdCards[7]?.value ?? "-"}</span>
            </div>
            <div className="ai-notes">
              {automatedNaverSourceRows.length ? <div>네이버 검색광고 {naverSearchAdData?.summary.spend.toLocaleString("ko-KR")}원과 네이버 플레이스 광고 {naverSearchAdData?.place.spend.toLocaleString("ko-KR")}원을 API 자동화 원천 수치로 반영했습니다.</div> : null}
              {adRecommendations.map((item) => <div key={item.title}>{item.detail}</div>)}
            </div>
          </div>

          <div className="ai-actions">
            <h3>문제 · 근거 · 실행 제안</h3>
            {adRecommendations.map((item, index) => (
              <div className="recommendation" key={item.title}>
                <b>{index + 1}</b>
                <div><strong>{item.title}</strong><span>{item.detail}</span><small className="recommendation-meta">근거 {periodDefinition.range} · 담당 마케팅팀 · 목표 KPI 기준선 회복 · 기한 다음 비교 기간</small></div>
              </div>
            ))}
          </div>
        </div>

        <footer className="ai-footer">
          <span>AI는 채널별 효율과 우선순위를 제안하고, 실제 집계 수치는 하단 표를 기준으로 합니다.</span>
          <button type="button" onClick={() => setAiEvidenceOpen((open) => !open)}>{aiEvidenceOpen ? "근거 데이터 닫기 ↑" : "근거 데이터 보기 ↓"}</button>
        </footer>
        {aiEvidenceOpen ? <div className="ai-evidence"><strong>근거 데이터 · {periodDefinition.range}</strong><span>{aiEvidence.ads}</span><small>선택한 기준일의 광고비·문의·전환 집계값을 근거로 표시합니다.</small></div> : null}
      </section>

      <section className="chart-grid">
        <article className="panel donut-panel">
          <ChartHeader title="광고비 비중" />

          <div className="donut-layout">
            <div className="donut-wrap">
              <div className="donut" style={{ background: adSpendDonut }} />
              <div className="donut-center">
                <span>총 광고비</span>
                <strong>{requestedAdCards[0]?.value}</strong>
              </div>
            </div>

            <div className="donut-legend">
              {activeAdChannelShare.map((item) => (
                <div key={item.label}>
                  <span>
                    <i style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <b>{item.value}%</b>
                  <small>{item.amount}</small>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel chart-panel">
          <ChartHeader
            title="채널별 추이"
            right={
              <div className="panel-actions">
                <button className={`pill ${adTrendMode === "daily" ? "active" : ""}`} type="button" onClick={() => setAdTrendMode("daily")}>
                  일간
                </button>
                <button className={`pill ${adTrendMode === "weekly" ? "active" : ""}`} type="button" onClick={() => setAdTrendMode("weekly")}>
                  주간
                </button>
                <button className={`pill ${adTrendMode === "monthly" ? "active" : ""}`} type="button" onClick={() => setAdTrendMode("monthly")}>
                  월간
                </button>
              </div>
            }
          />

          <div className="line-legend">
            <span>
              <i className="legend-dot green" />
              노출
            </span>
            <span>
              <i className="legend-dot blue" />
              클릭
            </span>
            <span>
              <i className="legend-dot violet" />
              CPC
            </span>
          </div>

          <svg className="line-chart" viewBox="0 0 600 220" role="img" aria-label="광고 채널 추이">
            {Array.from({ length: 5 }).map((_, index) => {
              const y = 32 + index * 38;
              return <line key={y} x1="28" x2="574" y1={y} y2={y} className="grid-line" />;
            })}

            <path d={adImpressionPath} className="series-line series-green" />
            <path d={adClickPath} className="series-line series-blue" />
            <path d={adCpcPath} className="series-line series-violet" />

            {adImpressionPoints.map((point, index) => (
              <circle key={`ai-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-green-fill" />
            ))}
            {adClickPoints.map((point, index) => (
              <circle key={`ac-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-blue-fill" />
            ))}
            {adCpcPoints.map((point, index) => (
              <circle key={`ap-${index}`} cx={point.x} cy={point.y} r="4.5" className="series-point series-violet-fill" />
            ))}

            {chartDateTicks(activeAdDailyRows).map(({ label, index }) => {
              const x = 26 + (548 / Math.max(1, activeAdDailyRows.length - 1)) * index;
              return <text key={`ad-${label}-${index}`} x={x} y="206" className="axis-label">{label}</text>;
            })}

            {!activeAdImpressionTrend.length ? <text x="300" y="116" textAnchor="middle" className="axis-empty-label">일자별 광고 노출·클릭·CPC 데이터가 미연동 상태입니다.</text> : null}
          </svg>
        </article>
      </section>

      <section className="panel table-panel budget-action-panel">
        <ChartHeader title="매체별 예산 조정 판단" right={<span className="chart-period-note">{periodDefinition.range}</span>} />
        <p className="table-helper">단순 지출 순위가 아니라 광고비가 CRM 문의·예약·내원·매출로 연결된 정도를 기준으로 분류합니다.</p>
        <div className="budget-action-grid">
          {channelDecisionRows.map((row) => (
            <article className="budget-action-card" key={`budget-${row.name}`}>
              <div><span>{row.name}</span><b className={`decision-action ${row.action.includes("확인") ? "review" : row.action.includes("확대") ? "grow" : "improve"}`}>{row.action}</b></div>
              <strong>{row.roas === null ? "ROAS 미집계" : `ROAS ${row.roas}%`}</strong>
              <small>내원 CPA {row.visitCpa === null ? "-" : formatWon(row.visitCpa)} · 광고비 {formatWon(row.spend)}</small>
            </article>
          ))}
          {!channelDecisionRows.length ? <div className="data-empty-row">광고 원천 데이터와 CRM 귀속값 연결 후 예산 판단을 표시합니다.</div> : null}
        </div>
      </section>

      <section className="panel table-panel channel-funnel-panel">
        <ChartHeader title="매체별 전환 병목 진단" right={<span className="chart-period-note">광고 원천 + CRM 귀속</span>} />
        <p className="table-helper">플랫폼 클릭과 CRM 문의·예약·내원을 순서대로 연결합니다. 뒤 단계가 앞 단계보다 큰 경우에는 잘못된 비율을 만들지 않고 귀속 확인 대상으로 표시합니다.</p>
        <div className="data-table">
          <div className="table-head channel-funnel-head">
            <span>매체</span><span>클릭</span><span>문의</span><span>클릭→문의</span><span>예약</span><span>문의→예약</span><span>내원</span><span>예약→내원</span><span>핵심 병목</span>
          </div>
          {channelFunnelRows.map((row) => (
            <div className="table-row channel-funnel-row" key={`funnel-${row.name}`}>
              <b>{row.name}</b>
              <span>{row.clicks.toLocaleString("ko-KR")}</span>
              <span>{row.inquiries.toLocaleString("ko-KR")}</span>
              <strong className={row.clickToInquiry === null ? "rate-pending" : ""}>{row.clickToInquiry === null ? "확인 필요" : `${row.clickToInquiry}%`}</strong>
              <span>{row.reservations.toLocaleString("ko-KR")}</span>
              <strong className={row.inquiryToReservation === null ? "rate-pending" : ""}>{row.inquiryToReservation === null ? "확인 필요" : `${row.inquiryToReservation}%`}</strong>
              <span>{row.visits.toLocaleString("ko-KR")}</span>
              <strong className={row.reservationToVisit === null ? "rate-pending" : ""}>{row.reservationToVisit === null ? "확인 필요" : `${row.reservationToVisit}%`}</strong>
              <b className={`funnel-bottleneck ${row.complete ? "ready" : "review"}`}>{row.complete && row.bottleneck ? `${row.bottleneck.label} ${row.bottleneck.rate}%` : "귀속 확인 필요"}</b>
            </div>
          ))}
          {!channelFunnelRows.length ? <div className="data-empty-row">매체별 클릭과 CRM 귀속 데이터 연결 후 병목을 진단합니다.</div> : null}
        </div>
      </section>

      <section className="panel ad-weekday-panel">
        <ChartHeader
          title="요일별 평균 효율 지표"
          right={
            <div className="panel-actions">
              <button className={`pill ${adEfficiencyMonthMode === "current" ? "active" : ""}`} type="button" onClick={() => setAdEfficiencyMonthMode("current")}>선택 기간</button>
              <button className={`pill ${adEfficiencyMonthMode === "previous" ? "active" : ""}`} type="button" onClick={() => setAdEfficiencyMonthMode("previous")}>비교 기간</button>
            </div>
          }
        />
        <p className="ad-weekday-helper">상단에서 선택한 기간의 요일별 평균 광고 효율입니다. 금액은 낮을수록, ROAS는 높을수록 효율적입니다.</p>
        <div className="ad-weekday-grid">
          {([
            { key: "cpl", title: "CPL", suffix: "원", color: "#3b82f6" },
            { key: "reservationCpa", title: "예약 CPA", suffix: "원", color: "#8b5cf6" },
            { key: "visitCpa", title: "내원 CPA", suffix: "원", color: "#f59e0b" },
            { key: "roas", title: "ROAS", suffix: "%", color: "#24a47a" },
          ] as const).map((metric) => (
            <article className="ad-weekday-chart" key={metric.key}>
              <strong>{metric.title}</strong>
              <div className="ad-efficiency-bars" aria-label={`${metric.title} 요일별 평균`}>
                {adWeekdayEfficiency.map((item) => {
                  const value = item[metric.key];
                  return (
                    <div className="ad-efficiency-bar-group" key={`${metric.key}-${item.label}`}>
                      <span>{value === 0 ? "-" : `${value.toLocaleString("ko-KR")}${metric.suffix}`}</span>
                      <i style={{ height: value === 0 ? "0%" : `${Math.max(4, (value / adEfficiencyMax[metric.key]) * 100)}%`, background: metric.color }} />
                      <b>{item.label}</b>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel table-panel ad-channel-metrics-panel">
        <ChartHeader title="매체별 광고 지표" />
        <p className="table-helper">광고비, 문의, 예약, 내원과 단계별 획득 비용을 매체별로 비교합니다.</p>
        <div className="data-table">
          <div className="table-head ad-channel-metric-head">
            <span>매체</span><span>총 광고비</span><span>광고 문의</span><span>광고 예약</span><span>광고 내원</span><span>CPL</span><span>예약 CPA</span><span>내원 CPA</span><span>ROAS</span>
          </div>
          {requestedAdChannelRows.map((row) => (
            <div className="table-row ad-channel-metric-row" key={row.name}>
              <b>{row.name}</b><span>{row.spend}</span><span>{row.inquiry}</span><span>{row.reservation}</span><span>{row.visit}</span><span>{row.cpl}</span><span>{row.reservationCpa}</span><span>{row.visitCpa}</span><strong>{row.roas}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel table-panel ad-raw-metrics-panel">
        <ChartHeader title="매체별 광고 원천 지표" />
        <p className="table-helper">선택한 기간의 매체별 노출부터 전환까지 원천 성과와 효율을 한 번에 비교합니다.</p>
        <div className="data-table">
          <div className="table-head ad-raw-metric-head">
            <span>매체</span><span>광고비</span><span>노출</span><span>클릭</span><span>CTR</span><span>CPC</span><span>전환</span><span>전환율</span><span>전환당 비용</span>
          </div>
          {rawAdChannelRows.map((row) => (
            <div className="table-row ad-raw-metric-row" key={row.name}>
              <b>{row.name}{row.automated ? <small className="auto-source-badge">자동</small> : null}</b><span>{row.spend}</span><span>{row.impressions}</span><span>{row.clicks}</span><span>{row.ctr}</span><span>{row.cpc}</span><span>{row.conversions}</span><span>{row.conversionRate}</span><strong>{row.conversionCost}</strong>
            </div>
          ))}
          {!rawAdChannelRows.length ? <div className="data-empty-row">선택 기간의 광고 원천 데이터가 없습니다.</div> : null}
        </div>
      </section>

      <section className="panel table-panel naver-search-ads-panel">
        <ChartHeader
          title="네이버 검색광고 자동화"
          right={
            <button
              className="pill"
              type="button"
              disabled={naverSearchAdLoadState === "loading"}
              onClick={() => setNaverSearchAdRefreshKey((value) => value + 1)}
            >
              {naverSearchAdLoadState === "loading" ? "동기화 중" : "지금 동기화"}
            </button>
          }
        />
        <div className="naver-search-sync-row">
          <span className={`automation-status ${naverSearchAdLoadState === "live" ? "active" : ""}`}>
            {naverSearchAdLoadState === "live" ? "네이버 검색광고 실데이터 연결" : naverSearchAdLoadState === "loading" ? "네이버 검색광고 조회 중" : "네이버 검색광고 연결 확인 필요"}
          </span>
          <small>{naverSearchAdMessage}</small>
        </div>

        <div className="naver-search-summary-grid">
          {[
            { label: "광고비", value: naverSearchAdData ? `${naverSearchAdData.summary.spend.toLocaleString("ko-KR")}원` : "-" },
            { label: "노출", value: naverSearchAdData ? naverSearchAdData.summary.impressions.toLocaleString("ko-KR") : "-" },
            { label: "클릭", value: naverSearchAdData ? naverSearchAdData.summary.clicks.toLocaleString("ko-KR") : "-" },
            { label: "CTR", value: naverSearchAdData ? `${naverSearchAdData.summary.ctr}%` : "-" },
            { label: "CPC", value: naverSearchAdData ? `${naverSearchAdData.summary.cpc.toLocaleString("ko-KR")}원` : "-" },
            { label: "전환", value: naverSearchAdData ? naverSearchAdData.summary.conversions.toLocaleString("ko-KR") : "-" },
            { label: "전환율", value: naverSearchAdData ? `${naverSearchAdData.summary.conversionRate}%` : "-" },
            { label: "전환당 비용", value: naverSearchAdData ? `${naverSearchAdData.summary.conversionCost.toLocaleString("ko-KR")}원` : "-" },
          ].map((item) => (
            <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong></article>
          ))}
        </div>

        <p className="table-helper">요청한 8개 운영 그룹만 표시합니다. 자보 MO·PC와 키성장·성조숙증은 각각 하나의 그룹으로 합산합니다.</p>
        <div className="data-table">
          <div className="table-head naver-campaign-head">
            <span>그룹</span><span>상태</span><span>광고비</span><span>노출</span><span>클릭</span><span>CTR</span><span>CPC</span><span>전환</span><span>전환율</span><span>전환당 비용</span>
          </div>
          {naverSearchAdData?.groups.length ? naverSearchAdData.groups.map((row) => (
            <div className="table-row naver-campaign-row" key={row.id}>
              <b>{row.name}</b>
              <span>{row.status}</span>
              <span>{row.spend.toLocaleString("ko-KR")}원</span>
              <span>{row.impressions.toLocaleString("ko-KR")}</span>
              <span>{row.clicks.toLocaleString("ko-KR")}</span>
              <span>{row.ctr}%</span>
              <span>{row.cpc.toLocaleString("ko-KR")}원</span>
              <span>{row.conversions.toLocaleString("ko-KR")}</span>
              <span>{row.conversionRate}%</span>
              <strong>{row.conversionCost.toLocaleString("ko-KR")}원</strong>
            </div>
          )) : (
            <div className="naver-search-empty">
              {naverSearchAdLoadState === "loading" ? "네이버 검색광고 그룹 데이터를 불러오는 중입니다." : "선택 기간에 집계된 그룹 데이터가 없습니다."}
            </div>
          )}
        </div>
        <NaverAdTrendChart
          title="검색광고 성과 추이"
          range={periodDefinition.range}
          rows={naverSearchAdData?.daily?.search ?? []}
          primaryMetric={searchTrendPrimary}
          secondaryMetric={searchTrendSecondary}
          onPrimaryMetricChange={setSearchTrendPrimary}
          onSecondaryMetricChange={setSearchTrendSecondary}
        />
      </section>

      <section className="panel naver-place-ads-panel">
        <ChartHeader
          title="네이버 플레이스 검색광고"
          right={<span className={`automation-status ${naverSearchAdLoadState === "live" ? "active" : ""}`}>{naverSearchAdData?.place.status ?? "동기화 중"}</span>}
        />
        <p className="table-helper">8개 검색광고 그룹과 분리해 `플레이스_통합` 캠페인만 별도로 집계합니다. 선택 기간과 5분 자동 동기화 기준은 동일합니다.</p>
        <div className="naver-search-summary-grid naver-place-summary-grid">
          {[
            { label: "광고비", value: naverSearchAdData ? `${naverSearchAdData.place.spend.toLocaleString("ko-KR")}원` : "-" },
            { label: "노출", value: naverSearchAdData ? naverSearchAdData.place.impressions.toLocaleString("ko-KR") : "-" },
            { label: "클릭", value: naverSearchAdData ? naverSearchAdData.place.clicks.toLocaleString("ko-KR") : "-" },
            { label: "CTR", value: naverSearchAdData ? `${naverSearchAdData.place.ctr}%` : "-" },
            { label: "CPC", value: naverSearchAdData ? `${naverSearchAdData.place.cpc.toLocaleString("ko-KR")}원` : "-" },
            { label: "전환", value: naverSearchAdData ? naverSearchAdData.place.conversions.toLocaleString("ko-KR") : "-" },
            { label: "전환율", value: naverSearchAdData ? `${naverSearchAdData.place.conversionRate}%` : "-" },
            { label: "전환당 비용", value: naverSearchAdData ? `${naverSearchAdData.place.conversionCost.toLocaleString("ko-KR")}원` : "-" },
          ].map((item) => (
            <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong></article>
          ))}
        </div>
        <NaverAdTrendChart
          title="플레이스 광고 성과 추이"
          range={periodDefinition.range}
          rows={naverSearchAdData?.daily?.place ?? []}
          primaryMetric={placeTrendPrimary}
          secondaryMetric={placeTrendSecondary}
          onPrimaryMetricChange={setPlaceTrendPrimary}
          onSecondaryMetricChange={setPlaceTrendSecondary}
        />
      </section>

      <section className="panel place-rank-panel">
        <ChartHeader
          title="플레이스 자연 노출 순위"
          right={
            <span className={`automation-status ${placeRankData?.providerConfigured ? "active" : ""}`}>
              {placeRankLoadState === "loading" ? "순위 불러오는 중" : placeRankData?.providerConfigured ? "매일 09:00 기준" : "자동 측정 미연동"}
            </span>
          }
        />
        <p className="table-helper">광고 영역을 제외한 자연 노출 순위의 측정 결과입니다. 키워드 등록과 측정 관리는 설정 메뉴 하단에서 변경할 수 있습니다.</p>
        <div className="place-rank-status-row">
          <span>{placeRankMessage}</span>
          <small>{activeDateRange.start} ~ {activeDateRange.end} · 매일 09:00 · 100위까지</small>
        </div>

        {placeRankData?.keywords.length ? (
          <>
            <div className="place-rank-keyword-grid">
              {placeRankData.keywords.map((keyword) => {
                const result = latestPlaceRankByKeyword.get(keyword.id);
                const latest = result?.latest;
                const previous = result?.previous;
                const delta = latest?.rank && previous?.rank ? previous.rank - latest.rank : null;
                return (
                  <button
                    className={`place-rank-keyword-card ${selectedPlaceRankKeyword?.id === keyword.id ? "selected" : ""}`}
                    key={keyword.id}
                    type="button"
                    onClick={() => setSelectedPlaceRankId(keyword.id)}
                  >
                    <span>{keyword.keyword}</span>
                    <strong>{latest ? latest.outsideTop100 ? "100위 밖" : latest.rank ? `${latest.rank}위` : "측정 실패" : "기록 없음"}</strong>
                    <small>{latest?.status === "failed" ? latest.message || "공급자 측정 오류" : delta === null ? "비교 기록 없음" : delta > 0 ? `전일 대비 ${delta}계단 상승` : delta < 0 ? `전일 대비 ${Math.abs(delta)}계단 하락` : "전일과 동일"}</small>
                    <i>{latest ? `${latest.date} · ${formatPlaceRankCheckedAt(latest.checkedAt)} · ${latest.status === "manual" ? "수동 입력값(자동값 아님)" : latest.trigger === "manual" ? "수동 측정" : latest.status === "failed" ? "실패" : "09:00 자동"}` : "측정 대기"}</i>
                  </button>
                );
              })}
            </div>

            {selectedPlaceRankKeyword ? (
              <div className="place-rank-detail">
                <div className="place-rank-detail-head">
                  <div>
                    <h3>{selectedPlaceRankKeyword.keyword} 기간별 순위 추세</h3>
                    <p>날짜별 순위와 추이를 함께 표시합니다. 막대가 높을수록 상위 노출입니다.</p>
                  </div>
                  <span className="place-rank-result-badge">광고 제외 · 자연 순위</span>
                </div>
                <div className="place-rank-summary-grid">
                  <article>
                    <span>현재 순위</span>
                    <strong>{latestSelectedPlaceRank ? latestSelectedPlaceRank.status === "failed" ? "측정 실패" : latestSelectedPlaceRank.outsideTop100 ? "100위 밖" : `${latestSelectedPlaceRank.rank}위` : "기록 없음"}</strong>
                    <small>{latestSelectedPlaceRank ? `${latestSelectedPlaceRank.date} ${formatPlaceRankCheckedAt(latestSelectedPlaceRank.checkedAt)}` : "측정 대기"}</small>
                  </article>
                  <article>
                    <span>직전 측정 대비</span>
                    <strong className={dailyRankDelta !== null && dailyRankDelta < 0 ? "down" : dailyRankDelta !== null && dailyRankDelta > 0 ? "up" : ""}>{formatRankMovement(dailyRankDelta)}</strong>
                    <small>동일 키워드의 직전 저장값 기준</small>
                  </article>
                  <article>
                    <span>선택 기간 변화</span>
                    <strong className={periodRankDelta !== null && periodRankDelta < 0 ? "down" : periodRankDelta !== null && periodRankDelta > 0 ? "up" : ""}>{formatRankMovement(periodRankDelta)}</strong>
                    <small>{activeDateRange.start} ~ {activeDateRange.end}</small>
                  </article>
                  <article>
                    <span>기간 측정 상태</span>
                    <strong>{selectedPlaceRankHistory.filter((row) => row.status !== "failed").length}/{selectedPlaceRankHistory.length || 0}일 정상</strong>
                    <small>{selectedPlaceRankHistory.some((row) => row.status === "failed") ? "실패 기록을 확인해 주세요" : "저장된 기록 정상"}</small>
                  </article>
                </div>
                {selectedPlaceRankHistory.length ? (
                  <>
                    <div className="place-rank-history-grid" aria-label={`${selectedPlaceRankKeyword.keyword} 날짜별 순위`}>
                      {[...selectedPlaceRankHistory].sort((a, b) => b.date.localeCompare(a.date)).map((row) => (
                        <div className={`place-rank-history-cell ${row.status === "failed" ? "failed" : ""}`} key={`cell-${row.keywordId}-${row.date}`}>
                          <span>{row.date.slice(5).replace("-", "-")}({new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" }).format(new Date(`${row.date}T00:00:00+09:00`))}) · {formatPlaceRankCheckedAt(row.checkedAt)}</span>
                          <strong>{row.status === "failed" ? "측정 실패" : row.outsideTop100 ? "100위 밖" : `${row.rank}위`}</strong>
                          {row.status === "failed" && row.message ? <small>{row.message}</small> : null}
                        </div>
                      ))}
                    </div>
                    <div className="place-rank-chart" aria-label={`${selectedPlaceRankKeyword.keyword} 일자별 순위 추세`}>
                      {selectedPlaceRankHistory.map((row) => (
                        <div className={`place-rank-bar ${row.status === "failed" ? "failed" : ""}`} key={`${row.keywordId}-${row.date}`}>
                          <b>{row.status === "failed" ? "실패" : row.outsideTop100 ? "100+" : `${row.rank}위`}</b>
                          <i style={{ height: row.rank ? `${Math.max(8, 102 - row.rank)}%` : row.outsideTop100 ? "5%" : "2%" }} />
                          <span>{row.date.slice(5).replace("-", ".")}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <div className="place-rank-empty">선택 기간에 저장된 순위 기록이 없습니다.</div>}
                <div className="rankfree-analysis-head">
                  <div>
                    <h3>키워드 · 경쟁 분석</h3>
                    <p>검색 수요와 경쟁 신호를 순위 추세와 함께 확인합니다. 없는 권한의 데이터는 추정하지 않습니다.</p>
                  </div>
                  <span className={`automation-status ${rankfreeInsightsState === "live" ? "active" : ""}`}>
                    {rankfreeInsightsState === "loading" ? "분석 조회 중" : rankfreeInsightsState === "live" ? "랭크프리 분석 연결" : "분석 확인 필요"}
                  </span>
                </div>
                <div className="rankfree-analysis-grid">
                  <article>
                    <span>월간 검색 수요</span>
                    {rankfreeInsights?.keywordStatus === "available" && rankfreeInsights.keywordData ? (
                      <>
                        <strong>{rankfreeInsights.keywordData.monthlyTotal.toLocaleString("ko-KR")}회</strong>
                        <small>PC {rankfreeInsights.keywordData.monthlyPc.toLocaleString("ko-KR")} · 모바일 {rankfreeInsights.keywordData.monthlyMobile.toLocaleString("ko-KR")}</small>
                      </>
                    ) : <p>{rankfreeInsights?.keywordMessage || "키워드 분석 권한을 확인해 주세요."}</p>}
                  </article>
                  <article>
                    <span>검색 경쟁 강도</span>
                    {rankfreeInsights?.keywordStatus === "available" && rankfreeInsights.keywordData ? (
                      <>
                        <strong>{rankfreeInsights.keywordData.competition || "정보 없음"}</strong>
                        <small>{rankfreeInsights.keywordScope === "keyword_detail" ? "상세 키워드 분석" : "기본 키워드 분석"}</small>
                      </>
                    ) : <p>{rankfreeInsights?.keywordMessage || "데이터 미연동"}</p>}
                  </article>
                  <article>
                    <span>경쟁 분석 점수</span>
                    {rankfreeInsights?.competitionStatus === "available" && rankfreeInsights.competition ? (
                      <>
                        <strong>{rankfreeInsights.competition.n1 !== null ? `N1 ${rankfreeInsights.competition.n1}` : "분석 기록 있음"}</strong>
                        <small>N2 {rankfreeInsights.competition.n2 ?? "-"} · N3 {rankfreeInsights.competition.n3 ?? "-"}</small>
                      </>
                    ) : <p>{rankfreeInsights?.competitionMessage || "경쟁 분석 권한을 확인해 주세요."}</p>}
                  </article>
                  <article>
                    <span>API 상태</span>
                    <strong>{rankfreeInsights?.connected ? "정상 연결" : "미연동"}</strong>
                    <small>{rankfreeInsights?.rateRemaining !== null && rankfreeInsights?.rateRemaining !== undefined ? `오늘 잔여 호출 ${rankfreeInsights.rateRemaining.toLocaleString("ko-KR")}회` : "호출 한도 정보 없음"}</small>
                  </article>
                </div>
                {rankfreeInsights?.keywordStatus === "available" && rankfreeInsights.keywordData?.related.length ? (
                  <div className="rankfree-related">
                    <strong>연관 키워드</strong>
                    <div>{rankfreeInsights.keywordData.related.map((row) => <span key={row.keyword}>{row.keyword}<b>{row.monthlyTotal.toLocaleString("ko-KR")}</b></span>)}</div>
                  </div>
                ) : null}
                {rankfreeInsights?.keywordStatus === "available" && rankfreeInsights.keywordData?.monthly.length ? (
                  <div className="rankfree-monthly-trend" aria-label="최근 12개월 검색량 추이">
                    {rankfreeInsights.keywordData.monthly.map((row) => {
                      const max = Math.max(...rankfreeInsights.keywordData!.monthly.map((item) => item.total), 1);
                      return <div key={row.label}><b>{row.total.toLocaleString("ko-KR")}</b><i style={{ height: `${Math.max(6, row.total / max * 100)}%` }} /><span>{row.label.slice(2)}</span></div>;
                    })}
                  </div>
                ) : null}
                {rankfreeInsights?.sourceNote ? <p className="rankfree-source-note">{rankfreeInsights.sourceNote}</p> : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="place-rank-empty">측정 결과가 없습니다. 설정 메뉴 하단에서 키워드와 플레이스 주소를 등록해 주세요.</div>
        )}
      </section>
    </>
  );

  const renderGa4 = () => (
    <>
      <section className="panel kpi-panel">
        <div className="section-title">GA4 웹사이트 성과</div>
        <div className="ga4-status-row">
          <span className={`automation-status ${ga4LoadState === "live" && ga4Automation ? "active" : ""}`}>{ga4LoadState === "loading" ? "GA4 실데이터 조회 중" : ga4LoadState === "live" ? (ga4Data?.warnings?.length ? "GA4 핵심 데이터 연결 · 일부 보고서 확인" : ga4Automation ? "GA4 실데이터 연결 완료 · 자동 분석 설정" : "GA4 실데이터 연결 완료 · 자동 분석 중지") : "GA4 연결 확인 필요"}</span>
          <small>{ga4LoadMessage}{ga4LastSyncedAt ? ` · 마지막 동기화 ${ga4LastSyncedAt}` : ""}</small>
          {ga4Data?.warnings?.length ? <p className="data-warning">부분 연동: {ga4Data.warnings.join(", ")}를 제외한 핵심 데이터를 표시합니다.</p> : null}
          {ga4Data?.summary.utmMissingSessions ? <p className="data-warning">UTM 미설정 세션 {ga4Data.summary.utmMissingSessions.toLocaleString("ko-KR")}건이 감지되었습니다. 캠페인 성과 비교에서 제외될 수 있습니다.</p> : null}
          {!ga4SessionsReconciled && ga4Data ? <p className="data-warning" role="alert">전체 세션 {ga4Data.summary.sessions.toLocaleString("ko-KR")}건과 채널 합계 {ga4ChannelSessionTotal.toLocaleString("ko-KR")}건이 일치하지 않습니다. 채널별 AI 분석은 보류됩니다.</p> : null}
        </div>
        <div className="kpi-grid ga4-kpi-grid">
          {ga4Cards.map((card) => <MetricCardView key={card.label} card={card} />)}
        </div>
      </section>

      <section className={`panel ai-panel ${!aiSettings.enabled ? "ai-disabled" : ""}`}>
        <div className="ai-head">
          <div className="ai-head-left">
            <span className="ai-pill">AI PERFORMANCE BRIEF</span>
            <span className="ai-period-label">{activeDateRange.start} ~ {activeDateRange.end} 기준</span>
            <h2>{periodDefinition.label} GA4 자동 분석</h2>
          </div>
          <div className="ai-head-right"><span>{ga4LoadState === "live" ? "GA4 실데이터" : "예시 데이터"} · 집계 이벤트만 사용</span></div>
        </div>
        <div className="ai-body">
          <div className="ai-summary">
            <h3>한눈에 보는 결과</h3>
            <p>선택 기간 세션 {ga4Cards[0]?.value}, 사용자 {ga4Cards[1]?.value}, 주요 전환 {ga4Cards[4]?.value}건으로 집계되었습니다. 웹 전환율은 {ga4Cards[5]?.value}입니다.</p>
            <div className="chip-row"><span>참여율 {ga4Cards[3]?.value}</span><span>전환 {ga4Cards[4]?.value}</span><span>전환율 {ga4Cards[5]?.value}</span></div>
            <div className="ai-notes">{ga4Recommendations.map((item) => <div key={item.title}>{item.detail}</div>)}</div>
          </div>
          <div className="ai-actions">
            <h3>문제 · 근거 · 실행 제안</h3>
            {ga4Recommendations.map((item, index) => (
              <div className="recommendation" key={item.title}><b>{index + 1}</b><div><strong>{item.title}</strong><span>{item.detail}</span><small className="recommendation-meta">근거 {periodDefinition.range} · 원인 단정 없이 검증 필요 · 기한 다음 비교 기간</small></div></div>
            ))}
          </div>
        </div>
        <footer className="ai-footer">
          <span>GA4 분석은 개인 식별정보 없이 채널·이벤트 집계 데이터만 사용합니다.</span>
          <button type="button" onClick={() => setGa4Automation((enabled) => !enabled)}>{ga4Automation ? "자동 분석 중지" : "자동 분석 시작"}</button>
        </footer>
      </section>

      <section className="panel ga4-crm-bridge-panel">
        <ChartHeader title="GA4 → CRM 전환 연결 진단" right={<span className={`reconcile-status ${ga4CrmBridge.ready ? "pass" : "fail"}`}>{ga4CrmBridge.ready ? "대조 가능" : "연결 보완 필요"}</span>} />
        <p className="table-helper">웹 행동과 상담 결과는 동일 건이 아닐 수 있으므로 임의로 합치지 않고, 같은 기간의 수집 규모와 누락 신호를 나란히 표시합니다.</p>
        <div className="ga4-crm-bridge-grid">
          <article><span>GA4 주요 전환</span><strong>{ga4CrmBridge.webConversions === null ? "미연동" : `${ga4CrmBridge.webConversions.toLocaleString("ko-KR")}건`}</strong><small>전화·카카오·예약 주요 이벤트</small></article>
          <i aria-hidden="true">→</i>
          <article><span>CRM 유효 문의</span><strong>{ga4CrmBridge.crmInquiries === null ? "미연동" : `${ga4CrmBridge.crmInquiries.toLocaleString("ko-KR")}건`}</strong><small>전화 + 온라인 문의</small></article>
          <i aria-hidden="true">→</i>
          <article><span>CRM 예약</span><strong>{ga4CrmBridge.crmReservations === null ? "미연동" : `${ga4CrmBridge.crmReservations.toLocaleString("ko-KR")}건`}</strong><small>예약 완료 건수</small></article>
          <article className={ga4CrmBridge.utmMissing ? "bridge-warning" : "bridge-good"}><span>UTM 누락 세션</span><strong>{ga4CrmBridge.utmMissing === null ? "미연동" : `${ga4CrmBridge.utmMissing.toLocaleString("ko-KR")}건`}</strong><small>{ga4CrmBridge.utmMissing ? "광고 소재 URL 보완 필요" : "캠페인 식별 정상"}</small></article>
        </div>
      </section>

      <section className="panel table-panel ga4-channel-panel">
        <ChartHeader title="GA4 유입 채널별 성과" />
        <p className="table-helper">선택 기간의 세션, 사용자, 참여율과 주요 전환을 채널별로 비교합니다.</p>
        <div className="data-table">
          <div className="table-head ga4-channel-head"><span>채널</span><span>세션</span><span>사용자</span><span>참여율</span><span>주요 전환</span><span>전환율</span></div>
          {ga4ChannelRows.map((row) => (
            <div className="table-row ga4-channel-row" key={row.channel}>
              <b>{row.channel}</b><span>{row.sessions.toLocaleString("ko-KR")}</span><span>{row.users.toLocaleString("ko-KR")}</span><span>{row.engaged}%</span><span>{row.conversions.toLocaleString("ko-KR")}</span><strong>{row.rate}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="ga4-detail-grid">
        <article className="panel table-panel ga4-detail-panel">
          <ChartHeader title="상위 랜딩페이지" />
          <div className="data-table">
            <div className="table-head ga4-landing-head"><span>랜딩페이지</span><span>세션</span><span>사용자</span><span>참여율</span><span>주요 전환</span></div>
            {ga4LandingRows.map((row) => <div className="table-row ga4-landing-row" key={row.page}><b>{row.page}</b><span>{row.sessions.toLocaleString("ko-KR")}</span><span>{row.users.toLocaleString("ko-KR")}</span><span>{row.engagement}%</span><strong>{row.keyEvents.toLocaleString("ko-KR")}</strong></div>)}
          </div>
        </article>
        <article className="panel table-panel ga4-detail-panel">
          <ChartHeader title="주요 이벤트" />
          <div className="data-table">
            <div className="table-head ga4-event-head"><span>이벤트</span><span>이벤트 수</span><span>사용자</span><span>구분</span></div>
            {ga4EventRows.map((row) => <div className="table-row ga4-event-row" key={row.event}><b>{row.event}</b><span>{row.count.toLocaleString("ko-KR")}</span><span>{row.users.toLocaleString("ko-KR")}</span><strong>{row.keyEvent}</strong></div>)}
          </div>
        </article>
      </section>

      <section className="panel ga4-readiness-panel">
        <ChartHeader title="GA4 전환 설정 진단" right={<span className={`reconcile-status ${ga4Data?.summary.keyEvents ? "pass" : "fail"}`}>{ga4Data?.summary.keyEvents ? "주요 전환 수집 중" : "설정 필요"}</span>} />
        <p className="table-helper">전화·카카오·예약 이벤트의 실제 수집 여부와 GA4 주요 이벤트 지정 여부를 선택 기간 기준으로 확인합니다.</p>
        <div className="ga4-readiness-grid">
          {ga4ConversionReadiness.map((item) => (
            <article className="ga4-readiness-card" key={item.label}>
              <div><span>{item.label}</span><strong>{item.count.toLocaleString("ko-KR")}건</strong></div>
              <b className={item.keyEvent ? "ready" : item.count > 0 ? "collected" : "missing"}>{item.keyEvent ? "주요 이벤트 지정 완료" : item.count > 0 ? "수집됨 · 주요 이벤트 지정 필요" : "미수집"}</b>
              <small>{item.eventNames || item.recommendation}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel table-panel ga4-landing-conversion-panel">
        <ChartHeader title="랜딩페이지별 전화·카카오·예약 전환" />
        <p className="table-helper">선택 기간의 GA4 이벤트를 랜딩페이지와 연결해 표시합니다. 이벤트가 없으면 추정하지 않습니다.</p>
        <div className="data-table">
          <div className="table-head ga4-landing-conversion-head"><span>랜딩페이지</span><span>이벤트</span><span>전환 수</span><span>사용자</span><span>주요 전환</span></div>
          {ga4LandingConversionRows.map((row) => <div className="table-row ga4-landing-conversion-row" key={`${row.page}-${row.event}`}><b>{row.page}</b><span>{row.event}</span><span>{row.count.toLocaleString("ko-KR")}</span><span>{row.users.toLocaleString("ko-KR")}</span><strong>{row.keyEvents.toLocaleString("ko-KR")}</strong></div>)}
          {!ga4LandingConversionRows.length ? <div className="data-empty-row">전화·카카오·예약 이벤트가 아직 수집되지 않았습니다. 위 전환 설정 진단을 확인하세요.</div> : null}
        </div>
      </section>

      <section className="panel table-panel ga4-device-panel">
        <ChartHeader title="기기별 사용자 · 전환" />
        <div className="data-table">
          <div className="table-head ga4-device-head"><span>기기</span><span>사용자</span><span>세션</span><span>세션 비중</span><span>전환율</span></div>
          {ga4DeviceRows.map((row) => <div className="table-row ga4-device-row" key={row.device}><b>{row.device}</b><span>{row.users.toLocaleString("ko-KR")}</span><span>{row.sessions.toLocaleString("ko-KR")}</span><span>{row.share}%</span><strong>{row.conversionRate}%</strong></div>)}
        </div>
      </section>
    </>
  );

  const renderData = () => (
    <>
      <section className="panel kpi-panel">
        <div className="section-title">데이터 관리 <span className={`source-badge ${dataSourceState}`}>{dataSourceState === "live" ? "D1 실데이터" : dataSourceState === "loading" ? "연결 확인 중" : "데이터 미연동"}</span></div>
        <div className="kpi-grid data-kpi-grid">
          <MetricCardView card={{ label: "전체 업로드", value: `${dataQuality?.uploadSummary.total ?? 0}건`, delta: "실제 이력", previous: "D1 업로드 배치", icon: "", tone: "green" }} />
          <MetricCardView card={{ label: "정상 반영", value: `${dataQuality?.uploadSummary.validated ?? 0}건`, delta: "검수 완료", previous: "오류 없는 업로드", icon: "", tone: "blue" }} />
          <MetricCardView card={{ label: "검수 대기", value: `${dataQuality?.uploadSummary.review ?? 0}건`, delta: "확인 필요", previous: "오류 또는 경고 포함", icon: "", tone: "orange" }} />
          <MetricCardView card={{ label: "오류 행", value: `${dataQuality?.uploadSummary.errors ?? 0}건`, delta: "수정 필요", previous: "업로드 검수 결과", icon: "", tone: "violet" }} />
        </div>
      </section>

      <section className="panel data-trust-panel">
        <ChartHeader title="데이터 신뢰도 요약" right={<span className={`reconcile-status ${dataTrustSummary.missingLinks + dataTrustSummary.duplicates + dataTrustSummary.mismatches === 0 ? "pass" : "fail"}`}>{dataTrustSummary.missingLinks + dataTrustSummary.duplicates + dataTrustSummary.mismatches === 0 ? "검증 통과" : "확인 필요"}</span>} />
        <div className="data-trust-grid">
          <article><span>연결 원천</span><strong>{dataTrustSummary.connectedSources}/{dataTrustSummary.totalSources}</strong><small>문의·예약·내원·결제·광고비</small></article>
          <article className={dataTrustSummary.missingLinks ? "trust-warning" : "trust-good"}><span>연결 누락</span><strong>{dataTrustSummary.missingLinks.toLocaleString("ko-KR")}건</strong><small>문의→예약→내원 관계</small></article>
          <article className={dataTrustSummary.duplicates ? "trust-warning" : "trust-good"}><span>중복 행</span><strong>{dataTrustSummary.duplicates.toLocaleString("ko-KR")}건</strong><small>원천 식별키 기준</small></article>
          <article className={dataTrustSummary.mismatches ? "trust-warning" : "trust-good"}><span>합계 불일치</span><strong>{dataTrustSummary.mismatches.toLocaleString("ko-KR")}개</strong><small>기간 합계 = 세부 합계</small></article>
        </div>
      </section>

      <section className="chart-grid data-grid">
        <article className="panel table-panel">
          <ChartHeader title="업로드 메뉴" />
          <div className="upload-zone">
            <div className="upload-zone-inner">
              <span className="upload-badge">드래그 & 드롭</span>
              <strong>상담, 내원, 광고비 파일을 여기에 올려주세요.</strong>
              <p>CSV, XLSX, XLS 형식을 지원합니다. 업로드 후 자동 검수와 컬럼 매핑을 진행합니다.</p>
              <p className="upload-api-note">업로드 원본은 R2에, 검수 결과와 운영 데이터는 D1에 영구 저장됩니다. 예시 행은 삭제한 뒤 업로드해 주세요.</p>
            </div>
            <div className="upload-actions">
              <input ref={fileInputRef} className="visually-hidden" type="file" accept=".csv,.xlsx,.xls" onChange={handleUploadFile} />
              <button className="primary-button" type="button" disabled={!canManageData} onClick={() => fileInputRef.current?.click()}>
                파일 선택
              </button>
              <label className="template-picker">
                <span className="visually-hidden">다운로드할 템플릿 유형</span>
                <select value={templateType} onChange={(event) => setTemplateType(event.target.value as ImportTableKey)}>
                  {importTables.map((table) => <option key={table.key} value={table.key}>{table.label} 템플릿</option>)}
                </select>
              </label>
              <button className="pill subtle" type="button" onClick={downloadTemplate}>
                템플릿 다운로드
              </button>
            </div>
            {validationResults ? <p className="upload-feedback" role="status">{validationResults}</p> : null}
          </div>
        </article>

        <article className="panel table-panel">
          <ChartHeader title="최근 업로드 상태" />

          <div className="data-table">
            <div className="table-head upload-table-head">
              <span>파일</span>
              <span>데이터</span>
              <span>적용 기간</span>
              <span>업로드자</span>
              <span>행 수</span>
              <span>검수</span>
              <span>상태</span>
              <span>업데이트</span>
            </div>

            {uploadedFiles.map((row) => (
              <div className="table-row upload-table-row" key={row.name}>
                <b>{row.name}<small>{row.type}</small></b>
                <span>{row.dataset ?? "데이터"}</span>
                <span>{row.periodStart ? `${row.periodStart}${row.periodEnd && row.periodEnd !== row.periodStart ? ` ~ ${row.periodEnd}` : ""}` : "반영 전"}</span>
                <span>{row.uploadedBy ?? "-"}</span>
                <span>{row.rowCount?.toLocaleString("ko-KR") ?? "-"}</span>
                <span className={row.errorCount ? "upload-issue error" : row.warningCount ? "upload-issue warning" : "upload-issue clean"}>{row.errorCount ? `오류 ${row.errorCount}` : row.warningCount ? `경고 ${row.warningCount}` : "이상 없음"}</span>
                <span>
                  <i className={`status-dot ${row.status === "정상 반영" ? "good" : row.status === "검수 대기" ? "wait" : "bad"}`} />
                  {row.status}
                </span>
                <strong>{row.updated}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="summary-grid data-summary-grid">
        <article className="panel summary-cards-panel">
          <ChartHeader title="연동 상태" />
          <div className="integration-status-list">
            {importedDataCounts.map(({ label, count }) => {
              const status = count > 0 ? "실데이터" : "미연동";
              return (
              <div className="integration-status-row" key={label}>
                <span><i className={`status-dot ${count > 0 ? "good" : "wait"}`} />{label}</span>
                <strong>{status}</strong>
                <small>{count.toLocaleString("ko-KR")}행</small>
              </div>
            )})}
          </div>
        </article>

        <article className="panel table-panel">
          <ChartHeader title="누락 · 중복 자동 검사" />
          <ul className="checklist">
            <li>연결되지 않은 문의·예약·내원 관계: <b>{dataQuality?.warnings.missingLinks ?? 0}건</b></li>
            <li>업로드 중복 경고: <b>{dataQuality?.warnings.duplicates ?? 0}건</b></li>
            <li>오류가 있는 파일은 운영 집계에 반영하지 않습니다.</li>
            <li>예시 데이터는 템플릿 안내용이며 실데이터 집계에 포함하지 않습니다.</li>
          </ul>
        </article>
      </section>

      <section className="panel table-panel reconciliation-panel">
        <ChartHeader title="수치 대사표 · 기간 합계 = 세부 합계" />
        <p className="table-helper">선택 기간 {activeDateRange.start} ~ {activeDateRange.end}의 원천 합계와 일자별 상세 합계를 자동 비교합니다.</p>
        <div className="data-table">
          <div className="table-head reconciliation-head"><span>지표</span><span>기간 합계</span><span>세부 합계</span><span>검증</span></div>
          {reconciliationRows.map((row) => <div className="table-row reconciliation-row" key={row.metric}><b>{{ inquiries: "문의", reservations: "예약", visits: "내원", sales: "매출", adSpend: "광고비", departmentInquiries: "진료과목 문의", departmentPhoneInquiries: "진료과목 전화문의", departmentOnlineInquiries: "진료과목 온라인문의", departmentReservations: "진료과목 예약", departmentPhoneReservations: "진료과목 전화예약", departmentOnlineReservations: "진료과목 온라인예약", departmentNewVisits: "진료과목 신환 내원", channelInquiries: "채널 문의", channelReservations: "채널 예약", referralNewVisits: "내원경로 신환 내원" }[row.metric] || row.metric}</b><span>{row.total.toLocaleString("ko-KR")}</span><span>{row.detailTotal.toLocaleString("ko-KR")}</span><strong className={row.passed ? "reconcile-pass" : "reconcile-fail"}>{row.passed ? "일치" : `불일치 ${Math.abs(row.total - row.detailTotal).toLocaleString("ko-KR")}`}</strong></div>)}
          {!reconciliationRows.length ? <div className="data-empty-row">검증할 실데이터가 없습니다.</div> : null}
        </div>
      </section>

      <section className="panel table-panel data-template-map-panel">
        <ChartHeader title="페이지별 데이터 템플릿" />
        <p className="table-helper">각 화면에서 사용하는 지표와 업로드 원천 테이블을 같은 기준으로 정리했습니다.</p>
        <div className="data-template-map-grid">
          {templatePageGroups.map((group) => (
            <article className="data-template-map-card" key={group.page}>
              <span>{group.page}</span>
              <strong>{group.tables}</strong>
              <small>{group.output}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel table-panel uploaded-data-panel" id="daily-data-table">
        <ChartHeader title="일자별 데이터 테이블" right={<div className="data-table-actions"><label className="table-filter">표시<select value={dataVisibleCount} onChange={(event) => setDataVisibleCount(Number(event.target.value) as 7 | 14 | 30)}><option value="7">최근 7개</option><option value="14">최근 14개</option><option value="30">최근 30개</option></select></label><label className="table-filter">정렬<select value={dataSort} onChange={(event) => setDataSort(event.target.value as "latest" | "inquiries" | "sales")}><option value="latest">최신순</option><option value="inquiries">상담 많은순</option><option value="sales">매출 높은순</option></select></label><button className="primary-button save-data-button" type="button" disabled={!canManageData || !isDataDirty || dailyEditReason.trim().length < 2 || dailySaveState === "saving"} onClick={saveDailyData}>{dailySaveState === "saving" ? "저장 중" : isDataDirty ? `변경 ${editedDailyDates.length}일 저장` : dailySaveState === "saved" ? "저장 완료" : "수정 후 저장"}</button></div>} />
        <div className="data-period-toolbar">
          <strong>조회 기간</strong>
          <label><span>시작일</span><input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} /></label>
          <span className="data-period-separator">~</span>
          <label><span>종료일</span><input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} /></label>
          <button className="pill" type="button" onClick={applyDataDateRange}>기간 적용</button>
          <small>{activeDateRange.start} ~ {activeDateRange.end} · {visibleDailyData.length}일 표시</small>
        </div>
        <label className="daily-edit-reason"><span>수정 사유</span><input disabled={!canManageData} value={dailyEditReason} maxLength={200} onChange={(event) => setDailyEditReason(event.target.value)} placeholder={isDataDirty ? "저장 전에 수정 사유를 입력해 주세요." : "수치를 수정하면 사유 입력이 활성화됩니다."} /><small>{dailyEditReason.length}/200</small></label>
        <p className="table-helper">업로드된 원천 데이터의 일자별 합계입니다. 관리자와 마케팅 권한은 수치를 직접 수정할 수 있으며, 저장값과 수정자는 서버 변경 이력에 남습니다.</p>
        <div className="data-table">
          <div className="table-head daily-data-head">
            <span>일자</span><span>상담</span><span>예약</span><span>내원</span><span>예약률</span><span>내원율</span><span>매출</span><span>광고비</span>
          </div>
          {visibleDailyData.map((row) => (
            <div className="table-row daily-data-row" key={row.date}>
              <b>{row.date}{editedDailyDates.includes(row.date) ? <small className="daily-edited-badge">수정</small> : null}</b>
              {(["inquiries", "reservations", "visits"] as const).map((field) => canManageData ? <input key={field} inputMode="numeric" aria-label={`${row.date} ${field}`} value={row[field]} onChange={(event) => updateDailyData(row.date, field, event.target.value)} /> : <span key={field}>{row[field].toLocaleString("ko-KR")}</span>)}
              <span className="daily-rate">{row.inquiries === 0 ? "-" : `${Math.round((row.reservations / row.inquiries) * 1000) / 10}%`}</span>
              <span className="daily-rate">{row.reservations === 0 ? "-" : `${Math.round((row.visits / row.reservations) * 1000) / 10}%`}</span>
              {canManageData ? <input inputMode="numeric" aria-label={`${row.date} 매출`} value={row.sales} onChange={(event) => updateDailyData(row.date, "sales", event.target.value)} /> : <span>{formatWon(row.sales)}</span>}
              {canManageData ? <input inputMode="numeric" aria-label={`${row.date} 광고비`} value={row.adSpend} onChange={(event) => updateDailyData(row.date, "adSpend", event.target.value)} /> : <span>{formatWon(row.adSpend)}</span>}
            </div>
          ))}
          {visibleDailyData.length === 0 ? <div className="data-empty-row">선택 기간에 연결된 실데이터가 없습니다.</div> : null}
        </div>
      </section>

      <section className="panel table-panel daily-history-panel">
        <ChartHeader title="일자별 수치 수정 이력" right={<span className="chart-period-note">선택 기간 · 최근 {dataQuality?.overrideHistory?.length ?? 0}건</span>} />
        <p className="table-helper">관리자가 직접 수정해 저장한 값만 표시합니다. 동일 일자를 여러 번 수정한 경우 최신 기록부터 모두 보존됩니다.</p>
        <div className="data-table">
          <div className="table-head daily-history-head"><span>대상 일자</span><span>수정자</span><span>수정 시각</span><span>수정 사유</span><span>문의</span><span>예약</span><span>내원</span><span>매출</span><span>광고비</span><span>작업</span></div>
          {(dataQuality?.overrideHistory ?? []).map((row, index) => (
            <div className="table-row daily-history-row" key={`${row.date}-${row.updatedAt ?? index}`}>
              <b>{row.date}</b>
              <span>{row.updatedBy || "확인 불가"}</span>
              <span>{row.updatedAt ? new Date(row.updatedAt).toLocaleString("ko-KR") : "-"}</span>
              <span className="history-reason">{row.reason || "사유 미기록"}</span>
              <span>{row.inquiries.toLocaleString("ko-KR")}</span>
              <span>{row.reservations.toLocaleString("ko-KR")}</span>
              <span>{row.visits.toLocaleString("ko-KR")}</span>
              <span>{formatWon(row.sales)}</span>
              <span>{formatWon(row.adSpend)}</span>
              {canManageData ? <button className="history-restore-button" type="button" onClick={() => restoreDailyData(row)}>이 값 복원</button> : <span className="history-readonly">조회 전용</span>}
            </div>
          ))}
          {!dataQuality?.overrideHistory?.length ? <div className="data-empty-row">선택 기간에 저장된 직접 수정 이력이 없습니다.</div> : null}
        </div>
      </section>

      <section className="panel table-panel data-label-panel">
        <ChartHeader
          title={`${selectedImportContract.label} 데이터 레이블`}
          right={
            <label className="table-filter data-label-filter">
              템플릿
              <select value={templateType} onChange={(event) => setTemplateType(event.target.value as ImportTableKey)}>
                {importTables.map((table) => <option key={table.key} value={table.key}>{table.label}</option>)}
              </select>
            </label>
          }
        />
        <p className="table-helper">
          {selectedImportContract.purpose} · 기준일: <b>{selectedImportContract.primaryDateField}</b> · 중복 기준: <b>{selectedImportContract.dedupeKey}</b>
        </p>
        <div className="data-table">
          <div className="table-head data-label-head">
            <span>컬럼명</span><span>표시명</span><span>형식</span><span>필수</span><span>계산·표시 용도</span><span>입력 예시</span>
          </div>
          {selectedImportContract.fields.map((field) => (
            <div className="table-row data-label-row" key={field.key}>
              <b>{field.key}</b>
              <span>{field.label}</span>
              <span>{importFieldTypeLabels[field.type]}</span>
              <strong className={field.required ? "required-field" : "optional-field"}>{field.required ? "필수" : "선택"}</strong>
              <span>{field.description}</span>
              <span>{field.example}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  const integrationHealthRows = [
    {
      key: "ga4",
      name: "GA4 Data API",
      description: "웹 유입·랜딩페이지·전환 이벤트",
      state: ga4LoadState === "loading" ? "loading" : ga4LoadState === "error" ? "error" : ga4Data?.warnings?.length ? "partial" : "live",
      status: ga4LoadState === "loading" ? "조회 중" : ga4LoadState === "error" ? "오류" : ga4Data?.warnings?.length ? "부분 연동" : "정상 연동",
      lastSuccess: ga4LastSyncedAt || "성공 기록 없음",
      cadence: ga4Automation ? "5분 주기 · 화면 복귀 시 즉시" : "자동 갱신 중지",
      message: ga4LoadMessage,
      refresh: () => setGa4RefreshKey((value) => value + 1),
      refreshing: ga4LoadState === "loading",
    },
    {
      key: "naver-search-ads",
      name: "네이버 검색광고",
      description: "검색광고·플레이스 광고 원천 지표",
      state: naverSearchAdLoadState === "loading" ? "loading" : naverSearchAdLoadState === "error" ? "error" : "live",
      status: naverSearchAdLoadState === "loading" ? "조회 중" : naverSearchAdLoadState === "error" ? "오류" : "정상 연동",
      lastSuccess: naverSearchAdLastSyncedAt || "성공 기록 없음",
      cadence: "5분 주기 · 화면 복귀 시 즉시",
      message: naverSearchAdMessage,
      refresh: () => setNaverSearchAdRefreshKey((value) => value + 1),
      refreshing: naverSearchAdLoadState === "loading",
    },
    {
      key: "place-rank",
      name: "플레이스 자연 노출 순위",
      description: "광고 제외 키워드별 자연 노출 순위",
      state: placeRankLoadState === "loading" ? "loading" : placeRankLoadState === "error" ? "error" : !placeRankData?.providerConfigured ? "disconnected" : placeRankData.trackingSync?.error ? "partial" : "live",
      status: placeRankLoadState === "loading" ? "조회 중" : placeRankLoadState === "error" ? "오류" : !placeRankData?.providerConfigured ? "미설정" : placeRankData.trackingSync?.error ? "부분 연동" : "정상 연동",
      lastSuccess: placeRankData?.syncedAt ? formatPlaceRankCheckedAt(placeRankData.syncedAt) : "성공 기록 없음",
      cadence: placeRankData?.providerConfigured ? "매일 09:00 · 수동 측정 지원" : "자동 측정 중지",
      message: placeRankMessage,
      refresh: () => setPlaceRankRefreshKey((value) => value + 1),
      refreshing: placeRankLoadState === "loading",
    },
  ];
  const latestIntegrationSuccess = placeRankData?.syncedAt
    ? formatPlaceRankCheckedAt(placeRankData.syncedAt)
    : naverSearchAdLastSyncedAt || ga4LastSyncedAt || "성공 기록 없음";

  const renderSettings = () => (
    <>
      <section className="panel settings-hero">
        <div className="settings-hero-copy">
          <span className="ai-pill">{isAuthenticated ? "SIGNED IN" : "SETTINGS PREVIEW"}</span>
          <h2>설정 화면</h2>
          <p>
            병원 정보, 표시 기준, 알림, 권한을 한 화면에서 확인할 수 있도록 정리했습니다.
            {isAuthenticated
              ? " 로그인 상태에서는 바로 변경과 확인을 이어서 볼 수 있습니다."
              : " 로그인하면 같은 화면에서 바로 수정 흐름으로 이어집니다."}
          </p>
          <button className="primary-button settings-save-button" type="button" disabled={!isSettingsDirty || !canManageSettings || Boolean(userAccessValidation) || settingsSaveState === "saving"} onClick={saveSettings}>{settingsSaveState === "saving" ? "저장 중" : "설정 저장"}</button>
          {!canManageSettings ? <p className="permission-note">현재 권한({accessRole})은 설정 조회만 가능합니다.</p> : null}
        </div>

        <div className="settings-hero-grid">
          <article className="settings-stat">
            <span>접속 상태</span>
            <strong>{isAuthenticated ? `${accessRole} 로그인` : "로그인 대기"}</strong>
            <small>{isAuthenticated ? loginEmail : "admin@hospital.local"}</small>
          </article>
          <article className="settings-stat">
            <span>기본 기간</span>
            <strong>{periodDefinition.label}</strong>
            <small>{periodDefinition.range}</small>
          </article>
          <article className="settings-stat">
            <span>최근 동기화</span>
            <strong>{latestIntegrationSuccess}</strong>
            <small>외부 연동의 실제 성공 기록</small>
          </article>
        </div>
      </section>

      <section className="panel kpi-panel">
        <div className="section-title">기본 설정</div>
        <div className="settings-grid">
          <article className="setting-card">
            <h3>병원 정보</h3>
            <div className="setting-row">
              <span>병원명</span>
              <input className="setting-input" value={hospitalName} onChange={(event) => { setHospitalName(event.target.value); setIsSettingsDirty(true); }} aria-label="병원명" />
            </div>
            <div className="setting-row">
              <span>기준 지점</span>
              <input className="setting-input" value={hospitalLocation} onChange={(event) => { setHospitalLocation(event.target.value); setIsSettingsDirty(true); }} aria-label="기준 지점" />
            </div>
            <div className="setting-row">
              <span>언어</span>
              <select className="setting-input" value={settingsLocale} onChange={(event) => { setSettingsLocale(event.target.value); setIsSettingsDirty(true); }} aria-label="언어">
                <option>한국어</option>
                <option>English</option>
              </select>
            </div>
          </article>

          <article className="setting-card">
            <h3>표시 기준</h3>
            <div className="setting-row">
              <span>기본 기간</span>
              <select className="setting-input" value={settingsPeriod} onChange={(event) => { setSettingsPeriod(event.target.value as PeriodOption); setIsSettingsDirty(true); }} aria-label="기본 기간">
                {periodOptions.map((option) => <option key={option.label}>{option.label}</option>)}
              </select>
            </div>
            <div className="setting-row">
              <span>비교 기준</span>
              <select className="setting-input" value={settingsCompare} onChange={(event) => { setSettingsCompare(event.target.value as CompareOption); setIsSettingsDirty(true); }} aria-label="비교 기준">
                {compareOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="setting-row">
              <span>요일 표기</span>
              <strong>월~일</strong>
            </div>
          </article>

          <article className="setting-card">
            <h3>알림</h3>
            <div className="toggle-row">
              <span>오류 파일 알림</span>
              <button type="button" className={`toggle ${notifications.errors ? "on" : ""}`} aria-pressed={notifications.errors} onClick={() => { setNotifications((current) => ({ ...current, errors: !current.errors })); setIsSettingsDirty(true); }} />
            </div>
            <div className="toggle-row">
              <span>일일 요약 메일</span>
              <button type="button" className={`toggle ${notifications.summary ? "on" : ""}`} aria-pressed={notifications.summary} onClick={() => { setNotifications((current) => ({ ...current, summary: !current.summary })); setIsSettingsDirty(true); }} />
            </div>
            <div className="toggle-row">
              <span>변동 감지 알림</span>
              <button type="button" className={`toggle ${notifications.changes ? "on" : ""}`} aria-pressed={notifications.changes} onClick={() => { setNotifications((current) => ({ ...current, changes: !current.changes })); setIsSettingsDirty(true); }} />
            </div>
          </article>
        </div>
      </section>

      <section className="panel table-panel settings-management-panel">
        <ChartHeader title="사용자 · 권한 관리" right={<button className="pill" type="button" disabled={!canManageSettings} onClick={() => { setUsers((current) => [...current, { email: "", name: "", organization: hospitalLocation, role: "조회 전용", recentAccess: "접속 기록 없음" }]); setIsSettingsDirty(true); }}>사용자 추가</button>} />
        <p className="table-helper">서버가 로그인 이메일과 저장된 역할을 대조합니다. 설정은 최고관리자·병원 관리자, 데이터 관리는 마케팅 이상만 변경할 수 있습니다.</p>
        {userAccessValidation ? <p className="user-access-validation" role="alert">{userAccessValidation}</p> : <p className="user-access-validation pass">권한 구성 정상 · 최고관리자 {users.filter((user) => user.role === "최고관리자").length}명</p>}
        <div className="data-table">
          <div className="table-head user-access-head"><span>이메일</span><span>이름</span><span>소속</span><span>권한</span><span>최근 접속</span><span>작업</span></div>
          {users.map((user, index) => (
            <div className="table-row user-access-row" key={`${user.email}-${index}`}>
              <input disabled={!canManageSettings || user.email.trim().toLowerCase() === loginEmail.trim().toLowerCase()} value={user.email} aria-label={`${index + 1}번 사용자 이메일`} onChange={(event) => { setUsers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item)); setIsSettingsDirty(true); }} />
              <input disabled={!canManageSettings} value={user.name} aria-label={`${index + 1}번 사용자 이름`} onChange={(event) => { setUsers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item)); setIsSettingsDirty(true); }} />
              <input disabled={!canManageSettings} value={user.organization} aria-label={`${user.name} 소속`} onChange={(event) => { setUsers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, organization: event.target.value } : item)); setIsSettingsDirty(true); }} />
              <select disabled={!canManageSettings} value={user.role} aria-label={`${user.name} 권한`} onChange={(event) => { setUsers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value as UserAccessRow["role"] } : item)); setIsSettingsDirty(true); }}>
                {(["최고관리자", "병원 관리자", "마케팅", "상담", "조회 전용"] as const).map((role) => <option key={role}>{role}</option>)}
              </select>
              <span>{user.recentAccess}</span>
              {user.email.trim().toLowerCase() === loginEmail.trim().toLowerCase()
                ? <span className="current-user-label">현재 계정</span>
                : <button className="user-remove-button" type="button" disabled={!canManageSettings} onClick={() => { setUsers((current) => current.filter((_, itemIndex) => itemIndex !== index)); setIsSettingsDirty(true); }}>삭제</button>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel table-panel settings-management-panel">
        <ChartHeader title="KPI 목표 현황 · 설정" />
        <p className="table-helper">병원 전체 목표와 대표 진료과목·광고 매체 목표를 함께 설정하면 AI가 달성 여부와 우선순위를 비교합니다.</p>
        <div className="goal-status-grid">
          {kpiGoalStatus.slice(0, 8).map((target) => <article className="goal-status-card" key={`status-${target.metric}`}><span>{target.metric}</span><strong>{target.current === null || target.current === undefined ? "미집계" : target.metric.includes("CPA") || target.metric === "CPL" ? `${Math.round(target.current).toLocaleString("ko-KR")}원` : `${target.current}%`}</strong><small className={target.passed === null ? "" : target.passed ? "pass" : "fail"}>{target.passed === null ? "실데이터 연결 후 평가" : target.passed ? `목표 ${target.hospital} 달성` : `목표 ${target.hospital} 미달`}</small></article>)}
        </div>
        <div className="data-table">
          <div className="table-head kpi-target-head"><span>KPI</span><span>병원 전체 목표</span><span>진료과목별 목표</span><span>광고 매체별 목표</span></div>
          {kpiTargets.map((target, index) => (
            <div className="table-row kpi-target-row" key={target.metric}>
              <b>{target.metric}</b>
              {(["hospital", "department", "channel"] as const).map((field) => (
                <input disabled={!canManageSettings} key={field} value={target[field]} aria-label={`${target.metric} ${field} 목표`} onChange={(event) => { setKpiTargets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: event.target.value } : item)); setIsSettingsDirty(true); }} />
              ))}
            </div>
          ))}
        </div>
      </section>
      <section className="panel table-panel settings-management-panel">
        <ChartHeader title="설정 변경 이력" />
        <p className="table-helper">누가 언제 설정과 권한을 변경했는지 서버 감사 로그로 보존합니다.</p>
        <div className="data-table">
          <div className="table-head settings-history-head"><span>일시</span><span>작업자</span><span>변경 내용</span><span>대상·결과</span></div>
          {settingsHistory.map((row, index) => (
            <div className="table-row settings-history-row" key={`${row.createdAt}-${row.action}-${row.targetId ?? index}`}>
              <span>{new Date(row.createdAt).toLocaleString("ko-KR")}</span>
              <b>{row.userId}</b>
              <span>{settingsActionLabels[row.action] ?? row.action}</span>
              <strong>{row.metadata?.email
                ? `${row.metadata.email}${row.metadata.beforeRole !== row.metadata.afterRole ? ` · ${row.metadata.beforeRole ?? "신규"} → ${row.metadata.afterRole ?? "삭제"}` : ""}`
                : row.metadata?.detail
                  ? `${row.metadata.metric ? `${row.metadata.metric} · ` : ""}${row.metadata.detail}`
                  : row.metadata?.userCount !== undefined ? `사용자 ${row.metadata.userCount}명 · 최고관리자 ${row.metadata.ownerCount ?? "-"}명` : row.targetId ?? "-"}</strong>
            </div>
          ))}
          {settingsHistory.length === 0 ? <div className="data-empty-row">아직 저장된 변경 이력이 없습니다.</div> : null}
        </div>
      </section>

      <section className="panel settings-ai-panel">
        <ChartHeader title="AI 요약 · 자동 분석 설정" />
        <div className="settings-ai-grid">
          <div className="setting-row"><span>AI 요약 사용</span><button type="button" className={`toggle ${aiSettings.enabled ? "on" : ""}`} aria-pressed={aiSettings.enabled} onClick={() => { setAiSettings((current) => ({ ...current, enabled: !current.enabled })); setIsSettingsDirty(true); }} /></div>
          <label className="setting-row"><span>분석 주기</span><select className="setting-input" value={aiSettings.frequency} onChange={(event) => { setAiSettings((current) => ({ ...current, frequency: event.target.value })); setIsSettingsDirty(true); }}><option>매일 오전 9시</option><option>매주 월요일</option><option>데이터 업로드 후</option><option>수동 실행</option></select></label>
          <label className="setting-row"><span>비교 기준</span><select className="setting-input" value={aiSettings.compare} onChange={(event) => { setAiSettings((current) => ({ ...current, compare: event.target.value })); setIsSettingsDirty(true); }}><option>전일</option><option>전주 동일기간</option><option>전월 동일기간</option><option>최근 4주 평균</option></select></label>
          <label className="setting-row"><span>이상 변화 감지</span><select className="setting-input" value={aiSettings.anomaly} onChange={(event) => { setAiSettings((current) => ({ ...current, anomaly: event.target.value })); setIsSettingsDirty(true); }}><option>5% 이상</option><option>10% 이상</option><option>15% 이상</option><option>20% 이상</option></select></label>
          <label className="setting-row"><span>추천 표시 수준</span><select className="setting-input" value={aiSettings.recommendation} onChange={(event) => { setAiSettings((current) => ({ ...current, recommendation: event.target.value })); setIsSettingsDirty(true); }}><option>핵심 3개</option><option>상세 5개</option><option>전체 추천</option></select></label>
          <div className="setting-row"><span>GA4 자동 분석</span><button type="button" className={`toggle ${ga4Automation ? "on" : ""}`} aria-pressed={ga4Automation} onClick={() => { setGa4Automation((enabled) => !enabled); setIsSettingsDirty(true); }} /></div>
        </div>
      </section>
      <section className="panel integration-health-panel">
        <ChartHeader title="외부 데이터 연동 상태" right={<span className="chart-period-note">선택 기간 · {periodDefinition.range}</span>} />
        <p className="table-helper">GA4, 네이버 광고, 플레이스 순위의 마지막 성공 시각과 오류 상태를 한곳에서 확인합니다. 오류가 발생해도 임의 수치로 대체하지 않습니다.</p>
        <div className="integration-health-grid">
          {integrationHealthRows.map((integration) => (
            <article className={`integration-health-card ${integration.state}`} key={integration.key}>
              <div className="integration-health-head">
                <div>
                  <span>{integration.description}</span>
                  <h3>{integration.name}</h3>
                </div>
                <strong className={`integration-state ${integration.state}`}>{integration.status}</strong>
              </div>
              <dl>
                <div><dt>마지막 성공</dt><dd>{integration.lastSuccess}</dd></div>
                <div><dt>자동 갱신</dt><dd>{integration.cadence}</dd></div>
              </dl>
              <p>{integration.message}</p>
              <button className="pill integration-refresh-button" type="button" disabled={integration.refreshing} onClick={integration.refresh}>{integration.refreshing ? "새로고침 중" : "지금 새로고침"}</button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel ga4-connect-panel settings-ga4-connect-panel">
        <div className="ga4-connect-copy">
          <span className="ai-pill">GA4 DATA API</span>
          <h2>{ga4LoadState === "live" ? "GA4 실데이터 연동 완료" : "GA4 연동 상태"}</h2>
          <p>Google Analytics Data API를 서버에서 안전하게 조회합니다. 서비스 계정 비밀키는 Sites 비밀 환경변수에만 저장되어 화면과 소스 코드에 노출되지 않습니다.</p>
          <ol className="ga4-connect-steps">
            <li><b>1</b><span>연결 속성: 530041596</span></li>
            <li><b>2</b><span>조회 기간: {activeDateRange.start} ~ {activeDateRange.end}</span></li>
            <li><b>3</b><span>GA4 분석 페이지에서 기간을 변경하면 KPI, 채널, 랜딩페이지, 이벤트, 기기 데이터가 자동 갱신됩니다.</span></li>
            <li><b>4</b><span>AI 요약과 우선 실행 제안도 같은 기간의 집계 데이터를 기준으로 다시 계산됩니다.</span></li>
          </ol>
        </div>
        <div className="ga4-connect-form">
          <label><span>연동 상태</span><input readOnly value={ga4LoadState === "loading" ? "데이터 조회 중" : ga4LoadState === "live" ? "실데이터 연결 완료" : "권한 또는 API 상태 확인 필요"} /></label>
          <label><span>반영 기준일</span><input readOnly value={`${activeDateRange.start} ~ ${activeDateRange.end}`} /></label>
          <button className="primary-button" type="button" disabled={ga4LoadState === "loading"} onClick={() => setGa4RefreshKey((value) => value + 1)}>GA4 데이터 새로고침</button>
          <small>{ga4LoadMessage}{ga4LastSyncedAt ? ` · 마지막 동기화 ${ga4LastSyncedAt}` : ""}</small>
        </div>
      </section>

      <section className="panel place-rank-panel place-rank-settings-panel">
        <ChartHeader
          title="플레이스 순위 측정 설정"
          right={<span className={`automation-status ${placeRankData?.providerConfigured ? "active" : ""}`}>{placeRankData?.providerConfigured ? "공급자 연결 완료" : "공급자 미연결"}</span>}
        />
        <p className="table-helper">등록한 키워드는 서울시간 매일 09:00 이후 하루 한 번 자동 측정합니다. 광고 영역을 제외하고 최대 100위까지 기록합니다.</p>
        <div className="place-rank-status-row">
          <span>{placeRankMessage}</span>
          <small>측정 기준 09:00 · 광고 제외 · 일자별 자동 저장</small>
        </div>
        <div className="place-rank-provider-grid">
          <article><span>순위 공급자</span><strong>{placeRankData?.provider === "rankfree" ? "랭크프리" : placeRankData?.provider === "apify" ? "외부 브라우저" : "미연동"}</strong></article>
          <article><span>자동 측정</span><strong>{placeRankData?.providerConfigured ? "매일 09:00" : "사용 안 함"}</strong></article>
          <article><span>마지막 동기화</span><strong>{placeRankData?.syncedAt ? formatPlaceRankCheckedAt(placeRankData.syncedAt) : "-"}</strong></article>
          <article><span>이번 동기화 반영</span><strong>{placeRankData?.scheduledImported ?? 0}건</strong></article>
          <article><span>추적 슬롯 매칭</span><strong>{placeRankData ? `${placeRankData.trackingSync?.matchedSlots ?? 0}/${placeRankData.keywords.length}개` : "-"}</strong></article>
          <article><span>키워드 분석</span><strong>{rankfreeInsights?.keywordStatus === "available" ? "사용 가능" : rankfreeInsights?.keywordStatus === "scope-required" ? "권한 필요" : "확인 필요"}</strong></article>
          <article><span>경쟁 분석</span><strong>{rankfreeInsights?.competitionStatus === "available" ? "사용 가능" : rankfreeInsights?.competitionStatus === "not-analyzed" ? "분석 기록 없음" : rankfreeInsights?.competitionStatus === "scope-required" ? "권한 필요" : "확인 필요"}</strong></article>
        </div>

        <div className="place-rank-register">
          <label>
            <span>검색 키워드</span>
            <input disabled={!canManageSettings} value={placeRankKeyword} onChange={(event) => setPlaceRankKeyword(event.target.value)} placeholder="예: 인천 한방병원" maxLength={80} />
          </label>
          <label>
            <span>네이버 플레이스 주소</span>
            <input disabled={!canManageSettings} value={placeRankUrl} onChange={(event) => setPlaceRankUrl(event.target.value)} placeholder="https://m.place.naver.com/hospital/숫자ID" />
          </label>
          <button className="primary-button" type="button" onClick={savePlaceRankKeyword} disabled={placeRankSaving || !canManageSettings}>{placeRankEditingId ? "키워드 수정 저장" : "키워드 등록"}</button>
          {placeRankEditingId ? <button className="pill" type="button" onClick={() => { setPlaceRankEditingId(""); setPlaceRankKeyword(""); setPlaceRankUrl(""); }}>수정 취소</button> : null}
        </div>

        {placeRankData?.keywords.length ? (
          <>
            <div className="place-rank-keyword-grid">
              {placeRankData.keywords.map((keyword) => {
                const latest = latestPlaceRankByKeyword.get(keyword.id)?.latest;
                return (
                  <button className={`place-rank-keyword-card ${selectedPlaceRankKeyword?.id === keyword.id ? "selected" : ""}`} key={`settings-${keyword.id}`} type="button" onClick={() => setSelectedPlaceRankId(keyword.id)}>
                    <span>{keyword.keyword}</span>
                    <strong>{latest ? latest.outsideTop100 ? "100위 밖" : latest.rank ? `${latest.rank}위` : "측정 실패" : "측정 대기"}</strong>
                    <small>Place ID {keyword.placeId}</small>
                    <i>{latest ? latest.status === "failed" ? latest.message || `최근 측정 실패 ${latest.date}` : `최근 측정 ${latest.date}` : "09:00 자동 측정 예정"}</i>
                  </button>
                );
              })}
            </div>

            {selectedPlaceRankKeyword ? (
              <div className="place-rank-detail place-rank-management-detail">
                <div className="place-rank-detail-head">
                  <div>
                    <h3>{selectedPlaceRankKeyword.keyword}</h3>
                    <p>{selectedPlaceRankKeyword.placeUrl}</p>
                  </div>
                  <div className="place-rank-actions">
                    <button className="pill" type="button" disabled={!canManageSettings || placeRankSaving} onClick={() => { setPlaceRankEditingId(selectedPlaceRankKeyword.id); setPlaceRankKeyword(selectedPlaceRankKeyword.keyword); setPlaceRankUrl(selectedPlaceRankKeyword.placeUrl); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>키워드 수정</button>
                    <button className="pill" type="button" disabled={placeRankSaving || !placeRankData.providerConfigured || !canManageSettings} onClick={() => runPlaceRankAction("collect", selectedPlaceRankKeyword.id)}>{placeRankSaving ? "측정 중" : "수동 측정 실행"}</button>
                    <button className="text-button danger" type="button" disabled={placeRankSaving || !canManageSettings} onClick={() => runPlaceRankAction("delete", selectedPlaceRankKeyword.id)}>삭제</button>
                  </div>
                </div>
                <div className="place-rank-manual">
                  <span>수동 측정 결과가 오늘의 마지막 기록으로 반영됩니다. 공급자 오류 시 확인한 순위를 직접 입력할 수도 있습니다.</span>
                  <input disabled={!canManageSettings} type="number" min="1" max="100" value={manualPlaceRank} onChange={(event) => setManualPlaceRank(event.target.value)} placeholder="1~100" />
                  <button className="pill" type="button" disabled={placeRankSaving || !manualPlaceRank || !canManageSettings} onClick={() => runPlaceRankAction("record", selectedPlaceRankKeyword.id, { rank: Number(manualPlaceRank) })}>오늘 순위 저장</button>
                  <button className="pill" type="button" disabled={placeRankSaving || !canManageSettings} onClick={() => runPlaceRankAction("record", selectedPlaceRankKeyword.id, { outsideTop100: true })}>100위 밖 저장</button>
                </div>
              </div>
            ) : null}
          </>
        ) : <div className="place-rank-empty">등록된 추적 키워드가 없습니다.</div>}
      </section>
    </>
  );

  const renderMyPage = () => (
    <section className="panel mypage-panel">
      <div className="profile-summary">
        <div className="profile-avatar">{isAuthenticated ? "관" : "게"}</div>
        <div>
          <span className="ai-pill">ACCOUNT</span>
          <h2>{isAuthenticated ? `${accessRole} 계정` : "게스트 계정"}</h2>
          <p>{isAuthenticated ? loginEmail : "로그인하면 계정별 설정과 권한을 사용할 수 있습니다."}</p>
        </div>
      </div>
      <div className="mypage-actions">
        {isAuthenticated ? (
          <a className="pill subtle" href="/signout-with-chatgpt?return_to=/">로그아웃</a>
        ) : (
          <a className="primary-button" href="/signin-with-chatgpt?return_to=/">ChatGPT로 로그인</a>
        )}
      </div>
      <div className="account-detail-grid">
        <div><span>소속 병원</span><strong>{hospitalName}</strong></div>
        <div><span>기준 지점</span><strong>{hospitalLocation}</strong></div>
        <div><span>접근 권한</span><strong>{isAuthenticated ? accessRole : "미인증"}</strong></div>
        <div><span>분석 데이터</span><strong className="permission-enabled">조회 가능</strong></div>
        <div><span>데이터 관리</span><strong className={canManageData ? "permission-enabled" : "permission-limited"}>{canManageData ? "업로드·수정 가능" : "조회 전용"}</strong></div>
        <div><span>설정 관리</span><strong className={canManageSettings ? "permission-enabled" : "permission-limited"}>{canManageSettings ? "사용자·목표 변경 가능" : "권한 없음"}</strong></div>
      </div>
      <p className="account-security-note">최근 접속 시각은 서버에서 15분 간격으로 갱신되며, 모든 데이터 요청은 현재 역할을 다시 검사합니다.</p>
    </section>
  );

  if (!isClientReady) {
    return <div className="dashboard-shell" aria-busy="true" />;
  }

  if (authState !== "authenticated") {
    const isCheckingAccess = authState === "checking";
    const isForbidden = authState === "forbidden";
    const isUnavailable = authState === "unavailable";
    return (
      <main className="auth-gate-shell">
        <section className="auth-gate-card" aria-live="polite" aria-busy={isCheckingAccess}>
          <div className="auth-gate-brand"><span>M</span><strong>메디인사이트</strong></div>
          <div className={`auth-gate-status ${isCheckingAccess ? "checking" : isForbidden ? "forbidden" : isUnavailable ? "unavailable" : "locked"}`}>
            <i aria-hidden="true" />
            {isCheckingAccess ? "접근 권한 확인 중" : isForbidden ? "등록되지 않은 계정" : isUnavailable ? "서비스 연결 오류" : "로그인 필요"}
          </div>
          <h1>{isCheckingAccess ? "안전하게 데이터를 준비하고 있습니다." : isForbidden ? "이 대시보드에 접근할 권한이 없습니다." : isUnavailable ? "로그인은 유지하고 연결을 다시 확인합니다." : "로그인 후 대시보드를 확인할 수 있습니다."}</h1>
          <p>{isCheckingAccess ? "로그인 계정과 병원 권한을 확인한 뒤 필요한 데이터만 불러옵니다." : isForbidden ? "병원 최고관리자에게 현재 ChatGPT 계정을 사용자·권한 목록에 등록해 달라고 요청해 주세요." : isUnavailable ? "일시적인 서버 또는 저장소 오류입니다. 재로그인하지 않고 잠시 후 다시 시도할 수 있습니다." : "병원 CRM과 광고 데이터는 비공개 정보이므로 ChatGPT 로그인과 병원 접근 권한 확인 후에만 표시됩니다."}</p>
          {!isCheckingAccess ? isUnavailable
            ? <button className="primary-button auth-gate-action" type="button" onClick={() => { setAuthState("checking"); setAuthMessage("로그인과 병원 접근 권한을 다시 확인하고 있습니다."); setAuthRetryKey((value) => value + 1); }}>연결 다시 확인</button>
            : <a className="primary-button auth-gate-action" href="/signin-with-chatgpt?return_to=/">{isForbidden ? "다른 계정으로 로그인" : "ChatGPT로 로그인"}</a>
          : <div className="auth-gate-loader"><span /><span /><span /></div>}
          {!isCheckingAccess && authMessage ? <small>{authMessage}</small> : null}
          <div className="auth-gate-policy">
            <span>로그인 전 데이터 요청 차단</span>
            <span>사용자 역할별 API 권한 검사</span>
            <span>비공개 원천 데이터 보호</span>
          </div>
        </section>
      </main>
    );
  }

  let content: ReactNode;
  if (activeMenu === "kpi") content = renderKpi();
  else if (activeMenu === "consult") content = renderConsult();
  else if (activeMenu === "ads") content = renderAds();
  else if (activeMenu === "ga4") content = renderGa4();
  else if (activeMenu === "data") content = renderData();
  else if (activeMenu === "settings") content = renderSettings();
  else content = renderMyPage();

  const operationalPage = activeMenu === "kpi" || activeMenu === "consult";
  const adsDisconnected = activeMenu === "ads" && !hasImportedRows && naverSearchAdLoadState !== "live";
  const ga4Disconnected = activeMenu === "ga4" && ga4LoadState === "error";
  const externalSyncStatus = activeMenu === "ads"
    ? {
        state: naverSearchAdLoadState,
        label: naverSearchAdLoadState === "live" ? "네이버 광고 정상" : naverSearchAdLoadState === "loading" ? "네이버 광고 조회 중" : "네이버 광고 오류",
        syncedAt: naverSearchAdLastSyncedAt,
      }
    : activeMenu === "ga4"
      ? {
          state: ga4LoadState === "live" && ga4Data?.warnings?.length ? "partial" : ga4LoadState,
          label: ga4LoadState === "live" ? (ga4Data?.warnings?.length ? "GA4 부분 연동" : "GA4 정상") : ga4LoadState === "loading" ? "GA4 조회 중" : "GA4 오류",
          syncedAt: ga4LastSyncedAt,
        }
      : null;
  if ((operationalPage || activeMenu === "ads") && dataSourceState === "loading") {
    content = <section className="panel disconnected-state"><h2>실데이터 연결을 확인하고 있습니다.</h2><p>잠시만 기다려 주세요.</p></section>;
  } else if ((operationalPage && !hasImportedRows) || adsDisconnected || ga4Disconnected) {
    content = (
      <section className="panel disconnected-state" role="status">
        <span className="source-badge empty">실데이터 미연동</span>
        <h2>선택 기간에 표시할 실데이터가 없습니다.</h2>
        <p>추정값이나 예시 수치는 표시하지 않습니다. 데이터 관리에서 검수 완료된 CSV를 업로드하거나 외부 데이터 연결 상태를 확인해 주세요.</p>
        <div className="disconnected-actions">
          {canManageData ? <button className="primary-button" type="button" onClick={() => setActiveMenu("data")}>데이터 관리로 이동</button> : null}
          <span>{activeDateRange.start} ~ {activeDateRange.end}</span>
        </div>
      </section>
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">M</div>
          <div>
            <strong>메디인사이트</strong>
            <span>병원 마케팅 분석</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="대시보드 메뉴">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter((item) => {
              if (item.key === "settings") return canManageSettings;
              if (item.key === "data") return canManageData;
              return true;
            });
            if (visibleItems.length === 0) return null;
            return (
            <div className="sidebar-group" key={group.title}>
              <div className="sidebar-group-label">{group.title}</div>
              {visibleItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={activeMenu === item.key ? "nav-item active" : "nav-item"}
                  aria-current={activeMenu === item.key ? "page" : undefined}
                  onClick={() => requestMenuChange(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="dot" />
          <div>
            <strong>데이터 정상 연결</strong>
            <span>GA4 5분 주기 · 화면 복귀 시 즉시 갱신</span>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div className="topbar-left">
            <EvidenceLabel range={periodDefinition.range} compare={periodDefinition.compare} status={commonDataStatus} />
          </div>

          <div className="topbar-center" aria-live="polite">
            {externalSyncStatus ? (
              <span className={`external-sync-label ${externalSyncStatus.state}`} title={externalSyncStatus.state === "error" ? "외부 연동 설정과 최근 오류 메시지를 확인해 주세요." : undefined}>
                {externalSyncStatus.label}{externalSyncStatus.syncedAt ? ` · ${externalSyncStatus.syncedAt}` : ""}
              </span>
            ) : null}
            {dataRefreshAt ? <span className="data-refresh-label">갱신 {dataRefreshAt}</span> : null}
          </div>

          <div className="topbar-right">
            {activeMenu !== "mypage" && activeMenu !== "settings" ? <label className="range-pill range-select">
              <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodOption)} aria-label="분석 기간">
                {periodOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
              </select>
              <span>▾</span>
            </label> : null}
            {activeMenu !== "mypage" && activeMenu !== "settings" ? activeMenu === "ga4" || isCustomPeriod ? (
              <div className="range-pill custom-date-range" aria-label="직접 입력 기간">
                <input
                  type="date"
                  value={activeMenu === "ga4" && !isCustomPeriod ? activeDateRange.start : customStartDate}
                  max={activeMenu === "ga4" && !isCustomPeriod ? activeDateRange.end : customEndDate}
                  onChange={(event) => {
                    setCustomStartDate(event.target.value);
                    setPeriod(periodOptions[5].label);
                  }}
                  aria-label="조회 시작일"
                />
                <span>~</span>
                <input
                  type="date"
                  value={activeMenu === "ga4" && !isCustomPeriod ? activeDateRange.end : customEndDate}
                  min={activeMenu === "ga4" && !isCustomPeriod ? activeDateRange.start : customStartDate}
                  onChange={(event) => {
                    setCustomEndDate(event.target.value);
                    setPeriod(periodOptions[5].label);
                  }}
                  aria-label="조회 종료일"
                />
              </div>
            ) : <label className="range-pill range-select range-detail-select">
              <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodOption)} aria-label="기간 범위">
                {periodOptions.map((option) => <option key={option.label} value={option.label}>{option.range}</option>)}
              </select>
              <span>▾</span>
            </label> : null}
            {activeMenu !== "mypage" && activeMenu !== "settings" ? <label className="range-pill range-select compare-pill">
              <select value={compareOption} onChange={(event) => setCompareOption(event.target.value as CompareOption)} aria-label="비교 기간">
                {compareOptions.map((option) => <option key={option} value={option}>vs {option}</option>)}
              </select>
              <span>▾</span>
            </label> : null}
            <button className="profile-button" type="button" aria-label="계정 정보" onClick={() => setAccountOpen((open) => !open)}>
              P
            </button>
          </div>
        </header>

        {accountOpen && (
          <section className="login-panel" aria-label="로그인 계정 정보">
            <div>
              <span className="ai-pill">SECURE ACCESS</span>
              <h2>{isAuthenticated ? "로그인 계정" : "로그인이 필요합니다"}</h2>
              <p>{isAuthenticated ? `${loginEmail} · ${accessRole}` : "데이터는 ChatGPT 로그인과 사이트 접근 권한 확인 후에만 표시됩니다."}</p>
            </div>
            <div className="account-session-actions">
              {isAuthenticated ? (
                <a className="primary-button" href="/signout-with-chatgpt?return_to=/">로그아웃</a>
              ) : (
                <a className="primary-button" href="/signin-with-chatgpt?return_to=/">ChatGPT로 로그인</a>
              )}
              <button className="pill" type="button" onClick={() => setAccountOpen(false)}>닫기</button>
            </div>
          </section>
        )}

        <div className="page">
          {reconciliationWarning ? <div className="reconciliation-alert" role="alert">기간 합계와 세부 항목 합계가 일치하지 않습니다. 데이터 관리의 수치 대사표를 확인하세요.</div> : null}
          <section className="hero-row">
            <div>
              <h1>{pageMeta[activeMenu].title}</h1>
              <p>{pageMeta[activeMenu].subtitle}</p>
            </div>
            {pageMeta[activeMenu].primaryAction && activeMenu !== "data" ? <button className="primary-button" type="button">{pageMeta[activeMenu].primaryAction}</button> : null}
          </section>

          {content}
        </div>
      </main>

      {selectedKpiDetail ? (
        <div className="kpi-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedKpiLabel(null); }}>
          <section className="kpi-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="kpi-detail-title">
            <div className="kpi-detail-head">
              <div>
                <span className="source-badge live">KPI 계산 근거</span>
                <h2 id="kpi-detail-title">{selectedKpiDetail.card.label}</h2>
              </div>
              <button type="button" className="kpi-detail-close" onClick={() => setSelectedKpiLabel(null)} aria-label="KPI 상세 닫기">닫기</button>
            </div>
            <div className="kpi-detail-value">
              <strong>{selectedKpiDetail.card.value}</strong>
              <span className={selectedKpiDetail.card.delta.startsWith("-") ? "down" : "up"}>{selectedKpiDetail.card.delta}</span>
              {selectedKpiDetail.card.goalText ? <small>{selectedKpiDetail.card.goalText}</small> : null}
            </div>
            <dl className="kpi-detail-grid">
              <div><dt>집계 기간</dt><dd>{periodDefinition.range}</dd></div>
              <div><dt>비교 기준</dt><dd>{periodDefinition.compare}</dd></div>
              <div><dt>계산식</dt><dd>{selectedKpiDetail.formula}</dd></div>
              <div><dt>사용 원천</dt><dd>{selectedKpiDetail.sources}</dd></div>
              <div><dt>검증 기준</dt><dd>{selectedKpiDetail.validation}</dd></div>
              <div><dt>대사 결과</dt><dd className={reconciliationWarning ? "warn" : "pass"}>{selectedKpiDetail.reconciliation}</dd></div>
            </dl>
            <p className="kpi-detail-note">비교 증감과 목표 평가는 위 집계 기간과 동일한 원천 데이터만 사용합니다.</p>
            <div className="kpi-detail-actions">
              <button className="pill" type="button" onClick={() => setSelectedKpiLabel(null)}>계속 보기</button>
              {canManageData ? <button className="primary-button" type="button" onClick={() => { setSelectedKpiLabel(null); setActiveMenu("data"); }}>원천 데이터 확인</button> : null}
            </div>
          </section>
        </div>
      ) : null}

      {pendingMenu ? (
        <div className="unsaved-backdrop" role="presentation">
          <section className="unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description">
            <span className="source-badge review">저장 전 확인</span>
            <h2 id="unsaved-title">저장하지 않은 변경사항이 있습니다.</h2>
            <p id="unsaved-description">일자별 수치 {editedDailyDates.length}일과 수정 사유가 아직 서버에 저장되지 않았습니다.</p>
            <div className="unsaved-actions">
              <button className="pill" type="button" onClick={() => setPendingMenu(null)}>계속 수정</button>
              <button className="danger-button" type="button" onClick={discardDailyChangesAndNavigate}>변경 취소 후 이동</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
