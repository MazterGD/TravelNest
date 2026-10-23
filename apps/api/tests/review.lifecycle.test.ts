/**
 * Reviews: only the customer of a COMPLETED booking may review it, once;
 * edits/removal are limited to the author; owners respond only to reviews of
 * their own vehicles; public and owner aggregates ignore removed reviews.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "./setup";
import app from "../src/app";
import { config } from "../src/config/index";
import * as reviewService from "../src/modules/review/review.service";

const API_BASE = "/api/v1";
const PREFIX = "review.lifecycle";
const PLATES = ["REV-LC-A", "REV-LC-B"];
const DAY = 24 * 60 * 60 * 1000;

const dims = (
  v = 5,
  d = 4,
  p = 4,
  c = 4,
  m = 3,
) => ({
  ratingVehicleCondition: v,
  ratingDriverBehavior: d,
  ratingPunctuality: p,
  ratingCleanliness: c,
  ratingValueForMoney: m,
});

describe("Review lifecycle", () => {
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const vehicles: Record<string, string> = {};
  const bookings: Record<string, string> = {};
  let reviewId = "";

  const cleanup = async () => {
    await prisma.vehicle.deleteMany({ where: { licensePlate: { in: PLATES } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  beforeAll(async () => {
    await cleanup();
    const roles = {
      ownerA: "VEHICLE_OWNER",
      ownerB: "VEHICLE_OWNER",
      customer: "CUSTOMER",
      stranger: "CUSTOMER",
      admin: "ADMIN",
    } as const;
    for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key.toLowerCase()}@example.com`,
          password: "hashed",
          firstName: "Rev",
          lastName: `${key}Surname`,
          role: roles[key],
          status: "ACTIVE",
        },
      });
      ids[key] = user.id;
      tokens[key] = jwt.sign(
        { id: user.id, email: user.email, role: roles[key] },
        config.jwt.secret,
        { expiresIn: "1h" },
      );
    }

    for (const [key, plate, owner] of [
      ["A", PLATES[0], ids.ownerA],
      ["B", PLATES[1], ids.ownerB],
    ] as const) {
      const vehicle = await prisma.vehicle.create({
        data: {
          ownerId: owner,
          name: `Review Bus ${key}`,
          type: "ORDINARY",
          brand: "Test",
          model: "Model",
          year: 2022,
          licensePlate: plate,
          seats: 30,
          fuelType: "DIESEL",
          transmission: "MANUAL",
          pricePerDay: 15000,
          location: "Colombo",
          images: [],
          amenities: [],
        },
      });
      vehicles[key] = vehicle.id;
    }

    const book = async (
      key: string,
      vehicle: string,
      status: "COMPLETED" | "CONFIRMED",
      daysAgo: number,
    ) => {
      const booking = await prisma.booking.create({
        data: {
          customerId: ids.customer,
          vehicleId: vehicles[vehicle],
          startDate: new Date(Date.now() - (daysAgo + 1) * DAY),
          endDate: new Date(Date.now() - daysAgo * DAY),
          pickupLocation: "Colombo",
          totalAmount: 20000,
          status,
        },
      });
      bookings[key] = booking.id;
    };
    await book("first", "A", "COMPLETED", 5);
    await book("second", "A", "COMPLETED", 3);
    await book("onB", "B", "COMPLETED", 2);
    await book("upcoming", "A", "CONFIRMED", -10);
  });

  afterAll(cleanup);

  const as = (key: string) => `Bearer ${tokens[key]}`;
  const create = (key: string, body: Record<string, unknown>) =>
    request(app).post(`${API_BASE}/reviews`).set("Authorization", as(key)).send(body);

  describe("POST /reviews", () => {
    it("404s for an unknown booking", async () => {
      const res = await create("customer", {
        bookingId: "nope",
        vehicleId: vehicles.A,
        dimensions: dims(),
      });
      expect(res.status).toBe(404);
    });

    it("forbids reviewing someone else's booking", async () => {
      const res = await create("stranger", {
        bookingId: bookings.first,
        vehicleId: vehicles.A,
        dimensions: dims(),
      });
      expect(res.status).toBe(403);
    });

    it("refuses a booking that is not completed", async () => {
      const res = await create("customer", {
        bookingId: bookings.upcoming,
        vehicleId: vehicles.A,
        dimensions: dims(),
      });
      expect(res.status).toBe(400);
      expect(await prisma.review.count({ where: { bookingId: bookings.upcoming } })).toBe(0);
    });

    it("refuses a vehicle that does not match the booking", async () => {
      const res = await create("customer", {
        bookingId: bookings.first,
        vehicleId: vehicles.B,
        dimensions: dims(),
      });
      expect(res.status).toBe(400);
    });

    it("rejects missing or out-of-range category ratings", async () => {
      const missing = await create("customer", {
        bookingId: bookings.first,
        vehicleId: vehicles.A,
        dimensions: { ratingVehicleCondition: 5 },
      });
      const outOfRange = await create("customer", {
        bookingId: bookings.first,
        vehicleId: vehicles.A,
        dimensions: dims(6),
      });
      expect(missing.status).toBe(422);
      expect(outOfRange.status).toBe(422);
    });

    it("creates the review with an overall rating derived from the categories", async () => {
      const res = await create("customer", {
        bookingId: bookings.first,
        vehicleId: vehicles.A,
        dimensions: dims(5, 4, 4, 4, 3),
        title: " <b>Great</b> trip ",
        comment: "Lovely <i>driver</i>",
        isRecommended: true,
      });

      expect(res.status).toBe(201);
      const { review } = res.body.data;
      reviewId = review.id;
      expect(review.rating).toBe(4);
      expect(review.title).toBe("Great trip");
      expect(review.comment).toBe("Lovely driver");
      expect(review.vehicleName).toBe("Review Bus A");
      expect(review.ownerName).toBe("Rev ownerASurname");

      const row = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(row).toMatchObject({
        customerId: ids.customer,
        vehicleId: vehicles.A,
        rating: 4,
        ratingValueForMoney: 3,
        isRecommended: true,
      });
    });

    it("allows only one review per booking", async () => {
      const res = await create("customer", {
        bookingId: bookings.first,
        vehicleId: vehicles.A,
        dimensions: dims(),
      });
      expect(res.status).toBe(400);
      expect(await prisma.review.count({ where: { bookingId: bookings.first } })).toBe(1);
    });

    it("stores optional fields as null when omitted", async () => {
      const res = await create("customer", {
        bookingId: bookings.onB,
        vehicleId: vehicles.B,
        dimensions: dims(1, 1, 1, 1, 1),
      });

      expect(res.status).toBe(201);
      expect(res.body.data.review).toMatchObject({
        rating: 1,
        title: null,
        comment: null,
        isRecommended: null,
      });
    });
  });

  describe("service-level rating guards", () => {
    it("rejects an out-of-range category rating that bypasses the schema", async () => {
      await expect(
        reviewService.createReview(ids.customer, {
          bookingId: bookings.second,
          vehicleId: vehicles.A,
          dimensions: dims(0),
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects a review missing a category rating", async () => {
      const { ratingCleanliness: _omit, ...partial } = dims();
      await expect(
        reviewService.createReview(ids.customer, {
          bookingId: bookings.second,
          vehicleId: vehicles.A,
          dimensions: partial,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(await prisma.review.count({ where: { bookingId: bookings.second } })).toBe(0);
    });

    it("rejects an out-of-range rating on update", async () => {
      await expect(
        reviewService.updateReview(reviewId, ids.customer, {
          dimensions: dims(5, 5, 5, 5, 9),
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("GET /reviews/pending and /reviews/my-reviews", () => {
    it("lists only the caller's completed, unreviewed bookings", async () => {
      const res = await request(app)
        .get(`${API_BASE}/reviews/pending`)
        .set("Authorization", as("customer"));

      expect(res.status).toBe(200);
      expect(res.body.data.pendingReviews.map((p: { bookingId: string }) => p.bookingId)).toEqual([
        bookings.second,
      ]);
      expect(res.body.data.pendingReviews[0]).toMatchObject({
        vehicleId: vehicles.A,
        vehicleName: "Review Bus A",
        ownerName: "Rev ownerASurname",
      });
    });

    it("shows nothing pending for another customer", async () => {
      const res = await request(app)
        .get(`${API_BASE}/reviews/pending?page=1&limit=5`)
        .set("Authorization", as("stranger"));

      expect(res.status).toBe(200);
      expect(res.body.data.pendingReviews).toEqual([]);
      expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 5, total: 0 });
    });

    it("lists the caller's own reviews, newest first, with sane paging", async () => {
      const res = await request(app)
        .get(`${API_BASE}/reviews/my-reviews?page=abc&limit=999`)
        .set("Authorization", as("customer"));

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 50, total: 2 });
      expect(res.body.data.reviews.map((r: { vehicleName: string }) => r.vehicleName)).toEqual([
        "Review Bus B",
        "Review Bus A",
      ]);

      const empty = await request(app)
        .get(`${API_BASE}/reviews/my-reviews`)
        .set("Authorization", as("stranger"));
      expect(empty.body.data.reviews).toEqual([]);
    });
  });

  describe("PUT /reviews/:id", () => {
    const update = (key: string, id: string, body: Record<string, unknown>) =>
      request(app).put(`${API_BASE}/reviews/${id}`).set("Authorization", as(key)).send(body);

    it("404s for an unknown review", async () => {
      expect((await update("customer", "nope", { title: "x" })).status).toBe(404);
    });

    it("forbids editing another customer's review", async () => {
      const res = await update("stranger", reviewId, { title: "Hijacked" });
      expect(res.status).toBe(403);
      const row = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(row?.title).toBe("Great trip");
    });

    it("edits text without touching the ratings", async () => {
      const res = await update("customer", reviewId, {
        title: "Updated",
        comment: "",
        isRecommended: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.review).toMatchObject({
        title: "Updated",
        comment: null,
        isRecommended: false,
        rating: 4,
      });
    });

    it("recomputes the overall rating when categories change", async () => {
      const res = await update("customer", reviewId, { dimensions: dims(2, 2, 2, 3, 3) });

      expect(res.status).toBe(200);
      expect(res.body.data.review.rating).toBe(2);
      expect(res.body.data.review.dimensions).toMatchObject({
        cleanliness: 3,
        valueForMoney: 3,
      });
    });
  });

  describe("owner views and responses", () => {
    it("GET /reviews/vehicle/:id is public and aggregates only that vehicle", async () => {
      const res = await request(app).get(
        `${API_BASE}/reviews/vehicle/${vehicles.A}?page=0&limit=x`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 10, total: 1 });
      expect(res.body.data.reviews[0].customerName).toBe("Rev c.");
      expect(res.body.data.stats).toMatchObject({
        averageRating: 2,
        totalReviews: 1,
        ratingDistribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 },
        dimensionAverages: { vehicleCondition: 2, cleanliness: 3 },
      });
    });

    it("returns empty stats for a vehicle without reviews", async () => {
      const res = await request(app).get(`${API_BASE}/reviews/vehicle/unknown-vehicle`);

      expect(res.status).toBe(200);
      expect(res.body.data.stats).toMatchObject({
        averageRating: 0,
        totalReviews: 0,
        dimensionAverages: { vehicleCondition: null },
      });
    });

    it("blocks customers from owner review endpoints", async () => {
      const summary = await request(app)
        .get(`${API_BASE}/reviews/owner/summary`)
        .set("Authorization", as("customer"));
      const respond = await request(app)
        .post(`${API_BASE}/reviews/${reviewId}/response`)
        .set("Authorization", as("customer"))
        .send({ response: "x" });
      expect(summary.status).toBe(403);
      expect(respond.status).toBe(403);
    });

    it("forbids responding to a review of another owner's vehicle", async () => {
      const res = await request(app)
        .post(`${API_BASE}/reviews/${reviewId}/response`)
        .set("Authorization", as("ownerB"))
        .send({ response: "Not mine" });

      expect(res.status).toBe(403);
      const row = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(row?.ownerResponse).toBeNull();
    });

    it("404s responding to an unknown review and 400s an empty response", async () => {
      const unknown = await request(app)
        .post(`${API_BASE}/reviews/nope/response`)
        .set("Authorization", as("ownerA"))
        .send({ response: "Hi" });
      const empty = await request(app)
        .post(`${API_BASE}/reviews/${reviewId}/response`)
        .set("Authorization", as("ownerA"))
        .send({ response: "  <i></i> " });

      expect(unknown.status).toBe(404);
      expect(empty.status).toBe(400);
    });

    it("rejects a missing or non-string owner response", async () => {
      for (const body of [{}, { response: 42 }]) {
        const res = await request(app)
          .post(`${API_BASE}/reviews/${reviewId}/response`)
          .set("Authorization", as("ownerA"))
          .send(body);

        expect(res.status).toBe(422);
      }
    });

    it("lets the vehicle owner respond once", async () => {
      const first = await request(app)
        .post(`${API_BASE}/reviews/${reviewId}/response`)
        .set("Authorization", as("ownerA"))
        .send({ response: "Thank you <b>so much</b>!" });
      const second = await request(app)
        .post(`${API_BASE}/reviews/${reviewId}/response`)
        .set("Authorization", as("ownerA"))
        .send({ response: "Again" });

      expect(first.status).toBe(200);
      expect(first.body.data.review.ownerResponse).toBe("Thank you so much!");
      expect(second.status).toBe(400);
    });

    it("summarises only the owner's own reviews", async () => {
      const res = await request(app)
        .get(`${API_BASE}/reviews/owner/summary`)
        .set("Authorization", as("ownerB"));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        averageRating: 1,
        totalReviews: 1,
        pendingResponses: 1,
        responseRate: 0,
        ratingDistribution: { 1: 1, 2: 0 },
      });

      const responded = await request(app)
        .get(`${API_BASE}/reviews/owner/summary`)
        .set("Authorization", as("ownerA"));
      expect(responded.body.data).toMatchObject({ totalReviews: 1, responseRate: 100 });
    });

    it("returns zeroed stats for an admin who owns no vehicles", async () => {
      const res = await request(app)
        .get(`${API_BASE}/reviews/owner/summary`)
        .set("Authorization", as("admin"));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        averageRating: 0,
        totalReviews: 0,
        responseRate: 0,
        dimensionAverages: { punctuality: null },
      });
    });

    it("filters the owner's list by response state", async () => {
      const list = (key: string, query: string) =>
        request(app)
          .get(`${API_BASE}/reviews/owner/list${query}`)
          .set("Authorization", as(key));

      const all = await list("ownerA", "");
      const answered = await list("ownerA", "?hasResponse=true&page=1&limit=5");
      const unanswered = await list("ownerA", "?hasResponse=false");
      const ignored = await list("ownerA", "?hasResponse=maybe");

      expect(all.status).toBe(200);
      expect(all.body.data.pagination).toMatchObject({ limit: 20, total: 1 });
      expect(all.body.data.reviews[0]).toMatchObject({
        vehicleId: vehicles.A,
        customerName: "Rev c.",
        ownerResponse: "Thank you so much!",
      });
      expect(answered.body.data.pagination.total).toBe(1);
      expect(unanswered.body.data.pagination.total).toBe(0);
      expect(ignored.body.data.pagination.total).toBe(1);

      const other = await list("ownerB", "?hasResponse=true");
      expect(other.body.data.reviews).toEqual([]);
    });
  });

  describe("DELETE /reviews/:id and re-review", () => {
    it("404s for an unknown review and forbids deleting another's", async () => {
      const unknown = await request(app)
        .delete(`${API_BASE}/reviews/nope`)
        .set("Authorization", as("customer"));
      const foreign = await request(app)
        .delete(`${API_BASE}/reviews/${reviewId}`)
        .set("Authorization", as("stranger"));

      expect(unknown.status).toBe(404);
      expect(foreign.status).toBe(403);
    });

    it("soft-removes the review and hides it from public stats (ADR-006)", async () => {
      const res = await request(app)
        .delete(`${API_BASE}/reviews/${reviewId}`)
        .set("Authorization", as("customer"));

      expect(res.status).toBe(200);
      const row = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(row?.isRemoved).toBe(true);
      expect(row?.removedAt).not.toBeNull();

      const pub = await request(app).get(`${API_BASE}/reviews/vehicle/${vehicles.A}`);
      expect(pub.body.data.stats.totalReviews).toBe(0);

      const edit = await request(app)
        .put(`${API_BASE}/reviews/${reviewId}`)
        .set("Authorization", as("customer"))
        .send({ title: "Ghost" });
      expect(edit.status).toBe(404);
    });

    it("lists a booking whose review was removed as pending again", async () => {
      const res = await request(app)
        .get(`${API_BASE}/reviews/pending`)
        .set("Authorization", as("customer"));

      expect(res.status).toBe(200);
      expect(
        res.body.data.pendingReviews.map((p: { bookingId: string }) => p.bookingId),
      ).toContain(bookings.first);
    });

    it("replaces a removed review and clears the old owner response", async () => {
      const res = await create("customer", {
        bookingId: bookings.first,
        vehicleId: vehicles.A,
        dimensions: dims(5, 5, 5, 5, 5),
      });

      expect(res.status).toBe(201);
      expect(res.body.data.review.id).toBe(reviewId);
      const row = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(row).toMatchObject({ isRemoved: false, removedAt: null, ownerResponse: null, rating: 5 });
    });
  });
});
