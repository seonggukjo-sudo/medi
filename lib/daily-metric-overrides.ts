export type DailyMetricOverride = {
  date: string;
  inquiries: number;
  reservations: number;
  visits: number;
  sales: number;
  adSpend: number;
  updatedAt?: string;
  updatedBy?: string;
};

type OverrideAuditRow = {
  targetId: string | null;
  createdAt: string;
  userId: string;
  metadataJson: string | null;
};

export async function loadDailyMetricOverrides(
  db: D1Database,
  hospitalId: string,
  start?: string,
  end?: string,
) {
  const result = await db.prepare(
    "SELECT target_id AS targetId, created_at AS createdAt, user_id AS userId, metadata_json AS metadataJson FROM audit_logs WHERE hospital_id = ? AND action = 'daily_metrics_override' ORDER BY created_at DESC",
  ).bind(hospitalId).all<OverrideAuditRow>();
  const latest = new Map<string, DailyMetricOverride>();

  for (const row of result.results) {
    const date = row.targetId ?? "";
    if (!date || latest.has(date) || (start && date < start) || (end && date > end)) continue;
    try {
      const value = JSON.parse(row.metadataJson ?? "{}") as Partial<DailyMetricOverride>;
      latest.set(date, {
        date,
        inquiries: Math.max(0, Number(value.inquiries) || 0),
        reservations: Math.max(0, Number(value.reservations) || 0),
        visits: Math.max(0, Number(value.visits) || 0),
        sales: Math.max(0, Number(value.sales) || 0),
        adSpend: Math.max(0, Number(value.adSpend) || 0),
        updatedAt: row.createdAt,
        updatedBy: row.userId,
      });
    } catch {
      // Ignore malformed historical audit entries and keep the source aggregate.
    }
  }

  return [...latest.values()];
}
