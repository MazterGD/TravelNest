/**
 * Google/Facebook sign-in: starting the flow, the Facebook callback and
 * profile exchange, and signing in with a provider profile. Provider calls
 * are mocked through fetch; nothing reaches the network.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import {
  createOAuthStateToken,
  getFacebookProfileFromCode,
  loginWithOAuthProfile,
} from "../src/modules/auth/auth.service";

const API_BASE = "/api/v1";
const PREFIX = `oauth-flow-${Date.now()}`;
const original = {
  google: { ...config.oauth.google },
  facebook: { ...config.oauth.facebook },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const configure = () => {
  Object.assign(config.oauth.google, {
    clientId: "google-client",
    clientSecret: "google-secret",
    redirectUri: "http://localhost:5000/api/v1/auth/oauth/google/callback",
  });
  Object.assign(config.oauth.facebook, {
    clientId: "fb-client",
    clientSecret: "fb-secret",
    redirectUri: "http://localhost:5000/api/v1/auth/oauth/facebook/callback",
  });
};

const appCallback = `${config.appUrl.replace(/\/$/, "")}/auth/callback`;
const query = (location: string | undefined) => new URL(location ?? "http://x").searchParams;

afterEach(() => {
  Object.assign(config.oauth.google, original.google);
  Object.assign(config.oauth.facebook, original.facebook);
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe("starting the OAuth flow", () => {
  it.each([
    ["google", "https://accounts.google.com/o/oauth2/v2/auth", "google-client"],
    ["facebook", "https://www.facebook.com/v18.0/dialog/oauth", "fb-client"],
  ])("redirects to %s with a state bound to a nonce cookie", async (provider, url, clientId) => {
    configure();

    const res = await request(app).get(`${API_BASE}/auth/oauth/${provider}`);

    expect(res.status).toBe(302);
    expect(res.headers.location.startsWith(url)).toBe(true);
    const params = query(res.headers.location);
    expect(params.get("client_id")).toBe(clientId);
    expect(params.get("state")).toBeTruthy();
    expect(String(res.headers["set-cookie"])).toMatch(/oauthNonce=[0-9a-f]{32}; .*HttpOnly/);
  });

  it("only returns to the web app's own origin", async () => {
    configure();
    const { verifyOAuthStateToken } = await import("../src/modules/auth/auth.service");

    const returnToOf = async (returnTo: string) => {
      const res = await request(app)
        .get(`${API_BASE}/auth/oauth/google`)
        .query({ returnTo });
      return verifyOAuthStateToken(query(res.headers.location).get("state")!).returnTo;
    };

    expect(await returnToOf("https://evil.example.com/steal")).toBe(appCallback);
    expect(await returnToOf("not a url")).toBe(appCallback);
    expect(await returnToOf("/en/dashboard")).toBe(
      `${config.appUrl.replace(/\/$/, "")}/en/dashboard`,
    );
  });

  it.each(["google", "facebook"])("fails clearly when %s is not configured", async (provider) => {
    Object.assign(config.oauth.google, { clientId: "" });
    Object.assign(config.oauth.facebook, { clientId: "" });

    const res = await request(app).get(`${API_BASE}/auth/oauth/${provider}`);

    expect(res.status).toBe(500);
  });
});

describe("Facebook callback", () => {
  const CALLBACK = `${API_BASE}/auth/oauth/facebook/callback`;
  const state = (nonce: string) =>
    createOAuthStateToken({ provider: "facebook", returnTo: appCallback, nonce });
  const callback = (params: string) =>
    request(app).get(`${CALLBACK}?state=${state("n1")}${params}`).set("Cookie", "oauthNonce=n1");

  it("signs a new customer in and sets the refresh cookie, not a URL token", async () => {
    configure();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ access_token: "fb-token" }))
      .mockResolvedValueOnce(
        json({
          email: `${PREFIX}.fb@example.com`,
          first_name: "Kamal",
          last_name: "Silva",
          picture: { data: { url: "https://cdn.example.com/kamal.jpg" } },
        }),
      );

    const res = await callback("&code=good");

    expect(res.status).toBe(302);
    expect(query(res.headers.location).get("provider")).toBe("facebook");
    expect(res.headers.location).not.toContain("Token");
    expect(String(res.headers["set-cookie"])).toContain("refreshToken=");
    const user = await prisma.user.findUnique({ where: { email: `${PREFIX}.fb@example.com` } });
    expect(user).toMatchObject({ role: "CUSTOMER", isVerified: true, firstName: "Kamal" });
  });

  it.each([
    ["a provider error", "&error=access_denied", "OAUTH_DENIED"],
    ["a missing code", "", "MISSING_CODE"],
  ])("reports %s", async (_label, params, code) => {
    expect(query((await callback(params)).headers.location).get("error")).toBe(code);
  });

  it("reports a failed profile exchange", async () => {
    configure();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ error: "bad code" }, 400));

    const res = await callback("&code=bad");

    expect(query(res.headers.location).get("error")).toBe("PROFILE_ERROR");
  });

  it("rejects a state from another browser", async () => {
    const res = await request(app).get(`${CALLBACK}?code=x&state=${state("n1")}`);

    expect(query(res.headers.location).get("error")).toBe("INVALID_STATE");
  });
});

describe("getFacebookProfileFromCode", () => {
  it("needs Facebook to be configured", async () => {
    Object.assign(config.oauth.facebook, { clientId: "" });

    await expect(getFacebookProfileFromCode("c")).rejects.toMatchObject({ statusCode: 500 });
  });

  it("fills in default names and no avatar", async () => {
    configure();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ access_token: "t" }))
      .mockResolvedValueOnce(json({ email: "someone@example.com" }));

    await expect(getFacebookProfileFromCode("c")).resolves.toEqual({
      email: "someone@example.com",
      firstName: "TraveNest",
      lastName: "User",
      avatarUrl: null,
    });
  });

  it.each([
    ["the code exchange fails", [json({}, 400)], /exchange/],
    ["no access token comes back", [json({})], /access token missing/],
    ["the profile request fails", [json({ access_token: "t" }), json({}, 500)], /profile/],
    ["the profile has no email", [json({ access_token: "t" }), json({ first_name: "A" })], /email/],
  ])("rejects when %s", async (_label, responses, message) => {
    configure();
    const spy = vi.spyOn(globalThis, "fetch");
    for (const response of responses) spy.mockResolvedValueOnce(response);

    await expect(getFacebookProfileFromCode("c")).rejects.toThrow(message);
  });
});

describe("loginWithOAuthProfile", () => {
  const profile = (key: string) => ({
    email: `  ${PREFIX}.${key}@EXAMPLE.com `,
    firstName: "Nimal<script>x</script>",
    lastName: " ",
    avatarUrl: "https://cdn.example.com/a.jpg",
  });

  const existing = async (key: string, data: Record<string, unknown>) =>
    prisma.user.create({
      data: {
        email: `${PREFIX}.${key}@example.com`.toLowerCase(),
        password: "hashed",
        firstName: key,
        lastName: "Tester",
        role: "CUSTOMER",
        status: "ACTIVE",
        ...data,
      },
    });

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  it("creates a sanitised customer for a new email", async () => {
    const result = await loginWithOAuthProfile(profile("new"));

    expect(result.user).toMatchObject({
      email: `${PREFIX}.new@example.com`.toLowerCase(),
      lastName: "User",
      role: "CUSTOMER",
    });
    expect(result.user.firstName).not.toContain("<script>");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it("signs an existing customer in, clearing failed attempts and keeping their avatar", async () => {
    await existing("cust", { failedLoginAttempts: 3, avatar: "https://cdn.example.com/own.jpg", isVerified: false });

    const result = await loginWithOAuthProfile(profile("cust"));

    const row = await prisma.user.findUnique({ where: { id: result.user.id } });
    expect(row).toMatchObject({
      failedLoginAttempts: 0,
      avatar: "https://cdn.example.com/own.jpg",
      isVerified: true,
    });
  });

  it("does not verify a vehicle owner through social sign-in", async () => {
    await existing("owner", { role: "VEHICLE_OWNER", isVerified: false, status: "PENDING_VERIFICATION" });

    const result = await loginWithOAuthProfile(profile("owner"));

    expect((await prisma.user.findUnique({ where: { id: result.user.id } }))?.isVerified).toBe(false);
  });

  it.each([
    ["a locked account", { lockedUntil: new Date(Date.now() + 5 * 60_000) }, /locked/],
    ["a suspended account", { status: "SUSPENDED" }, /suspended/],
    ["an inactive account", { status: "INACTIVE" }, /not active/],
  ])("refuses %s", async (label, data, message) => {
    const key = label.replace(/\W/g, "");
    await existing(key, data);

    await expect(loginWithOAuthProfile(profile(key))).rejects.toThrow(message);
  });
});
