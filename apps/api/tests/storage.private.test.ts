/**
 * Private storage for documents and receipts (ADR-001): uploads return a
 * storage reference, responses carry short-lived signed URLs instead.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";

const upload = vi.fn();
const remove = vi.fn();
const createSignedUrls = vi.fn();
const from = vi.fn(() => ({ upload, remove, createSignedUrls }));
const createClient = vi.fn((_url: string, _key: string) => ({
  storage: { from },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string) => createClient(url, key),
}));

const loadStorage = async (serviceRoleKey: string) => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "publishable";
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  process.env.SUPABASE_PRIVATE_BUCKET = "private-bucket";
  process.env.SUPABASE_BUCKET = "travenest";
  return import("../src/utils/storage");
};

const file = {
  prefix: "registration/owner-documents/nic",
  fileName: "my nic.pdf",
  buffer: Buffer.from("pdf"),
  contentType: "application/pdf",
};

const STORAGE_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PRIVATE_BUCKET",
  "SUPABASE_BUCKET",
] as const;
const originalEnv = Object.fromEntries(
  STORAGE_ENV.map((key) => [key, process.env[key]]),
);

afterAll(() => {
  for (const key of STORAGE_ENV) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  vi.resetModules();
});

describe("private storage utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
  });

  it("uploads to the private bucket with the service key and returns a reference", async () => {
    const storage = await loadStorage("service-key");

    const result = await storage.uploadPrivateBuffer(file);

    expect(createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-key",
    );
    expect(from).toHaveBeenCalledWith("private-bucket");
    expect(result.url).toBe(`storage://private/${result.path}`);
    expect(result.path).toMatch(
      /^registration\/owner-documents\/nic\/\d+_[0-9a-f-]{36}_my_nic\.pdf$/,
    );
  });

  it("falls back to the public bucket outside production without a service key", async () => {
    const storage = await loadStorage("");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await storage.uploadPrivateBuffer(file);

    expect(result.url).toMatch(
      /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/travenest\//,
    );
    warn.mockRestore();
  });

  it("signs references in one call and maps them back", async () => {
    const storage = await loadStorage("service-key");
    createSignedUrls.mockResolvedValue({
      data: [
        { path: "receipts/a.pdf", signedUrl: "https://signed/a" },
        { path: "receipts/b.pdf", signedUrl: "https://signed/b" },
      ],
      error: null,
    });

    const signed = await storage.signPrivateRefs([
      "storage://private/receipts/a.pdf",
      "storage://private/receipts/b.pdf",
    ]);

    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(
      ["receipts/a.pdf", "receipts/b.pdf"],
      3600,
    );
    expect(signed.get("storage://private/receipts/a.pdf")).toBe(
      "https://signed/a",
    );
  });

  it("deletes a private reference from the private bucket", async () => {
    const storage = await loadStorage("service-key");

    await storage.deleteByUrl("storage://private/receipts/a.pdf");

    expect(from).toHaveBeenCalledWith("private-bucket");
    expect(remove).toHaveBeenCalledWith(["receipts/a.pdf"]);
  });

  it("recognises only files stored by the platform", async () => {
    const storage = await loadStorage("service-key");

    expect(storage.isPlatformFileRef("storage://private/x.pdf")).toBe(true);
    expect(
      storage.isPlatformFileRef(
        "https://project.supabase.co/storage/v1/object/public/travenest/a.png",
      ),
    ).toBe(true);
    expect(storage.isPlatformFileRef("https://evil.example/a.png")).toBe(false);
  });
});

describe("signPrivateFileUrls middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces references anywhere in the JSON body with signed URLs", async () => {
    await loadStorage("service-key");
    createSignedUrls.mockResolvedValue({
      data: [{ path: "docs/nic.pdf", signedUrl: "https://signed/nic" }],
      error: null,
    });
    const { signPrivateFileUrls } = await import(
      "../src/middleware/signFileUrls"
    );
    const app = express();
    app.use(signPrivateFileUrls);
    app.get("/", (_req, res) => {
      res.json({
        data: {
          documents: [{ url: "storage://private/docs/nic.pdf" }],
          photo: "https://public/photo.png",
        },
      });
    });

    const response = await request(app).get("/");

    expect(response.body.data.documents[0].url).toBe("https://signed/nic");
    expect(response.body.data.photo).toBe("https://public/photo.png");
  });

  it("leaves responses without references untouched", async () => {
    await loadStorage("service-key");
    const { signPrivateFileUrls } = await import(
      "../src/middleware/signFileUrls"
    );
    const app = express();
    app.use(signPrivateFileUrls);
    app.get("/", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get("/");

    expect(response.body).toEqual({ ok: true });
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});
