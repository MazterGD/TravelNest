import type { NextFunction, Request, Response } from "express";
import { isPrivateRef, signPrivateRefs } from "../utils/storage.js";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype;

const collectRefs = (value: unknown, refs: Set<string>): void => {
  if (isPrivateRef(value)) {
    refs.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, refs));
  } else if (isPlainObject(value)) {
    Object.values(value).forEach((item) => collectRefs(item, refs));
  }
};

const replaceRefs = (value: unknown, signed: Map<string, string>): unknown => {
  if (isPrivateRef(value)) {
    return signed.get(value) ?? null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceRefs(item, signed));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceRefs(item, signed),
      ]),
    );
  }
  return value;
};

/**
 * Replace private storage references in JSON responses with short-lived
 * signed URLs (ADR-001). Which responses may include such files is decided by
 * each route's authorization; this only turns the reference into a link.
 */
export const signPrivateFileUrls = (
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const sendJson = res.json.bind(res);

  res.json = (body?: unknown) => {
    const refs = new Set<string>();
    collectRefs(body, refs);
    if (refs.size === 0) return sendJson(body);

    signPrivateRefs([...refs])
      .catch((error) => {
        console.error("[storage] failed to sign private file URLs", error);
        return new Map<string, string>();
      })
      .then((signed) => sendJson(replaceRefs(body, signed)));
    return res;
  };

  next();
};
