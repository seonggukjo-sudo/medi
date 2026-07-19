import { env } from "cloudflare:workers";
import { accessErrorResponse, requireAccess } from "@/lib/server-access";
import { extractNaverPlaceId, loadPlaceRankData, type PlaceRankKeyword, type PlaceRankSnapshot } from "@/lib/place-rank-tracker";

export const runtime = "edge";

const hospitalId = "demo-hospital";
type RuntimeEnv = {
  DB: D1Database;
  RANKFREE_API_KEY?: string;
  PLACE_RANK_PROVIDER_URL?: string;
  PLACE_RANK_PROVIDER_TOKEN?: string;
  PLACE_RANK_PROVIDER_ACTOR_ID?: string;
};

type ApifyRun = {
  id?: string;
  status?: string;
  startedAt?: string;
  defaultDatasetId?: string;
  meta?: { origin?: string };
};

type ApifyRankResult = {
  keyword?: string;
  placeId?: string;
  rank?: number | null;
  blocked?: boolean;
  checkedCount?: number;
  maxRank?: number;
  outsideTop100?: boolean;
  checkedAt?: string;
  message?: string;
};

type RankfreeRankPayload = {
  data?: RankfreeRankPayload;
  rank?: number | null;
  list_total?: number | null;
  checked?: string;
  checked_at?: string;
  message?: string;
  error?: string;
  blocked?: boolean;
};

type ProviderPlaceItem = {
  placeId?: string | number;
  rank?: number | null;
  position?: number | null;
  naturalRank?: number | null;
  organicRank?: number | null;
  keyword?: string;
  blocked?: boolean;
  sponsored?: boolean;
  isSponsored?: boolean;
  ad?: boolean;
  isAd?: boolean;
  checkedCount?: number;
  maxRank?: number;
  outsideTop100?: boolean;
  type?: string;
  resultType?: string;
  message?: string;
  error?: string;
};

type ProviderPayload = ProviderPlaceItem | ProviderPlaceItem[] | {
  rank?: number | null;
  placeId?: string | number;
  blocked?: boolean;
  message?: string;
  results?: ProviderPlaceItem[];
  items?: ProviderPlaceItem[];
  places?: ProviderPlaceItem[];
};

function providerItems(payload: ProviderPayload) {
  if (Array.isArray(payload)) return payload;
  const envelope = payload as { results?: ProviderPlaceItem[]; items?: ProviderPlaceItem[]; places?: ProviderPlaceItem[] };
  if (envelope.results?.length) return envelope.results;
  if (envelope.items?.length) return envelope.items;
  if (envelope.places?.length) return envelope.places;
  return [];
}

function isSponsoredProviderItem(item: ProviderPlaceItem) {
  if (item.sponsored === true || item.isSponsored === true || item.ad === true || item.isAd === true) return true;
  return /sponsor|advert|광고/i.test(`${item.type ?? ""} ${item.resultType ?? ""}`);
}

function explicitProviderRank(item: ProviderPlaceItem) {
  for (const value of [item.naturalRank, item.organicRank, item.rank, item.position]) {
    const rank = Number(value);
    if (Number.isInteger(rank) && rank >= 1 && rank <= 100) return rank;
  }
  return null;
}

function hasProviderRankField(item: ProviderPlaceItem) {
  return ["naturalRank", "organicRank", "rank", "position"].some((key) => key in item);
}

function completedTop100Scan(item: ProviderPlaceItem) {
  if (item.outsideTop100 === true) return true;
  const checkedCount = Number(item.checkedCount);
  const requestedMax = Math.min(Number(item.maxRank) || 100, 100);
  return Number.isInteger(checkedCount) && checkedCount >= requestedMax;
}

function emptyProviderScan(item: ProviderPlaceItem) {
  return Number(item.checkedCount) === 0;
}

function providerCheckedCount(payload: ProviderPayload) {
  const items = providerItems(payload);
  if (items.length > 1) return items.filter((item) => !isSponsoredProviderItem(item)).length;
  const body = (items[0] ?? (Array.isArray(payload) ? payload[0] : payload) ?? {}) as ProviderPlaceItem;
  const checkedCount = Number(body.checkedCount);
  return Number.isInteger(checkedCount) && checkedCount >= 0 ? checkedCount : undefined;
}

