import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { config } from "../src/config/index";
import "./setup";
import { prisma } from "@travenest/database";

const API_BASE = "/api/v1";

const createdEmails: string[] = [];
const createdFaqIds: string[] = [];
const createdAmenityIds: string[] = [];
const touchedContentSlugs: string[] = [];
const createdPlatformNotificationIds: string[] = [];
const createdTestimonialIds: string[] = [];

const uniqueTag = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const trackEmail = (email: string) => {
  createdEmails.push(email);
  return email;
};

const makeEmail = (label: string) =>
  trackEmail(`phase5.integration.${label}.${uniqueTag()}@example.com`);

const makeToken = (
  id: string,
  email: string,
  role: "ADMIN" | "CUSTOMER" | "VEHICLE_OWNER",
) => jwt.sign({ id, email, role }, config.jwt.secret, { expiresIn: "1h" });

const createAdmin = async (
  adminRole: "SUPER_ADMIN" | "MODERATOR" | "FINANCE_ADMIN" | "SUPPORT_ADMIN",
) => {
  const admin = await prisma.user.create({
    data: {
      email: makeEmail("admin"),
      password: "password-hash",
      firstName: "Phase5",
      lastName: "Admin",
      role: "ADMIN",
      adminRole,
      status: "ACTIVE",
      isVerified: true,
    },
  });

  return {
    admin,
    token: makeToken(admin.id, admin.email, "ADMIN"),
  };
};

const createCustomer = async (label: string) => {
  return prisma.user.create({
    data: {
      email: makeEmail(label),
      password: "password-hash",
      firstName: "Phase5",
      lastName: "Customer",
      role: "CUSTOMER",
      status: "ACTIVE",
      isVerified: true,
      district: "Colombo",
    },
  });
};

afterEach(async () => {
  if (createdPlatformNotificationIds.length > 0) {
    await prisma.platformNotification.deleteMany({
      where: {
        id: {
          in: Array.from(new Set(createdPlatformNotificationIds)),
        },
      },
    });

    createdPlatformNotificationIds.length = 0;
  }

  if (createdAmenityIds.length > 0) {
    await prisma.amenity.deleteMany({
      where: {
        id: {
          in: Array.from(new Set(createdAmenityIds)),
        },
      },
    });

    createdAmenityIds.length = 0;
  }

  if (createdFaqIds.length > 0) {
    await prisma.faq.deleteMany({
      where: {
        id: {
          in: Array.from(new Set(createdFaqIds)),
        },
      },
    });

    createdFaqIds.length = 0;
  }

  if (createdTestimonialIds.length > 0) {
    await prisma.testimonial.deleteMany({
      where: {
        id: {
          in: Array.from(new Set(createdTestimonialIds)),
        },
      },
    });

    createdTestimonialIds.length = 0;
  }

  if (touchedContentSlugs.length > 0) {
    await prisma.contentPage.deleteMany({
      where: {
        slug: {
          in: Array.from(new Set(touchedContentSlugs)),
        },
      },
    });

    touchedContentSlugs.length = 0;
  }

  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: Array.from(new Set(createdEmails)),
        },
      },
    });

    createdEmails.length = 0;
  }
});

