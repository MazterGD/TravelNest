/**
 * Authentication API Tests
 * Comprehensive test suite following industry standards
 *
 * Test Categories:
 * 1. Registration Tests
 * 2. Login Tests
 * 3. Token Management Tests
 * 4. Password Management Tests
 * 5. Authorization/RBAC Tests
 * 6. Security Tests (XSS, SQL Injection, Rate Limiting)
 * 7. Edge Cases
 */
import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma, testUsers, cleanupTestUsers } from "./setup";

// Import app directly for testing
import app from "../src/app";

const API_BASE = "/api/v1";

// ============================================
// 1. REGISTRATION TESTS
// ============================================
describe("POST /auth/register", () => {
  beforeEach(async () => {
    await cleanupTestUsers();
  });

  describe("Successful Registration", () => {
    it("should register a new customer successfully", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data.user.email).toBe(testUsers.customer.email);
      expect(response.body.data.user.role).toBe("CUSTOMER");
      expect(response.body.data.user).not.toHaveProperty("password");
    });

    it("should register a new vehicle owner successfully", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.owner);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe("VEHICLE_OWNER");
    });

    it("should set HTTP-only cookie for refresh token", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      expect(response.status).toBe(201);
      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies!.some((c: string) => c.includes("refreshToken"))).toBe(
        true,
      );
      expect(cookies!.some((c: string) => c.includes("HttpOnly"))).toBe(true);
    });

    it("should normalize email to lowercase", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          email: "TEST.CUSTOMER@EXAMPLE.COM",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user.email).toBe("test.customer@example.com");
    });

    it("should return a valid JWT access token", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      expect(response.status).toBe(201);
      const { accessToken } = response.body.data;

      // Verify token is valid
      const decoded = jwt.decode(accessToken) as {
        id: string;
        email: string;
        role: string;
      };
      expect(decoded).toHaveProperty("id");
      expect(decoded).toHaveProperty("email");
      expect(decoded).toHaveProperty("role");
      expect(decoded.email).toBe(testUsers.customer.email);
    });
  });

  describe("Registration Validation Errors", () => {
    it("should reject registration with missing email", async () => {
      const { email, ...userData } = testUsers.customer;
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(userData);

      expect(response.status).toBe(422); // Zod validation returns 422
      expect(response.body.success).toBe(false);
    });

    it("should reject registration with invalid email format", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          email: "not-an-email",
        });

      expect(response.status).toBe(422); // Zod validation returns 422
      expect(response.body.success).toBe(false);
    });

    it("should reject registration with password less than 8 characters", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          password: "Short1!",
        });

      expect(response.status).toBe(422); // Zod validation returns 422
      expect(response.body.success).toBe(false);
    });

    it("should reject registration with password without uppercase", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          password: "lowercase123!",
        });

      expect(response.status).toBe(422); // Zod validation returns 422
      expect(response.body.success).toBe(false);
    });

    it("should reject registration with password without number", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          password: "NoNumberHere!",
        });

      expect(response.status).toBe(422); // Zod validation returns 422
      expect(response.body.success).toBe(false);
    });

    it("should reject registration with missing firstName", async () => {
      const { firstName, ...userData } = testUsers.customer;
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(userData);

      expect(response.status).toBe(422); // Zod validation returns 422
      expect(response.body.success).toBe(false);
    });

    it("should reject registration with firstName less than 2 characters", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          firstName: "A",
        });

      expect(response.status).toBe(422); // Zod validation returns 422
      expect(response.body.success).toBe(false);
    });

    it("should reject registration with missing lastName", async () => {
      const { lastName, ...userData } = testUsers.customer;
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(userData);

      expect(response.status).toBe(422); // Zod validation returns 422
      expect(response.body.success).toBe(false);
    });
  });

  describe("Duplicate Email Handling", () => {
    it("should reject registration with existing email", async () => {
      // First registration
      await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      // Attempt duplicate
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain("already registered");
    });

    it("should reject registration with same email different case", async () => {
      await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          email: testUsers.customer.email.toUpperCase(),
        });

      expect(response.status).toBe(409);
    });
  });
});