function resolveProviderRank(payload: ProviderPayload, keyword: PlaceRankKeyword) {
  const items = providerItems(payload);
  if (items.length) {
    const naturalItems = items.filter((item) => !isSponsoredProviderItem(item));
    const targetIndex = naturalItems.findIndex((item) => String(item.placeId ?? "") === keyword.placeId);
    if (targetIndex < 0) {
      return { rank: null, blocked: false, message: "자연 검색 결과에서 등록한 Place ID를 찾지 못했습니다." };
    }
    const target = naturalItems[targetIndex];
    if (target.blocked === true) {
      return { rank: null, blocked: true, outsideTop100: false, message: target.message || target.error || "검색 공급자가 측정을 차단했습니다." };
    }
    if (emptyProviderScan(target)) {
      return { rank: null, blocked: true, outsideTop100: false, message: "검색 결과를 한 건도 읽지 못해 순위를 확인할 수 없습니다." };
    }
    // Some providers return only the matched place in `results`, with its
    // absolute rank attached to the item. Do not mistake that one-item array
    // for a full result list, or a real 11th place becomes 1st place.
    const explicitRank = explicitProviderRank(target);
    if (explicitRank !== null) {
      return { rank: explicitRank, blocked: false, outsideTop100: false, message: target.message };
    }
    if (hasProviderRankField(target) && completedTop100Scan(target)) {
      return { rank: null, blocked: false, outsideTop100: true, message: target.message || "100위 밖" };
    }
    if (naturalItems.length > 1) {
      const rank = targetIndex + 1;
      return { rank: rank <= 100 ? rank : null, blocked: false, outsideTop100: rank > 100, message: rank > 100 ? "100위 밖" : undefined };
    }
    return {
      rank: null,
      blocked: false,
      outsideTop100: false,
      message: target.message || target.error || "공급자 응답에 절대 자연순위(rank) 값이 없습니다.",
    };
  }

  const body = (Array.isArray(payload) ? (payload[0] ?? {}) : payload) as ProviderPlaceItem;
  if (body.placeId && String(body.placeId) !== keyword.placeId) {
    return { rank: null, blocked: false, message: "공급자가 반환한 Place ID가 등록 대상과 다릅니다." };
  }
  if (emptyProviderScan(body)) {
    return { rank: null, blocked: true, outsideTop100: false, message: "검색 결과를 한 건도 읽지 못해 순위를 확인할 수 없습니다." };
  }
  const measuredRank = explicitProviderRank(body);
  const rank = Number.isInteger(measuredRank) && measuredRank >= 1 && measuredRank <= 100 ? measuredRank : null;
  const outsideTop100 = body.blocked !== true && rank === null && completedTop100Scan(body);
  return {
    rank,
    blocked: body.blocked === true,
    outsideTop100,
    message: body.message || body.error || (outsideTop100 ? "100위 밖" : rank === null ? "공급자 응답에 절대 자연순위(rank) 값이 없습니다." : undefined),
  };
}

function seoulDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function seoulHour() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

async function writeAudit(
  runtimeEnv: RuntimeEnv,
  access: { userId: string },
  action: string,
  targetId: string,
  metadata: unknown,
) {
  await runtimeEnv.DB.prepare(
    "INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, ?, 'place_rank', ?, ?, ?)",
  ).bind(crypto.randomUUID(), hospitalId, access.userId, action, targetId, new Date().toISOString(), JSON.stringify(metadata)).run();
}

