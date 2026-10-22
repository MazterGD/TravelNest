import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Mirror src/config: the local .env plus the repo root .env.
// Prisma is imported dynamically inside main() so this runs before the client loads.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", "..", ".env") });

/**
 * One-off, idempotent migration for ADR-001: moves identity/vehicle documents
 * and bank-transfer receipts that were uploaded before private storage from
 * the public bucket into the private bucket, and rewrites the stored URLs to
 * `storage://private/<path>` references. Photos stay public.
 *
 * Usage (dry run lists what would move; --apply performs it):
 *   pnpm --filter @travenest/api storage:backfill-private [--apply]
 */

const PRIVATE_REF_PREFIX = "storage://private/";
const PRIVATE_OWNER_DOCUMENT_TYPES = [
  "NIC",
  "DRIVING_LICENSE",
  "INSURANCE",
  "REGISTRATION_CERTIFICATE",
] as const;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const publicBucket = process.env.SUPABASE_BUCKET || "travenest";
const privateBucket = process.env.SUPABASE_PRIVATE_BUCKET || "travenest-private";
const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${publicBucket}/`;

type Target = {
  label: string;
  url: string;
  save: (ref: string) => Promise<unknown>;
};

const main = async () => {
  const apply = process.argv.includes("--apply");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
    process.exit(1);
  }

  const { default: prisma } = await import("@travenest/database");
  const storage = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  }).storage;

  const isPublicPlatformUrl = (url: string | null) =>
    !!url && url.startsWith(publicPrefix);

  const [ownerDocs, vehicleDocs, payments] = await Promise.all([
    prisma.ownerDocument.findMany({
      where: { type: { in: [...PRIVATE_OWNER_DOCUMENT_TYPES] } },
      select: { id: true, url: true },
    }),
    prisma.vehicleDocument.findMany({ select: { id: true, url: true } }),
    prisma.payment.findMany({
      where: { bankReceiptUrl: { not: null } },
      select: { id: true, bankReceiptUrl: true },
    }),
  ]);

  const targets: Target[] = [
    ...ownerDocs
      .filter((doc) => isPublicPlatformUrl(doc.url))
      .map((doc) => ({
        label: `owner document ${doc.id}`,
        url: doc.url,
        save: (ref: string) =>
          prisma.ownerDocument.update({ where: { id: doc.id }, data: { url: ref } }),
      })),
    ...vehicleDocs
      .filter((doc) => isPublicPlatformUrl(doc.url))
      .map((doc) => ({
        label: `vehicle document ${doc.id}`,
        url: doc.url,
        save: (ref: string) =>
          prisma.vehicleDocument.update({
            where: { id: doc.id },
            data: { url: ref },
          }),
      })),
    ...payments
      .filter((payment) => isPublicPlatformUrl(payment.bankReceiptUrl))
      .map((payment) => ({
        label: `payment receipt ${payment.id}`,
        url: payment.bankReceiptUrl!,
        save: (ref: string) =>
          prisma.payment.update({
            where: { id: payment.id },
            data: { bankReceiptUrl: ref },
          }),
      })),
  ];

  console.log(
    `[storage-backfill] ${targets.length} public file(s) to move to "${privateBucket}"${apply ? "" : " (dry run; pass --apply to move them)"}`,
  );

  let moved = 0;
  for (const target of targets) {
    const objectPath = decodeURIComponent(target.url.slice(publicPrefix.length));
    if (!apply) {
      console.log(`  would move ${target.label}`);
      continue;
    }

    try {
      const download = await storage.from(publicBucket).download(objectPath);
      if (download.error || !download.data) {
        throw new Error(download.error?.message || "download failed");
      }

      const upload = await storage
        .from(privateBucket)
        .upload(objectPath, download.data, {
          contentType: download.data.type || undefined,
          upsert: true,
        });
      if (upload.error) throw new Error(upload.error.message);

      await target.save(`${PRIVATE_REF_PREFIX}${objectPath}`);

      // Remove the public copy only once the database points at the private one.
      const removal = await storage.from(publicBucket).remove([objectPath]);
      if (removal.error) {
        console.warn(
          `  moved ${target.label} but could not delete the public copy: ${removal.error.message}`,
        );
      }
      moved += 1;
    } catch (error) {
      console.error(
        `  failed to move ${target.label}: ${(error as Error).message}`,
      );
    }
  }

  if (apply) {
    console.log(`[storage-backfill] moved ${moved}/${targets.length} file(s)`);
  }
  await prisma.$disconnect();
};

main().catch((error) => {
  console.error("[storage-backfill] failed", error);
  process.exit(1);
});
