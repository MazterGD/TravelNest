import { z } from "zod";

const dateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date",
  });

const quotationStatusSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.toUpperCase() : val),
  z.enum(["PENDING", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"]),
);

const vehicleTypeSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.toUpperCase() : val),
  z.enum(["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"]),
);

export const ownerQuotationRequestsSchema = z.object({
  query: z
    .object({
      status: quotationStatusSchema.optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
      startDate: dateString.optional(),
      endDate: dateString.optional(),
      vehicleType: vehicleTypeSchema.optional(),
      passengerMin: z.coerce.number().int().min(1).optional(),
      passengerMax: z.coerce.number().int().min(1).optional(),
      sortBy: z
        .enum([
          "newest",
          "oldest",
          "tripDate",
          "passengersHigh",
          "passengersLow",
        ])
        .optional(),
    })
    .refine(
      (data) =>
        !data.passengerMin ||
        !data.passengerMax ||
        data.passengerMin <= data.passengerMax,
      {
        message: "passengerMin must be less than or equal to passengerMax",
        path: ["passengerMax"],
      },
    )
    .refine(
      (data) =>
        !data.startDate ||
        !data.endDate ||
        new Date(data.startDate) <= new Date(data.endDate),
      {
        message: "endDate must be on or after startDate",
        path: ["endDate"],
      },
    ),
});

const money = z.number().finite().nonnegative();

export const sendQuotationSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    vehicleId: z.string().min(1),
    startTime: z.string().max(20).optional(),
    estimatedDistance: z.string().max(50).optional(),
    estimatedDuration: z.string().max(50).optional(),
    vehicleRentalCost: money.optional(),
    driverCost: money,
    fuelCost: money,
    tollCharges: money,
    permitFees: money.optional(),
    customItems: z
      .array(
        z.object({
          description: z.string().max(200),
          amount: money,
        }),
      )
      .max(20)
      .optional(),
    subtotal: money.optional(),
    tax: money.optional(),
    totalAmount: money.optional(),
    additionalNotes: z.string().max(1000).optional(),
    validityDays: z.number().int().min(1).max(30),
  }),
});

const optionalDate = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  dateString.optional(),
);

const locationObject = z.object({
  address: z.string().nullish(),
  city: z.string().nullish(),
  district: z.string().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
});

const location = z.union([z.string().trim().min(1).max(300), locationObject]);

export const createQuotationRequestSchema = z.object({
  body: z.object({
    vehicleId: z.string().min(1).optional(),
    tripId: z.string().min(1).optional(),
    vehicleType: vehicleTypeSchema.optional(),
    startDate: dateString,
    endDate: optionalDate,
    startTime: z.string().max(20).nullish(),
    // Presence is checked by the service, which answers 400 with a clear message.
    pickupLocation: location.optional(),
    dropoffLocation: location.nullish(),
    passengerCount: z.coerce.number().int().min(1).max(100).optional(),
    estimatedDistance: z.string().max(50).nullish(),
    estimatedDuration: z.string().max(50).nullish(),
    specialRequests: z.string().max(2000).nullish(),
    itineraryStops: z.array(z.any()).max(25).optional(),
    itineraryRoute: z.any().optional(),
    intermediateStops: z.array(z.any()).max(10).optional(),
    isRoundTrip: z.boolean().optional(),
    needsAC: z.boolean().optional(),
    amenities: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  }),
});

export const quotationListQuerySchema = z.object({
  query: z.object({
    status: quotationStatusSchema.optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const respondToQuotationSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    status: z.enum(["ACCEPTED", "REJECTED"]),
    rejectionReason: z.string().max(500).optional(),
  }),
});
