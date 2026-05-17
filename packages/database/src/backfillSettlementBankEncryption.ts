import {
  prisma,
  isSettlementBankValueEncrypted,
} from "./index.js";

async function main() {
  const settlements = await prisma.settlement.findMany({
    where: {
      OR: [
        { bankAccountName: { not: null } },
        { bankAccountNumber: { not: null } },
        { bankCode: { not: null } },
      ],
    },
    select: {
      id: true,
      bankAccountName: true,
      bankAccountNumber: true,
      bankCode: true,
    },
  });

  let updatedCount = 0;

  for (const settlement of settlements) {
    const shouldEncryptBankAccountName =
      settlement.bankAccountName !== null &&
      !isSettlementBankValueEncrypted(settlement.bankAccountName);

    const shouldEncryptBankAccountNumber =
      settlement.bankAccountNumber !== null &&
      !isSettlementBankValueEncrypted(settlement.bankAccountNumber);

    const shouldEncryptBankCode =
      settlement.bankCode !== null &&
      !isSettlementBankValueEncrypted(settlement.bankCode);

    if (
      !shouldEncryptBankAccountName &&
      !shouldEncryptBankAccountNumber &&
      !shouldEncryptBankCode
    ) {
      continue;
    }

    await prisma.settlement.update({
      where: { id: settlement.id },
      data: {
        ...(shouldEncryptBankAccountName
          ? { bankAccountName: settlement.bankAccountName }
          : {}),
        ...(shouldEncryptBankAccountNumber
          ? { bankAccountNumber: settlement.bankAccountNumber }
          : {}),
        ...(shouldEncryptBankCode ? { bankCode: settlement.bankCode } : {}),
      },
    });

    updatedCount += 1;
  }

  console.log(
    `Settlement bank field encryption backfill complete. Updated ${updatedCount} record(s).`,
  );
}

main()
  .catch((error) => {
    console.error("Settlement bank encryption backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
