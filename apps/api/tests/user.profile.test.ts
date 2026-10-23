/**
 * Customer self-service profile: read/update own profile, address, password,
 * avatar (storage mocked) and dashboard statistics.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./setup";

const uploadBuffer = vi.fn();
const deleteByUrl = vi.fn();

vi.mock("../src/utils/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/storage")>();
  return {
    ...actual,
    uploadBuffer: (...args: unknown[]) => uploadBuffer(...args),
    deleteByUrl: (...args: unknown[]) => deleteByUrl(...args),
  };
});

const { default: app } = await import("../src/app");
const { config } = await import("../src/config/index");
const userService = await import("../src/modules/user/user.service");

const API_BASE = "/api/v1";
const PREFIX = "user.profile";
const PLATE = "USR-PROF-1";
const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = "OldPassword1";

describe("User profile endpoints", () => {
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  const cleanup = async () => {
    await prisma.contactMessage.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.vehicle.deleteMany({ where: { licensePlate: PLATE } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  };

  const sign = (id: string, email: string, role: string, tokenVersion?: number) =>
    jwt.sign(
      { id, email, role, ...(tokenVersion !== undefined && { tokenVersion }) },
      config.jwt.secret,
      { expiresIn: "1h" },
    );

  beforeAll(async () => {
    await cleanup();
    const hashed = await bcrypt.hash(PASSWORD, 4);
    const roles = {
      customer: "CUSTOMER",
      other: "CUSTOMER",
      pwd: "CUSTOMER",
      owner: "VEHICLE_OWNER",
    } as const;
    for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}.${key}@example.com`,
          password: hashed,
          firstName: "Profile",
          lastName: key,
          role: roles[key],
          status: "ACTIVE",
        },
      });
      ids[key] = user.id;
      tokens[key] = sign(user.id, user.email, roles[key]);
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: ids.owner,
        name: "Profile Bus",
        type: "ORDINARY",
        brand: "Test",
        model: "Model",
        year: 2022,
        licensePlate: PLATE,
        seats: 30,
        fuelType: "DIESEL",
        transmission: "MANUAL",
        pricePerDay: 15000,
        location: "Colombo",
        images: [],
        amenities: [],
      },
    });
    const booking = (status: "COMPLETED" | "PENDING" | "CANCELLED", amount: number) =>
      prisma.booking.create({
        data: {
          customerId: ids.customer,
          vehicleId: vehicle.id,
          startDate: new Date(Date.now() - 10 * DAY),
          endDate: new Date(Date.now() - 9 * DAY),
          pickupLocation: "Colombo",
          totalAmount: amount,
          status,
        },
      });
    const completed = await booking("COMPLETED", 20000);
    await booking("COMPLETED", 5000);
    await booking("PENDING", 7000);
    await booking("CANCELLED", 9000);
    await prisma.review.create({
      data: {
        customerId: ids.customer,
        vehicleId: vehicle.id,
        bookingId: completed.id,
        rating: 5,
      },
    });
  });

  beforeEach(() => {
    uploadBuffer.mockReset();
    deleteByUrl.mockReset();
  });

  afterAll(cleanup);

  const auth = (key: string) => `Bearer ${tokens[key]}`;

  describe("GET /users/profile", () => {
    it("returns the caller's own profile without the password hash", async () => {
      const res = await request(app)
        .get(`${API_BASE}/users/profile`)
        .set("Authorization", auth("customer"));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(ids.customer);
      expect(res.body.data.email).toBe(`${PREFIX}.customer@example.com`);
      expect(res.body.data).not.toHaveProperty("password");
    });

    it("requires sign-in", async () => {
      const res = await request(app).get(`${API_BASE}/users/profile`);
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /users/profile/personal", () => {
    it("updates only the caller's row and strips markup", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/users/profile/personal`)
        .set("Authorization", auth("customer"))
        .send({
          firstName: "  <b>Nimal</b> ",
          lastName: "Perera",
          phone: "+94771112223",
          nicNumber: "199012345678",
        });

      expect(res.status).toBe(200);
      const row = await prisma.user.findUnique({ where: { id: ids.customer } });
      expect(row?.firstName).toBe("Nimal");
      expect(row?.lastName).toBe("Perera");
      expect(row?.phone).toBe("+94771112223");
      expect(row?.nicNumber).toBe("199012345678");
      const other = await prisma.user.findUnique({ where: { id: ids.other } });
      expect(other?.firstName).toBe("Profile");
    });

    it("leaves fields that were not sent unchanged", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/users/profile/personal`)
        .set("Authorization", auth("customer"))
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.lastName).toBe("Perera");
    });

    it("rejects a too-short first name", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/users/profile/personal`)
        .set("Authorization", auth("customer"))
        .send({ firstName: "A" });

      expect(res.status).toBe(422);
    });
  });

  describe("PATCH /users/profile/address", () => {
    it("saves a sanitised address", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/users/profile/address`)
        .set("Authorization", auth("customer"))
        .send({
          address: " 12 <b>Galle</b> Road ",
          city: "Colombo",
          district: "Colombo",
          postalCode: "00300",
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        address: "12 Galle Road",
        city: "Colombo",
        district: "Colombo",
        postalCode: "00300",
      });
    });

    it("accepts an empty update", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/users/profile/address`)
        .set("Authorization", auth("customer"))
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.city).toBe("Colombo");
    });

    it("rejects an over-long postal code", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/users/profile/address`)
        .set("Authorization", auth("customer"))
        .send({ postalCode: "12345678901" });

      expect(res.status).toBe(422);
    });
  });

  describe("POST /users/change-password", () => {
    const change = (body: Record<string, string>, token = auth("pwd")) =>
      request(app)
        .post(`${API_BASE}/users/change-password`)
        .set("Authorization", token)
        .send(body);

    it("rejects a wrong current password", async () => {
      const res = await change({
        currentPassword: "WrongPassword1",
        newPassword: "NewPassword1",
        confirmPassword: "NewPassword1",
      });

      expect(res.status).toBe(400);
    });

    it("rejects mismatched confirmation and weak passwords", async () => {
      const mismatch = await change({
        currentPassword: PASSWORD,
        newPassword: "NewPassword1",
        confirmPassword: "NewPassword2",
      });
      const weak = await change({
        currentPassword: PASSWORD,
        newPassword: "alllowercase",
        confirmPassword: "alllowercase",
      });

      expect(mismatch.status).toBe(422);
      expect(weak.status).toBe(422);
    });

    it("changes the password and invalidates older sessions", async () => {
      const before = await prisma.user.findUnique({ where: { id: ids.pwd } });
      const versioned = sign(
        ids.pwd,
        `${PREFIX}.pwd@example.com`,
        "CUSTOMER",
        before!.tokenVersion,
      );

      const res = await change(
        {
          currentPassword: PASSWORD,
          newPassword: "NewPassword1",
          confirmPassword: "NewPassword1",
        },
        `Bearer ${versioned}`,
      );

      expect(res.status).toBe(200);
      const after = await prisma.user.findUnique({ where: { id: ids.pwd } });
      expect(after!.tokenVersion).toBe(before!.tokenVersion + 1);
      expect(await bcrypt.compare("NewPassword1", after!.password)).toBe(true);

      const reuse = await request(app)
        .get(`${API_BASE}/users/profile`)
        .set("Authorization", `Bearer ${versioned}`);
      expect(reuse.status).toBe(401);
    });
  });

  describe("avatar", () => {
    const png = Buffer.from("\x89PNG avatar");

    it("requires a file", async () => {
      const res = await request(app)
        .post(`${API_BASE}/users/avatar`)
        .set("Authorization", auth("other"));

      expect(res.status).toBe(400);
      expect(uploadBuffer).not.toHaveBeenCalled();
    });

    it("does not store an unsupported file type", async () => {
      const res = await request(app)
        .post(`${API_BASE}/users/avatar`)
        .set("Authorization", auth("other"))
        .attach("avatar", Buffer.from("%PDF"), {
          filename: "a.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(uploadBuffer).not.toHaveBeenCalled();
    });

    it.todo(
      "answers an unsupported avatar type with 400, not 500 (multer fileFilter error is not mapped)",
    );

    it("uploads to the caller's folder and replaces the previous avatar", async () => {
      await prisma.user.update({
        where: { id: ids.other },
        data: { avatar: "https://cdn.example/old.png" },
      });
      uploadBuffer.mockResolvedValue({
        path: "avatars/x/new.png",
        publicUrl: "https://cdn.example/new.png",
      });

      const res = await request(app)
        .post(`${API_BASE}/users/avatar`)
        .set("Authorization", auth("other"))
        .attach("avatar", png, { filename: "me.png", contentType: "image/png" });

      expect(res.status).toBe(200);
      expect(uploadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: `avatars/${ids.other}`,
          fileName: "me.png",
          contentType: "image/png",
        }),
      );
      expect(deleteByUrl).toHaveBeenCalledWith("https://cdn.example/old.png");
      const row = await prisma.user.findUnique({ where: { id: ids.other } });
      expect(row?.avatar).toBe("https://cdn.example/new.png");
    });

    it("sets a first avatar without deleting anything", async () => {
      await prisma.user.update({ where: { id: ids.other }, data: { avatar: null } });
      uploadBuffer.mockResolvedValue({
        path: "avatars/x/first.png",
        publicUrl: "https://cdn.example/first.png",
      });

      const res = await request(app)
        .post(`${API_BASE}/users/avatar`)
        .set("Authorization", auth("other"))
        .attach("avatar", png, { filename: "me.png", contentType: "image/png" });

      expect(res.status).toBe(200);
      expect(deleteByUrl).not.toHaveBeenCalled();
    });

    it("deletes the stored avatar file and clears the field", async () => {
      const res = await request(app)
        .delete(`${API_BASE}/users/avatar`)
        .set("Authorization", auth("other"));

      expect(res.status).toBe(200);
      expect(deleteByUrl).toHaveBeenCalledWith("https://cdn.example/first.png");
      expect(res.body.data.avatar).toBeNull();
    });

    it("clears an already-empty avatar without touching storage", async () => {
      const res = await request(app)
        .delete(`${API_BASE}/users/avatar`)
        .set("Authorization", auth("other"));

      expect(res.status).toBe(200);
      expect(deleteByUrl).not.toHaveBeenCalled();
    });
  });

  describe("GET /users/dashboard/stats", () => {
    it("counts only the caller's bookings, quotations and reviews", async () => {
      const res = await request(app)
        .get(`${API_BASE}/users/dashboard/stats`)
        .set("Authorization", auth("customer"));

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        totalBookings: 4,
        completedBookings: 2,
        pendingBookings: 1,
        pendingQuotations: 0,
        totalReviews: 1,
        totalSpent: 25000,
      });
    });

    it("reports zero spend for a customer with no bookings", async () => {
      const res = await request(app)
        .get(`${API_BASE}/users/dashboard/stats`)
        .set("Authorization", auth("other"));

      expect(res.status).toBe(200);
      expect(res.body.data.totalBookings).toBe(0);
      expect(res.body.data.totalSpent).toBe(0);
    });
  });

  describe("POST /users/data-deletion-request", () => {
    it("files a request without a reason for a user with no phone", async () => {
      const res = await request(app)
        .post(`${API_BASE}/users/data-deletion-request`)
        .set("Authorization", auth("other"))
        .send({});

      expect(res.status).toBe(200);
      const message = await prisma.contactMessage.findFirst({
        where: { email: `${PREFIX}.other@example.com` },
      });
      expect(message?.message).toContain(ids.other);
      expect(message?.message).not.toContain("Reason:");
      expect(message?.phone ?? null).toBeNull();
    });
  });

  describe("service guards for a missing user", () => {
    const missing = "missing-user-id";

    it("404s on profile, avatar and password operations", async () => {
      await expect(userService.getUserProfile(missing)).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(userService.updateAvatar(missing, "x")).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(userService.deleteAvatar(missing)).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(
        userService.changePassword(missing, {
          currentPassword: "a",
          newPassword: "b",
          confirmPassword: "b",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(userService.requestDataDeletion(missing)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