function providerActorId(runtimeEnv: RuntimeEnv) {
  if (runtimeEnv.PLACE_RANK_PROVIDER_ACTOR_ID) return runtimeEnv.PLACE_RANK_PROVIDER_ACTOR_ID;
  return runtimeEnv.PLACE_RANK_PROVIDER_URL?.match(/\/acts\/([^/]+)\//)?.[1] ?? "";
}

function normalizedKeyword(value: string) {
  return value.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

function dateInSeoul(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function providerConfigured(runtimeEnv: RuntimeEnv) {
  return Boolean(runtimeEnv.RANKFREE_API_KEY || runtimeEnv.PLACE_RANK_PROVIDER_URL);
}

async function registerRankfreeSlot(runtimeEnv: RuntimeEnv, keyword: PlaceRankKeyword) {
  if (!runtimeEnv.RANKFREE_API_KEY) return { registered: false, provider: "rankfree" };
  const response = await fetch("https://rankfree.kr/api/v1/rank/slots", {
    method: "POST",
    headers: {
      authorization: `Bearer ${runtimeEnv.RANKFREE_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ place: keyword.placeUrl, keywords: [keyword.keyword], label: keyword.keyword }),
  });
  const payload = await response.json().catch(() => ({})) as { created?: unknown[]; skipped?: unknown[]; message?: string; error?: string };
  if (!response.ok && response.status !== 409) {
    throw new Error(payload.message || payload.error || `랭크프리 추적 등록 실패 (HTTP ${response.status})`);
  }
  return {
    registered: true,
    provider: "rankfree",
    created: Array.isArray(payload.created) ? payload.created.length : 0,
    skipped: Array.isArray(payload.skipped) ? payload.skipped.length : 0,
  };
}

async function measureWithRankfree(runtimeEnv: RuntimeEnv, keyword: PlaceRankKeyword, trigger: "scheduled" | "manual"): Promise<PlaceRankSnapshot> {
  const response = await fetch("https://rankfree.kr/api/v1/rank/check", {
    method: "POST",
    headers: {
      authorization: `Bearer ${runtimeEnv.RANKFREE_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ keyword: keyword.keyword, place: keyword.placeUrl }),
  });
  const payload = await response.json().catch(() => ({})) as RankfreeRankPayload;
  const result = payload.data && typeof payload.data === "object" ? payload.data : payload;
  if (response.status === 429 || result.blocked || Number(result.rank) === -429) {
    throw new Error(result.message || result.error || "랭크프리 조회가 일시적으로 제한되었습니다.");
  }
  if (!response.ok) {
    throw new Error(result.message || result.error || `랭크프리 순위 조회 실패 (HTTP ${response.status})`);
  }

  const measuredRank = Number(result.rank);
  const outsideTop100 = measuredRank === 0 || measuredRank === 300 || measuredRank > 100;
  const rank = Number.isInteger(measuredRank) && measuredRank >= 1 && measuredRank <= 100 ? measuredRank : null;
  if (rank === null && !outsideTop100) {
    throw new Error(result.message || result.error || "랭크프리가 유효한 순위 값을 반환하지 않았습니다.");
  }
  const checkedValue = result.checked_at || result.checked;
  const checkedAt = checkedValue && !Number.isNaN(new Date(checkedValue).getTime()) ? new Date(checkedValue).toISOString() : new Date().toISOString();
  return {
    keywordId: keyword.id,
    date: dateInSeoul(checkedAt) || seoulDate(),
    rank,
    outsideTop100,
    status: "measured",
    source: "authorized-provider",
    checkedAt,
    rankMethod: "provider-absolute",
    trigger,
    checkedCount: outsideTop100 ? Math.max(100, Number(result.list_total) || 300) : Number(result.list_total) || undefined,
    maxRank: 300,
    message: outsideTop100 ? "100위 밖" : "랭크프리 순위 조회",
  };
}

async function readRankResultFromRunLog(runtimeEnv: RuntimeEnv, runId: string) {
  if (!runtimeEnv.PLACE_RANK_PROVIDER_TOKEN) return null;
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/log`, {
    headers: { authorization: `Bearer ${runtimeEnv.PLACE_RANK_PROVIDER_TOKEN}` },
  });
  if (!response.ok) return null;
  const log = await response.text();
  const marker = "Place rank check completed ";
  const line = log.split(/\r?\n/).reverse().find((value) => value.includes(marker));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(line.indexOf(marker) + marker.length)) as ApifyRankResult;
  } catch {
    return null;
  }
}

async function runActorAndReadLog(runtimeEnv: RuntimeEnv, keyword: PlaceRankKeyword) {
  const actorId = providerActorId(runtimeEnv);
  if (!actorId || !runtimeEnv.PLACE_RANK_PROVIDER_TOKEN) return null;
  const response = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=60`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${runtimeEnv.PLACE_RANK_PROVIDER_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      keyword: keyword.keyword,
      placeUrl: keyword.placeUrl,
      placeId: keyword.placeId,
      maxRank: 100,
      excludeSponsored: true,
    }),
  });
  if (!response.ok) throw new Error(`순위 공급자 실행 실패 (HTTP ${response.status})`);
  const body = await response.json().catch(() => ({})) as { data?: ApifyRun };
  const run = body.data;
  if (!run?.id) throw new Error("순위 공급자 실행 ID를 확인할 수 없습니다.");
  if (run.status !== "SUCCEEDED") throw new Error(`순위 공급자 실행이 완료되지 않았습니다 (${run.status || "UNKNOWN"}).`);
  return readRankResultFromRunLog(runtimeEnv, run.id);
}

