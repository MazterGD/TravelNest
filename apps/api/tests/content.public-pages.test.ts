/**
 * Public content pages (Terms, Privacy, ...): only published pages are served,
 * drafts and unknown slugs answer 404.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "./setup";
import app from "../src/app";

const API_BASE = "/api/v1";
const TAG = `cp-${Date.now().toString(36)}`;
const PUBLISHED = `${TAG}-terms`;
const DRAFT = `${TAG}-draft`;

describe("GET /content/:slug", () => {
  beforeAll(async () => {
    await prisma.contentPage.createMany({
      data: [
        {
          slug: PUBLISHED,
          title: "Terms",
          content: { en: { body: "Be kind" }, si: { body: "සුහදව" } },
          excerpt: "internal excerpt",
          isPublished: true,
          publishedAt: new Date(),
        },
        { slug: DRAFT, title: "Draft", content: { en: { body: "WIP" } } },
      ],
    });
  });

  afterAll(async () => {
    await prisma.contentPage.deleteMany({ where: { slug: { startsWith: TAG } } });
  });

  it("returns a published page with only its public fields", async () => {
    const response = await request(app).get(`${API_BASE}/content/${PUBLISHED}`);

    expect(response.status).toBe(200);
    const page = response.body.data.page;
    expect(page).toMatchObject({
      slug: PUBLISHED,
      title: "Terms",
      content: { en: { body: "Be kind" }, si: { body: "සුහදව" } },
    });
    expect(Object.keys(page).sort()).toEqual(["content", "slug", "title", "updatedAt"]);
  });

  it("hides unpublished drafts", async () => {
    const response = await request(app).get(`${API_BASE}/content/${DRAFT}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("answers 404 for an unknown slug", async () => {
    const response = await request(app).get(`${API_BASE}/content/${TAG}-missing`);

    expect(response.status).toBe(404);
  });
});
