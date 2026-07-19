import { env } from "cloudflare:workers";
import { accessErrorResponse, requireAccess } from "@/lib/server-access";

export const runtime = "edge";
const hospitalId = "demo-hospital";

type RuntimeEnv = {
  NAVER_SEARCH_AD_CUSTOMER_ID?: string;
  NAVER_SEARCH_AD_API_KEY?: string;
  NAVER_SEARCH_AD_SECRET_KEY?: string;
};

type NaverCampaign = {
  nccCampaignId?: string;
  name?: string;
  status?: string;
};

type NaverStat = {
  dateStart?: string;
  dateEnd?: string;
  impCnt?: number;
  clkCnt?: number;
  salesAmt?: number;
  ctr?: number;
  cpc?: number;
  ccnt?: number;
};

type NaverStatReport = {
  data?: NaverStat[];
};

const apiBaseUrl = "https://api.searchad.naver.com";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function createSignature(timestamp: string, method: string, path: string, secretKey: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${method}.${path}`));
  return bytesToBase64(new Uint8Array(signature));
}

async function naverRequest<T>(
  path: string,
  searchParams: URLSearchParams | null,
  credentials: { customerId: string; apiKey: string; secretKey: string },
) {
  const method = "GET";
  const url = `${apiBaseUrl}${path}${searchParams ? `?${searchParams.toString()}` : ""}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const timestamp = Date.now().toString();
    const signature = await createSignature(timestamp, method, path, credentials.secretKey);
    const response = await fetch(url, {
      method,
      headers: {
        "X-Timestamp": timestamp,
        "X-API-KEY": credentials.apiKey,
        "X-Customer": credentials.customerId,
        "X-Signature": signature,
      },
    });
    if (response.ok) return response.json() as Promise<T>;

    const detail = await response.json().catch(() => null) as { title?: string; message?: string; detail?: string } | null;
    const reason = detail?.detail || detail?.message || detail?.title || `HTTP ${response.status}`;
    const isRateLimited = response.status === 429 || reason.toLowerCase().includes("rps");
    if (isRateLimited && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      continue;
    }
    throw new Error(`네이버 검색광고 API 조회에 실패했습니다. ${reason}`);
  }
  throw new Error("네이버 검색광고 API 호출 제한으로 동기화가 지연되고 있습니다.");
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const groupDefinitions = [
  { name: "#자보", campaigns: ["#자보_MO (신)", "#자보_PC (신)"] },
  { name: "#다이어트", campaigns: ["#다이어트 (신)"] },
  { name: "#암요양", campaigns: ["#암요양 (신)"] },
  { name: "#성장", campaigns: ["#키성장(신)", "#성조숙증 (신)"] },
  { name: "#수술후재활", campaigns: ["#수술후재활(신)"] },
  { name: "#예방접종", campaigns: ["#예방접종"] },
  { name: "#영양수액", campaigns: ["#영양수액"] },
  { name: "#병원명", campaigns: ["#병원명"] },
] as const;