async function syncScheduledRuns(
  runtimeEnv: RuntimeEnv,
  access: { userId: string },
  keywords: PlaceRankKeyword[],
  snapshots: PlaceRankSnapshot[],
) {
  const actorId = providerActorId(runtimeEnv);
  if (!actorId || !runtimeEnv.PLACE_RANK_PROVIDER_TOKEN || keywords.length === 0) return 0;

  const startedAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const runsResponse = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?desc=1&status=SUCCEEDED&limit=100&startedAfter=${encodeURIComponent(startedAfter)}`, {
    headers: { authorization: `Bearer ${runtimeEnv.PLACE_RANK_PROVIDER_TOKEN}` },
  });
  if (!runsResponse.ok) return 0;
  const runsBody = await runsResponse.json().catch(() => ({})) as { data?: { items?: ApifyRun[] } };
  const scheduledRuns = (runsBody.data?.items ?? []).filter((run) => run.id && run.meta?.origin === "SCHEDULER");
  const existing = new Set(snapshots
    .filter((snapshot) => snapshot.source === "authorized-provider" && snapshot.rankMethod === "provider-absolute")
    .map((snapshot) => `${snapshot.keywordId}:${snapshot.date}`));
  let imported = 0;

  for (const run of scheduledRuns) {
    const runDate = dateInSeoul(run.startedAt ?? "");
    if (!run.id || !runDate || keywords.every((keyword) => existing.has(`${keyword.id}:${runDate}`))) continue;
    const runResult = await readRankResultFromRunLog(runtimeEnv, run.id);
    const results = runResult ? [runResult] : [];

    for (const result of Array.isArray(results) ? results : []) {
      const keyword = keywords.find((item) =>
        (result.placeId && item.placeId === String(result.placeId))
        || (result.keyword && normalizedKeyword(item.keyword) === normalizedKeyword(String(result.keyword))),
      );
      if (!keyword) continue;
      if (result.placeId && keyword.placeId !== String(result.placeId)) continue;
      const checkedAt = result.checkedAt && !Number.isNaN(new Date(result.checkedAt).getTime()) ? result.checkedAt : run.startedAt ?? new Date().toISOString();
      const date = dateInSeoul(checkedAt) || runDate;
      const dedupeKey = `${keyword.id}:${date}`;
      if (existing.has(dedupeKey)) continue;
      const measuredRank = Number(result.rank);
      const rank = Number.isInteger(measuredRank) && measuredRank >= 1 && measuredRank <= 100 ? measuredRank : null;
      const checkedCount = Number(result.checkedCount);
      const completedScan = result.outsideTop100 === true
        || (Number.isInteger(checkedCount) && checkedCount >= Math.min(Number(result.maxRank) || 100, 100));
      const measurementFailed = result.blocked === true || (rank === null && !completedScan);
      const snapshot: PlaceRankSnapshot = {
        keywordId: keyword.id,
        date,
        rank,
        outsideTop100: !measurementFailed && rank === null,
        status: measurementFailed ? "failed" : "measured",
        source: "authorized-provider",
        checkedAt,
        rankMethod: "provider-absolute",
        trigger: "scheduled",
        checkedCount: Number.isInteger(checkedCount) ? checkedCount : undefined,
        maxRank: Number(result.maxRank) || 100,
        message: result.message || (rank === null && !result.blocked ? "100위 밖" : undefined),
      };
      await writeAudit(runtimeEnv, access, "place_rank_snapshot", keyword.id, snapshot);
      existing.add(dedupeKey);
      imported += 1;
    }
  }
  return imported;
}

async function measureKeyword(runtimeEnv: RuntimeEnv, keyword: PlaceRankKeyword, trigger: "scheduled" | "manual"): Promise<PlaceRankSnapshot> {
  const checkedAt = new Date().toISOString();
  const date = seoulDate();
  if (runtimeEnv.RANKFREE_API_KEY) {
    return measureWithRankfree(runtimeEnv, keyword, trigger);
  }
  if (!runtimeEnv.PLACE_RANK_PROVIDER_URL) {
    throw new Error("허가된 순위 측정 공급자가 아직 연결되지 않았습니다.");
  }

  const actorResult = await runActorAndReadLog(runtimeEnv, keyword);
  let payload: ProviderPayload;
  if (actorResult) {
    payload = actorResult;
  } else {
    const response = await fetch(runtimeEnv.PLACE_RANK_PROVIDER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(runtimeEnv.PLACE_RANK_PROVIDER_TOKEN ? { authorization: `Bearer ${runtimeEnv.PLACE_RANK_PROVIDER_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        keyword: keyword.keyword,
        placeUrl: keyword.placeUrl,
        placeId: keyword.placeId,
        maxRank: 100,
        excludeSponsored: true,
      }),
    });
    payload = await response.json().catch(() => ({})) as ProviderPayload;
    if (!response.ok) {
      const failed = resolveProviderRank(payload, keyword);
      throw new Error(failed.message || `순위 공급자 조회 실패 (HTTP ${response.status})`);
    }
  }
  const resolved = resolveProviderRank(payload, keyword);
  const checkedCount = providerCheckedCount(payload);
  if (resolved.blocked) throw new Error(resolved.message || "검색 서비스의 접근 제한으로 순위를 측정하지 못했습니다.");
  if (resolved.rank === null && !resolved.outsideTop100) {
    throw new Error(resolved.message || "공급자가 유효한 자연 노출 순위를 반환하지 않았습니다.");
  }
  const rank = resolved.rank;
  return {
    keywordId: keyword.id,
    date,
    rank,
    outsideTop100: resolved.outsideTop100,
    status: "measured",
    source: "authorized-provider",
    checkedAt,
    rankMethod: "provider-absolute",
    trigger,
    checkedCount,
    maxRank: 100,
    message: resolved.message || (rank === null ? "100위 밖" : undefined),
  };
}

