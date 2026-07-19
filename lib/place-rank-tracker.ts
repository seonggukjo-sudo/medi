export type PlaceRankKeyword = {
  id: string;
  keyword: string;
  placeUrl: string;
  placeId: string;
  active: boolean;
  createdAt: string;
  providerSlotId?: string;
};

export type PlaceRankSnapshot = {
  keywordId: string;
  date: string;
  rank: number | null;
  outsideTop100: boolean;
  status: "measured" | "manual" | "failed";
  source: "authorized-provider" | "manual";
  checkedAt: string;
  rankMethod?: "provider-absolute";
  manualRecordVersion?: "current";
  trigger?: "scheduled" | "manual";
  checkedCount?: number;
  maxRank?: number;
  message?: string;
};

type AuditRow = {
  action: string;
  targetId: string | null;
  createdAt: string;
  metadataJson: string | null;
};

function parseJson<T>(value: string | null) {
  try {
    return JSON.parse(value ?? "{}") as T;
  } catch {
    return null;
  }
}

export function extractNaverPlaceId(placeUrl: string) {
  try {
    const url = new URL(placeUrl);
    if (!["m.place.naver.com", "map.naver.com"].includes(url.hostname)) return "";
    return url.pathname.match(/(?:place|hospital|entry\/place)\/(\d+)/)?.[1] ?? "";
  } catch {
    return "";
  }
}

export async function loadPlaceRankData(db: D1Database, hospitalId: string, start: string, end: string) {
  const rows = await db.prepare(
    "SELECT action, target_id AS targetId, created_at AS createdAt, metadata_json AS metadataJson FROM audit_logs WHERE hospital_id = ? AND target_type = 'place_rank' ORDER BY created_at DESC",
  ).bind(hospitalId).all<AuditRow>();

  const keywordState = new Map<string, PlaceRankKeyword | null>();
  const snapshots = new Map<string, PlaceRankSnapshot>();
  const snapshotResetAt = new Map<string, string>();

  for (const row of rows.results) {
    const targetId = row.targetId ?? "";
    if (!targetId) continue;
    if ((row.action === "place_rank_keyword_saved" || row.action === "place_rank_keyword_deleted") && !keywordState.has(targetId)) {
      if (row.action === "place_rank_keyword_deleted") {
        keywordState.set(targetId, null);
      } else {
        const value = parseJson<Partial<PlaceRankKeyword>>(row.metadataJson);
        if (value?.keyword && value.placeUrl && value.placeId) {
          keywordState.set(targetId, {
            id: targetId,
            keyword: String(value.keyword),
            placeUrl: String(value.placeUrl),
            placeId: String(value.placeId),
            active: value.active !== false,
            createdAt: String(value.createdAt || row.createdAt),
            providerSlotId: value.providerSlotId ? String(value.providerSlotId) : undefined,
          });
        }
      }
    }
    if (row.action === "place_rank_snapshot_reset" && !snapshotResetAt.has(targetId)) {
      const value = parseJson<{ resetAt?: string }>(row.metadataJson);
      snapshotResetAt.set(targetId, value?.resetAt || row.createdAt);
      continue;
    }
    if (row.action === "place_rank_snapshot") {
      let value = parseJson<PlaceRankSnapshot>(row.metadataJson);
      // Older provider snapshots were calculated from the returned array
      // position and could turn a real 11th-place result into 1st place.
      // Keep manual records, but hide legacy automatic records from all views.
      if (value?.source === "authorized-provider" && value.rankMethod !== "provider-absolute") continue;
      if (value?.source === "manual" && value.manualRecordVersion !== "current") continue;
      if (value?.source === "authorized-provider" && value.outsideTop100 && !(Number(value.checkedCount) >= 100)) {
        value = {
          ...value,
          rank: null,
          outsideTop100: false,
          status: "failed",
          message: "100개 자연 검색 결과를 확인하지 못해 기존 순위 판정을 무효화했습니다.",
        };
      }
      const resetAt = snapshotResetAt.get(targetId);
      if (resetAt && row.createdAt <= resetAt) continue;
      if (!value || value.date < start || value.date > end) continue;
      const key = `${targetId}:${value.date}`;
      if (!snapshots.has(key)) snapshots.set(key, { ...value, keywordId: targetId });
    }
  }

  return {
    keywords: [...keywordState.values()].filter((value): value is PlaceRankKeyword => Boolean(value)),
    snapshots: [...snapshots.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
