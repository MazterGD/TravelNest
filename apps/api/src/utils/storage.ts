import { createClient } from "@supabase/supabase-js";
import { config } from "../config/index.js";
import { ApiError } from "../middleware/errorHandler.js";

const supabaseUrl = config.supabase.url;
const supabaseKey = config.supabase.publishableKey;
const bucket = config.supabase.bucket;

if (!supabaseUrl || !supabaseKey) {
  // Guard in runtime when storage is used.
  console.warn("Supabase storage is not configured.");
}

const createStorageClient = () =>
  createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

const publicBaseUrl = config.supabase.publicUrl || supabaseUrl;

const normalizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

const buildPath = (prefix: string, fileName: string) => {
  const safeName = normalizeFileName(fileName);
  const token = Math.random().toString(36).slice(2, 10);
  return `${prefix}/${Date.now()}_${token}_${safeName}`;
};

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

export const deleteByUrl = async (url: string | null | undefined) => {
  if (!url) return;
  const path = extractPathFromPublicUrl(url);
  if (!path) return;
  await deleteByPath(path);
};
