/**
 * Public landing endpoints: aggregated landing data, public config with
 * admin-configured overrides vs computed defaults, about stats, contact form
 * (persists + notifies admins) and the heuristic route estimate.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import type { Prisma } from "@prisma/client";
import { prisma } from "./setup";
import app from "../src/app";
import { landingService } from "../src/modules/landing/landing.service";

const API_BASE = "/api/v1";
const PREFIX = "landing.public";
const TAG = `lp${Date.now().toString(36)}`;
const DAY = 24 * 60 * 60 * 1000;

const CONFIG_KEYS = [
  "contact_info",
  "social_media_links",
  "google_maps_embed",
  "about_page_stats",
  "login_marketing_stats",
  "contact_page_faqs",
  "vehicle_types",
  "ac_types",
  "vehicle_conditions",
  "vehicle_amenities",
  "districts",
  "quotation_vehicle_types",
  "recent_searches",
  "quotation_pricing",
];

describe("Public landing API", () => {
  let configSnapshot: Array<{
    key: string;
    value: Prisma.JsonValue;
    description: string | null;
    isActive: boolean;
  }> = [];
  const ids = {
    vehiclePhoto: "",
    vehicleImage: "",
    vehicleBare: "",
    package: "",
    activeTestimonial: "",
    inactiveTestimonial: "",
    removedTestimonial: "",
    publishedFaq: "",
    draftFaq: "",
    removedFaq: "",
    admin: "",
  };

  const restoreConfigs = async () => {
    await prisma.platformConfig.deleteMany({ where: { key: { in: CONFIG_KEYS } } });
    if (configSnapshot.length > 0) {
      await prisma.platformConfig.createMany({
        data: configSnapshot.map((row) => ({
          ...row,
          value: row.value as Prisma.InputJsonValue,
        })),
      });
    }
  };

  const cleanup = async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerId: { in: userIds } },
      select: { id: true },
    });
    const vehicleIds = vehicles.map((v) => v.id);
    await prisma.review.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.booking.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.tripPackage.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehiclePhoto.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.contactMessage.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.testimonial.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.faq.deleteMany({ where: { question: { startsWith: TAG } } });
    await prisma.platformStat.deleteMany({ where: { key: { startsWith: TAG } } });
    await prisma.popularRoute.deleteMany({ where: { fromCity: { startsWith: TAG } } });
    await prisma.trustedPartner.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  };

  const createUser = (label: string, role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER", district?: string) =>
    prisma.user.create({
      data: {
        email: `${PREFIX}.${label}.${TAG}@example.com`,
        password: "hashed",
        firstName: "Landing",
        lastName: label,
        role,
        adminRole: role === "ADMIN" ? "SUPPORT_ADMIN" : undefined,
        status: "ACTIVE",
        district,
      },
    });

  const createVehicle = (ownerId: string, label: string, extra: Partial<Prisma.VehicleUncheckedCreateInput> = {}) =>
    prisma.vehicle.create({
      data: {
        ownerId,
        name: `${TAG} ${label}`,
        type: "LUXURY_AC",
        brand: "Lanka",
        model: "Coach",
        year: 2022,
        licensePlate: `${TAG}-${label}`.toUpperCase(),
        seats: 40,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 25000,
        location: "Colombo",
        images: [],
        amenities: ["wifi"],
        ...extra,
      },
    });

  beforeAll(async () => {
    await cleanup();
    configSnapshot = await prisma.platformConfig.findMany({
      where: { key: { in: CONFIG_KEYS } },
      select: { key: true, value: true, description: true, isActive: true },
    });
    await prisma.platformConfig.deleteMany({ where: { key: { in: CONFIG_KEYS } } });

    const admin = await createUser("admin", "ADMIN");
    ids.admin = admin.id;
    const owner = await createUser("owner", "VEHICLE_OWNER", `${TAG}-district`);
    const customer = await createUser("customer", "CUSTOMER");

    const withPhoto = await createVehicle(owner.id, "photo", { acType: "full-ac" });
    const withImage = await createVehicle(owner.id, "image", { images: ["https://cdn.example.com/b.webp"] });
    const bare = await createVehicle(owner.id, "bare");
    await createVehicle(owner.id, "inactive", { isActive: false });
    ids.vehiclePhoto = withPhoto.id;
    ids.vehicleImage = withImage.id;
    ids.vehicleBare = bare.id;

    await prisma.vehiclePhoto.create({
      data: {
        vehicleId: withPhoto.id,
        url: "https://cdn.example.com/a.webp",
        fileName: "a.webp",
        fileSize: 100,
        mimeType: "image/webp",
      },
    });

    const pkg = await prisma.tripPackage.create({
      data: {
        ownerId: owner.id,
        vehicleId: withPhoto.id,
        title: `${TAG} package`,
        startLocation: "Colombo",
        endLocation: "Kandy",
        durationDays: 2,
        price: 60000,
        minPassengers: 10,
        maxPassengers: 40,
      },
    });
    ids.package = pkg.id;

    const book = (vehicleId: string, offsetDays: number, tripPackageId?: string) =>
      prisma.booking.create({
        data: {
          customerId: customer.id,
          vehicleId,
          tripPackageId,
          startDate: new Date(Date.now() + offsetDays * DAY),
          endDate: new Date(Date.now() + (offsetDays + 1) * DAY),
          pickupLocation: "Colombo",
          totalAmount: 20000,
          status: "COMPLETED",
        },
      });

    const b1 = await book(withPhoto.id, 3, pkg.id);
    const b2 = await book(withPhoto.id, 5);
    await book(withImage.id, 7);
    await book(bare.id, 9);
    await prisma.review.createMany({
      data: [
        { customerId: customer.id, vehicleId: withPhoto.id, bookingId: b1.id, rating: 4 },
        { customerId: customer.id, vehicleId: withPhoto.id, bookingId: b2.id, rating: 5 },
      ],
    });

    const testimonial = (label: string, extra: Partial<Prisma.TestimonialCreateInput> = {}) =>
      prisma.testimonial.create({
        data: {
          name: `${TAG} ${label}`,
          role: "Teacher",
          organization: "School",
          imageUrl: "https://cdn.example.com/t.webp",
          quote: "Smooth trip to Ella",
          ...extra,
        },
      });
    ids.activeTestimonial = (await testimonial("active", { sortOrder: -1000 })).id;
    ids.inactiveTestimonial = (await testimonial("inactive", { isActive: false, sortOrder: -1000 })).id;
    ids.removedTestimonial = (
      await testimonial("removed", { isRemoved: true, removedAt: new Date(), sortOrder: -1000 })
    ).id;

    const faq = (label: string, extra: Partial<Prisma.FaqCreateInput> = {}) =>
      prisma.faq.create({
        data: { question: `${TAG} ${label}?`, answer: "Answer text", sortOrder: -1000, ...extra },
      });
    ids.publishedFaq = (await faq("published", { category: "Booking" })).id;
    ids.draftFaq = (await faq("draft", { isPublished: false })).id;
    ids.removedFaq = (await faq("removed", { isRemoved: true, removedAt: new Date() })).id;

    await prisma.platformStat.createMany({
      data: [
        { key: `${TAG}_b`, value: "20+", label: "Second", sortOrder: -999 },
        { key: `${TAG}_a`, value: "10+", label: "First", sortOrder: -1000 },
        { key: `${TAG}_off`, value: "0", label: "Hidden", sortOrder: -1001, isActive: false },
      ],
    });
    await prisma.popularRoute.create({
      data: {
        fromCity: `${TAG} Colombo`,
        toCity: "Galle",
        durationHours: 2.5,
        avgPrice: 30000,
        bookingsCount: 1_000_000,
        imageUrl: "https://cdn.example.com/r.webp",
      },
    });
    await prisma.trustedPartner.create({ data: { name: `${TAG} Partner`, sortOrder: -1000 } });
  });

  afterAll(async () => {
    await restoreConfigs();
    await cleanup();
  });

  describe("GET /landing", () => {
    it("aggregates active content and ranks vehicles and packages by bookings", async () => {
      const response = await request(app).get(`${API_BASE}/landing`);

      expect(response.status).toBe(200);
      const data = response.body.data;

      const statKeys = data.stats.map((s: { key: string }) => s.key);
      expect(statKeys.indexOf(`${TAG}_a`)).toBeLessThan(statKeys.indexOf(`${TAG}_b`));
      expect(statKeys).not.toContain(`${TAG}_off`);

      expect(data.popularRoutes[0].fromCity).toBe(`${TAG} Colombo`);
      expect(data.trustedPartners.map((p: { name: string }) => p.name)).toContain(`${TAG} Partner`);

      const testimonialIds = data.testimonials.map((t: { id: string }) => t.id);
      expect(testimonialIds).toContain(ids.activeTestimonial);
      expect(testimonialIds).not.toContain(ids.inactiveTestimonial);
      expect(testimonialIds).not.toContain(ids.removedTestimonial);

      const featured = data.featuredVehicles as Array<Record<string, unknown>>;
      expect(featured[0].id).toBe(ids.vehiclePhoto);
      const byId = Object.fromEntries(featured.map((v) => [v.id, v]));
      expect(byId[ids.vehiclePhoto]).toMatchObject({
        imageUrl: "https://cdn.example.com/a.webp",
        ownerName: "Landing owner",
        rating: 4.5,
        reviewsCount: 2,
      });
      expect(byId[ids.vehicleImage]).toMatchObject({
        imageUrl: "https://cdn.example.com/b.webp",
        rating: 0,
        reviewsCount: 0,
      });
      expect(byId[ids.vehicleBare]).toMatchObject({ imageUrl: null });

      expect(data.popularPackages[0]).toMatchObject({
        id: ids.package,
        startLocation: "Colombo",
        endLocation: "Kandy",
        bookingCount: 1,
      });
    });

    it("exposes active platform stats through the service helper", async () => {
      const stats = await landingService.getStats();
      const keys = stats.map((s) => s.key);
      expect(keys).toContain(`${TAG}_a`);
      expect(keys).not.toContain(`${TAG}_off`);
    });
  });

  describe("GET /landing/config", () => {
    it("falls back to defaults derived from live data when nothing is configured", async () => {
      const response = await request(app).get(`${API_BASE}/landing/config`);

      expect(response.status).toBe(200);
      const data = response.body.data;
      expect(data.contactInfo.email).toBe("support@travelnest.lk");
      expect(data.socialMediaLinks.facebook).toContain("facebook.com");
      expect(data.googleMapsEmbed.zoom).toBe(15);
      expect(data.aboutStats).toHaveLength(4);
      expect(data.loginMarketingStats.verifiedBuses).toBe("500+");
      expect(data.recentSearches).toEqual([]);
      expect(data.quotationPricing.validityOptionsDays).toEqual([]);

      expect(data.options.vehicleTypes).toContainEqual({ value: "LUXURY_AC", label: "LUXURY_AC" });
      expect(data.options.quotationVehicleTypes).toEqual(data.options.vehicleTypes);
      expect(data.options.acTypes).toContainEqual({ value: "FULL_AC", label: "full-ac" });
      expect(data.options.districts).toContain(`${TAG}-district`);
      expect(data.options.conditions.map((c: { value: string }) => c.value)).toEqual([
        "excellent",
        "good",
        "fair",
      ]);
      expect(data.options.amenities.some((a: { id: string }) => a.id === "wifi")).toBe(true);

      const faqIds = data.faqs.map((f: { id: string }) => f.id);
      expect(faqIds).toContain(ids.publishedFaq);
      expect(faqIds).not.toContain(ids.draftFaq);
      expect(faqIds).not.toContain(ids.removedFaq);
    });

    it("prefers active admin-configured values and ignores inactive ones", async () => {
      const overrides: Record<string, Prisma.InputJsonValue> = {
        contact_info: { email: "help@example.lk" },
        social_media_links: { facebook: "https://facebook.com/override" },
        google_maps_embed: { zoom: 9 },
        about_page_stats: [{ label: "Buses", value: "9" }],
        login_marketing_stats: { verifiedBuses: "9+" },
        contact_page_faqs: [{ id: "c1", question: "Q?", answer: "A" }],
        vehicle_types: [{ value: "ORDINARY", label: "Ordinary" }],
        ac_types: [{ value: "NON_AC", label: "Non AC" }],
        vehicle_conditions: [{ value: "new", label: "New" }],
        vehicle_amenities: [{ id: "tv", label: "TV" }],
        districts: ["Galle"],
        quotation_vehicle_types: [{ value: "SEMI_LUXURY", label: "Semi" }],
        recent_searches: [{ id: "r1", from: "A", to: "B", date: "2026-01-01", passengers: 4 }],
        quotation_pricing: { taxRate: 0.18 },
      };
      await prisma.platformConfig.createMany({
        data: Object.entries(overrides).map(([key, value]) => ({
          key,
          value,
          isActive: key !== "districts",
        })),
      });

      try {
        const response = await request(app).get(`${API_BASE}/landing/config`);

        expect(response.status).toBe(200);
        const data = response.body.data;
        expect(data.contactInfo).toEqual(overrides.contact_info);
        expect(data.socialMediaLinks).toEqual(overrides.social_media_links);
        expect(data.googleMapsEmbed).toEqual(overrides.google_maps_embed);
        expect(data.aboutStats).toEqual(overrides.about_page_stats);
        expect(data.loginMarketingStats).toEqual(overrides.login_marketing_stats);
        expect(data.faqs).toEqual(overrides.contact_page_faqs);
        expect(data.options.vehicleTypes).toEqual(overrides.vehicle_types);
        expect(data.options.acTypes).toEqual(overrides.ac_types);
        expect(data.options.conditions).toEqual(overrides.vehicle_conditions);
        expect(data.options.amenities).toEqual(overrides.vehicle_amenities);
        expect(data.options.quotationVehicleTypes).toEqual(overrides.quotation_vehicle_types);
        expect(data.recentSearches).toEqual(overrides.recent_searches);
        expect(data.quotationPricing).toEqual(overrides.quotation_pricing);
        expect(data.options.districts).not.toEqual(["Galle"]);
        expect(data.options.districts).toContain(`${TAG}-district`);
      } finally {
        await prisma.platformConfig.deleteMany({ where: { key: { in: CONFIG_KEYS } } });
      }
    });
  });

  describe("GET /landing/about-stats", () => {
    const setAboutConfig = async (value: Prisma.InputJsonValue, isActive: boolean) => {
      await prisma.platformConfig.deleteMany({ where: { key: "about_page_stats" } });
      await prisma.platformConfig.create({ data: { key: "about_page_stats", value, isActive } });
    };

    afterAll(async () => {
      await prisma.platformConfig.deleteMany({ where: { key: "about_page_stats" } });
    });

    it("uses the first four active platform stats when no config exists", async () => {
      await prisma.platformConfig.deleteMany({ where: { key: "about_page_stats" } });

      const response = await request(app).get(`${API_BASE}/landing/about-stats`);

      expect(response.status).toBe(200);
      const stats = response.body.data.stats;
      expect(stats.length).toBeLessThanOrEqual(4);
      expect(stats[0]).toEqual({ label: "First", value: "10+", icon: `${TAG}_a` });
      expect(stats[1]).toEqual({ label: "Second", value: "20+", icon: `${TAG}_b` });
    });

    it("returns the configured stats when the config is active and a list", async () => {
      const configured = [{ label: "Buses", value: "42", icon: "bus" }];
      await setAboutConfig(configured, true);

      const response = await request(app).get(`${API_BASE}/landing/about-stats`);

      expect(response.body.data.stats).toEqual(configured);
    });

    it("ignores an inactive or malformed config", async () => {
      await setAboutConfig([{ label: "Buses", value: "42" }], false);
      const inactive = await request(app).get(`${API_BASE}/landing/about-stats`);
      await setAboutConfig({ label: "not-a-list" }, true);
      const malformed = await request(app).get(`${API_BASE}/landing/about-stats`);

      expect(inactive.body.data.stats[0].icon).toBe(`${TAG}_a`);
      expect(malformed.body.data.stats[0].icon).toBe(`${TAG}_a`);
    });
  });

  describe("POST /landing/contact", () => {
    it("stores the message and notifies admins", async () => {
      const email = `${PREFIX}.visitor.${TAG}@example.com`;
      const response = await request(app).post(`${API_BASE}/landing/contact`).send({
        name: "Nimal Perera",
        email,
        phone: "+94771112223",
        subject: "Group trip",
        message: "We need a bus for 40 people to Kandy.",
      });

      expect(response.status).toBe(200);
      expect(response.body.data.accepted).toBe(true);
      const reference = response.body.data.reference as string;
      expect(reference).toMatch(/^CN-\d+$/);

      const stored = await prisma.contactMessage.findUnique({ where: { referenceId: reference } });
      expect(stored).toMatchObject({ name: "Nimal Perera", email, subject: "Group trip" });

      await vi.waitFor(
        async () => {
          const notification = await prisma.notification.findFirst({
            where: { userId: ids.admin, type: "contact_message" },
          });
          expect(notification?.title).toBe("Contact: Group trip");
        },
        { timeout: 5000, interval: 100 },
      );
    });

    it("skips admin notifications when there are no admins", async () => {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await prisma.user.updateMany({
        where: { id: { in: admins.map((a) => a.id) } },
        data: { role: "CUSTOMER" },
      });

      try {
        const email = `${PREFIX}.noadmin.${TAG}@example.com`;
        const response = await request(app).post(`${API_BASE}/landing/contact`).send({
          name: "Kamala",
          email,
          subject: "Hello",
          message: "Just saying hello to the team.",
        });

        expect(response.status).toBe(200);
        expect(await prisma.contactMessage.count({ where: { email } })).toBe(1);
      } finally {
        await prisma.user.updateMany({
          where: { id: { in: admins.map((a) => a.id) } },
          data: { role: "ADMIN" },
        });
      }
    });

    it("rejects an invalid submission without storing it", async () => {
      const email = `${PREFIX}.invalid.${TAG}@example.com`;
      const response = await request(app).post(`${API_BASE}/landing/contact`).send({
        name: "N",
        email,
        subject: "Hi",
        message: "short",
      });

      expect(response.status).toBe(422);
      const fields = response.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(["name", "message"]));
      expect(await prisma.contactMessage.count({ where: { email } })).toBe(0);
    });
  });

  describe("POST /landing/route-estimate", () => {
    const loc = (city: string, district: string) => ({ city, district });

    it("estimates a one-way trip within the same city", async () => {
      const response = await request(app)
        .post(`${API_BASE}/landing/route-estimate`)
        .send({ pickupLocation: loc("Colombo", "Colombo"), dropoffLocation: loc(" colombo ", "COLOMBO") });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        estimatedDistanceKm: 12,
        estimatedDurationMinutes: 17,
        displayDistance: "12 km",
        displayDuration: "0h 17min",
      });
    });

    it("adds district/inter-district legs, doubles round trips and buffers stops", async () => {
      const response = await request(app)
        .post(`${API_BASE}/landing/route-estimate`)
        .send({
          pickupLocation: loc("Colombo", "Colombo"),
          intermediateStops: [loc("Dehiwala", "Colombo")],
          dropoffLocation: loc("Kandy", "Kandy"),
          isRoundTrip: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        estimatedDistanceKm: 268,
        estimatedDurationMinutes: 383,
        displayDistance: "268 km",
        displayDuration: "6h 23min",
      });
    });

    it("rejects a location without a city", async () => {
      const response = await request(app)
        .post(`${API_BASE}/landing/route-estimate`)
        .send({ pickupLocation: { district: "Colombo" }, dropoffLocation: loc("Kandy", "Kandy") });

      expect(response.status).toBe(422);
    });
  });
});
