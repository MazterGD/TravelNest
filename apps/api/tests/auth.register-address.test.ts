/**
 * Registration keeps the customer's address details for their profile.
 */
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";
import { withRegistrationProof } from "./helpers";

const EMAIL = `register-address-${Date.now()}@example.com`;

describe("POST /auth/register with an address", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it("stores the sanitised address, city, district and postal code", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send(
        withRegistrationProof({
          email: EMAIL,
          password: "Secret123",
          firstName: "Nimal",
          lastName: "Perera",
          address: "12 Temple Road<script>x</script>",
          city: "Kandy",
          district: "Kandy",
          postalCode: "20000",
        }),
      );

    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(user).toMatchObject({ city: "Kandy", district: "Kandy", postalCode: "20000" });
    expect(user?.address).toContain("12 Temple Road");
    expect(user?.address).not.toContain("<script>");
  });

  it("rejects an over-long address", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send(withRegistrationProof({ email: `x${EMAIL}`, password: "Secret123", firstName: "Ab", lastName: "Cd", address: "x".repeat(201) }));

    expect(res.status).toBe(422);
  });
});
