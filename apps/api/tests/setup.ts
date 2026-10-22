/**
 * Test Setup File
 * Initializes test environment and cleanup
 */
import { beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";

// Set test environment to disable rate limiting
process.env.NODE_ENV = "test";

// PayHere env must be set here (setupFiles run before test-file imports) so
// src/config captures it; top-of-file assignments in test files run after the
// hoisted app/config imports and are too late.
process.env.PAYHERE_MERCHANT_ID = "TEST_MERCHANT";
process.env.PAYHERE_MERCHANT_SECRET = "TEST_SECRET";

// Test database client
export const prisma = new PrismaClient();

// Test user data for reuse
export const testUsers = {
  customer: {
    email: "test.customer@example.com",
    password: "TestPassword123!",
    firstName: "Test",
    lastName: "Customer",
    phone: "+94771234567",
    role: "customer" as const,
  },
  owner: {
    email: "test.owner@example.com",
    password: "TestPassword123!",
    firstName: "Test",
    lastName: "Owner",
    phone: "+94777654321",
    role: "owner" as const,
  },
  admin: {
    email: "test.admin@example.com",
    password: "AdminPassword123!",
    firstName: "Test",
    lastName: "Admin",
  },
};

// Clean up test data before all tests
beforeAll(async () => {
  // Connect to database
  await prisma.$connect();

  // Clean up any existing test users
  await cleanupTestUsers();
});

// Clean up after each test to ensure isolation
afterEach(async () => {
  await cleanupTestUsers();
});

// Disconnect after all tests
afterAll(async () => {
  await cleanupTestUsers();
  await prisma.$disconnect();
});

// Helper to clean up test users
async function cleanupTestUsers() {
  const testEmails = [
    testUsers.customer.email,
    testUsers.owner.email,
    testUsers.admin.email,
    "duplicate@example.com",
    "newuser@example.com",
    "inactive@example.com",
    "suspended@example.com",
    "xss@example.com",
    "sqli@example.com",
  ];

  await prisma.user.deleteMany({
    where: {
      email: {
        in: testEmails,
      },
    },
  });
}

// Export cleanup function for individual tests
export { cleanupTestUsers };