describe("Admin Phase 5 - settings and content endpoints", () => {
  it("gets and updates platform settings for super admins", async () => {
    const { token } = await createAdmin("SUPER_ADMIN");

    const getResponse = await request(app)
      .get(`${API_BASE}/admin/settings/platform`)
      .set("Authorization", `Bearer ${token}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.success).toBe(true);
    expect(typeof getResponse.body.data.maintenanceMode).toBe("boolean");

    const maintenanceMessage = `Maintenance ${uniqueTag()}`;

    const patchResponse = await request(app)
      .patch(`${API_BASE}/admin/settings/platform`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        maintenanceMode: true,
        maintenanceMessage,
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.success).toBe(true);
    expect(patchResponse.body.data.maintenanceMode).toBe(true);
    expect(patchResponse.body.data.maintenanceMessage).toBe(maintenanceMessage);
  });

  it("blocks platform settings for non super admins", async () => {
    const { token } = await createAdmin("MODERATOR");

    const response = await request(app)
      .get(`${API_BASE}/admin/settings/platform`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("manages content pages and faqs", async () => {
    const { token } = await createAdmin("SUPER_ADMIN");
    const contentSlug = `terms-${uniqueTag()}`;
    touchedContentSlugs.push(contentSlug);

    const getPageResponse = await request(app)
      .get(`${API_BASE}/admin/content/${contentSlug}`)
      .set("Authorization", `Bearer ${token}`);

    expect(getPageResponse.status).toBe(200);
    expect(getPageResponse.body.success).toBe(true);
    expect(getPageResponse.body.data.slug).toBe(contentSlug);

    const patchPageResponse = await request(app)
      .patch(`${API_BASE}/admin/content/${contentSlug}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Updated Terms and Conditions",
        excerpt: "Updated legal terms for TravelNest",
        content: {
          blocks: [
            {
              type: "paragraph",
              text: "These are the updated terms.",
            },
          ],
        },
        isPublished: true,
      });

    expect(patchPageResponse.status).toBe(200);
    expect(patchPageResponse.body.success).toBe(true);
    expect(patchPageResponse.body.data.title).toBe("Updated Terms and Conditions");
    expect(patchPageResponse.body.data.isPublished).toBe(true);

    const listContentResponse = await request(app)
      .get(`${API_BASE}/admin/content?search=${contentSlug}`)
      .set("Authorization", `Bearer ${token}`);

    expect(listContentResponse.status).toBe(200);
    expect(listContentResponse.body.success).toBe(true);
    expect(
      listContentResponse.body.data.items.some(
        (item: { slug: string }) => item.slug === contentSlug,
      ),
    ).toBe(true);

    const createFaqResponse = await request(app)
      .post(`${API_BASE}/admin/faqs`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "How can I cancel my booking?",
        answer: "You can cancel from your bookings page before trip start.",
        category: "BOOKING",
        sortOrder: 5,
      });

    expect(createFaqResponse.status).toBe(201);
    expect(createFaqResponse.body.success).toBe(true);

    const faqId = createFaqResponse.body.data.id as string;
    createdFaqIds.push(faqId);

    const updateFaqResponse = await request(app)
      .patch(`${API_BASE}/admin/faqs/${faqId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        isPublished: false,
      });

    expect(updateFaqResponse.status).toBe(200);
    expect(updateFaqResponse.body.success).toBe(true);
    expect(updateFaqResponse.body.data.isPublished).toBe(false);

    const deleteFaqResponse = await request(app)
      .delete(`${API_BASE}/admin/faqs/${faqId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteFaqResponse.status).toBe(200);
    expect(deleteFaqResponse.body.success).toBe(true);
    expect(deleteFaqResponse.body.data.deleted).toBe(true);

    createdFaqIds.splice(createdFaqIds.indexOf(faqId), 1);
  });

  it("approves and updates testimonials", async () => {
    const { token } = await createAdmin("SUPER_ADMIN");

    const testimonial = await prisma.testimonial.create({
      data: {
        name: "Phase5 Testimonial",
        role: "Operations Manager",
        organization: "ABC Travels",
        imageUrl: "https://example.com/testimonial-phase5.jpg",
        rating: 4,
        quote: "The platform helped us scale quickly.",
        tripDetails: "Colombo to Ella",
        sortOrder: 12,
        isActive: false,
      },
    });

    createdTestimonialIds.push(testimonial.id);

    const approveResponse = await request(app)
      .post(`${API_BASE}/admin/testimonials/${testimonial.id}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "Approved after moderation" });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.success).toBe(true);
    expect(approveResponse.body.data.isActive).toBe(true);

    const updateResponse = await request(app)
      .patch(`${API_BASE}/admin/testimonials/${testimonial.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        quote: "Updated quote for phase 5 admin tests.",
        rating: 5,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.rating).toBe(5);

    const deleteResponse = await request(app)
      .delete(`${API_BASE}/admin/testimonials/${testimonial.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
    expect(deleteResponse.body.data.deleted).toBe(true);

    createdTestimonialIds.splice(createdTestimonialIds.indexOf(testimonial.id), 1);
  });

  it("manages amenities lifecycle", async () => {
    const { token } = await createAdmin("SUPER_ADMIN");
    const code = `USB_PORT_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const createResponse = await request(app)
      .post(`${API_BASE}/admin/amenities`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        code,
        name: "USB Charging Port",
        description: "USB outlets near every seat",
        sortOrder: 3,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.code).toBe(code);

    const amenityId = createResponse.body.data.id as string;
    createdAmenityIds.push(amenityId);

    const listResponse = await request(app)
      .get(`${API_BASE}/admin/amenities?search=${code}`)
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(
      listResponse.body.data.items.some((item: { id: string }) => item.id === amenityId),
    ).toBe(true);

    const updateResponse = await request(app)
      .patch(`${API_BASE}/admin/amenities/${amenityId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "USB-C Charging Port",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.name).toBe("USB-C Charging Port");

    const deleteResponse = await request(app)
      .delete(`${API_BASE}/admin/amenities/${amenityId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
    expect(deleteResponse.body.data.deleted).toBe(true);

    createdAmenityIds.splice(createdAmenityIds.indexOf(amenityId), 1);
  });

  it("creates, tracks analytics, and resends platform notifications", async () => {
    const { token } = await createAdmin("SUPER_ADMIN");
    const targetUser = await createCustomer("notify-target");

    const sentBefore = await prisma.notification.count({
      where: {
        userId: targetUser.id,
        type: "platform_announcement",
      },
    });

    const createResponse = await request(app)
      .post(`${API_BASE}/admin/notifications`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: `Service advisory ${uniqueTag()}`,
        message: "Please note scheduled maintenance tonight at 11 PM.",
        type: "ANNOUNCEMENT",
        channel: "IN_APP",
        targetUserIds: [targetUser.id],
        metadata: {
          source: "phase5-integration-test",
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.delivery.recipientCount).toBe(1);

    const notificationId = createResponse.body.data.notification.id as string;
    createdPlatformNotificationIds.push(notificationId);

    const listResponse = await request(app)
      .get(`${API_BASE}/admin/notifications?search=Service advisory`)
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(
      listResponse.body.data.items.some((item: { id: string }) => item.id === notificationId),
    ).toBe(true);

    const analyticsResponse = await request(app)
      .get(`${API_BASE}/admin/notifications/${notificationId}/analytics`)
      .set("Authorization", `Bearer ${token}`);

    expect(analyticsResponse.status).toBe(200);
    expect(analyticsResponse.body.success).toBe(true);
    expect(analyticsResponse.body.data.metrics.targetedRecipients).toBe(1);
    expect(analyticsResponse.body.data.metrics.delivered).toBeGreaterThanOrEqual(1);

    const resendResponse = await request(app)
      .patch(`${API_BASE}/admin/notifications/${notificationId}/resend`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        message: "Maintenance has been postponed to 1 AM.",
      });

    expect(resendResponse.status).toBe(200);
    expect(resendResponse.body.success).toBe(true);

    const resentId = resendResponse.body.data.notification.id as string;
    createdPlatformNotificationIds.push(resentId);

    const sentAfter = await prisma.notification.count({
      where: {
        userId: targetUser.id,
        type: "platform_announcement",
      },
    });

    expect(sentAfter).toBeGreaterThanOrEqual(sentBefore + 2);
  });
});
