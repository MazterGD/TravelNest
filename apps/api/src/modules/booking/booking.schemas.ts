import { z } from "zod";

const upperEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(
    (val) => (typeof val === "string" ? val.toUpperCase() : val),
    z.enum(values),
  );

const bookingStatus = upperEnum([
  "PENDING",
  "CONFIRMED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);

const dateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date",
  });

const page = z.coerce.number().int().min(1).optional();
// The bookings page exports up to 1000 rows to CSV in one request.
const limit = z.coerce.number().int().min(1).max(1000).optional();

export const myBookingsQuerySchema = z.object({
  query: z.object({
    status: bookingStatus.optional(),
    page,
    limit,
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    vehicleType: upperEnum(["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"]).optional(),
    sort: z.string().max(40).optional(),
  }),
});

export const ownerBookingsQuerySchema = z.object({
  query: z.object({
    status: bookingStatus.optional(),
    vehicleId: z.string().optional(),
    page,
    limit,
  }),
});

export const adminBookingsQuerySchema = z.object({
  query: z.object({
    status: bookingStatus.optional(),
    page,
    limit,
  }),
});

export const fromQuotationSchema = z.object({
  body: z.object({
    quotationId: z.string({ error: (issue) => (issue.input === undefined ? "Quotation ID is required" : undefined) }).min(1),
  }),
});

export const bookingReasonSchema = z.object({
  body: z
    .object({
      reason: z.string().max(1000).optional(),
    })
    .optional(),
});

export const assignDriverSchema = z.object({
  body: z.object({
    driverName: z.string().optional(),
    driverPhone: z.string().optional(),
    driverLicense: z.string().optional(),
  }),
});

const stopPoint = z.object({
  location: z.string(),
  time: z.string(),
});

export const updateItinerarySchema = z.object({
  body: z.object({
    itinerary: z
      .array(
        z.object({
          dayNumber: z.number().int().min(1),
          date: dateString,
          startLocation: z.string().trim().min(1).max(200),
          endLocation: z.string().trim().min(1).max(200),
          overnightStop: z.string().max(200).optional(),
          description: z.string().max(2000).optional(),
          estimatedKm: z.number().min(0).optional(),
          pickupPoints: z.array(stopPoint).max(20).optional(),
          dropoffPoints: z.array(stopPoint).max(20).optional(),
        }),
      )
      .max(60),
  }),
});
