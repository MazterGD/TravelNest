/**
 * Admin vehicle list (ADM-11): guarded like the other admin modules and
 * validated so bad paging cannot reach Prisma.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "admin.vehicles.access";

describe("GET /admin/vehicles", () => {
  const tokens: Record<string, string> = {};

  const cleanup = () =>
    prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

  beforeAll(async () => {
    await cleanup();
    for (const adminRole of ["SUPER_ADMIN", "SUPPORT_ADMIN"] as const) {
      const admin = await prisma.user.create({
        data: {
          email: `${PREFIX}.${adminRole.toLowerCase()}@example.com`,
          password: "hashed",
          firstName: "Vehicles",
          lastName: adminRole,
          role: "ADMIN",
          adminRole,
          status: "ACTIVE",
        },
      });
      tokens[adminRole] = jwt.sign(
        { id: admin.id, email: admin.email, role: "ADMIN" },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }
  });

  afterAll(cleanup);

  const list = (role: string, query = "") =>
    request(app)
      .get(`${API_BASE}/admin/vehicles${query}`)
      .set("Authorization", `Bearer ${tokens[role]}`);

  it("requires the verifications read permission", async () => {
    expect((await list("SUPPORT_ADMIN")).status).toBe(403);
  });

  it("lists vehicles for a super admin", async () => {
    expect((await list("SUPER_ADMIN")).status).toBe(200);
  });

  it("rejects invalid paging instead of failing", async () => {
    expect((await list("SUPER_ADMIN", "?limit=-5&page=0")).status).toBe(422);
    expect((await list("SUPER_ADMIN", "?type=NOT_A_TYPE")).status).toBe(422);
  });
});