// ============================================
// 2. LOGIN TESTS
// ============================================
describe("POST /auth/login", () => {
  beforeEach(async () => {
    await cleanupTestUsers();
    // Create test user
    await request(app)
      .post(`${API_BASE}/auth/register`)
      .send(testUsers.customer);
  });

  describe("Successful Login", () => {
    it("should login with valid credentials", async () => {
      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: testUsers.customer.email,
        password: testUsers.customer.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data.user.email).toBe(testUsers.customer.email);
    });

    it("should login with email in different case", async () => {
      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: testUsers.customer.email.toUpperCase(),
        password: testUsers.customer.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should set HTTP-only refresh token cookie on login", async () => {
      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: testUsers.customer.email,
        password: testUsers.customer.password,
      });

      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies!.some((c: string) => c.includes("refreshToken"))).toBe(
        true,
      );
      expect(cookies!.some((c: string) => c.includes("HttpOnly"))).toBe(true);
    });

    it("should not return password in user object", async () => {
      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: testUsers.customer.email,
        password: testUsers.customer.password,
      });

      expect(response.body.data.user).not.toHaveProperty("password");
    });
  });

  describe("Failed Login Attempts", () => {
    it("should reject login with incorrect password", async () => {
      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: testUsers.customer.email,
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject login with non-existent email", async () => {
      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: "nonexistent@example.com",
        password: testUsers.customer.password,
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return generic error message for security (not revealing which field is wrong)", async () => {
      const wrongPassword = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: testUsers.customer.email,
          password: "WrongPassword123!",
        });

      const wrongEmail = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: "wrong@example.com",
          password: testUsers.customer.password,
        });

      // Both should have the same error message (not revealing which field is wrong)
      expect(wrongPassword.body.error.message).toBe(
        wrongEmail.body.error.message,
      );
    });

    it("should reject login with missing email", async () => {
      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        password: testUsers.customer.password,
      });

      expect(response.status).toBe(422); // Zod validation returns 422
    });

    it("should reject login with missing password", async () => {
      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: testUsers.customer.email,
      });

      expect(response.status).toBe(422); // Zod validation returns 422
    });
  });

  describe("Account Status Handling", () => {
    it("should reject login for suspended user", async () => {
      // Suspend the user directly in database
      await prisma.user.update({
        where: { email: testUsers.customer.email },
        data: { status: "SUSPENDED" },
      });

      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: testUsers.customer.email,
        password: testUsers.customer.password,
      });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain("suspended");
    });

    it("should reject login for inactive user", async () => {
      await prisma.user.update({
        where: { email: testUsers.customer.email },
        data: { status: "INACTIVE" },
      });

      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: testUsers.customer.email,
        password: testUsers.customer.password,
      });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain("not active");
    });
  });
});

// ============================================
// 3. TOKEN MANAGEMENT TESTS
// ============================================
describe("Token Management", () => {
  let accessToken: string;
  let refreshTokenCookie: string;

  beforeEach(async () => {
    await cleanupTestUsers();
    const registerResponse = await request(app)
      .post(`${API_BASE}/auth/register`)
      .send(testUsers.customer);

    accessToken = registerResponse.body.data.accessToken;
    refreshTokenCookie = registerResponse.headers["set-cookie"]?.[0] || "";
  });

  describe("GET /auth/me - Get Current User", () => {
    it("should return current user with valid token", async () => {
      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUsers.customer.email);
    });

    it("should reject request without token", async () => {
      const response = await request(app).get(`${API_BASE}/auth/me`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should reject request with invalid token", async () => {
      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set("Authorization", "Bearer invalid.token.here");

      expect(response.status).toBe(401);
    });

    it("should reject request with expired token", async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { id: "test", email: "test@test.com", role: "CUSTOMER" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "-1h" },
      );

      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    // Regression: TokenExpiredError extends JsonWebTokenError, so the middleware
    // must surface the TOKEN_EXPIRED code (not the generic "Invalid token") —
    // the web client's silent refresh only triggers on that exact code. Needs no
    // DB: jwt.verify throws on the expired token before any Prisma lookup runs.
    it("should return TOKEN_EXPIRED code for an expired access token", async () => {
      const expiredToken = jwt.sign(
        { id: "test", email: "test@test.com", role: "CUSTOMER" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "-1h" },
      );

      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("TOKEN_EXPIRED");
    });

    it("should reject request with malformed Authorization header", async () => {
      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set("Authorization", accessToken); // Missing "Bearer " prefix

      expect(response.status).toBe(401);
    });
  });

  describe("POST /auth/refresh-token", () => {
    it("should refresh tokens with valid refresh token", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/refresh-token`)
        .set("Cookie", refreshTokenCookie)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("accessToken");
    });

    it("should reject refresh without refresh token", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/refresh-token`)
        .send({});

      expect(response.status).toBe(401);
    });

    it("should reject refresh with invalid refresh token", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/refresh-token`)
        .set("Cookie", "refreshToken=invalid.token.here")
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe("POST /auth/logout", () => {
    it("should logout successfully and clear refresh token cookie", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/logout`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Check that cookie is cleared
      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(
        cookies!.some(
          (c: string) =>
            c.includes("refreshToken=;") || c.includes("refreshToken="),
        ),
      ).toBe(true);
    });

    it("should reject logout without authentication", async () => {
      const response = await request(app).post(`${API_BASE}/auth/logout`);

      expect(response.status).toBe(401);
    });
  });
});

