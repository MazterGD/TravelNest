import { z } from "zod";

const dateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date",
  });

const vehicleTypeSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.toUpperCase() : val),
  z.enum(["ORDINARY", "SEMI_LUXURY", "LUXURY_AC"]),
);

const tripStatusSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.toUpperCase() : val),
  z.enum([
    "PLANNING",
    "AWAITING_QUOTES",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
    "EXPIRED",
  ]),
);

const locationObject = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const stopObject = z.object({
  id: z.string().optional(),
  location: locationObject,
});

export const createTripSchema = z.object({
  body: z
    .object({
      title: z.string().trim().max(120).optional(),
      pickupLocation: z.union([z.string().trim().min(1), locationObject]),
      dropoffLocation: z
        .union([z.string().trim().min(1), locationObject])
        .optional(),
      intermediateStops: z.array(stopObject).max(10).optional(),
      startDate: dateString,
      endDate: dateString.optional(),
      startTime: z.string().optional(),
      isRoundTrip: z.boolean().optional(),
      passengerCount: z.coerce.number().int().min(1).max(100),
      vehicleTypePreference: vehicleTypeSchema.optional(),
      needsAC: z.boolean().optional(),
      specialRequests: z.string().trim().max(2000).optional(),
      estimatedDistance: z.string().optional(),
      estimatedDuration: z.string().optional(),
      itineraryStops: z.array(z.any()).optional(),
      itineraryRoute: z.any().optional(),
    })
    .refine(
      (data) =>
        !data.endDate ||
        new Date(data.endDate) >= new Date(data.startDate),
      {
        message: "endDate must be on or after startDate",
        path: ["endDate"],
      },
    ),
});

export const updateTripSchema = z.object({
  body: z
    .object({
      title: z.string().trim().max(120).optional(),
      pickupLocation: z.union([z.string().trim().min(1), locationObject]).optional(),
      dropoffLocation: z
        .union([z.string().trim().min(1), locationObject])
        .optional(),
      intermediateStops: z.array(stopObject).max(10).optional(),
      startDate: dateString.optional(),
      endDate: dateString.optional(),
      startTime: z.string().optional(),
      isRoundTrip: z.boolean().optional(),
      passengerCount: z.coerce.number().int().min(1).max(100).optional(),
      vehicleTypePreference: vehicleTypeSchema.optional(),
      needsAC: z.boolean().optional(),
      specialRequests: z.string().trim().max(2000).optional(),
      estimatedDistance: z.string().optional(),
      estimatedDuration: z.string().optional(),
      itineraryStops: z.array(z.any()).optional(),
      itineraryRoute: z.any().optional(),
    })
    .refine(
      (data) =>
        !data.startDate ||
        !data.endDate ||
        new Date(data.endDate) >= new Date(data.startDate),
      {
        message: "endDate must be on or after startDate",
        path: ["endDate"],
      },
    ),
});

export const listTripsSchema = z.object({
  query: z.object({
    status: tripStatusSchema.optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    activeOnly: z
      .preprocess(
        (val) => (val === "true" || val === true ? true : val === "false" ? false : val),
        z.boolean(),
      )
      .optional(),
  }),
});
