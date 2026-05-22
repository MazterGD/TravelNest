/**
 * Owner Profile API Tests
 * Comprehensive test suite for owner profile management
 *
 * Test Categories:
 * 1. Get Profile Tests
 * 2. Update Personal Info Tests
 * 3. Update Address Tests
 * 4. Update Business Profile Tests
 * 5. Dashboard Stats Tests
 * 6. Authorization Tests
 * 7. Edge Cases
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";

const API_BASE = "/api/v1";

// Test data
const testOwnerData = {
  firstName: "Profile",
  lastName: "Owner",
  email: "profile.test.owner@example.com",
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
      registrationNumber: "PROF-TEST-001",
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

// Helper function to clean up test data
async function cleanupTestData() {
  const testEmails = [
    "profile.test.owner@example.com",
    "customer.test@example.com",
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
    where: { licensePlate: { in: ["PROF-TEST-001"] } },
  });
}

beforeAll(async () => {
  await cleanupTestData();
});

// ============================================
// 1. GET PROFILE TESTS
// ============================================
describe("GET /owner/profile - Get Owner Profile", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    expect(registerResponse.status).toBe(201);
    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should return owner profile successfully", async () => {
    const response = await request(app)
      .get(`${API_BASE}/owner/profile`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("email", testOwnerData.email);
    expect(response.body.data).toHaveProperty(
      "firstName",
      testOwnerData.firstName,
    );
    expect(response.body.data).toHaveProperty(
      "lastName",
      testOwnerData.lastName,
    );
    expect(response.body.data).not.toHaveProperty("password");
  });

  it("should include address information in profile", async () => {
    const response = await request(app)
      .get(`${API_BASE}/owner/profile`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("address");
    expect(response.body.data).toHaveProperty("city");
    expect(response.body.data).toHaveProperty("district");
  });

  it("should reject request without authentication", async () => {
    const response = await request(app).get(`${API_BASE}/owner/profile`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject request from non-owner role", async () => {
    // Create a customer
    const customerResponse = await request(app)
      .post(`${API_BASE}/auth/register`)
      .send({
        firstName: "Test",
        lastName: "Customer",
        email: "customer.test@example.com",
        password: "TestPassword123!",
        role: "customer",
      });

    const customerToken = customerResponse.body.data.accessToken;

    const response = await request(app)
      .get(`${API_BASE}/owner/profile`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});

// ============================================
// 2. UPDATE PERSONAL INFO TESTS
// ============================================
describe("PATCH /owner/profile/personal - Update Personal Info", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should update first name successfully", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ firstName: "Updated" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.firstName).toBe("Updated");
  });

  it("should update last name successfully", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ lastName: "NewLastName" });

    expect(response.status).toBe(200);
    expect(response.body.data.lastName).toBe("NewLastName");
  });

  it("should update phone number successfully", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ phone: "+94779876543" });

    expect(response.status).toBe(200);
    expect(response.body.data.phone).toBe("+94779876543");
  });

  it("should update multiple fields at once", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        firstName: "NewFirst",
        lastName: "NewLast",
        phone: "+94779876543",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.firstName).toBe("NewFirst");
    expect(response.body.data.lastName).toBe("NewLast");
    expect(response.body.data.phone).toBe("+94779876543");
  });

  it("should not return password in response", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ firstName: "Test" });

    expect(response.status).toBe(200);
    expect(response.body.data).not.toHaveProperty("password");
  });

  it("should sanitize XSS in input", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ firstName: '<script>alert("xss")</script>Test' });

    expect(response.status).toBe(200);
    expect(response.body.data.firstName).not.toContain("<script>");
  });

  it("should reject first name less than 2 characters", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ firstName: "A" });

    expect([400, 422]).toContain(response.status);
  });

  it("should trim whitespace from input", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ firstName: "  Trimmed  " });

    expect(response.status).toBe(200);
    expect(response.body.data.firstName).toBe("Trimmed");
  });
});

// ============================================
// 3. UPDATE ADDRESS TESTS
// ============================================
describe("PATCH /owner/profile/address - Update Address", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should update address successfully", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/address`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        address: "456 New Street",
        city: "Kandy",
        district: "kandy",
        postalCode: "20000",
        baseLocation: "Kandy",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.address).toBe("456 New Street");
    expect(response.body.data.city).toBe("Kandy");
    expect(response.body.data.district).toBe("kandy");
  });

  it("should update partial address fields", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/address`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ city: "Galle" });

    expect(response.status).toBe(200);
    expect(response.body.data.city).toBe("Galle");
  });

  it("should accept empty postal code", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/address`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ postalCode: "" });

    expect(response.status).toBe(200);
  });

  it("should reject request without authentication", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/address`)
      .send({ city: "Kandy" });

    expect(response.status).toBe(401);
  });
});

// ============================================
// 4. UPDATE BUSINESS PROFILE TESTS
// ============================================
describe("PATCH /owner/profile/business - Update Business Profile", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should create business profile if not exists", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/business`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessName: "New Bus Company",
        businessType: "private-limited",
        registrationNumber: "PV12345",
        taxId: "TIN123456",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify business profile was created
    const businessProfile = await prisma.businessProfile.findFirst({
      where: { ownerId },
    });
    expect(businessProfile).not.toBeNull();
    expect(businessProfile!.businessName).toBe("New Bus Company");
  });

  it("should update existing business profile", async () => {
    // First create a business profile
    await prisma.businessProfile.create({
      data: {
        ownerId,
        businessName: "Old Name",
        businessType: "sole-proprietorship",
      },
    });

    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/business`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessName: "Updated Name",
        businessType: "private-limited",
      });

    expect(response.status).toBe(200);

    const businessProfile = await prisma.businessProfile.findFirst({
      where: { ownerId },
    });
    expect(businessProfile!.businessName).toBe("Updated Name");
    expect(businessProfile!.businessType).toBe("private-limited");
  });

  it("should reject business name less than 2 characters", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/business`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessName: "A" });

    expect([400, 422]).toContain(response.status);
  });
});

// ============================================
// 5. DASHBOARD STATS TESTS
// ============================================
describe("GET /owner/dashboard/stats - Dashboard Statistics", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should return dashboard statistics", async () => {
    const response = await request(app)
      .get(`${API_BASE}/owner/dashboard/stats`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("totalVehicles");
    expect(response.body.data).toHaveProperty("activeVehicles");
  });

  it("should reflect correct vehicle count", async () => {
    const response = await request(app)
      .get(`${API_BASE}/owner/dashboard/stats`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalVehicles).toBe(1);
  });

  it("should reject request without authentication", async () => {
    const response = await request(app).get(
      `${API_BASE}/owner/dashboard/stats`,
    );

    expect(response.status).toBe(401);
  });
});

// ============================================
// 6. AUTHORIZATION TESTS
// ============================================
describe("Owner Profile Authorization", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should reject expired token", async () => {
    // Use a known expired token
    const expiredToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJWRUhJQ0xFX09XTkVSIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid";

    const response = await request(app)
      .get(`${API_BASE}/owner/profile`)
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it("should reject malformed token", async () => {
    const response = await request(app)
      .get(`${API_BASE}/owner/profile`)
      .set("Authorization", "Bearer malformed.token.here");

    expect(response.status).toBe(401);
  });

  it("should reject request with missing Bearer prefix", async () => {
    const response = await request(app)
      .get(`${API_BASE}/owner/profile`)
      .set("Authorization", ownerToken);

    expect(response.status).toBe(401);
  });
});

// ============================================
// 7. EDGE CASES
// ============================================
describe("Owner Profile Edge Cases", () => {
  beforeEach(async () => {
    await cleanupTestData();
    const registerResponse = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(testOwnerData);

    ownerToken = registerResponse.body.data.accessToken;
    ownerId = registerResponse.body.data.user.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should handle Unicode characters in names", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        firstName: "නුවන්",
        lastName: "பெரேரா",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.firstName).toBe("නුවන්");
    expect(response.body.data.lastName).toBe("பெரேரா");
  });

  it("should handle concurrent profile updates", async () => {
    const updates = Array(5)
      .fill(null)
      .map((_, i) =>
        request(app)
          .patch(`${API_BASE}/owner/profile/personal`)
          .set("Authorization", `Bearer ${ownerToken}`)
          .send({ firstName: `Name${i}` }),
      );

    const results = await Promise.all(updates);

    // All should succeed
    results.forEach((r) => {
      expect([200, 409, 429]).toContain(r.status);
    });
  });

  it("should handle empty update body", async () => {
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect([200, 400, 422]).toContain(response.status);
  });

  it("should handle very long input strings", async () => {
    const longString = "A".repeat(1000);
    const response = await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ firstName: longString });

    expect([400, 413, 422]).toContain(response.status);
  });

  it("should persist changes across requests", async () => {
    // Update name
    await request(app)
      .patch(`${API_BASE}/owner/profile/personal`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ firstName: "Persisted" });

    // Fetch profile
    const response = await request(app)
      .get(`${API_BASE}/owner/profile`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.firstName).toBe("Persisted");
  });
});