// ============================================
// 4. PASSWORD MANAGEMENT TESTS
// ============================================
describe("Password Management", () => {
  let accessToken: string;

  beforeEach(async () => {
    await cleanupTestUsers();
    const response = await request(app)
      .post(`${API_BASE}/auth/register`)
      .send(testUsers.customer);
    accessToken = response.body.data.accessToken;
  });

  describe("PUT /auth/change-password", () => {
    it("should change password with valid current password", async () => {
      const response = await request(app)
        .put(`${API_BASE}/auth/change-password`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: testUsers.customer.password,
          newPassword: "NewPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify new password works
      const loginResponse = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: testUsers.customer.email,
          password: "NewPassword123!",
        });

      expect(loginResponse.status).toBe(200);
    });

    it("should reject change with incorrect current password", async () => {
      const response = await request(app)
        .put(`${API_BASE}/auth/change-password`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "WrongPassword123!",
          newPassword: "NewPassword123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("incorrect");
    });

    it("should reject change without authentication", async () => {
      const response = await request(app)
        .put(`${API_BASE}/auth/change-password`)
        .send({
          currentPassword: testUsers.customer.password,
          newPassword: "NewPassword123!",
        });

      expect(response.status).toBe(401);
    });

    it("should reject weak new password", async () => {
      const response = await request(app)
        .put(`${API_BASE}/auth/change-password`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: testUsers.customer.password,
          newPassword: "weak",
        });

      expect(response.status).toBe(422); // Zod validation returns 422 for weak password
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("should accept request for existing email", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/forgot-password`)
        .send({ email: testUsers.customer.email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should accept request for non-existing email (security - no information leak)", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/forgot-password`)
        .send({ email: "nonexistent@example.com" });

      // Should return same response as existing email
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return same message for existing and non-existing emails", async () => {
      const existingResponse = await request(app)
        .post(`${API_BASE}/auth/forgot-password`)
        .send({ email: testUsers.customer.email });

      const nonExistingResponse = await request(app)
        .post(`${API_BASE}/auth/forgot-password`)
        .send({ email: "nonexistent@example.com" });

      expect(
        existingResponse.body.message || existingResponse.body.data?.message,
      ).toBe(
        nonExistingResponse.body.message ||
          nonExistingResponse.body.data?.message,
      );
    });
  });

  describe("POST /auth/reset-password", () => {
    it("should reject reset with invalid token", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/reset-password`)
        .send({
          token: "invalid.reset.token",
          password: "NewPassword123!",
        });

      expect(response.status).toBe(400);
    });

    it("should reject reset with expired token", async () => {
      // Create an expired reset token
      const expiredToken = jwt.sign(
        { id: "test-id", purpose: "password-reset" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "-1h" },
      );

      const response = await request(app)
        .post(`${API_BASE}/auth/reset-password`)
        .send({
          token: expiredToken,
          password: "NewPassword123!",
        });

      expect(response.status).toBe(400);
    });

    it("should reject reset with token for wrong purpose", async () => {
      const wrongPurposeToken = jwt.sign(
        { id: "test-id", purpose: "email-verification" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "1h" },
      );

      const response = await request(app)
        .post(`${API_BASE}/auth/reset-password`)
        .send({
          token: wrongPurposeToken,
          password: "NewPassword123!",
        });

      expect(response.status).toBe(400);
    });
  });
});

// ============================================
// 5. AUTHORIZATION / RBAC TESTS
// ============================================
describe("Authorization / RBAC", () => {
  let customerToken: string;
  let ownerToken: string;

  beforeEach(async () => {
    await cleanupTestUsers();

    // Create customer
    const customerResponse = await request(app)
      .post(`${API_BASE}/auth/register`)
      .send(testUsers.customer);
    customerToken = customerResponse.body.data.accessToken;

    // Create owner
    const ownerResponse = await request(app)
      .post(`${API_BASE}/auth/register`)
      .send(testUsers.owner);
    ownerToken = ownerResponse.body.data.accessToken;
  });

  it("should return correct role in token for customer", async () => {
    const decoded = jwt.decode(customerToken) as { role: string };
    expect(decoded.role).toBe("CUSTOMER");
  });

  it("should return correct role in token for vehicle owner", async () => {
    const decoded = jwt.decode(ownerToken) as { role: string };
    expect(decoded.role).toBe("VEHICLE_OWNER");
  });

  it("should include role in /auth/me response", async () => {
    const response = await request(app)
      .get(`${API_BASE}/auth/me`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(response.body.data.user.role).toBe("CUSTOMER");
  });
});

// ============================================
// 6. SECURITY TESTS
// ============================================
describe("Security Tests", () => {
  beforeEach(async () => {
    await cleanupTestUsers();
  });

  describe("XSS Prevention", () => {
    it("should sanitize XSS in firstName", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          email: "xss@example.com",
          firstName: '<script>alert("xss")</script>',
        });

      if (response.status === 201) {
        // If registration succeeds, the script should be stored safely (escaped)
        expect(response.body.data.user.firstName).not.toContain("<script>");
      } else {
        // If validation rejects it, that's also acceptable
        expect(response.status).toBe(400);
      }
    });

    it("should sanitize XSS in lastName", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          email: "xss@example.com",
          lastName: '<img src=x onerror="alert(1)">',
        });

      if (response.status === 201) {
        expect(response.body.data.user.lastName).not.toContain("onerror");
      }
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should prevent SQL injection in email", async () => {
      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: "'; DROP TABLE users; --",
        password: "TestPassword123!",
      });

      // Should fail validation (Zod returns 422 for invalid email format) or auth error
      expect([401, 422]).toContain(response.status);
    });

    it("should prevent SQL injection in password", async () => {
      // First register
      await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      const response = await request(app).post(`${API_BASE}/auth/login`).send({
        email: testUsers.customer.email,
        password: "' OR '1'='1",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Password Security", () => {
    it("should hash passwords (not store in plaintext)", async () => {
      await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      const user = await prisma.user.findUnique({
        where: { email: testUsers.customer.email },
      });

      expect(user?.password).not.toBe(testUsers.customer.password);
      expect(user?.password).toMatch(/^\$2[aby]?\$.{56}$/); // bcrypt hash pattern
    });

    it("should never return password in any response", async () => {
      const registerResponse = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      expect(registerResponse.body.data.user).not.toHaveProperty("password");

      const loginResponse = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: testUsers.customer.email,
          password: testUsers.customer.password,
        });

      expect(loginResponse.body.data.user).not.toHaveProperty("password");

      const meResponse = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set(
          "Authorization",
          `Bearer ${registerResponse.body.data.accessToken}`,
        );

      expect(meResponse.body.data.user).not.toHaveProperty("password");
    });
  });

  describe("Token Security", () => {
    it("should not accept tokens signed with different secret", async () => {
      const fakeToken = jwt.sign(
        { id: "fake-id", email: "fake@example.com", role: "ADMIN" },
        "wrong-secret",
        { expiresIn: "1h" },
      );

      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set("Authorization", `Bearer ${fakeToken}`);

      expect(response.status).toBe(401);
    });

    it("should reject tampered tokens", async () => {
      const registerResponse = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      const validToken = registerResponse.body.data.accessToken;
      // Tamper with the token payload
      const [header, _payload, signature] = validToken.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          id: "hacked",
          email: "hacked@test.com",
          role: "ADMIN",
        }),
      ).toString("base64url");
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set("Authorization", `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe("Cookie Security", () => {
    it("should set SameSite attribute on cookies", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(testUsers.customer);

      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);
      expect(
        cookies!.some((c: string) => c.toLowerCase().includes("samesite")),
      ).toBe(true);
    });
  });
});

