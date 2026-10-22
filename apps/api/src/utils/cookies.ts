import type { CookieOptions } from "express";
import { config } from "../config/index.js";

/**
 * Base options shared by the refresh-token and CSRF cookies. Production uses
 * SameSite=None so the web app can call the API from another origin; set
 * COOKIE_DOMAIN (e.g. ".example.com") when web and API are sibling subdomains.
 */
export const authCookieOptions = (): CookieOptions => ({
  secure: config.env === "production",
  sameSite: config.env === "production" ? "none" : "lax",
  ...(config.cookieDomain && { domain: config.cookieDomain }),
});