function listDates(start: string, end: string) {
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function GET(request: Request) {
  try {
    await requireAccess(request, hospitalId);
    const runtimeEnv = env as unknown as RuntimeEnv;
    const customerId = runtimeEnv.NAVER_SEARCH_AD_CUSTOMER_ID;
    const apiKey = runtimeEnv.NAVER_SEARCH_AD_API_KEY;
    const secretKey = runtimeEnv.NAVER_SEARCH_AD_SECRET_KEY;
    if (!customerId || !apiKey || !secretKey) {
      return Response.json({ configured: false, error: "네이버 검색광고 API 환경변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      return Response.json({ configured: true, error: "올바른 조회 시작일과 종료일이 필요합니다." }, { status: 400 });
    }

    const credentials = { customerId, apiKey, secretKey };
    const campaigns = await naverRequest<NaverCampaign[]>("/ncc/campaigns", null, credentials);
    const statEntries: Array<readonly [string, NaverStat[]]> = [];
    for (const campaign of campaigns) {
      if (!campaign.nccCampaignId) continue;
      const params = new URLSearchParams();
      params.set("id", campaign.nccCampaignId);
      params.set("fields", JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ctr", "cpc", "ccnt"]));
      params.set("timeRange", JSON.stringify({ since: start, until: end }));
      params.set("timeIncrement", "1");
      const report = await naverRequest<NaverStatReport>("/stats", params, credentials);
      statEntries.push([campaign.nccCampaignId, report.data ?? []] as const);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    const statsById = new Map(statEntries);

    const aggregateDaily = (campaignNames: ReadonlySet<string>) => listDates(start, end).map((date) => {
      const totals = campaigns.reduce((total, campaign) => {
        if (!campaignNames.has(campaign.name ?? "")) return total;
        const stats = statsById.get(campaign.nccCampaignId ?? "") ?? [];
        const daily = stats.find((stat) => (stat.dateStart ?? "").slice(0, 10) === date);
        if (!daily) return total;
        return {
          impressions: total.impressions + numberValue(daily.impCnt),
          clicks: total.clicks + numberValue(daily.clkCnt),
          spend: total.spend + numberValue(daily.salesAmt),
          conversions: total.conversions + numberValue(daily.ccnt),
        };
      }, { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
      return {
        date,
        ...totals,
        ctr: totals.impressions ? round(totals.clicks / totals.impressions * 100) : 0,
        cpc: totals.clicks ? Math.round(totals.spend / totals.clicks) : 0,
        conversionRate: totals.clicks ? round(totals.conversions / totals.clicks * 100) : 0,
        conversionCost: totals.conversions ? Math.round(totals.spend / totals.conversions) : 0,
      };
    });

    const rows = campaigns.map((campaign) => {
      const dailyStats = statsById.get(campaign.nccCampaignId ?? "") ?? [];
      const totals = dailyStats.reduce((total, stat) => ({
        impressions: total.impressions + numberValue(stat.impCnt),
        clicks: total.clicks + numberValue(stat.clkCnt),
        spend: total.spend + numberValue(stat.salesAmt),
        conversions: total.conversions + numberValue(stat.ccnt),
      }), { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
      const { impressions, clicks, spend, conversions } = totals;
      return {
        id: campaign.nccCampaignId ?? campaign.name ?? "campaign",
        name: campaign.name || "이름 없는 캠페인",
        status: campaign.status || "UNKNOWN",
        impressions,
        clicks,
        spend,
        ctr: impressions ? round(clicks / impressions * 100) : 0,
        cpc: clicks ? Math.round(spend / clicks) : 0,
        conversions,
        conversionRate: clicks ? round(conversions / clicks * 100) : 0,
        conversionCost: conversions ? Math.round(spend / conversions) : 0,
      };
    });

    const groups = groupDefinitions.map((definition) => {
      const members = rows.filter((row) => definition.campaigns.some((campaignName) => campaignName === row.name));
      const totals = members.reduce((total, row) => ({
        spend: total.spend + row.spend,
        impressions: total.impressions + row.impressions,
        clicks: total.clicks + row.clicks,
        conversions: total.conversions + row.conversions,
      }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
      return {
        id: definition.name,
        name: definition.name,
        status: members.some((row) => row.status === "ELIGIBLE") ? "운영 중" : "중지",
        campaignCount: members.length,
        ...totals,
        ctr: totals.impressions ? round(totals.clicks / totals.impressions * 100) : 0,
        cpc: totals.clicks ? Math.round(totals.spend / totals.clicks) : 0,
        conversionRate: totals.clicks ? round(totals.conversions / totals.clicks * 100) : 0,
        conversionCost: totals.conversions ? Math.round(totals.spend / totals.conversions) : 0,
      };
    });

    const placeMembers = rows.filter((row) => row.name === "플레이스_통합");
    const placeTotals = placeMembers.reduce((total, row) => ({
      spend: total.spend + row.spend,
      impressions: total.impressions + row.impressions,
      clicks: total.clicks + row.clicks,
      conversions: total.conversions + row.conversions,
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
    const place = {
      id: "naver-place-search",
      name: "네이버 플레이스 검색광고",
      status: placeMembers.some((row) => row.status === "ELIGIBLE") ? "운영 중" : "중지",
      ...placeTotals,
      ctr: placeTotals.impressions ? round(placeTotals.clicks / placeTotals.impressions * 100) : 0,
      cpc: placeTotals.clicks ? Math.round(placeTotals.spend / placeTotals.clicks) : 0,
      conversionRate: placeTotals.clicks ? round(placeTotals.conversions / placeTotals.clicks * 100) : 0,
      conversionCost: placeTotals.conversions ? Math.round(placeTotals.spend / placeTotals.conversions) : 0,
    };

    const summary = groups.reduce((total, row) => ({
      spend: total.spend + row.spend,
      impressions: total.impressions + row.impressions,
      clicks: total.clicks + row.clicks,
      conversions: total.conversions + row.conversions,
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

    return Response.json({
      configured: true,
      source: "naver-search-ads",
      range: { start, end },
      summary: {
        ...summary,
        ctr: summary.impressions ? round(summary.clicks / summary.impressions * 100) : 0,
        cpc: summary.clicks ? Math.round(summary.spend / summary.clicks) : 0,
        conversionRate: summary.clicks ? round(summary.conversions / summary.clicks * 100) : 0,
        conversionCost: summary.conversions ? Math.round(summary.spend / summary.conversions) : 0,
      },
      groups,
      place,
      daily: {
        search: aggregateDaily(new Set(groupDefinitions.flatMap((definition) => [...definition.campaigns]))),
        place: aggregateDaily(new Set(["플레이스_통합"])),
      },
      campaigns: rows,
      syncedAt: new Date().toISOString(),
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return accessErrorResponse(error, "네이버 검색광고 조회 중 오류가 발생했습니다.");
  }
}
