import crypto from "crypto";

const ENCRYPTION_PREFIX = "enc:v1";
const DEFAULT_DEV_KEY = "travenest-dev-settlement-bank-key";

const resolveKeyMaterial = () => {
  const explicitKey =
    process.env.SETTLEMENT_BANK_ENCRYPTION_KEY ||
    process.env.BANK_DATA_ENCRYPTION_KEY;

  if (explicitKey && explicitKey.trim().length > 0) {
    return explicitKey;
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SETTLEMENT_BANK_ENCRYPTION_KEY is required in production",
    );
  }

  return DEFAULT_DEV_KEY;
};

const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(resolveKeyMaterial())
  .digest();

const normalizeNullableString = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const isSettlementBankValueEncrypted = (
  value: string | null | undefined,
): value is string => {
  return typeof value === "string" && value.startsWith(`${ENCRYPTION_PREFIX}:`);
};

export const encryptSettlementBankValue = (
  value: string | null | undefined,
): string | null => {
  const normalized = normalizeNullableString(value);

  if (!normalized) {
    return null;
  }

  if (isSettlementBankValueEncrypted(normalized)) {
    return normalized;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
};

export const decryptSettlementBankValue = (
  value: string | null | undefined,
): string | null => {
  const normalized = normalizeNullableString(value);

  if (!normalized) {
    return null;
  }

  if (!isSettlementBankValueEncrypted(normalized)) {
    return normalized;
  }

  const payload = normalized.slice(`${ENCRYPTION_PREFIX}:`.length);
  const parts = payload.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted settlement bank value format");
  }

  const [ivBase64, authTagBase64, encryptedBase64] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

export const maskSettlementBankAccountNumber = (
  value: string | null | undefined,
): string | null => {
  const normalized = normalizeNullableString(value);

  if (!normalized) {
    return null;
  }

  const compact = normalized.replace(/\s+/g, "");

  if (compact.length <= 4) {
    return "*".repeat(compact.length);
  }

  const visibleTail = compact.slice(-4);
  return `${"*".repeat(compact.length - 4)}${visibleTail}`;
};

export const maskSettlementBankAccountName = (
  value: string | null | undefined,
): string | null => {
  const normalized = normalizeNullableString(value);

  if (!normalized) {
    return null;
  }

  const segments = normalized.split(/\s+/).filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return segments
    .map((segment) => {
      if (segment.length <= 1) {
        return segment;
      }

      return `${segment[0]}${"*".repeat(Math.max(1, segment.length - 1))}`;
    })
    .join(" ");
};

export const maskSettlementBankCode = (
  value: string | null | undefined,
): string | null => {
  const normalized = normalizeNullableString(value);

  if (!normalized) {
    return null;
  }

  if (normalized.length <= 2) {
    return "*".repeat(normalized.length);
  }

  return `${normalized.slice(0, 2)}${"*".repeat(normalized.length - 2)}`;
};
