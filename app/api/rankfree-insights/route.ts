import { env } from "cloudflare:workers";
import { accessErrorResponse, requireAccess } from "@/lib/server-access";

export const runtime = "edge";

const hospitalId = "demo-hospital";
const apiBase = "https://rankfree.kr/api/v1";

type RuntimeEnv = {
  RANKFREE_API_KEY?: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(asRecord);
  const record = asRecord(value);
  for (const key of ["data", "items", "tracks", "slots", "results"]) {
    if (Array.isArray(record[key])) return (record[key] as unknown[]).map(asRecord);
  }
  return [];
}

function textValue(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return "";
}

function statusMessage(status: number, payload: unknown, fallback: string) {
  const record = asRecord(payload);
  const message = textValue(record, ["message", "error", "detail"]);
  if (status === 403) return "현재 API 키에 이 분석 권한이 없습니다.";
  if (status === 429) return "오늘 API 호출 한도에 도달했거나 조회가 일시 제한되었습니다.";
  return message || fallback;
}

async function rankfreeGet(apiKey: string, path: string) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    payload,
    rateLimit: response.headers.get("x-ratelimit-limit"),
    rateRemaining: response.headers.get("x-ratelimit-remaining"),
  };
}

function normalizeKeyword(payload: unknown) {
  const envelope = asRecord(payload);
  const data = asRecord(envelope.data ?? payload);
  const related = Array.isArray(data.related)
    ? data.related.map(asRecord).slice(0, 8).map((row) => ({
        keyword: textValue(row, ["keyword", "query", "name"]),
        monthlyTotal: Number(row.monthly_total ?? row.monthlyTotal ?? 0) || 0,
      })).filter((row) => row.keyword)
    : [];
  const detail = asRecord(data.detail);
  const monthly = Array.isArray(detail.monthly)
    ? detail.monthly.map(asRecord).slice(-12).map((row) => ({
        label: textValue(row, ["label", "month"]),
        pc: Number(row.pc ?? 0) || 0,
        mobile: Number(row.mobile ?? 0) || 0,
        total: Number(row.total ?? 0) || 0,
      })).filter((row) => row.label)
    : [];
  return {
    keyword: textValue(data, ["keyword"]),
    monthlyPc: Number(data.monthly_pc ?? data.monthlyPc ?? 0) || 0,
    monthlyMobile: Number(data.monthly_mobile ?? data.monthlyMobile ?? 0) || 0,
    monthlyTotal: Number(data.monthly_total ?? data.monthlyTotal ?? 0) || 0,
    competition: textValue(data, ["comp_idx", "competition"]),
    related,
    monthly,
  };
}

function findTrack(payload: unknown, keyword: string, placeId: string) {
  const normalizedKeyword = keyword.replace(/\s+/g, "").toLowerCase();
  return asArray(payload).find((row) => {
    const rowKeyword = textValue(row, ["keyword", "query"]).replace(/\s+/g, "").toLowerCase();
    const rowPlaceId = textValue(row, ["place_id", "placeId"]);
    return (rowKeyword && rowKeyword === normalizedKeyword) || (rowPlaceId && rowPlaceId === placeId);
  });
}

function normalizeCompetition(track: JsonRecord | undefined) {
  if (!track) return null;
  return {
    slotId: textValue(track, ["slot_id", "slotId", "id"]),
    rank: Number(track.rank ?? track.last_rank ?? 0) || null,
    n1: Number(track.n1 ?? track.N1 ?? 0) || null,
    n2: Number(track.n2 ?? track.N2 ?? 0) || null,
    n3: Number(track.n3 ?? track.N3 ?? 0) || null,
    analyzedAt: textValue(track, ["analyzed_at", "analyzedAt", "updated_at", "updatedAt"]),
  };
}

export async function GET(request: Request) {
  try {
    await requireAccess(request, hospitalId);
    const runtimeEnv = env as unknown as RuntimeEnv;
    const url = new URL(request.url);
    const keyword = String(url.searchParams.get("keyword") || "").trim().slice(0, 80);
    const placeId = String(url.searchParams.get("placeId") || "").trim();
    if (!keyword) return Response.json({ error: "분석할 키워드가 필요합니다." }, { status: 400 });
    if (!runtimeEnv.RANKFREE_API_KEY) {
      return Response.json({
        connected: false,
        keywordStatus: "unlinked",
        competitionStatus: "unlinked",
        message: "랭크프리 API가 연결되지 않았습니다.",
      });
    }

    const [detailResult, tracksResult] = await Promise.all([
      rankfreeGet(runtimeEnv.RANKFREE_API_KEY, `/keyword/detail?keyword=${encodeURIComponent(keyword)}`),
      rankfreeGet(runtimeEnv.RANKFREE_API_KEY, "/compete/tracks"),
    ]);

    let keywordResult = detailResult;
    let keywordScope: "keyword_detail" | "keyword" | null = detailResult.ok ? "keyword_detail" : null;
    if (!detailResult.ok && [403, 503].includes(detailResult.status)) {
      keywordResult = await rankfreeGet(runtimeEnv.RANKFREE_API_KEY, `/keyword?keyword=${encodeURIComponent(keyword)}`);
      if (keywordResult.ok) keywordScope = "keyword";
    }

    const track = tracksResult.ok ? findTrack(tracksResult.payload, keyword, placeId) : undefined;
    const limits = [detailResult, keywordResult, tracksResult]
      .map((result) => ({ limit: Number(result.rateLimit), remaining: Number(result.rateRemaining) }))
      .filter((row) => Number.isFinite(row.limit) && Number.isFinite(row.remaining));
    const rateLimit = limits.length ? Math.max(...limits.map((row) => row.limit)) : null;
    const rateRemaining = limits.length ? Math.min(...limits.map((row) => row.remaining)) : null;

    return Response.json({
      connected: true,
      source: "rankfree",
      sourceNote: "랭크프리 자체 추정 데이터이며 네이버 공식 지표가 아닙니다.",
      keywordStatus: keywordResult.ok ? "available" : keywordResult.status === 403 ? "scope-required" : "error",
      keywordScope,
      keywordData: keywordResult.ok ? normalizeKeyword(keywordResult.payload) : null,
      keywordMessage: keywordResult.ok ? "" : statusMessage(keywordResult.status, keywordResult.payload, "키워드 분석 데이터를 불러오지 못했습니다."),
      competitionStatus: tracksResult.ok ? track ? "available" : "not-analyzed" : tracksResult.status === 403 ? "scope-required" : "error",
      competition: normalizeCompetition(track),
      competitionMessage: tracksResult.ok
        ? track ? "" : "이 키워드의 경쟁 분석 기록이 아직 없습니다."
        : statusMessage(tracksResult.status, tracksResult.payload, "경쟁 분석 데이터를 불러오지 못했습니다."),
      rateLimit,
      rateRemaining,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return accessErrorResponse(error, "랭크프리 분석 데이터를 불러오지 못했습니다.");
  }
}
