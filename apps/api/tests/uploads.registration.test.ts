/**
 * Anonymous registration uploads: category/type validation and the
 * public-vs-private storage split (ADR-001). Storage is mocked.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

const uploadBuffer = vi.fn();
const uploadPrivateBuffer = vi.fn();
const signPrivateRefs = vi.fn();

vi.mock("../src/utils/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/storage")>();
  return {
    ...actual,
    uploadBuffer: (...args: unknown[]) => uploadBuffer(...args),
    uploadPrivateBuffer: (...args: unknown[]) => uploadPrivateBuffer(...args),
    signPrivateRefs: (...args: unknown[]) => signPrivateRefs(...args),
  };
});

const { default: app } = await import("../src/app");

const ENDPOINT = "/api/v1/uploads/registration";
const pdf = Buffer.from("%PDF-1.4 test");
const jpg = Buffer.from("\xff\xd8\xff jpeg");

const upload = (
  fields: Record<string, string>,
  file: { buffer: Buffer; name: string; type: string } | null = {
    buffer: pdf,
    name: "doc.pdf",
    type: "application/pdf",
  },
) => {
  let req = request(app).post(ENDPOINT);
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  if (file) {
    req = req.attach("file", file.buffer, {
      filename: file.name,
      contentType: file.type,
    });
  }
  return req;
};

describe("POST /uploads/registration", () => {
  beforeEach(() => {
    uploadBuffer.mockReset();
    uploadPrivateBuffer.mockReset();
    signPrivateRefs.mockReset();
    uploadBuffer.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      path: `${prefix}/f`,
      publicUrl: `https://cdn.example/${prefix}/f`,
    }));
    uploadPrivateBuffer.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      path: `${prefix}/f`,
      url: `storage://private/${prefix}/f`,
    }));
    signPrivateRefs.mockImplementation(async (refs: string[]) =>
      new Map(refs.map((ref) => [ref, `https://signed.example/${ref.length}`])),
    );
  });

  const nothingStored = () => {
    expect(uploadBuffer).not.toHaveBeenCalled();
    expect(uploadPrivateBuffer).not.toHaveBeenCalled();
  };

  it("requires a file", async () => {
    const res = await upload({ category: "vehicle-photos" }, null);

    expect(res.status).toBe(400);
    expect(res.body.error?.message ?? res.body.message).toMatch(/File is required/);
    nothingStored();
  });

  it("rejects a missing or unknown category", async () => {
    const missing = await upload({});
    const unknown = await upload({ category: "avatars" });

    expect(missing.status).toBe(400);
    expect(unknown.status).toBe(400);
    nothingStored();
  });

  it("requires a document type for document categories", async () => {
    const res = await upload({ category: "owner-documents" });

    expect(res.status).toBe(400);
    nothingStored();
  });

  it("rejects a document type outside the category", async () => {
    const res = await upload({ category: "owner-documents", subfolder: "INSURANCE" });

    expect(res.status).toBe(400);
    nothingStored();
  });

  it("rejects an unknown photo tag", async () => {
    const res = await upload(
      { category: "vehicle-photos", subfolder: "roof" },
      { buffer: jpg, name: "bus.jpg", type: "image/jpeg" },
    );

    expect(res.status).toBe(400);
    nothingStored();
  });

  it("does not store unsupported file types", async () => {
    const res = await upload(
      { category: "vehicle-photos" },
      { buffer: Buffer.from("MZ"), name: "x.exe", type: "application/x-msdownload" },
    );

    expect(res.status).toBe(400);
    nothingStored();
  });

  it("stores an NIC privately and returns a signed link, never the raw reference", async () => {
    const res = await upload({ category: "owner-documents", subfolder: " nic " });

    expect(res.status).toBe(201);
    expect(uploadPrivateBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: "registration/owner-documents/nic",
        fileName: "doc.pdf",
        contentType: "application/pdf",
      }),
    );
    expect(uploadBuffer).not.toHaveBeenCalled();
    expect(res.body.data.url).toMatch(/^https:\/\/signed\.example\//);
    expect(res.body.data.path).toBe("registration/owner-documents/nic/f");
  });

  it("accepts the folder name as the document type", async () => {
    const res = await upload({
      category: "vehicle-documents",
      subfolder: "registration-certificate",
    });

    expect(res.status).toBe(201);
    expect(uploadPrivateBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: "registration/vehicle-documents/registration-certificate",
      }),
    );
  });

  it("keeps the owner's profile photo public", async () => {
    const res = await upload(
      { category: "owner-documents", subfolder: "PROFILE_PHOTO" },
      { buffer: jpg, name: "me.jpg", type: "image/jpeg" },
    );

    expect(res.status).toBe(201);
    expect(uploadPrivateBuffer).not.toHaveBeenCalled();
    expect(res.body.data.url).toBe(
      "https://cdn.example/registration/owner-documents/profile-photo/f",
    );
  });

  it("stores tagged and untagged vehicle photos publicly", async () => {
    const tagged = await upload(
      { category: "vehicle-photos", subfolder: "Interior" },
      { buffer: jpg, name: "in.jpg", type: "image/jpeg" },
    );
    const untagged = await upload(
      { category: "vehicle-photos" },
      { buffer: jpg, name: "out.jpg", type: "image/jpeg" },
    );

    expect(tagged.status).toBe(201);
    expect(untagged.status).toBe(201);
    expect(uploadBuffer.mock.calls.map(([arg]) => arg.prefix)).toEqual([
      "registration/vehicle-photos/interior",
      "registration/vehicle-photos",
    ]);
    expect(uploadPrivateBuffer).not.toHaveBeenCalled();
  });
});
