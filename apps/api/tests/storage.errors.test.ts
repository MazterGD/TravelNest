/**
 * Storage utility edge cases: missing configuration, Supabase errors and
 * deleting public files by URL. Supabase is mocked.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const upload = vi.fn();
const remove = vi.fn();
const createSignedUrls = vi.fn();
const from = vi.fn(() => ({ upload, remove, createSignedUrls }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from } }),
}));

const STORAGE_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PRIVATE_BUCKET",
  "SUPABASE_BUCKET",
  "NODE_ENV",
] as const;
const originalEnv = Object.fromEntries(STORAGE_ENV.map((key) => [key, process.env[key]]));

const loadStorage = async (env: Partial<Record<(typeof STORAGE_ENV)[number], string>>) => {
  vi.resetModules();
  // Empty rather than deleted: dotenv would otherwise refill them from .env files.
  for (const key of STORAGE_ENV) {
    if (key === "NODE_ENV") continue;
    process.env[key] = "";
  }
  Object.assign(process.env, { SUPABASE_BUCKET: "travenest", ...env });
  return import("../src/utils/storage");
};

const configured = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "publishable",
};

const file = {
  prefix: "avatars/u1",
  fileName: "me.png",
  buffer: Buffer.from("png"),
  contentType: "image/png",
};

afterAll(() => {
  for (const key of STORAGE_ENV) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  vi.resetModules();
});

describe("storage without configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("refuses uploads and quietly skips deletes", async () => {
    const storage = await loadStorage({});

    await expect(storage.uploadBuffer(file)).rejects.toMatchObject({ statusCode: 400 });
    await expect(storage.deleteByPath("avatars/u1/me.png")).resolves.toBeUndefined();
    await expect(storage.deleteByUrl("storage://private/docs/a.pdf")).resolves.toBeUndefined();
    await expect(storage.signPrivateRefs(["storage://private/docs/a.pdf"])).resolves.toEqual(new Map());
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("storage with Supabase errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces upload, sign and delete failures as server errors", async () => {
    const storage = await loadStorage({ ...configured, SUPABASE_SERVICE_ROLE_KEY: "service" });
    upload.mockResolvedValue({ error: { message: "bucket full" } });
    remove.mockResolvedValue({ error: { message: "locked" } });
    createSignedUrls.mockResolvedValue({ data: null, error: { message: "denied" } });

    await expect(storage.uploadBuffer(file)).rejects.toThrow("bucket full");
    await expect(storage.uploadPrivateBuffer(file)).rejects.toThrow("bucket full");
    await expect(storage.signPrivateRefs(["storage://private/a.pdf"])).rejects.toThrow("denied");
    await expect(storage.deleteByUrl("storage://private/a.pdf")).rejects.toThrow("locked");
    await expect(storage.deleteByPath("avatars/u1/me.png")).rejects.toThrow("locked");
  });

  it("deletes our own public files by URL and ignores anything else", async () => {
    const storage = await loadStorage(configured);
    remove.mockResolvedValue({ error: null });
    const ownUrl = "https://project.supabase.co/storage/v1/object/public/travenest/avatars/u1/me.png";

    await storage.deleteByUrl(ownUrl);
    await storage.deleteByUrl("https://elsewhere.example.com/me.png");
    await storage.deleteByUrl(null);
    await storage.deleteByPath("");

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(["avatars/u1/me.png"]);
    expect(storage.extractPathFromPublicUrl("")).toBeNull();
  });
});
