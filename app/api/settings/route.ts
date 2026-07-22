import { env } from "cloudflare:workers";
import { accessErrorResponse, requireAccess, roleLabels, type DashboardRole } from "@/lib/server-access";

export const runtime = "edge";

const hospitalId = "demo-hospital";
const roleByLabel: Record<string, DashboardRole> = Object.fromEntries(
  Object.entries(roleLabels).map(([role, label]) => [label, role]),
) as Record<string, DashboardRole>;

const defaultSettings = {
  hospitalName: "메디인사이트",
  hospitalLocation: "서울 본원",
  locale: "한국어",
  defaultPeriod: "최근7일(오늘제외)",
  compare: "전일 기간",
  notifications: { errors: true, summary: true, changes: false },
  kpiTargets: [],
  aiSettings: { enabled: true, frequency: "매일 오전 9시", compare: "전주 동일기간", anomaly: "10% 이상", recommendation: "핵심 3개" },
  dataPolicy: {
    departmentCategories: "교통사고, 재활, 성장, 다이어트, 암, 기타",
    inflowChannels: "네이버 플레이스, 네이버 검색광고, 네이버 블로그, 구글 검색, 인스타그램, 카카오, 지인 소개, 기존 환자, 간판·현수막, 모름, 기타",
    duplicateRule: "일자 + 원천 ID",
    mismatchPolicy: "합계 불일치 시 AI 분석 보류",
  },
  ga4Automation: true,
  googleSheetId: "",
  googleSheetAutomation: false,
};

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return typeof value === "string" ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  try {
    const access = await requireAccess(request, hospitalId);
    const [settingsRow, userRows, historyRows] = await Promise.all([
      env.DB.prepare("SELECT alert_policy_json AS settingsJson, updated_at AS updatedAt FROM hospital_settings WHERE hospital_id = ?")
        .bind(hospitalId).first<{ settingsJson: string; updatedAt: string }>(),
      env.DB.prepare("SELECT email, name, role, last_login_at AS lastLoginAt FROM users WHERE hospital_id = ? AND status = 'active' ORDER BY created_at")
        .bind(hospitalId).all(),
      env.DB.prepare("SELECT user_id AS userId, action, target_id AS targetId, created_at AS createdAt, metadata_json AS metadataJson FROM audit_logs WHERE hospital_id = ? AND target_type IN ('settings', 'users') ORDER BY created_at DESC LIMIT 30")
        .bind(hospitalId).all(),
    ]);

    const settings = { ...defaultSettings, ...parseJson(settingsRow?.settingsJson, {}) };
    const persistedUsers = (userRows.results as Array<{ email: string; name: string; role: DashboardRole; lastLoginAt: string | null }>).map((user) => ({
      email: user.email,
      name: user.name,
      organization: settings.hospitalLocation,
      role: roleLabels[user.role],
      recentAccess: user.lastLoginAt || "접속 기록 없음",
    }));
    const users = persistedUsers.length > 0 ? persistedUsers : [{
      email: access.email,
      name: access.name,
      organization: settings.hospitalLocation,
      role: roleLabels.owner,
      recentAccess: "현재 접속",
    }];

    return Response.json({
      settings,
      users,
      history: historyRows.results.map((row) => ({
        ...row,
        metadata: parseJson((row as { metadataJson?: string }).metadataJson, {}),
      })),
      access: { email: access.email, role: access.role, roleLabel: roleLabels[access.role], canManageSettings: ["owner", "admin"].includes(access.role), canManageData: ["owner", "admin", "marketer"].includes(access.role) },
      updatedAt: settingsRow?.updatedAt ?? null,
    });
  } catch (error) {
    return accessErrorResponse(error, "설정을 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAccess(request, hospitalId, ["owner", "admin"]);
    const body = await request.json() as { settings?: Record<string, unknown>; users?: Array<{ email?: string; name?: string; role?: string }> };
    if (!body.settings || !Array.isArray(body.users)) return Response.json({ error: "저장할 설정 형식이 올바르지 않습니다." }, { status: 400 });

    const normalizedUsers: Array<{ email: string; name: string; role: DashboardRole }> = [];
    const seenEmails = new Set<string>();
    for (const user of body.users) {
      const email = String(user.email || "").trim().toLowerCase();
      const role = roleByLabel[String(user.role)];
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "사용자 이메일 형식을 확인해 주세요." }, { status: 400 });
      if (seenEmails.has(email)) return Response.json({ error: `중복 사용자 이메일이 있습니다: ${email}` }, { status: 400 });
      if (!role) return Response.json({ error: `${email} 사용자의 권한 값이 올바르지 않습니다.` }, { status: 400 });
      seenEmails.add(email);
      normalizedUsers.push({ email, name: String(user.name || email.split("@")[0]).trim(), role });
    }
    if (normalizedUsers.length === 0) return Response.json({ error: "최소 1명의 사용자가 필요합니다." }, { status: 400 });
    if (!normalizedUsers.some((user) => user.role === "owner")) {
      if (access.role !== "owner") return Response.json({ error: "최고관리자를 최소 1명 유지해야 합니다." }, { status: 400 });
      const currentUser = normalizedUsers.find((user) => user.email === access.email);
      if (currentUser) currentUser.role = "owner";
      else normalizedUsers.push({ email: access.email, name: access.name, role: "owner" });
    }

    const [existingResult, existingSettingsRow] = await Promise.all([
      env.DB.prepare("SELECT email, name, role, last_login_at AS lastLoginAt, created_at AS createdAt FROM users WHERE hospital_id = ? AND status = 'active'")
        .bind(hospitalId)
        .all(),
      env.DB.prepare("SELECT alert_policy_json AS settingsJson FROM hospital_settings WHERE hospital_id = ?")
        .bind(hospitalId)
        .first<{ settingsJson: string }>(),
    ]);
    const existingUsers = existingResult.results as Array<{ email: string; name: string; role: DashboardRole; lastLoginAt: string | null; createdAt: string }>;
    const existingByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]));
    const nextByEmail = new Map(normalizedUsers.map((user) => [user.email, user]));
    const previousSettings = { ...defaultSettings, ...parseJson<Record<string, unknown>>(existingSettingsRow?.settingsJson, {}) };
    const previousTargets = Array.isArray(previousSettings.kpiTargets) ? previousSettings.kpiTargets as Array<Record<string, unknown>> : [];
    const nextTargets = Array.isArray(body.settings.kpiTargets) ? body.settings.kpiTargets as Array<Record<string, unknown>> : [];
    const previousTargetByMetric = new Map(previousTargets.map((target) => [String(target.metric || ""), target]));
    const nextTargetByMetric = new Map(nextTargets.map((target) => [String(target.metric || ""), target]));

    const now = new Date().toISOString();
    const statements = [
      env.DB.prepare("INSERT OR IGNORE INTO hospitals (hospital_id, name, timezone, status, created_at) VALUES (?, ?, 'Asia/Seoul', 'active', ?)")
        .bind(hospitalId, String(body.settings.hospitalName || defaultSettings.hospitalName), now),
      env.DB.prepare("INSERT INTO hospital_settings (hospital_id, operation_profile, alert_policy_json, notification_targets_json, updated_by, updated_at) VALUES (?, 'weekly_meeting', ?, '[]', ?, ?) ON CONFLICT(hospital_id) DO UPDATE SET alert_policy_json = excluded.alert_policy_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at")
        .bind(hospitalId, JSON.stringify(body.settings), access.email, now),
      env.DB.prepare("DELETE FROM users WHERE hospital_id = ?").bind(hospitalId),
    ];

    for (const user of normalizedUsers) {
      const existing = existingByEmail.get(user.email);
      statements.push(env.DB.prepare("INSERT INTO users (user_id, hospital_id, email, name, role, status, last_login_at, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)")
        .bind(`${hospitalId}:${user.email}`, hospitalId, user.email, user.name, user.role, user.email === access.email ? now : existing?.lastLoginAt ?? null, existing?.createdAt ?? now));
      const action = !existing ? "user_added" : existing.role !== user.role ? "user_role_changed" : existing.name !== user.name ? "user_profile_changed" : null;
      if (action) {
        statements.push(env.DB.prepare("INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, ?, 'users', ?, ?, ?)")
          .bind(crypto.randomUUID(), hospitalId, access.email, action, user.email, now, JSON.stringify({ email: user.email, name: user.name, beforeRole: existing ? roleLabels[existing.role] : null, afterRole: roleLabels[user.role] })));
      }
    }
    for (const existing of existingUsers) {
      if (nextByEmail.has(existing.email.toLowerCase())) continue;
      statements.push(env.DB.prepare("INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, 'user_removed', 'users', ?, ?, ?)")
        .bind(crypto.randomUUID(), hospitalId, access.email, existing.email, now, JSON.stringify({ email: existing.email, name: existing.name, beforeRole: roleLabels[existing.role], afterRole: null })));
    }
    for (const metric of new Set([...previousTargetByMetric.keys(), ...nextTargetByMetric.keys()])) {
      if (!metric) continue;
      const before = previousTargetByMetric.get(metric);
      const after = nextTargetByMetric.get(metric);
      if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) continue;
      const summarize = (target?: Record<string, unknown>) => target
        ? `병원 ${String(target.hospital || "-")} · 진료과목 ${String(target.department || "-")} · 매체 ${String(target.channel || "-")}`
        : "설정 없음";
      statements.push(env.DB.prepare("INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, 'kpi_target_changed', 'settings', ?, ?, ?)")
        .bind(crypto.randomUUID(), hospitalId, access.email, `kpi:${metric}`, now, JSON.stringify({ metric, beforeValue: summarize(before), afterValue: summarize(after), detail: `${summarize(before)} → ${summarize(after)}` })));
    }
    const previousAi = previousSettings.aiSettings && typeof previousSettings.aiSettings === "object" ? previousSettings.aiSettings as Record<string, unknown> : {};
    const nextAi = body.settings.aiSettings && typeof body.settings.aiSettings === "object" ? body.settings.aiSettings as Record<string, unknown> : {};
    const aiFields: Array<[string, string]> = [["enabled", "사용 여부"], ["frequency", "분석 주기"], ["compare", "비교 기준"], ["anomaly", "이상 변화"], ["recommendation", "추천 수준"]];
    const aiChanges = aiFields
      .filter(([field]) => String(previousAi[field] ?? "-") !== String(nextAi[field] ?? "-"))
      .map(([field, label]) => `${label} ${String(previousAi[field] ?? "-")} → ${String(nextAi[field] ?? "-")}`);
    if (aiChanges.length > 0) {
      statements.push(env.DB.prepare("INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, 'ai_settings_changed', 'settings', 'ai-analysis', ?, ?)")
        .bind(crypto.randomUUID(), hospitalId, access.email, now, JSON.stringify({ detail: aiChanges.join(" · ") })));
    }
    statements.push(env.DB.prepare("INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, 'settings_saved', 'settings', ?, ?, ?)")
      .bind(crypto.randomUUID(), hospitalId, access.email, hospitalId, now, JSON.stringify({ userCount: normalizedUsers.length, ownerCount: normalizedUsers.filter((user) => user.role === "owner").length, changedByRole: access.role })));

    await env.DB.batch(statements);
    return Response.json({ saved: true, updatedAt: now, userCount: normalizedUsers.length });
  } catch (error) {
    return accessErrorResponse(error, "설정을 저장하지 못했습니다.");
  }
}
