/**
 * Vehicle Management API Tests
 * Comprehensive test suite for vehicle CRUD operations
 *
 * Test Categories:
 * 1. Vehicle Creation Tests
 * 2. Vehicle Retrieval Tests
 * 3. Vehicle Update Tests
 * 4. Vehicle Delete Tests
 * 5. Ownership Verification Tests
 * 6. Photo Management Tests
 * 7. Document Management Tests
 * 8. Edge Cases
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";

const API_BASE = "/api/v1";

// Test data
const testOwnerData = {
  firstName: "Vehicle",
  lastName: "Owner",
  email: "vehicle.test.owner@example.com",
  phone: "+94771234567",
  nicNumber: "199012345678",
  password: "TestPassword123!",
  confirmPassword: "TestPassword123!",
  address: {
    address: "123 Test Street",
    city: "Colombo",
    district: "colombo",
    postalCode: "10100",
    baseLocation: "Colombo",
  },
  vehicles: [
    {
      registrationNumber: "VEH-TEST-001",
      vehicleType: "luxury",
      make: "Ashok Leyland",
      model: "Viking",
      year: 2022,
      seatingCapacity: 45,
      acType: "full-ac",
      photos: [],
      documents: [],
    },
  ],
};

let ownerToken: string;
let ownerId: string;
let vehicleId: string;

// Helper function to clean up test data
async function cleanupTestData() {
  const testEmails = [
    "vehicle.test.owner@example.com",
    "vehicle.test.owner2@example.com",
    "another.owner@example.com",
  ];

  for (const email of testEmails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.vehiclePhoto.deleteMany({
        where: { vehicle: { ownerId: user.id } },
      });
      await prisma.vehicleDocument.deleteMany({
        where: { vehicle: { ownerId: user.id } },
      });
      await prisma.vehicle.deleteMany({ where: { ownerId: user.id } });
      await prisma.ownerDocument.deleteMany({ where: { ownerId: user.id } });
      await prisma.businessProfile.deleteMany({ where: { ownerId: user.id } });
    }
  }

  await prisma.user.deleteMany({
    where: { email: { in: testEmails } },
  });

  await prisma.vehicle.deleteMany({
    where: {
      licensePlate: {
        in: [
          "VEH-TEST-001",
          "VEH-TEST-002",
          "VEH-TEST-003",
          "NEW-VEH-001",
          "UPDATED-001",
        ],
      },
    },
  });
}

// Setup before all tests
beforeAll(async () => {
  await cleanupTestData();
});

// ============================================
// 1. VEHICLE RETRIEVAL TESTS - GET /vehicles/my
// ============================================
describe("GET /vehicles/my - Get Owner's Vehicles", () => {
  beforeEach(async () => {
    await cleanupTestData();
    // Register owner with a vehicle
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    expect(registerResponse.status).toBe(201);
    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;

    // Get the vehicle ID
    const user = await prisma.user.findUnique({
      where: { email: testOwnerData.email },
      include: { vehicles: true },
    });
    vehicleId = user!.vehicles[0].id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should return owner's vehicles successfully", async () => {
    const response = await request(app)
      .get(`${API_BASE}/vehicles/my`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].licensePlate).toBe("VEH-TEST-001");
  });

  it("should return empty array for owner with no vehicles", async () => {
    // Delete the vehicle
    await prisma.vehicle.deleteMany({ where: { ownerId } });

    const response = await request(app)
      .get(`${API_BASE}/vehicles/my`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
  });

  it("should reject request without authentication", async () => {
    const response = await request(app).get(`${API_BASE}/vehicles/my`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject request with invalid token", async () => {
    const response = await request(app)
      .get(`${API_BASE}/vehicles/my`)
      .set("Authorization", "Bearer invalid_token");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should return vehicles with photos and documents", async () => {
    // Add a photo to the vehicle
    await prisma.vehiclePhoto.create({
      data: {
        vehicleId,
        url: "https://example.com/photo.jpg",
        fileName: "photo.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
        isPrimary: true,
      },
    });

    const response = await request(app)
      .get(`${API_BASE}/vehicles/my`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toHaveProperty("photos");
    expect(response.body.data[0].photos.length).toBe(1);
  });
});

// ============================================
// 2. SINGLE VEHICLE RETRIEVAL - GET /vehicles/:id
// ============================================
describe("GET /vehicles/:id - Get Single Vehicle", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;

    const user = await prisma.user.findUnique({
      where: { email: testOwnerData.email },
      include: { vehicles: true },
    });
    vehicleId = user!.vehicles[0].id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should return vehicle details by ID", async () => {
    const response = await request(app)
      .get(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(vehicleId);
    expect(response.body.data.licensePlate).toBe("VEH-TEST-001");
  });

  it("should return 422 for invalid UUID format (all zeros)", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await request(app)
      .get(`${API_BASE}/vehicles/${fakeId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should return 422 for invalid vehicle ID format", async () => {
    const response = await request(app)
      .get(`${API_BASE}/vehicles/invalid-id`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });
});

// ============================================
// 3. VEHICLE UPDATE TESTS - PATCH /vehicles/:id
// ============================================
describe("PATCH /vehicles/:id - Update Vehicle", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;

    const user = await prisma.user.findUnique({
      where: { email: testOwnerData.email },
      include: { vehicles: true },
    });
    vehicleId = user!.vehicles[0].id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should update vehicle details successfully", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        model: "Updated Model",
        year: 2023,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.model).toBe("Updated Model");
    expect(response.body.data.year).toBe(2023);
  });

  it("should reject update of vehicle by non-owner", async () => {
    // Create another owner
    const anotherOwnerData = {
      ...testOwnerData,
      email: "another.owner@example.com",
      nicNumber: "199012345679",
      vehicles: [
        {
          ...testOwnerData.vehicles[0],
          registrationNumber: "VEH-TEST-002",
        },
      ],
    };

    const anotherRegisterResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(anotherOwnerData);

    const anotherOwnerToken = anotherRegisterResponse.body.data.accessToken;

    // Try to update first owner's vehicle with second owner's token
    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${anotherOwnerToken}`)
      .send({
        model: "Hacked Model",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should reject update without authentication", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}`)
      .send({
        model: "New Model",
      });

    expect(response.status).toBe(401);
  });

  it("should sanitize XSS in update fields", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        model: '<script>alert("xss")</script>Test Model',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.model).not.toContain("<script>");
  });
});

// ============================================
// 4. VEHICLE DELETE TESTS - DELETE /vehicles/:id
// ============================================
describe("DELETE /vehicles/:id - Delete Vehicle", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;

    const user = await prisma.user.findUnique({
      where: { email: testOwnerData.email },
      include: { vehicles: true },
    });
    vehicleId = user!.vehicles[0].id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should delete vehicle successfully", async () => {
    const response = await request(app)
      .delete(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify vehicle is deleted
    const deletedVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    expect(deletedVehicle).toBeNull();
  });

  it("should reject delete by non-owner", async () => {
    // Create another owner
    const anotherOwnerData = {
      ...testOwnerData,
      email: "another.owner@example.com",
      nicNumber: "199012345679",
      vehicles: [
        {
          ...testOwnerData.vehicles[0],
          registrationNumber: "VEH-TEST-002",
        },
      ],
    };

    const anotherRegisterResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(anotherOwnerData);

    const anotherOwnerToken = anotherRegisterResponse.body.data.accessToken;

    // Try to delete first owner's vehicle with second owner's token
    const response = await request(app)
      .delete(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${anotherOwnerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);

    // Verify vehicle still exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    expect(vehicle).not.toBeNull();
  });

  it("should return 422 when deleting with invalid ID format", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await request(app)
      .delete(`${API_BASE}/vehicles/${fakeId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should delete associated photos when vehicle is deleted", async () => {
    // Add a photo
    await prisma.vehiclePhoto.create({
      data: {
        vehicleId,
        url: "https://example.com/photo.jpg",
        fileName: "photo.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
        isPrimary: true,
      },
    });

    const response = await request(app)
      .delete(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    // Verify photos are deleted
    const photos = await prisma.vehiclePhoto.findMany({
      where: { vehicleId },
    });
    expect(photos.length).toBe(0);
  });
});

// ============================================
// 5. VEHICLE ACTIVATION/DEACTIVATION TESTS
// ============================================
describe("PATCH /vehicles/:id/status - Toggle Vehicle Status", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;

    const user = await prisma.user.findUnique({
      where: { email: testOwnerData.email },
      include: { vehicles: true },
    });
    vehicleId = user!.vehicles[0].id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should deactivate vehicle successfully", async () => {
    // First verify it starts as active (after verification)
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: true },
    });

    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    expect(vehicle!.isActive).toBe(false);
  });

  it("should reactivate vehicle successfully", async () => {
    // First deactivate
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: false },
    });

    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ isActive: true });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    expect(vehicle!.isActive).toBe(true);
  });
});

// ============================================
// 6. EDGE CASES
// ============================================
describe("Vehicle Edge Cases", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;

    const user = await prisma.user.findUnique({
      where: { email: testOwnerData.email },
      include: { vehicles: true },
    });
    vehicleId = user!.vehicles[0].id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should handle concurrent update requests", async () => {
    const updates = Array(5)
      .fill(null)
      .map((_, i) =>
        request(app)
          .patch(`${API_BASE}/vehicles/${vehicleId}`)
          .set("Authorization", `Bearer ${ownerToken}`)
          .send({ model: `Model ${i}` }),
      );

    const results = await Promise.all(updates);

    // All should succeed or fail gracefully
    results.forEach((r) => {
      expect([200, 409, 429]).toContain(r.status);
    });
  });

  it("should handle special characters in vehicle model", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ model: "Viking (Premium)" });

    expect(response.status).toBe(200);
    expect(response.body.data.model).toBe("Viking (Premium)");
  });

  it("should reject invalid year values", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ year: 1800 });

    expect([400, 422]).toContain(response.status);
  });

  it("should reject future year values", async () => {
    const futureYear = new Date().getFullYear() + 5;
    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ year: futureYear });

    expect([400, 422]).toContain(response.status);
  });

  it("should handle empty update body", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect([200, 400]).toContain(response.status);
  });
});

// ============================================
// 7. VEHICLE PHOTOS TESTS
// ============================================
describe("Vehicle Photos Management", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;

    const user = await prisma.user.findUnique({
      where: { email: testOwnerData.email },
      include: { vehicles: true },
    });
    vehicleId = user!.vehicles[0].id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should add photos to vehicle", async () => {
    const response = await request(app)
      .post(`${API_BASE}/vehicles/${vehicleId}/photos`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        photos: [
          {
            url: "https://example.com/photo1.jpg",
            fileName: "photo1.jpg",
            fileSize: 1024,
            mimeType: "image/jpeg",
            isPrimary: true,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("should reject invalid MIME type for photos", async () => {
    const response = await request(app)
      .post(`${API_BASE}/vehicles/${vehicleId}/photos`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        photos: [
          {
            url: "https://example.com/malicious.exe",
            fileName: "malicious.exe",
            fileSize: 1024,
            mimeType: "application/x-msdownload",
            isPrimary: true,
          },
        ],
      });

    expect([400, 422]).toContain(response.status);
  });

  it("should enforce only one primary photo", async () => {
    // Add first primary photo
    await request(app)
      .post(`${API_BASE}/vehicles/${vehicleId}/photos`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        photos: [
          {
            url: "https://example.com/photo1.jpg",
            fileName: "photo1.jpg",
            fileSize: 1024,
            mimeType: "image/jpeg",
            isPrimary: true,
          },
        ],
      });

    // Add second primary photo
    await request(app)
      .post(`${API_BASE}/vehicles/${vehicleId}/photos`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        photos: [
          {
            url: "https://example.com/photo2.jpg",
            fileName: "photo2.jpg",
            fileSize: 1024,
            mimeType: "image/jpeg",
            isPrimary: true,
          },
        ],
      });

    // Only one should be primary
    const photos = await prisma.vehiclePhoto.findMany({
      where: { vehicleId, isPrimary: true },
    });

    expect(photos.length).toBe(1);
  });
});