async function collectMissingToday(runtimeEnv: RuntimeEnv, access: { userId: string }, keywords: PlaceRankKeyword[], snapshots: PlaceRankSnapshot[]) {
  if (!providerConfigured(runtimeEnv)) return;
  if (seoulHour() < 9) return;
  const today = seoulDate();
  const measuredToday = new Set(snapshots
    .filter((row) => row.date === today && row.source === "authorized-provider" && row.rankMethod === "provider-absolute")
    .map((row) => row.keywordId));
  for (const keyword of keywords.filter((row) => row.active && !measuredToday.has(row.id))) {
    try {
      if (runtimeEnv.RANKFREE_API_KEY) {
        await registerRankfreeSlot(runtimeEnv, keyword).catch(() => null);
      }
      const snapshot = await measureKeyword(runtimeEnv, keyword, "scheduled");
      await writeAudit(runtimeEnv, access, "place_rank_snapshot", keyword.id, snapshot);
    } catch (error) {
      const snapshot: PlaceRankSnapshot = {
        keywordId: keyword.id,
        date: today,
        rank: null,
        outsideTop100: false,
        status: "failed",
        source: "authorized-provider",
        checkedAt: new Date().toISOString(),
        rankMethod: "provider-absolute",
        message: error instanceof Error ? error.message : "순위를 측정하지 못했습니다.",
      };
      await writeAudit(runtimeEnv, access, "place_rank_snapshot", keyword.id, snapshot);
    }
  }
}

