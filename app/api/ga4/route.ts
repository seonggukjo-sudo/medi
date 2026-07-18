import { env } from "cloudflare:workers";

export const runtime = "edge";

type RuntimeEnv = {
  GA4_PROPERTY_ID?: string;
  GA4_CLIENT_EMAIL?: string;
  GA4_PRIVATE_KEY?: string;
};

type Ga4Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type Ga4Report = {
  rows?: Ga4Row[];
  totals?: Ga4Row[];
};

const analyticsScope = "https://www.googleapis.com/auth/analytics.readonly";
const tokenEndpoint = "https://oauth2.googleapis.com/token";

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function pemToPkcs8(pem: string) {
  const binary = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function createAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = stringToBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = stringToBase64Url(JSON.stringify({
    iss: clientEmail,
    scope: analyticsScope,
    aud: tokenEndpoint,
    iat: now,
    exp: now + 3600,
  }));
  const unsignedToken = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsignedToken));
  const assertion = `${unsignedToken}.${bytesToBase64Url(new Uint8Array(signature))}`;
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) throw new Error("Google 서비스 계정 인증에 실패했습니다. 비밀키와 API 활성화 상태를 확인해 주세요.");
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("Google 인증 응답에 액세스 토큰이 없습니다.");
  return body.access_token;
}

async function runReport(
  propertyId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  metrics: string[],
  limit = 10,
) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      metricAggregations: ["TOTAL"],
      orderBys: metrics.length ? [{ metric: { metricName: metrics[0] }, desc: true }] : undefined,
      limit,
    }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: { status?: string; message?: string } } | null;
    if (response.status === 403) {
      throw new Error("서비스 계정에 이 GA4 속성의 조회자 권한이 없거나 Google Analytics Data API가 비활성 상태입니다.");
    }
    throw new Error(detail?.error?.message || `GA4 조회에 실패했습니다${detail?.error?.status ? ` (${detail.error.status})` : ""}.`);
  }
  return response.json() as Promise<Ga4Report>;
}

async function safeRunReport(
  label: string,
  propertyId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  metrics: string[],
  limit: number,
) {
  try {
    return { report: await runReport(propertyId, accessToken, startDate, endDate, dimensions, metrics, limit), warning: null };
  } catch {
    return { report: {} as Ga4Report, warning: `${label} 보고서` };
  }
}

