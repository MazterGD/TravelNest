/**
 * Security regression tests: stored quotation routes can only be changed by
 * the quotation's parties (OBJ-2), and Socket.IO refuses cross-site
 * handshakes (OBJ-4).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import { initSocketServer } from "../src/realtime/socket";

const API_BASE = "/api/v1";
const PREFIX = "sec.routing";
const DAY = 24 * 60 * 60 * 1000;
const WAYPOINTS = [
  { lat: 6.9271, lng: 79.8612, name: "Colombo" },
  { lat: 7.2906, lng: 80.6337, name: "Kandy" },
];

describe("Route persistence authorization", () => {
  let ownQuoteId = "";
  let acceptedQuoteId = "";
  const tokens = { customer: "", stranger: "" };

  const cleanup = () =>
    prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

  beforeAll(async () => {
    await cleanup();
    for (const key of Object.keys(tokens) as (keyof typeof tokens)[]) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: "hashed",
          firstName: "Route",
          lastName: key,
          role: "CUSTOMER",
          status: "ACTIVE",
        },
      });
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role: "CUSTOMER" },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
      if (key === "customer") {
        const base = {
          customerId: user.id,
          startDate: new Date(Date.now() + 10 * DAY),
          endDate: new Date(Date.now() + 11 * DAY),
          pickupLocation: "Colombo",
          dropoffLocation: "Kandy",
          estimatedDistance: "120 km",
        };
        ownQuoteId = (
          await prisma.quotation.create({
            data: { ...base, quotationId: `QUO-SEC-R-${Date.now()}-1` },
          })
        ).id;
        acceptedQuoteId = (
          await prisma.quotation.create({
            data: {
              ...base,
              quotationId: `QUO-SEC-R-${Date.now()}-2`,
              status: "ACCEPTED",
            },
          })
        ).id;
      }
    }
  });

  afterAll(cleanup);

  const calculate = (token: string, quotationId: string) =>
    request(app)
      .post(`${API_BASE}/routing/calculate`)
      .set("Authorization", `Bearer ${token}`)
      .send({ waypoints: WAYPOINTS, quotationId });

  it("refuses to overwrite another customer's quotation route", async () => {
    const response = await calculate(tokens.stranger, ownQuoteId);

    expect(response.status).toBe(403);
    const quote = await prisma.quotation.findUnique({
      where: { id: ownQuoteId },
    });
    expect(quote?.estimatedDistance).toBe("120 km");
  });

  it("freezes the route once the quotation is accepted", async () => {
    const response = await calculate(tokens.customer, acceptedQuoteId);

    expect(response.status).toBe(400);
  });
});

describe("Socket.IO origin check", () => {
  let server: http.Server;

  beforeAll(async () => {
    server = http.createServer(app);
    initSocketServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const handshake = (origin?: string) => {
    const req = request(server).get("/socket.io/?EIO=4&transport=polling");
    return origin ? req.set("Origin", origin) : req;
  };

  it("rejects a handshake from another site", async () => {
    const response = await handshake("https://evil.example");

    expect(response.status).toBe(403);
  });

  it("accepts a handshake from the web app origin", async () => {
    const response = await handshake(config.corsOrigin);

    expect(response.status).toBe(200);
  });
});
