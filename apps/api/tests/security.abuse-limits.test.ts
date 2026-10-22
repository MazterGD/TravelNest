/**
 * Abuse limits on anonymous and public endpoints (OBJ-5, OBJ-7, OBJ-8).
 * Rate limiters only run in production, so those tests switch the runtime
 * environment for their requests.
 */
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const CONTACT_EMAIL = "abuse.limits.contact@example.com";

const asProduction = async <T>(fn: () => Promise<T>): Promise<T> => {
  const runtime = config as { env: string };
  const original = runtime.env;
  runtime.env = "production";
  try {
    return await fn();
  } finally {
    runtime.env = original;
  }
};

describe("Public review lists", () => {
  it("caps the page size", async () => {
    const response = await request(app).get(
      `${API_BASE}/reviews/vehicle/cnonexistentvehicle0000000?limit=1000000`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.limit).toBe(50);
  });

  it("ignores non-numeric paging instead of failing", async () => {
    const response = await request(app).get(
      `${API_BASE}/reviews/vehicle/cnonexistentvehicle0000000?limit=abc&page=-3`,
    );

    expect(response.status).toBe(200);
  });
});

describe("Anonymous endpoint rate limits", () => {
  afterAll(async () => {
    await prisma.contactMessage.deleteMany({ where: { email: CONTACT_EMAIL } });
  });

  it("throttles the contact form per client", async () => {
    const statuses = await asProduction(async () => {
      const results: number[] = [];
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post(`${API_BASE}/landing/contact`)
          .send({
            name: "Abuse Tester",
            email: CONTACT_EMAIL,
            subject: "Spam check",
            message: "This is a rate limit regression test message.",
          });
        results.push(response.status);
      }
      return results;
    });

    expect(statuses.slice(0, 5).every((status) => status === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("throttles anonymous registration uploads per client", async () => {
    const last = await asProduction(async () => {
      let status = 0;
      for (let i = 0; i < 61; i++) {
        const response = await request(app)
          .post(`${API_BASE}/uploads/registration`)
          .field("category", "vehicle-photos");
        status = response.status;
      }
      return status;
    });

    expect(last).toBe(429);
  });
});
