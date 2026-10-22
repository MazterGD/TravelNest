/**
 * Security regression tests: client-supplied file URLs (OBJ-3). Only files
 * uploaded through TraveNest can be attached, and never another account's.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";

const API_BASE = "/api/v1";
const PREFIX = "sec.filerefs";
const VICTIM_NIC = "storage://private/registration/owner-documents/nic/victim.pdf";

describe("Client-supplied file references", () => {
  let attackerToken = "";

  const cleanup = () =>
    prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

  beforeAll(async () => {
    await cleanup();
    const victim = await prisma.user.create({
      data: {
        email: `${PREFIX}.victim@example.com`,
        password: "hashed",
        firstName: "Victim",
        lastName: "Owner",
        role: "VEHICLE_OWNER",
        status: "ACTIVE",
        documents: {
          create: {
            type: "NIC",
            url: VICTIM_NIC,
            fileName: "victim.pdf",
            fileSize: 1000,
            mimeType: "application/pdf",
          },
        },
      },
    });
    expect(victim.id).toBeTruthy();
    const attacker = await prisma.user.create({
      data: {
        email: `${PREFIX}.attacker@example.com`,
        password: "hashed",
        firstName: "Attacker",
        lastName: "Owner",
        role: "VEHICLE_OWNER",
        status: "ACTIVE",
      },
    });
    attackerToken = jwt.sign(
      { id: attacker.id, email: attacker.email, role: "VEHICLE_OWNER" },
      config.jwt.secret,
      { expiresIn: "1h" },
    );
  });

  afterAll(cleanup);

  const addDocument = (url: string) =>
    request(app)
      .post(`${API_BASE}/owner/documents`)
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({
        type: "NIC",
        url,
        fileName: "nic.pdf",
        fileSize: 1000,
        mimeType: "application/pdf",
      });

  it.each([
    "https://evil.example/phishing.pdf",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
  ])("rejects an external or script URL: %s", async (url) => {
    const response = await addDocument(url);

    expect(response.status).toBe(422);
  });

  it("rejects attaching another owner's stored document", async () => {
    const response = await addDocument(VICTIM_NIC);

    expect(response.status).toBe(403);
    const victimDocs = await prisma.ownerDocument.count({
      where: { url: VICTIM_NIC },
    });
    expect(victimDocs).toBe(1);
  });

  it("accepts the owner's own uploaded file", async () => {
    const response = await addDocument(
      "storage://private/registration/owner-documents/nic/attacker-own.pdf",
    );

    expect(response.status).toBe(201);
  });
});
