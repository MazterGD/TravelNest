import { type Request, type Response, type NextFunction } from "express";
import { recordUserAction } from "../modules/admin/audit/audit.service.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CUID_RE = /^c[a-z0-9]{20,}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isId = (segment: string): boolean =>
  CUID_RE.test(segment) || UUID_RE.test(segment);

const METHOD_ACTION: Record<string, string> = {
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

/**
 * Derive a coarse { entityType, entityId } from a request path such as
 * `/api/v1/bookings/<id>/cancel` → { entityType: "BOOKINGS", entityId: "<id>" }.
 */
const deriveEntity = (
  originalUrl: string,
): { entityType: string; entityId: string } => {
  const path = originalUrl.split("?")[0];
  const segments = path.split("/").filter(Boolean);

  // Skip the `api` + version prefix (e.g. api/v1) when present.
  const apiIdx = segments.indexOf("api");
  const rest = apiIdx >= 0 ? segments.slice(apiIdx + 2) : segments;

  if (rest.length === 0) {
    return { entityType: "UNKNOWN", entityId: "" };
  }

  return {
    entityType: rest[0].toUpperCase().replace(/-/g, "_"),
    entityId: rest.find(isId) ?? "",
  };
};

/**
 * App-wide audit logger. Records every successful authenticated mutation
 * (customer, owner, or admin) once the response is flushed — at which point the
 * per-route `authenticate` middleware has populated `req.user`.
 *
 * Admin routes are skipped: those service layers already emit richer, explicit
 * audit entries, so logging them here too would double-count. Only request
 * metadata is stored (never the body) to keep PII/secrets out of the trail.
 */
export const auditLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  res.on("finish", () => {
    const user = req.user;
    if (!user) return; // unauthenticated (e.g. login/register) — nothing to attribute
    if (res.statusCode >= 400) return; // only successful mutations
    if (req.originalUrl.includes("/admin/")) return; // admin actions audited explicitly

    const { entityType, entityId } = deriveEntity(req.originalUrl);

    void recordUserAction({
      actorId: user.id,
      actorRole: user.role,
      action: METHOD_ACTION[req.method] ?? req.method,
      entityType,
      entityId,
      changes: { method: req.method, path: req.originalUrl.split("?")[0] },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      status: "success",
    }).catch((err) => {
      // Audit failure must never break the request that already succeeded.
      console.warn("[audit] failed to record user action", err);
    });
  });

  next();
};
