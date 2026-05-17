import { PrismaClient } from "@prisma/client";
import {
  encryptSettlementBankValue,
  isSettlementBankValueEncrypted,
} from "./settlementBankEncryption.js";

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

const encryptSettlementBankFields = <T extends Record<string, unknown>>(
  data: T,
): T => {
  const nextData: Record<string, unknown> = { ...data };

  if ("bankAccountName" in nextData) {
    const bankAccountName = nextData.bankAccountName as string | null | undefined;
    nextData.bankAccountName = bankAccountName
      ? isSettlementBankValueEncrypted(bankAccountName)
        ? bankAccountName
        : encryptSettlementBankValue(bankAccountName)
      : null;
  }

  if ("bankAccountNumber" in nextData) {
    const bankAccountNumber = nextData.bankAccountNumber as
      | string
      | null
      | undefined;
    nextData.bankAccountNumber = bankAccountNumber
      ? isSettlementBankValueEncrypted(bankAccountNumber)
        ? bankAccountNumber
        : encryptSettlementBankValue(bankAccountNumber)
      : null;
  }

  if ("bankCode" in nextData) {
    const bankCode = nextData.bankCode as string | null | undefined;
    nextData.bankCode = bankCode
      ? isSettlementBankValueEncrypted(bankCode)
        ? bankCode
        : encryptSettlementBankValue(bankCode)
      : null;
  }

  return nextData as T;
};

const withEncryptedSettlementArgs = (args: Record<string, unknown> | undefined) => {
  if (!args) {
    return args;
  }

  const nextArgs: Record<string, unknown> = { ...args };

  if ("data" in nextArgs) {
    const data = nextArgs.data;

    if (Array.isArray(data)) {
      nextArgs.data = data.map((item) =>
        typeof item === "object" && item !== null
          ? encryptSettlementBankFields(item as Record<string, unknown>)
          : item,
      );
    } else if (typeof data === "object" && data !== null) {
      nextArgs.data = encryptSettlementBankFields(data as Record<string, unknown>);
    }
  }

  if ("create" in nextArgs && typeof nextArgs.create === "object" && nextArgs.create !== null) {
    nextArgs.create = encryptSettlementBankFields(
      nextArgs.create as Record<string, unknown>,
    );
  }

  if ("update" in nextArgs && typeof nextArgs.update === "object" && nextArgs.update !== null) {
    nextArgs.update = encryptSettlementBankFields(
      nextArgs.update as Record<string, unknown>,
    );
  }

  return nextArgs;
};

const settlementWriteOperations = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
]);

const prismaWithExtensions = prismaClient.$extends({
  query: {
    settlement: {
      async $allOperations({ operation, args, query }) {
        if (settlementWriteOperations.has(operation)) {
          const encryptedArgs = withEncryptedSettlementArgs(
            args as Record<string, unknown> | undefined,
          ) as typeof args;

          return query(encryptedArgs);
        }

        return query(args);
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaWithExtensions;

export * from "@prisma/client";
export {
  decryptSettlementBankValue,
  encryptSettlementBankValue,
  isSettlementBankValueEncrypted,
  maskSettlementBankAccountName,
  maskSettlementBankAccountNumber,
  maskSettlementBankCode,
} from "./settlementBankEncryption.js";
export default prisma;
