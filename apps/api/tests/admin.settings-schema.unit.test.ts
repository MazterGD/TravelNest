/**
 * Platform settings validation (ADM-10): values that drive commission and
 * refund calculations stay within sensible bounds.
 */
import { describe, it, expect } from "vitest";
import { updatePlatformSettingsSchema } from "../src/modules/admin/settings/settings.schemas";

const parse = (body: Record<string, unknown>) =>
  updatePlatformSettingsSchema.safeParse({ body });

describe("updatePlatformSettingsSchema", () => {
  it.each([
    ["a commission rate entered as a percent", { paymentSettings: { commissionRate: 15 } }],
    ["a negative commission rate", { paymentSettings: { commissionRate: -0.1 } }],
    ["a refund above 100%", { bookingSettings: { refundPartialPercent: 500 } }],
    ["an auto-cancel window under an hour", { bookingSettings: { autoCancelUnpaidHours: 0 } }],
    [
      "a full-refund window shorter than the partial one",
      { bookingSettings: { refundFullHours: 24, refundPartialHours: 168 } },
    ],
  ])("rejects %s", (_label, body) => {
    expect(parse(body).success).toBe(false);
  });

  it("accepts the documented defaults and keeps other keys", () => {
    const result = parse({
      paymentSettings: { commissionRate: 0.1, provider: "payhere" },
      bookingSettings: {
        autoCancelUnpaidHours: 24,
        refundFullHours: 336,
        refundPartialHours: 168,
        refundPartialPercent: 50,
        refundWindowHours: 24,
      },
    });

    expect(result.success).toBe(true);
  });
});
