/**
 * OAuth callback hardening (AUTH-5, AUTH-6): state is mandatory and bound to
 * the starting browser, tokens never travel in the redirect URL, and Google
 * logins require a verified email.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../src/app";
import { config } from "../src/config/index";
import {
  createOAuthStateToken,
  getGoogleProfileFromCode,
} from "../src/modules/auth/auth.service";

const API_BASE = "/api/v1";
const CALLBACK = `${API_BASE}/auth/oauth/google/callback`;

const stateFor = (nonce: string, provider: "google" | "facebook" = "google") =>
  createOAuthStateToken({
    provider,
    returnTo: `${config.appUrl.replace(/\/$/, "")}/auth/callback`,
    nonce,
  });

const errorOf = (location: string | undefined) =>
  location ? new URL(location).searchParams.get("error") : null;

describe("OAuth callback state", () => {
  it("rejects a callback without state", async () => {
    const response = await request(app).get(`${CALLBACK}?code=abc`);

    expect(response.status).toBe(302);
    expect(errorOf(response.headers.location)).toBe("INVALID_STATE");
  });

  it("rejects a valid state from another browser (no nonce cookie)", async () => {
    const response = await request(app).get(
      `${CALLBACK}?code=abc&state=${stateFor("nonce-1")}`,
    );

    expect(errorOf(response.headers.location)).toBe("INVALID_STATE");
  });

  it("rejects a state whose nonce does not match the cookie", async () => {
    const response = await request(app)
      .get(`${CALLBACK}?code=abc&state=${stateFor("nonce-1")}`)
      .set("Cookie", "oauthNonce=other-nonce");

    expect(errorOf(response.headers.location)).toBe("INVALID_STATE");
  });

  it("rejects a state issued for a different provider", async () => {
    const response = await request(app)
      .get(`${CALLBACK}?code=abc&state=${stateFor("nonce-1", "facebook")}`)
      .set("Cookie", "oauthNonce=nonce-1");

    expect(errorOf(response.headers.location)).toBe("INVALID_STATE");
  });

  it("accepts a state bound to this browser", async () => {
    const response = await request(app)
      .get(`${CALLBACK}?state=${stateFor("nonce-1")}`)
      .set("Cookie", "oauthNonce=nonce-1");

    // Past the state check, the missing code is the next failure.
    expect(errorOf(response.headers.location)).toBe("MISSING_CODE");
    expect(response.headers.location).not.toContain("accessToken");
  });
});

describe("Google profile verification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockGoogle = (profile: Record<string, unknown>) => {
    const google = config.oauth.google as { clientId: string; clientSecret: string };
    google.clientId ||= "test-client";
    google.clientSecret ||= "test-secret";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "google-token" })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(profile)));
  };

  it("rejects an unverified Google email", async () => {
    mockGoogle({ email: "victim@example.com", email_verified: false });

    await expect(getGoogleProfileFromCode("code")).rejects.toThrow(
      "Google account email is not verified",
    );
  });

  it("accepts a verified Google email", async () => {
    mockGoogle({
      email: "verified@example.com",
      email_verified: true,
      given_name: "Verified",
      family_name: "User",
    });

    await expect(getGoogleProfileFromCode("code")).resolves.toMatchObject({
      email: "verified@example.com",
    });
  });
});
