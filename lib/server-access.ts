import { env } from "cloudflare:workers";

export type DashboardRole = "owner" | "admin" | "marketer" | "counselor" | "viewer";

export const roleLabels: Record<DashboardRole, string> = {
  owner: "최고관리자",
  admin: "병원 관리자",
  marketer: "마케팅",
  counselor: "상담",
  viewer: "조회 전용",
};

export class AccessError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const accessHeartbeatIntervalMs = 15 * 60 * 1000;

function requestEmail(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (email) return email;

  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return request.headers.get("x-medi-insight-user")?.trim().toLowerCase() || "admin@hospital.local";
  }
  return "";
}

export async function requireAccess(
  request: Request,
  hospitalId: string,
  allowedRoles: DashboardRole[] = ["owner", "admin", "marketer", "counselor", "viewer"],
) {
  const email = requestEmail(request);
  if (!email) throw new AccessError("Sites 로그인 정보가 없습니다.", 401);

  const countRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE hospital_id = ? AND status = 'active'")
    .bind(hospitalId)
    .first<{ count: number }>();
  const bootstrap = Number(countRow?.count ?? 0) === 0;
  const user = bootstrap
    ? null
    : await env.DB.prepare(
        "SELECT user_id AS userId, email, name, role, last_login_at AS lastLoginAt FROM users WHERE hospital_id = ? AND lower(email) = ? AND status = 'active' LIMIT 1",
      ).bind(hospitalId, email).first<{ userId: string; email: string; name: string; role: DashboardRole; lastLoginAt: string | null }>();

  if (!bootstrap && !user) throw new AccessError("이 병원 대시보드에 등록된 사용자가 아닙니다.", 403);
  const role: DashboardRole = bootstrap ? "owner" : user!.role;
  if (!allowedRoles.includes(role)) throw new AccessError("이 작업을 수행할 권한이 없습니다.", 403);

  const now = new Date();
  const previousAccessAt = user?.lastLoginAt ? Date.parse(user.lastLoginAt) : 0;
  const shouldRefreshAccess = Boolean(user && (!Number.isFinite(previousAccessAt) || now.getTime() - previousAccessAt >= accessHeartbeatIntervalMs));
  if (shouldRefreshAccess && user) {
    try {
      await env.DB.prepare("UPDATE users SET last_login_at = ? WHERE hospital_id = ? AND user_id = ?")
        .bind(now.toISOString(), hospitalId, user.userId)
        .run();
    } catch {
      // Access logging must not block an otherwise authorized dashboard request.
    }
  }

  return {
    email,
    role,
    bootstrap,
    userId: user?.userId ?? email,
    name: user?.name ?? email.split("@")[0],
    lastLoginAt: shouldRefreshAccess ? now.toISOString() : user?.lastLoginAt ?? null,
  };
}

export function accessErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}
