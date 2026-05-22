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