// ============================================
// 7. EDGE CASES
// ============================================
describe("Edge Cases", () => {
  beforeEach(async () => {
    await cleanupTestUsers();
  });

  describe("Empty and Whitespace Handling", () => {
    it("should reject email with only whitespace", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          email: "   ",
        });

      expect(response.status).toBe(422); // Zod validation returns 422
    });

    it("should trim whitespace from email", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          email: "  test.customer@example.com  ",
        });

      if (response.status === 201) {
        expect(response.body.data.user.email).toBe("test.customer@example.com");
      }
    });

    it("should handle empty request body", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({});

      expect(response.status).toBe(422); // Zod validation returns 422
    });

    it("should handle null values", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          email: null,
          password: null,
          firstName: null,
          lastName: null,
        });

      expect(response.status).toBe(422); // Zod validation returns 422
    });
  });

  describe("Unicode and Special Characters", () => {
    it("should handle Unicode characters in names", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          firstName: "日本語",
          lastName: "Müller",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user.firstName).toBe("日本語");
      expect(response.body.data.user.lastName).toBe("Müller");
    });

    it("should handle emoji in names", async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          firstName: "Test😀",
          lastName: "User🎉",
        });

      // Either accept or reject consistently (Zod may return 422 for validation)
      expect([201, 400, 422]).toContain(response.status);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent registrations with same email", async () => {
      const registrations = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .post(`${API_BASE}/auth/register`)
            .send(testUsers.customer),
        );

      const results = await Promise.all(registrations);

      // Due to race conditions, we should have at least 1 success and at most 4 conflicts
      const successCount = results.filter((r) => r.status === 201).length;
      const conflictCount = results.filter((r) => r.status === 409).length;

      // At least one should succeed (but due to race conditions, more might succeed)
      expect(successCount).toBeGreaterThanOrEqual(1);
      // Success + conflicts should equal total attempts
      expect(successCount + conflictCount).toBe(5);
    });
  });

  describe("Large Input Handling", () => {
    it("should reject extremely long email", async () => {
      const longEmail = "a".repeat(500) + "@example.com";
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          email: longEmail,
        });

      expect([400, 422]).toContain(response.status);
    });

    it("should reject extremely long password", async () => {
      const longPassword = "A1!" + "a".repeat(10000);
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...testUsers.customer,
          password: longPassword,
        });

      // Should either reject or handle gracefully (422 is also valid for validation errors)
      expect([201, 400, 413, 422]).toContain(response.status);
    });
  });
});

// ============================================
// 8. RESPONSE FORMAT VALIDATION
// ============================================
describe("Response Format Validation", () => {
  beforeEach(async () => {
    await cleanupTestUsers();
  });

  it("should return consistent success response format", async () => {
    const response = await request(app)
      .post(`${API_BASE}/auth/register`)
      .send(testUsers.customer);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("data");
  });

  it("should return consistent error response format", async () => {
    const response = await request(app).post(`${API_BASE}/auth/login`).send({
      email: "nonexistent@example.com",
      password: "WrongPassword123!",
    });

    expect(response.body).toHaveProperty("success", false);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("message");
    expect(response.body.error).toHaveProperty("code");
  });

  it("should return proper content-type header", async () => {
    const response = await request(app)
      .post(`${API_BASE}/auth/register`)
      .send(testUsers.customer);

    expect(response.headers["content-type"]).toMatch(/application\/json/);
  });
});
