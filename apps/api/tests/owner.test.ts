/**
 * Owner Registration API Tests
 * Comprehensive test suite for owner registration with vehicles
 *
 * Test Categories:
 * 1. Successful Registration
 * 2. Validation Errors
 * 3. Duplicate Handling
 * 4. Vehicle Validation
 * 5. Document Bypass Mode
 * 6. Business Profile
 * 7. Edge Cases
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";

const API_BASE = "/api/v1";

// Shared document fixtures matching the current schema (documents are required)
const testVehicleDocuments = [
  {
    type: "DRIVING_LICENSE",
    fileName: "license.pdf",
    fileSize: 1024,
    mimeType: "application/pdf",
    url: "storage://private/test/docs/license.pdf",
  },
  {
    type: "INSURANCE",
    fileName: "insurance.pdf",
    fileSize: 1024,
    mimeType: "application/pdf",
    url: "storage://private/test/docs/insurance.pdf",
  },
  {
    type: "REGISTRATION_CERTIFICATE",
    fileName: "cr.pdf",
    fileSize: 1024,
    mimeType: "application/pdf",
    url: "storage://private/test/docs/cr.pdf",
  },
];

const testOwnerDocuments = [
  {
    type: "NIC",
    fileName: "nic.pdf",
    fileSize: 1024,
    mimeType: "application/pdf",
    url: "storage://private/test/docs/nic.pdf",
  },
  {
    type: "PROFILE_PHOTO",
    fileName: "photo.jpg",
    fileSize: 2048,
    mimeType: "image/jpeg",
    url: "storage://private/test/docs/photo.jpg",
  },
];

// Test owner data
const validOwnerData = {
  firstName: "Test",
  lastName: "Owner",
  email: "test.owner.reg@example.com",
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
  ownerDocuments: testOwnerDocuments,
  vehicles: [
    {
      registrationNumber: "TEST-1234",
      vehicleType: "LUXURY_AC",
      make: "Ashok Leyland",
      model: "Viking",
      year: 2022,
      seatingCapacity: 45,
      acType: "FULL_AC",
      photos: [],
      documents: testVehicleDocuments,
    },
  ],
};

// Helper function to clean up test data
async function cleanupTestOwner() {
  const testEmails = [
    "test.owner.reg@example.com",
    "test.owner.dup@example.com",
    "test.owner.business@example.com",
    "test.owner.nodocs@example.com",
  ];

  // Delete vehicles first (due to foreign key constraints)
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
    }
  }

  await prisma.user.deleteMany({
    where: { email: { in: testEmails } },
  });

  // Also delete by license plate
  await prisma.vehicle.deleteMany({
    where: {
      licensePlate: { in: ["TEST-1234", "TEST-5678", "DUP-1234", "BUS-0001"] },
    },
  });
}

// ============================================
// 1. SUCCESSFUL REGISTRATION TESTS
// ============================================
describe("POST /owner/register - Successful Registration", () => {
  beforeEach(async () => {
    await cleanupTestOwner();
  });

  afterEach(async () => {
    await cleanupTestOwner();
  });

  it("should register a new owner with one vehicle successfully", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(validOwnerData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("user");
    expect(response.body.data).toHaveProperty("accessToken");
    expect(response.body.data.user.email).toBe(validOwnerData.email);
    expect(response.body.data.user.role).toBe("VEHICLE_OWNER");
    expect(response.body.data.user.status).toBe("PENDING_VERIFICATION");
    expect(response.body.data.user.nicNumber).toBe(validOwnerData.nicNumber);
    expect(response.body.data.user).not.toHaveProperty("password");
  });

  it("should register owner with multiple vehicles", async () => {
    const dataWithMultipleVehicles = {
      ...validOwnerData,
      email: "test.owner.dup@example.com",
      vehicles: [
        {
          registrationNumber: "TEST-1234",
          vehicleType: "LUXURY_AC",
          make: "Ashok Leyland",
          model: "Viking",
          year: 2022,
          seatingCapacity: 45,
          acType: "FULL_AC",
          photos: [],
          documents: testVehicleDocuments,
        },
        {
          registrationNumber: "TEST-5678",
          vehicleType: "ORDINARY",
          make: "TATA",
          model: "Marcopolo",
          year: 2021,
          seatingCapacity: 52,
          acType: "AC",
          photos: [],
          documents: testVehicleDocuments,
        },
      ],
    };

    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(dataWithMultipleVehicles);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    // Verify both vehicles were created
    const vehicles = await prisma.vehicle.findMany({
      where: { owner: { email: dataWithMultipleVehicles.email } },
    });
    expect(vehicles.length).toBe(2);
  });

  it("should set HTTP-only cookie for refresh token", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(validOwnerData);

    expect(response.status).toBe(201);
    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies!.some((c: string) => c.includes("refreshToken"))).toBe(true);
    expect(cookies!.some((c: string) => c.includes("HttpOnly"))).toBe(true);
  });

  it("should issue a CSRF cookie and no SameSite=Strict refresh cookie", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(validOwnerData);

    expect(response.status).toBe(201);
    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("csrf-token="))).toBe(true);
    const refresh = cookies.find((c) => c.startsWith("refreshToken="));
    expect(refresh).toBeDefined();
    expect(refresh).not.toMatch(/SameSite=Strict/i);
  });

  it("should normalize email to lowercase", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        email: "TEST.OWNER.REG@EXAMPLE.COM",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe("test.owner.reg@example.com");
  });
});

// ============================================
// 2. VALIDATION ERROR TESTS
// ============================================
describe("POST /owner/register - Validation Errors", () => {
  beforeEach(async () => {
    await cleanupTestOwner();
  });

  it("should reject registration with missing email", async () => {
    const { email, ...dataWithoutEmail } = validOwnerData;
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(dataWithoutEmail);

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should reject registration with invalid email format", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({ ...validOwnerData, email: "not-an-email" });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should reject registration with password less than 8 characters", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        password: "Short1!",
        confirmPassword: "Short1!",
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should reject registration with mismatched passwords", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        confirmPassword: "DifferentPassword123!",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain("Passwords do not match");
  });

  it("should reject registration with missing NIC number", async () => {
    const { nicNumber, ...dataWithoutNic } = validOwnerData;
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(dataWithoutNic);

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should reject registration without vehicles", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({ ...validOwnerData, vehicles: [] });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should reject registration with missing address", async () => {
    const { address, ...dataWithoutAddress } = validOwnerData;
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(dataWithoutAddress);

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });
});

// ============================================
// 3. DUPLICATE HANDLING TESTS
// ============================================
describe("POST /owner/register - Duplicate Handling", () => {
  beforeEach(async () => {
    await cleanupTestOwner();
  });

  afterEach(async () => {
    await cleanupTestOwner();
  });

  it("should reject registration with existing email", async () => {
    // First registration
    await request(app).post(`${API_BASE}/owner/register`).send(validOwnerData);

    // Second registration with same email
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        vehicles: [
          {
            ...validOwnerData.vehicles[0],
            registrationNumber: "DUP-1234",
          },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain("Email already registered");
  });

  it("should reject registration with existing vehicle registration number", async () => {
    // First registration
    await request(app).post(`${API_BASE}/owner/register`).send(validOwnerData);

    // Second registration with different email but same vehicle
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        email: "test.owner.dup@example.com",
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain("already exists");
  });
});

// ============================================
// 4. VEHICLE VALIDATION TESTS
// ============================================
describe("POST /owner/register - Vehicle Validation", () => {
  beforeEach(async () => {
    await cleanupTestOwner();
  });

  it("should reject invalid vehicle type", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        vehicles: [
          {
            ...validOwnerData.vehicles[0],
            vehicleType: "invalid-type",
          },
        ],
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should reject invalid AC type", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        vehicles: [
          {
            ...validOwnerData.vehicles[0],
            acType: "invalid-ac",
          },
        ],
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should reject vehicle with year before 1990", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        vehicles: [
          {
            ...validOwnerData.vehicles[0],
            year: 1985,
          },
        ],
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should reject vehicle with seating capacity over 100", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        vehicles: [
          {
            ...validOwnerData.vehicles[0],
            seatingCapacity: 150,
          },
        ],
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });
});

// ============================================
// 5. DOCUMENT REQUIREMENT TESTS
// ============================================
describe("POST /owner/register - Document Requirements", () => {
  beforeEach(async () => {
    await cleanupTestOwner();
  });

  afterEach(async () => {
    await cleanupTestOwner();
  });

  it("should reject registration without documents (documents are required)", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        ownerDocuments: [],
        vehicles: [
          {
            ...validOwnerData.vehicles[0],
            documents: [],
            photos: [],
          },
        ],
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it("should store documents when provided", async () => {
    const dataWithDocs = {
      ...validOwnerData,
      email: "test.owner.nodocs@example.com",
      ownerDocuments: testOwnerDocuments,
      vehicles: [
        {
          ...validOwnerData.vehicles[0],
          registrationNumber: "BUS-0001",
          documents: testVehicleDocuments,
          photos: [
            {
              fileName: "bus-front.jpg",
              fileSize: 4096,
              mimeType: "image/jpeg",
              isPrimary: true,
              url: "storage://private/test/photos/bus-front.jpg",
            },
          ],
        },
      ],
    };

    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(dataWithDocs);

    expect(response.status).toBe(201);

    // Verify documents were created
    const user = await prisma.user.findUnique({
      where: { email: dataWithDocs.email },
      include: {
        documents: true,
        vehicles: {
          include: {
            documents: true,
            photos: true,
          },
        },
      },
    });

    expect(user).not.toBeNull();
    expect(user!.documents.length).toBe(2);
    expect(user!.vehicles[0].documents.length).toBe(3);
    expect(user!.vehicles[0].photos.length).toBe(1);
    expect(user!.vehicles[0].photos[0].isPrimary).toBe(true);
  });
});

// ============================================
// 6. BUSINESS PROFILE TESTS
// ============================================
describe("POST /owner/register - Business Profile", () => {
  beforeEach(async () => {
    await cleanupTestOwner();
  });

  afterEach(async () => {
    await cleanupTestOwner();
  });

  it("should store business info when provided", async () => {
    const dataWithBusiness = {
      ...validOwnerData,
      email: "test.owner.business@example.com",
      businessInfo: {
        businessName: "Test Bus Company",
        businessType: "private-limited",
        businessRegNumber: "PV12345",
        tinNumber: "TIN123456",
      },
    };

    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send(dataWithBusiness);

    expect(response.status).toBe(201);

    // Business info is stored on the user record
    const user = await prisma.user.findUnique({
      where: { email: dataWithBusiness.email },
    });

    expect(user).not.toBeNull();
    expect(user!.businessName).toBe("Test Bus Company");
    expect(user!.businessType).toBe("private-limited");
    expect(user!.businessRegNumber).toBe("PV12345");
    expect(user!.tinNumber).toBe("TIN123456");
  });

  it("should allow registration without business info", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        businessInfo: undefined,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});

// ============================================
// 7. EDGE CASES
// ============================================
describe("POST /owner/register - Edge Cases", () => {
  beforeEach(async () => {
    await cleanupTestOwner();
  });

  afterEach(async () => {
    await cleanupTestOwner();
  });

  it("should sanitize XSS in input fields", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        firstName: '<script>alert("xss")</script>Test',
        lastName: 'Owner<img src=x onerror=alert("xss")>',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.firstName).not.toContain("<script>");
    expect(response.body.data.user.lastName).not.toContain("<img");
  });

  it("should handle empty optional postal code", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        address: {
          ...validOwnerData.address,
          postalCode: "",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("should trim whitespace from input fields", async () => {
    const response = await request(app)
      .post(`${API_BASE}/owner/register`)
      .send({
        ...validOwnerData,
        firstName: "  Test  ",
        lastName: "  Owner  ",
        email: "  test.owner.reg@example.com  ",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.firstName).toBe("Test");
    expect(response.body.data.user.lastName).toBe("Owner");
    expect(response.body.data.user.email).toBe("test.owner.reg@example.com");
  });
});
