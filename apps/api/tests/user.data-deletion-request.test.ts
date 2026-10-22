/**
 * Full data deletion requests go to support (ADR-006).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const EMAIL = "data.deletion.request@example.com";

describe("POST /users/data-deletion-request", () => {
  let token = "";
  let userId = "";

  beforeAll(async () => {
    await prisma.contactMessage.deleteMany({ where: { email: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        password: "hashed",
        firstName: "Erase",
        lastName: "Me",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    userId = user.id;
    token = jwt.sign(
      { id: user.id, email: EMAIL, role: "CUSTOMER" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
  });

  afterAll(async () => {
    await prisma.contactMessage.deleteMany({ where: { email: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it("files a support request with the account details", async () => {
    const response = await request(app)
      .post(`${API_BASE}/users/data-deletion-request`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Moving abroad" });

    expect(response.status).toBe(200);
    expect(response.body.data.reference).toMatch(/^CN-/);

    const message = await prisma.contactMessage.findFirst({
      where: { email: EMAIL },
    });
    expect(message?.subject).toBe("Data deletion request");
    expect(message?.message).toContain(userId);
    expect(message?.message).toContain("Moving abroad");
  });

  it("requires sign-in", async () => {
    const response = await request(app)
      .post(`${API_BASE}/users/data-deletion-request`)
      .send({});

    expect(response.status).toBe(401);
  });
});
