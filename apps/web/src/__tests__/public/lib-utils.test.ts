/**
 * Pure helpers under src/lib: formatting, dashboard routing, place-name
 * localisation, class merging, printable documents and zod schemas.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateRange,
  formatPhoneNumber,
  formatRelativeTime,
  formatTime,
  stripRemovedSuffix,
  truncateText,
} from "@/lib/utils/formatters";
import { getDashboardPath, getDashboardUrl } from "@/lib/utils/getDashboardUrl";
import {
  getPlaceTranslationKey,
  localizePlaceName,
} from "@/lib/i18n/placeName";
import { cn } from "@/lib/utils/cn";
import {
  buildComparisonHTML,
  buildInvoiceHTML,
  printAsPDF,
  type InvoiceBooking,
} from "@/lib/utils/pdfUtils";
import {
  contactFormSchema,
  loginSchema,
  profileUpdateSchema,
  quotationRequestSchema,
  quotationResponseSchema,
  registerSchema,
  reviewSchema,
  vehicleSchema,
} from "@/lib/validations";
import { UserRole, type User } from "@/types";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("formatters", () => {
  it("formats rupees with and without fraction digits", () => {
    expect(formatCurrency(12500)).toContain("12,500");
    expect(formatCurrency(12500)).not.toContain(".");
    expect(
      formatCurrency(10.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ).toContain("10.50");
  });

  it("formats dates by variant, custom options and rejects invalid input", () => {
    const iso = "2026-06-03T10:00:00Z";
    expect(formatDate(iso)).toContain("2026");
    expect(formatDate(new Date(iso), "long")).toMatch(/June/);
    expect(formatDate(iso, "medium")).toContain("2026");
    expect(formatDate(iso, "full")).toContain("2026");
    expect(formatDate(iso, "bogus" as any)).toContain("2026");
    expect(formatDate(iso, { year: "numeric" })).toBe("2026");
    expect(formatDate("not-a-date")).toBe("Invalid date");
  });

  it("formats times in 24h by default, 12h and with seconds", () => {
    const d = new Date(2026, 5, 3, 14, 5, 9);
    expect(formatTime(d)).toMatch(/14.05/);
    expect(formatTime(d.toISOString(), { hour12: true })).toMatch(/02.05/);
    expect(formatTime(d, { showSeconds: true })).toMatch(/14.05.09/);
    expect(formatTime("nope")).toBe("Invalid time");
  });

  it("joins a date range", () => {
    expect(formatDateRange("2026-06-03", "2026-06-05")).toMatch(/ - /);
  });

  it("describes relative times in days, hours, minutes and seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
    expect(formatRelativeTime("2026-06-05T12:00:00Z")).toBe("in 2 days");
    expect(formatRelativeTime(new Date("2026-06-03T09:00:00Z"))).toBe(
      "3 hours ago",
    );
    expect(formatRelativeTime("2026-06-03T12:10:00Z")).toBe("in 10 minutes");
    expect(formatRelativeTime("2026-06-03T12:00:00Z")).toBe("now");
  });

  it("formats Sri Lankan phone numbers and leaves others untouched", () => {
    expect(formatPhoneNumber("+94 77 123 4567")).toBe("+94 77 123 4567");
    expect(formatPhoneNumber("94771234567")).toBe("+94 77 123 4567");
    expect(formatPhoneNumber("0771234567")).toBe("077 123 4567");
    expect(formatPhoneNumber("12345")).toBe("12345");
  });

  it("truncates long text and strips the soft-removed suffix", () => {
    expect(truncateText("short", 10)).toBe("short");
    expect(truncateText("abcdefghijkl", 8)).toBe("abcde...");
    expect(stripRemovedSuffix("bob@x.lk#removed-abc123")).toBe("bob@x.lk");
    expect(stripRemovedSuffix("plain")).toBe("plain");
  });
});

describe("getDashboardUrl", () => {
  const user = (role: UserRole, isVerified = true) =>
    ({ id: "u", role, isVerified }) as User;

  it("routes each role to its dashboard", () => {
    expect(getDashboardUrl(user(UserRole.ADMIN), "en")).toBe("/en/admin");
    expect(getDashboardUrl(user(UserRole.VEHICLE_OWNER), "si")).toBe(
      "/si/owner/dashboard",
    );
    expect(getDashboardUrl(user(UserRole.CUSTOMER), "ta")).toBe("/ta/dashboard");
  });

  it("holds unverified owners at the pending-approval page", () => {
    expect(getDashboardUrl(user(UserRole.VEHICLE_OWNER, false), "en")).toBe(
      "/en/owner/pending-approval",
    );
  });

  it("returns locale-less paths for middleware", () => {
    expect(getDashboardPath(UserRole.ADMIN)).toBe("/admin");
    expect(getDashboardPath(UserRole.VEHICLE_OWNER)).toBe("/owner/dashboard");
    expect(getDashboardPath(UserRole.CUSTOMER)).toBe("/dashboard");
  });
});

describe("place names", () => {
  it("maps known places regardless of case and spacing", () => {
    expect(getPlaceTranslationKey("  Nuwara   Eliya ")).toBe("nuwaraEliya");
    expect(getPlaceTranslationKey("Atlantis")).toBeNull();
  });

  it("translates known places and passes unknown ones through", () => {
    const t = (k: string) => `T:${k}`;
    expect(localizePlaceName("Kandy", t)).toBe("T:kandy");
    expect(localizePlaceName("Atlantis", t)).toBe("Atlantis");
  });
});

describe("cn", () => {
  it("merges conditional classes and dedupes tailwind conflicts", () => {
    expect(cn("p-2", false && "hidden", "p-4", ["text-body"])).toBe(
      "p-4 text-body",
    );
  });
});

describe("pdfUtils", () => {
  const invoice: InvoiceBooking = {
    bookingRef: "BK-1<x>",
    status: "confirmed",
    createdAt: "2026-06-03T00:00:00Z",
    customer: { name: "Nimal & Co", email: "n@x.lk", phone: "077" },
    trip: {
      startDate: "2026-06-10",
      endDate: "2026-06-11",
      startTime: "08:00",
      pickupLocation: "Colombo",
      dropoffLocation: "Kandy",
      passengers: 30,
      estimatedDistance: "115 km",
    },
    vehicle: { name: "Bus", type: "LUXURY_AC", capacity: 45, registration: "NB-1234" },
    owner: { name: "Owner", phone: "071" },
    driver: { name: "Driver D", phone: "070", license: "B123" },
    payment: {
      total: 50000,
      paid: 50000,
      status: "COMPLETED",
      method: "",
      paidAt: "2026-06-04",
      platformCommission: 5000,
      netAmount: 45000,
      breakdown: {
        basePrice: 40000,
        driverAllowance: 5000,
        additionalCharges: 5000,
        subtotal: 50000,
        tax: 100,
        customItems: [{ description: "Toll's", amount: 300 }],
      },
    },
    notes: "Bring water",
  };

  it("builds an escaped invoice with all optional sections", () => {
    const html = buildInvoiceHTML(invoice);
    expect(html).toContain("Invoice BK-1&lt;x&gt;");
    expect(html).toContain("Nimal &amp; Co");
    expect(html).toContain("CONFIRMED");
    expect(html).toContain("Toll&#39;s");
    expect(html).toContain("Assigned Driver");
    expect(html).toContain("License");
    expect(html).toContain("Special Requirements");
    expect(html).toContain("115 km");
    expect(html).toContain("at 08:00");
    expect(html).toContain("Subtotal");
    expect(html).toContain("Paid On");
    expect(html).toContain("N/A");
  });

  it("omits optional invoice sections when data is missing", () => {
    const html = buildInvoiceHTML({
      ...invoice,
      driver: { name: "D" },
      notes: undefined,
      trip: { ...invoice.trip, startTime: null, estimatedDistance: null },
      payment: {
        ...invoice.payment,
        method: "CASH",
        paidAt: null,
        breakdown: { basePrice: 1, driverAllowance: 1, additionalCharges: 0 },
      },
    });
    expect(html).not.toContain("Special Requirements");
    expect(html).not.toContain("License");
    expect(html).not.toContain("Subtotal");
    expect(html).not.toContain("Paid On");
    expect(html).toContain("CASH");

    const bare = buildInvoiceHTML({
      ...invoice,
      driver: null,
      payment: { ...invoice.payment, breakdown: null },
    });
    expect(bare).not.toContain("Assigned Driver");
    expect(bare).not.toContain("Base Price");
  });

  it("marks the cheapest quotation as best value in a comparison", () => {
    const html = buildComparisonHTML(
      [
        {
          vehicleName: "Cheap",
          ownerName: "A",
          price: 100,
          validUntil: "Jun 10",
          notes: "Hi",
          amenities: ["WiFi", "AC"],
          vehicleSpecifications: { brand: "Tata", model: "LP", year: 2020, seats: 40 },
          priceBreakdown: {
            vehicleRentalCost: 1,
            driverCost: 1,
            fuelCost: 1,
            tollCharges: 1,
            otherCharges: 2,
            tax: 3,
          },
        },
        {
          vehicleName: "Dear",
          ownerName: "B",
          price: 200,
          vehicleSpecifications: { brand: "Ashok", model: "V", year: 0, seats: 50 },
          priceBreakdown: {
            vehicleRentalCost: 1,
            driverCost: 1,
            fuelCost: 1,
            tollCharges: 1,
            otherCharges: 0,
            tax: 0,
          },
        },
      ],
      {
        pickupCity: "Colombo",
        dropoffCity: "Galle",
        pickupDate: "2026-06-10",
        pickupTime: "07:00",
        passengerCount: 20,
      },
    );
    expect(html.match(/Best Value/g)?.length).toBe(1);
    expect(html).toContain("2 quotations compared");
    expect(html).toContain("Tata LP (2020), 40 seats");
    expect(html).toContain("Ashok V, 50 seats");
    expect(html).toContain("Valid until: Jun 10");
    expect(html).toContain("WiFi · AC");
    expect(html).toContain("Colombo → Galle");
    expect(html).toContain("at 07:00");

    const single = buildComparisonHTML(
      [{ vehicleName: "Only", ownerName: "C", price: 5 }],
      { pickupCity: "a", dropoffCity: "b", pickupDate: "2026-06-10", pickupTime: "", passengerCount: 1 },
    );
    expect(single).toContain("1 quotation compared");
    expect(single).not.toContain("cmp-breakdown\"");
  });

  it("writes the document to a print window", () => {
    const doc = { write: vi.fn(), close: vi.fn() };
    const win = { document: doc, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(win as any);
    printAsPDF("<p>body</p>", "My <Doc>");
    expect(doc.write.mock.calls[0][0]).toContain("<title>My &lt;Doc&gt;</title>");
    expect(doc.write.mock.calls[0][0]).toContain("<p>body</p>");
    expect(win.print).toHaveBeenCalled();
  });

  it("does nothing when the popup is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => printAsPDF("x", "y")).not.toThrow();
  });
});

describe("validation schemas", () => {
  it("validates login and registration input", () => {
    expect(loginSchema.safeParse({ email: "a@b.lk", password: "12345678" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "bad", password: "1" }).success).toBe(false);

    const reg = {
      email: "a@b.lk",
      password: "Passw0rd",
      confirmPassword: "Passw0rd",
      firstName: "Ab",
      lastName: "Cd",
      phone: "",
    };
    const ok = registerSchema.safeParse(reg);
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.role).toBe("customer");
    const mismatch = registerSchema.safeParse({ ...reg, confirmPassword: "Other0rd" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0].path).toEqual(["confirmPassword"]);
    expect(registerSchema.safeParse({ ...reg, password: "weakpass", confirmPassword: "weakpass" }).success).toBe(false);
  });

  it("requires a future date and return details for round trips", () => {
    const loc = { address: "12 Main St", city: "Colombo", district: "Colombo" };
    const base = {
      pickupLocation: loc,
      dropoffLocation: loc,
      startDate: "2999-01-01",
      startTime: "08:30",
      passengerCount: 10,
      vehicleType: "ORDINARY",
    };
    expect(quotationRequestSchema.safeParse(base).success).toBe(true);
    expect(quotationRequestSchema.safeParse({ ...base, startDate: "2000-01-01" }).success).toBe(false);
    const rt = quotationRequestSchema.safeParse({ ...base, isRoundTrip: true });
    expect(rt.success).toBe(false);
    expect(rt.error?.issues[0].path).toEqual(["endDate"]);
    expect(
      quotationRequestSchema.safeParse({ ...base, isRoundTrip: true, endDate: "2999-01-02", returnTime: "18:00" }).success,
    ).toBe(true);
  });

  it("validates vehicles, quotation responses, reviews, contact and profile", () => {
    expect(
      vehicleSchema.safeParse({
        name: "Bus",
        licensePlate: "NB-1234",
        type: "ORDINARY",
        brand: "Tata",
        model: "LP",
        year: 2020,
        seats: 40,
        acType: "ac",
        location: "Colombo",
      }).success,
    ).toBe(true);
    expect(vehicleSchema.safeParse({ licensePlate: "bad" }).success).toBe(false);
    const qr = quotationResponseSchema.parse({
      vehicleId: "v",
      startTime: "08:00",
      estimatedDistance: "1",
      estimatedDuration: "1",
      vehicleRentalCost: 1,
      driverCost: 1,
      fuelCost: 1,
      tollCharges: 0,
      subtotal: 3,
      tax: 0,
      totalAmount: 3,
      validityDays: 7,
    });
    expect(qr.customItems).toEqual([]);
    expect(reviewSchema.safeParse({ bookingId: "b", rating: 5, comment: "short" }).success).toBe(false);
    expect(
      contactFormSchema.safeParse({ name: "Ab", email: "a@b.lk", subject: "Hello", message: "x".repeat(20) }).success,
    ).toBe(true);
    expect(profileUpdateSchema.safeParse({ phone: "abc" }).success).toBe(false);
  });
});
