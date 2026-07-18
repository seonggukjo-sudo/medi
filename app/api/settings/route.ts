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
  defaultPeriod: "최근 7일",
  compare: "이전 7일",
  notifications: { errors: true, summary: true, changes: false },
  kpiTargets: [],
  aiSettings: { enabled: true, frequency: "매일 오전 9시", compare: "전주 동일기간", anomaly: "10% 이상", recommendation: "핵심 3개" },
  ga4Automation: true,
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
      env.DB.prepare("SELECT user_id AS userId, action, created_at AS createdAt, metadata_json AS metadataJson FROM audit_logs WHERE hospital_id = ? AND target_type IN ('settings', 'users') ORDER BY created_at DESC LIMIT 20")
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

    const now = new Date().toISOString();
    const statements = [
      env.DB.prepare("INSERT OR IGNORE INTO hospitals (hospital_id, name, timezone, status, created_at) VALUES (?, ?, 'Asia/Seoul', 'active', ?)")
        .bind(hospitalId, String(body.settings.hospitalName || defaultSettings.hospitalName), now),
      env.DB.prepare("INSERT INTO hospital_settings (hospital_id, operation_profile, alert_policy_json, notification_targets_json, updated_by, updated_at) VALUES (?, 'weekly_meeting', ?, '[]', ?, ?) ON CONFLICT(hospital_id) DO UPDATE SET alert_policy_json = excluded.alert_policy_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at")
        .bind(hospitalId, JSON.stringify(body.settings), access.email, now),
      env.DB.prepare("DELETE FROM users WHERE hospital_id = ?").bind(hospitalId),
    ];

    for (const user of body.users) {
      const email = String(user.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) continue;
      const role = roleByLabel[String(user.role)] || "viewer";
      statements.push(env.DB.prepare("INSERT INTO users (user_id, hospital_id, email, name, role, status, last_login_at, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)")
        .bind(`${hospitalId}:${email}`, hospitalId, email, String(user.name || email.split("@")[0]), role, email === access.email ? now : null, now));
    }
    if (!body.users.some((user) => String(user.email || "").trim().toLowerCase() === access.email)) {
      statements.push(env.DB.prepare("INSERT INTO users (user_id, hospital_id, email, name, role, status, last_login_at, created_at) VALUES (?, ?, ?, ?, 'owner', 'active', ?, ?)")
        .bind(`${hospitalId}:${access.email}`, hospitalId, access.email, access.name, now, now));
    }
    statements.push(env.DB.prepare("INSERT INTO audit_logs (log_id, hospital_id, user_id, action, target_type, target_id, created_at, metadata_json) VALUES (?, ?, ?, 'settings_saved', 'settings', ?, ?, ?)")
      .bind(crypto.randomUUID(), hospitalId, access.email, hospitalId, now, JSON.stringify({ userCount: body.users.length, changedByRole: access.role })));

    await env.DB.batch(statements);
    return Response.json({ saved: true, updatedAt: now });
  } catch (error) {
    return accessErrorResponse(error, "설정을 저장하지 못했습니다.");
  }
}