function numberAt(row: Ga4Row | undefined, index: number) {
  const value = Number(row?.metricValues?.[index]?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function dimensionAt(row: Ga4Row, index = 0) {
  return row.dimensionValues?.[index]?.value || "(not set)";
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: Request) {
  try {
    const runtimeEnv = env as unknown as RuntimeEnv;
    const propertyId = runtimeEnv.GA4_PROPERTY_ID;
    const clientEmail = runtimeEnv.GA4_CLIENT_EMAIL;
    const privateKey = runtimeEnv.GA4_PRIVATE_KEY;
    if (!propertyId || !clientEmail || !privateKey) {
      return Response.json({ configured: false, error: "GA4 서버 환경변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get("start");
    const endDate = url.searchParams.get("end");
    if (!isDate(startDate) || !isDate(endDate) || startDate! > endDate!) {
      return Response.json({ configured: true, error: "올바른 조회 시작일과 종료일이 필요합니다." }, { status: 400 });
    }

    const accessToken = await createAccessToken(clientEmail, privateKey);
    const summaryReport = await runReport(propertyId, accessToken, startDate!, endDate!, [], [
      "sessions", "activeUsers", "engagedSessions", "engagementRate", "keyEvents",
      "newUsers", "totalUsers", "screenPageViews", "averageSessionDuration", "eventCount",
    ], 1);
    const [conversionRateResult, channelResult, landingResult, landingConversionResult, eventResult, deviceResult, utmResult] = await Promise.all([
      safeRunReport("전환율", propertyId, accessToken, startDate!, endDate!, [], ["sessionKeyEventRate"], 1),
      safeRunReport("유입 채널", propertyId, accessToken, startDate!, endDate!, ["sessionDefaultChannelGroup"], [
        "sessions", "activeUsers", "engagementRate", "keyEvents", "sessionKeyEventRate",
      ], 10),
      safeRunReport("랜딩페이지", propertyId, accessToken, startDate!, endDate!, ["landingPage"], [
        "sessions", "activeUsers", "engagementRate", "keyEvents",
      ], 8),
      safeRunReport("랜딩페이지 전환", propertyId, accessToken, startDate!, endDate!, ["landingPage", "eventName"], [
        "eventCount", "activeUsers", "keyEvents",
      ], 100),
      safeRunReport("이벤트", propertyId, accessToken, startDate!, endDate!, ["eventName"], [
        "eventCount", "activeUsers", "keyEvents",
      ], 50),
      safeRunReport("기기", propertyId, accessToken, startDate!, endDate!, ["deviceCategory"], [
        "activeUsers", "sessions", "sessionKeyEventRate",
      ], 5),
      safeRunReport("UTM", propertyId, accessToken, startDate!, endDate!, ["sessionManualCampaignName"], ["sessions"], 100),
    ]);
    const conversionRateReport = conversionRateResult.report;
    const channelReport = channelResult.report;
    const landingReport = landingResult.report;
    const landingConversionReport = landingConversionResult.report;
    const eventReport = eventResult.report;
    const deviceReport = deviceResult.report;
    const utmReport = utmResult.report;
    const warnings = [conversionRateResult, channelResult, landingResult, landingConversionResult, eventResult, deviceResult, utmResult]
      .map((result) => result.warning)
      .filter((warning): warning is string => Boolean(warning));

    const total = summaryReport.totals?.[0] ?? summaryReport.rows?.[0];
    const sessions = numberAt(total, 0);
    const newUsers = numberAt(total, 5);
    const totalUsers = numberAt(total, 6);
    const devices = (deviceReport.rows ?? []).map((row) => ({
      device: dimensionAt(row),
      users: numberAt(row, 0),
      sessions: numberAt(row, 1),
      share: sessions ? round(numberAt(row, 1) / sessions * 100) : 0,
      conversionRate: round(numberAt(row, 2) * 100, 2),
    }));

    return Response.json({
      configured: true,
      source: "ga4",
      warnings,
      range: { start: startDate, end: endDate },
      summary: {
        sessions,
        activeUsers: numberAt(total, 1),
        engagedSessions: numberAt(total, 2),
        engagementRate: round(numberAt(total, 3) * 100),
        keyEvents: numberAt(total, 4),
        conversionRate: round(numberAt(conversionRateReport.totals?.[0] ?? conversionRateReport.rows?.[0], 0) * 100, 2),
        newUsers,
        returningUsers: Math.max(0, totalUsers - newUsers),
        utmMissingSessions: (utmReport.rows ?? []).filter((row) => dimensionAt(row) === "(not set)").reduce((sum, row) => sum + numberAt(row, 0), 0),
        pageViews: numberAt(total, 7),
        averageSessionDuration: round(numberAt(total, 8)),
        eventCount: numberAt(total, 9),
      },
      channels: (channelReport.rows ?? []).map((row) => ({
        channel: dimensionAt(row),
        sessions: numberAt(row, 0),
        users: numberAt(row, 1),
        engaged: round(numberAt(row, 2) * 100),
        conversions: numberAt(row, 3),
        rate: round(numberAt(row, 4) * 100, 2),
      })),
      landingPages: (landingReport.rows ?? []).map((row) => ({
        page: dimensionAt(row),
        sessions: numberAt(row, 0),
        users: numberAt(row, 1),
        engagement: round(numberAt(row, 2) * 100),
        keyEvents: numberAt(row, 3),
      })),
      landingConversions: (landingConversionReport.rows ?? []).filter((row) => numberAt(row, 0) > 0).map((row) => ({
        page: dimensionAt(row, 0),
        event: dimensionAt(row, 1),
        count: numberAt(row, 0),
        users: numberAt(row, 1),
        keyEvents: numberAt(row, 2),
      })),
      events: (eventReport.rows ?? []).map((row) => ({
        event: dimensionAt(row),
        count: numberAt(row, 0),
        users: numberAt(row, 1),
        keyEvent: numberAt(row, 2) > 0 ? "주요 전환" : "일반",
      })),
      devices,
    }, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GA4 조회 중 알 수 없는 오류가 발생했습니다.";
    return Response.json({ configured: true, error: message }, { status: 502 });
  }
}