export async function GET(request: Request) {
  try {
    const access = await requireAccess(request, hospitalId);
    const runtimeEnv = env as unknown as RuntimeEnv;
    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!validDate(start) || !validDate(end) || start! > end!) {
      return Response.json({ error: "올바른 조회 기간이 필요합니다." }, { status: 400 });
    }
    const allData = await loadPlaceRankData(runtimeEnv.DB, hospitalId, "2000-01-01", "2999-12-31");
    const scheduledImported = runtimeEnv.RANKFREE_API_KEY
      ? 0
      : await syncScheduledRuns(runtimeEnv, access, allData.keywords, allData.snapshots).catch(() => 0);
    let data = await loadPlaceRankData(runtimeEnv.DB, hospitalId, start!, end!);
    if (url.searchParams.get("collect") === "today") {
      await collectMissingToday(runtimeEnv, access, data.keywords, data.snapshots);
      data = await loadPlaceRankData(runtimeEnv.DB, hospitalId, start!, end!);
    }
    return Response.json({
      ...data,
      range: { start, end },
      providerConfigured: providerConfigured(runtimeEnv),
      provider: runtimeEnv.RANKFREE_API_KEY ? "rankfree" : runtimeEnv.PLACE_RANK_PROVIDER_URL ? "apify" : null,
      collectionRule: "daily-09:00",
      scheduledTime: "09:00",
      collectionAvailable: seoulHour() >= 9,
      maxRank: 100,
      excludesSponsored: true,
      scheduledImported,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return accessErrorResponse(error, "플레이스 순위 데이터를 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAccess(request, hospitalId, ["owner", "admin", "marketer"]);
    const runtimeEnv = env as unknown as RuntimeEnv;
    const body = await request.json() as {
      action?: "save" | "delete" | "collect" | "record";
      id?: string;
      keyword?: string;
      placeUrl?: string;
      rank?: number | null;
      outsideTop100?: boolean;
    };

    if (body.action === "save") {
      const keyword = String(body.keyword || "").trim().slice(0, 80);
      const placeUrl = String(body.placeUrl || "").trim();
      const placeId = extractNaverPlaceId(placeUrl);
      if (!keyword) return Response.json({ error: "추적할 검색 키워드를 입력해 주세요." }, { status: 400 });
      if (!placeId) return Response.json({ error: "네이버 지도 또는 모바일 플레이스의 숫자 Place ID가 포함된 주소를 입력해 주세요." }, { status: 400 });
      const id = body.id || crypto.randomUUID();
      const value: PlaceRankKeyword = { id, keyword, placeUrl, placeId, active: true, createdAt: new Date().toISOString() };
      await writeAudit(runtimeEnv, access, "place_rank_keyword_saved", id, value);
      const tracking = runtimeEnv.RANKFREE_API_KEY
        ? await registerRankfreeSlot(runtimeEnv, value)
        : { registered: false, provider: null };
      return Response.json({ saved: true, keyword: value, tracking });
    }

    if (body.action === "delete" && body.id) {
      await writeAudit(runtimeEnv, access, "place_rank_keyword_deleted", body.id, { deletedAt: new Date().toISOString() });
      return Response.json({ deleted: true });
    }

    const today = seoulDate();
    const data = await loadPlaceRankData(runtimeEnv.DB, hospitalId, "2000-01-01", "2999-12-31");
    const keyword = data.keywords.find((row) => row.id === body.id);
    if (!keyword) return Response.json({ error: "등록된 키워드를 찾지 못했습니다." }, { status: 404 });

    if (body.action === "record") {
      const numericRank = Number(body.rank);
      const outsideTop100 = body.outsideTop100 === true;
      if (!outsideTop100 && (!Number.isInteger(numericRank) || numericRank < 1 || numericRank > 100)) {
        return Response.json({ error: "순위는 1~100 사이로 입력하거나 100위 밖을 선택해 주세요." }, { status: 400 });
      }
      const snapshot: PlaceRankSnapshot = {
        keywordId: keyword.id,
        date: today,
        rank: outsideTop100 ? null : numericRank,
        outsideTop100,
        status: "manual",
        source: "manual",
        checkedAt: new Date().toISOString(),
        manualRecordVersion: "current",
        message: outsideTop100 ? "100위 밖" : undefined,
      };
      await writeAudit(runtimeEnv, access, "place_rank_snapshot", keyword.id, snapshot);
      return Response.json({ saved: true, snapshot });
    }

    if (body.action === "collect") {
      if (!providerConfigured(runtimeEnv)) return Response.json({ error: "허가된 자동 순위 측정 공급자를 먼저 연결해 주세요." }, { status: 503 });
      const resetAt = new Date().toISOString();
      await writeAudit(runtimeEnv, access, "place_rank_snapshot_reset", keyword.id, { resetAt });
      const snapshot = await measureKeyword(runtimeEnv, keyword, "manual");
      await writeAudit(runtimeEnv, access, "place_rank_snapshot", keyword.id, snapshot);
      return Response.json({ saved: true, reset: true, replacedAutomatic: true, snapshot });
    }

    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    return accessErrorResponse(error, "플레이스 순위 작업을 완료하지 못했습니다.");
  }
}
