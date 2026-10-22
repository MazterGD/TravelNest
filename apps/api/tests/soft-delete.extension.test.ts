/**
 * Soft-delete read filtering in the shared Prisma client (ADR-006).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import db from "@travenest/database";
import { prisma as rawPrisma } from "./setup";

const EMAIL = "softdelete.extension@example.com";

describe("Soft-delete query extension", () => {
  let userId = "";

  beforeAll(async () => {
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await rawPrisma.user.create({
      data: {
        email: EMAIL,
        password: "hashed",
        firstName: "Soft",
        lastName: "Deleted",
        role: "CUSTOMER",
        status: "ACTIVE",
        isRemoved: true,
        removedAt: new Date(),
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await rawPrisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it("hides removed rows from unique, first, many and count reads", async () => {
    expect(await db.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await db.user.findFirst({ where: { email: EMAIL } })).toBeNull();
    expect(await db.user.findMany({ where: { email: EMAIL } })).toHaveLength(0);
    expect(await db.user.count({ where: { email: EMAIL } })).toBe(0);
  });

  it("includes removed rows when a query opts in", async () => {
    const user = await db.user.findUnique({
      where: { id: userId, isRemoved: undefined },
    });
    expect(user?.isRemoved).toBe(true);

    expect(
      await db.user.count({ where: { email: EMAIL, isRemoved: true } }),
    ).toBe(1);
  });
});
