/**
 * The configured commission rate is a fraction; out-of-range settings must
 * not produce negative owner payouts (ADM-10 defence in depth).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "./setup";
import { getConfiguredCommissionRate } from "../src/modules/payment/settlement.service";

describe("getConfiguredCommissionRate", () => {
  let settingsId = "";
  let originalPaymentSettings: Prisma.JsonValue | null = null;
  let created = false;

  beforeAll(async () => {
    const existing = await prisma.platformSettings.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      settingsId = existing.id;
      originalPaymentSettings = existing.paymentSettings;
    } else {
      const row = await prisma.platformSettings.create({ data: {} });
      settingsId = row.id;
      created = true;
    }
  });

  afterAll(async () => {
    if (created) {
      await prisma.platformSettings.delete({ where: { id: settingsId } });
    } else {
      await prisma.platformSettings.update({
        where: { id: settingsId },
        data: {
          paymentSettings: originalPaymentSettings ?? Prisma.DbNull,
        },
      });
    }
  });

  const withSetting = async (commissionRate: unknown) => {
    await prisma.platformSettings.update({
      where: { id: settingsId },
      data: { paymentSettings: { commissionRate } as Prisma.InputJsonValue },
    });
    return getConfiguredCommissionRate();
  };

  it("uses a configured fraction", async () => {
    const activeRule = await prisma.commissionRule.findFirst({
      where: { isActive: true, type: "PERCENTAGE" },
    });
    if (activeRule) return; // an active rule takes precedence over settings
    expect(await withSetting(0.15)).toBe(0.15);
  });

  it("falls back to the 10% default when the rate is above 1", async () => {
    const activeRule = await prisma.commissionRule.findFirst({
      where: { isActive: true, type: "PERCENTAGE" },
    });
    if (activeRule) return;
    expect(await withSetting(15)).toBe(0.1);
  });

  it("falls back to the default for negative or non-numeric rates", async () => {
    const activeRule = await prisma.commissionRule.findFirst({
      where: { isActive: true, type: "PERCENTAGE" },
    });
    if (activeRule) return;
    expect(await withSetting(-0.2)).toBe(0.1);
    expect(await withSetting("0.2")).toBe(0.1);
  });
});
