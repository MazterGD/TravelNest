import { z } from "zod";

const dateRangeQuerySchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (value) => {
      if (!value.startDate || !value.endDate) {
        return true;
      }

      return value.startDate <= value.endDate;
    },
    {
      message: "startDate must be before or equal to endDate",
      path: ["startDate"],
    },
  );

export const analyticsQuerySchema = z.object({
  query: dateRangeQuerySchema,
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const exportAnalyticsSchema = z.object({
  query: dateRangeQuerySchema,
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});
