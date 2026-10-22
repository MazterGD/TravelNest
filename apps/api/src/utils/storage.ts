import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/index.js";
import { ApiError } from "../middleware/errorHandler.js";

const supabaseUrl = config.supabase.url;
const supabaseKey = config.supabase.publishableKey;
const bucket = config.supabase.bucket;
const privateBucket = config.supabase.privateBucket;
const serviceRoleKey = config.supabase.serviceRoleKey;

// Stored in place of a URL for files in the private bucket (ADR-001).
export const PRIVATE_REF_PREFIX = "storage://private/";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

if (!supabaseUrl || !supabaseKey) {
  // Guard in runtime when storage is used.
  console.warn("Supabase storage is not configured.");
}

const createStorageClient = () =>
  createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

const createServiceStorageClient = () =>
  createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

const publicBaseUrl = config.supabase.publicUrl || supabaseUrl;

const normalizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

// The random segment keeps object paths unguessable.
const buildPath = (prefix: string, fileName: string) => {
  const safeName = normalizeFileName(fileName);
  return `${prefix}/${Date.now()}_${crypto.randomUUID()}_${safeName}`;
};

export const isPrivateStorageEnabled = () =>
  Boolean(supabaseUrl && serviceRoleKey);

export const isPrivateRef = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith(PRIVATE_REF_PREFIX);

export const uploadBuffer = async (params: {
  prefix: string;
  fileName: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
}) => {
  if (!supabaseUrl || !supabaseKey) {
    throw ApiError.badRequest("Storage is not configured");
  }

  const path = buildPath(params.prefix, params.fileName);
  const supabase = createStorageClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, params.buffer, {
      contentType: params.contentType,
      cacheControl: params.cacheControl || "3600",
      upsert: false,
    });

  if (error) {
    throw ApiError.internal(error.message);
  }

  const publicUrl = `${publicBaseUrl}/storage/v1/object/public/${bucket}/${path}`;

  return { path, publicUrl };
};

/**
 * Upload a sensitive file (identity documents, receipts) to the private
 * bucket and return a storage reference to persist instead of a URL. Clients
 * only ever receive short-lived signed URLs for it.
 */
export const uploadPrivateBuffer = async (params: {
  prefix: string;
  fileName: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ path: string; url: string }> => {
  if (!isPrivateStorageEnabled()) {
    if (config.env === "production") {
      throw ApiError.internal("Private storage is not configured");
    }
    console.warn(
      "[storage] SUPABASE_SERVICE_ROLE_KEY not set; storing a private file in the public bucket (development only)",
    );
    const upload = await uploadBuffer(params);
    return { path: upload.path, url: upload.publicUrl };
  }

  const path = buildPath(params.prefix, params.fileName);
  const { error } = await createServiceStorageClient()
    .storage.from(privateBucket)
    .upload(path, params.buffer, {
      contentType: params.contentType,
      upsert: false,
    });

  if (error) {
    throw ApiError.internal(error.message);
  }

  return { path, url: `${PRIVATE_REF_PREFIX}${path}` };
};

/**
 * Exchange private storage references for short-lived signed URLs, in one
 * request. References that cannot be signed are left out of the result.
 */
export const signPrivateRefs = async (
  refs: string[],
): Promise<Map<string, string>> => {
  const signed = new Map<string, string>();
  if (refs.length === 0 || !isPrivateStorageEnabled()) return signed;

  const paths = refs.map((ref) => ref.slice(PRIVATE_REF_PREFIX.length));
  const { data, error } = await createServiceStorageClient()
    .storage.from(privateBucket)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error) {
    throw ApiError.internal(error.message);
  }

  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) {
      signed.set(`${PRIVATE_REF_PREFIX}${entry.path}`, entry.signedUrl);
    }
  }
  return signed;
};

export const deleteByPath = async (path: string) => {
  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  if (!path) return;

  const supabase = createStorageClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw ApiError.internal(error.message);
  }
};

export const extractPathFromPublicUrl = (url: string) => {
  if (!url) return null;
  const prefix = `${publicBaseUrl}/storage/v1/object/public/${bucket}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
};

/** True for a file this platform stored (private reference or own public URL). */
export const isPlatformFileRef = (value: string) =>
  isPrivateRef(value) || extractPathFromPublicUrl(value) !== null;

export const deleteByUrl = async (url: string | null | undefined) => {
  if (!url) return;

  if (isPrivateRef(url)) {
    if (!isPrivateStorageEnabled()) return;
    const { error } = await createServiceStorageClient()
      .storage.from(privateBucket)
      .remove([url.slice(PRIVATE_REF_PREFIX.length)]);
    if (error) {
      throw ApiError.internal(error.message);
    }
    return;
  }

  const path = extractPathFromPublicUrl(url);
  if (!path) return;
  await deleteByPath(path);
};
