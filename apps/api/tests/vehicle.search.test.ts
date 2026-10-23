/**
 * Public vehicle search: attribute filters, sorting and the progressive
 * coordinate search (exact town -> 10/20/30 km rings -> district -> none).
 * Fixtures sit in the far north so other tests' vehicles never match.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";

const API = "/api/v1/vehicles";
const PREFIX = `veh-search-${Date.now()}`;
const TOWN = `${PREFIX}-town`;
const POINT = { lat: 9.82, lng: 80.23 };

describe("Vehicle search", () => {
  const ids = { owner: "", near: "", ring: "", luxury: "", paused: "" };
  let plateSeq = 1000;

  const search = (query: string) => request(app).get(`${API}?${query}`);
  const listed = (res: request.Response) => res.body.data.vehicles.map((v: { id: string }) => v.id);

  const make = (overrides: Record<string, unknown>) =>
    prisma.vehicle.create({
      data: {
        ownerId: ids.owner,
        name: `${PREFIX} bus`,
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: `VSZ-${++plateSeq}`,
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: TOWN,
        acType: "non-ac",
        images: [],
        amenities: [],
        ...overrides,
      },
    });

  const cleanup = async () => {
    const owners = (
      await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } })
    ).map((u) => u.id);
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: owners } } });
    await prisma.user.deleteMany({ where: { id: { in: owners } } });
  };

  beforeAll(async () => {
    await cleanup();
    ids.owner = (
      await prisma.user.create({
        data: {
          email: `${PREFIX}.owner@example.com`,
          password: "x",
          firstName: "Search",
          lastName: "Owner",
          role: "VEHICLE_OWNER",
          status: "ACTIVE",
          isVerified: true,
          district: `${PREFIX}-district`,
        },
      })
    ).id;
    ids.near = (await make({ seats: 25, pricePerDay: 12000, latitude: POINT.lat, longitude: POINT.lng })).id;
    ids.luxury = (
      await make({
        type: "LUXURY_AC",
        acType: "full-ac",
        seats: 50,
        pricePerDay: 40000,
        amenities: ["wifi", "usb"],
        latitude: POINT.lat + 0.01,
        longitude: POINT.lng,
      })
    ).id;
    ids.ring = (await make({ location: "Elsewhere", latitude: POINT.lat + 0.14, longitude: POINT.lng })).id;
    ids.paused = (await make({ isAvailable: false, latitude: POINT.lat, longitude: POINT.lng })).id;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("by town name", () => {
    it("filters by type, AC, amenities and seats", async () => {
      const res = await search(
        `location=${TOWN}&type=luxury&acType=FULL_AC&amenities=wifi,usb&minSeats=40&maxSeats=60`,
      );

      expect(res.status).toBe(200);
      expect(listed(res)).toEqual([ids.luxury]);
      expect(res.body.data.matchTier).toBe("exact");
    });

    it("sorts by price, capacity, rating and age", async () => {
      const cheapest = await search(`location=${TOWN}&sortBy=price&sortOrder=asc`);
      const biggest = await search(`location=${TOWN}&sortBy=capacity&sortOrder=desc`);
      const rated = await search(`location=${TOWN}&sortBy=rating`);
      const oldest = await search(`location=${TOWN}&sortBy=newest&sortOrder=asc`);

      expect(listed(cheapest)[0]).toBe(ids.near);
      expect(listed(biggest)[0]).toBe(ids.luxury);
      expect(rated.status).toBe(200);
      expect(listed(oldest)[0]).toBe(ids.near);
    });

    it("includes paused vehicles only when asked", async () => {
      const paused = await search(`location=${TOWN}&available=false`);

      expect(listed(paused)).toEqual([ids.paused]);
    });

    it("searches by district text when no coordinates are given", async () => {
      const res = await search(`district=${TOWN}&limit=2&page=1`);

      expect(res.body.data.pagination).toMatchObject({ limit: 2, total: 2 });
    });
  });

  describe("by coordinates", () => {
    it("prefers the exact town the customer typed", async () => {
      const res = await search(`lat=${POINT.lat}&lng=${POINT.lng}&location=${TOWN}`);

      expect(res.body.data.matchTier).toBe("exact");
      expect(listed(res)).not.toContain(ids.ring);
    });

    it("widens to the nearest ring that has buses", async () => {
      const near = await search(`lat=${POINT.lat}&lng=${POINT.lng}`);
      const ringOnly = await search(`lat=${POINT.lat + 0.14}&lng=${POINT.lng + 0.14}`);

      expect(near.body.data.matchTier).toBe("10km");
      expect(listed(near).sort()).toEqual([ids.near, ids.luxury].sort());
      expect(ringOnly.body.data.matchTier).toBe("20km");
      expect(listed(ringOnly)).toEqual([ids.ring]);
    });

    it("matches either end of a one-way trip", async () => {
      const res = await search(`lat=6.03&lng=80.21&lat2=${POINT.lat}&lng2=${POINT.lng}`);

      expect(res.body.data.matchTier).toBe("10km");
    });

    it("falls back to the owner's district, then to nothing", async () => {
      const far = { lat: 6.37, lng: 81.52 };
      const district = await search(`lat=${far.lat}&lng=${far.lng}&district=${PREFIX}-district`);
      const none = await search(`lat=${far.lat}&lng=${far.lng}&location=${PREFIX}-nowhere`);

      expect(district.body.data.matchTier).toBe("district");
      expect(listed(district)).toContain(ids.ring);
      expect(none.body.data).toMatchObject({ vehicles: [], matchTier: "none" });
    });

    it("ignores coordinates outside Sri Lanka", async () => {
      const res = await search(`lat=51.5&lng=-0.12&location=${TOWN}`);

      expect(res.body.data.matchTier).toBe("exact");
    });
  });
});
