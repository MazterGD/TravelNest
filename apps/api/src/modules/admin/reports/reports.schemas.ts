import { z } from "zod";

const reportTypeSchema = z.enum([
  "USERS",
  "BOOKINGS",
  "FINANCIAL",
  "OPERATIONS",
  "AUDIT",
  "DISPUTES",
  "VERIFICATIONS",
  "SYSTEM",
]);

const reportFormatSchema = z.enum(["CSV", "PDF", "EXCEL"]);

const reportFrequencySchema = z.enum(["ON_DEMAND", "DAILY", "WEEKLY", "MONTHLY"]);

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const reportConfigurationSchema = z.record(z.string(), z.unknown());

export const listScheduledReportsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(200).optional(),
    reportType: reportTypeSchema.optional(),
    format: reportFormatSchema.optional(),
    frequency: reportFrequencySchema.optional(),
    isActive: z.coerce.boolean().optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const createScheduledReportSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    reportType: reportTypeSchema,
    format: reportFormatSchema.optional(),
    frequency: reportFrequencySchema.optional(),
    cronExpression: z.string().trim().max(120).optional(),
    timezone: z.string().trim().max(120).optional(),
    configuration: reportConfigurationSchema.optional(),
    recipients: z.array(z.string().trim().email()).max(30).optional(),
    isActive: z.boolean().optional(),
    nextRunAt: z.coerce.date().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const reportIdParamsSchema = z.object({
  params: z.object({
    reportId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const updateScheduledReportSchema = z.object({
  params: z.object({
    reportId: z.string().trim().min(1),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      description: z.string().trim().max(500).optional(),
      reportType: reportTypeSchema.optional(),
      format: reportFormatSchema.optional(),
      frequency: reportFrequencySchema.optional(),
      cronExpression: z.string().trim().max(120).optional(),
      timezone: z.string().trim().max(120).optional(),
      configuration: reportConfigurationSchema.optional(),
      recipients: z.array(z.string().trim().email()).max(30).optional(),
      isActive: z.boolean().optional(),
      nextRunAt: z.coerce.date().nullable().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
  query: z.object({}).optional(),
});

export const runScheduledReportSchema = z.object({
  params: z.object({
    reportId: z.string().trim().min(1),
  }),
  body: z.object({
    format: reportFormatSchema.optional(),
  }),
  query: z.object({}).optional(),
});

export const exportAdminReportSchema = z.object({
  body: z
    .object({
      reportId: z.string().trim().min(1).optional(),
      reportType: reportTypeSchema.optional(),
      format: reportFormatSchema.optional(),
      name: z.string().trim().min(2).max(120).optional(),
      configuration: reportConfigurationSchema.optional(),
    })
    .refine((value) => Boolean(value.reportId || value.reportType), {
      message: "reportId or reportType is required",
    }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export type ReportType = z.infer<typeof reportTypeSchema>;
export type ReportFormat = z.infer<typeof reportFormatSchema>;
export type ReportFrequency = z.infer<typeof reportFrequencySchema>;

export type ListScheduledReportsFilters = z.infer<
  typeof listScheduledReportsSchema
>["query"];

export type CreateScheduledReportInput = z.infer<
  typeof createScheduledReportSchema
>["body"];

export type UpdateScheduledReportInput = z.infer<
  typeof updateScheduledReportSchema
>["body"];

export type RunScheduledReportInput = z.infer<typeof runScheduledReportSchema>["body"];

export type ExportAdminReportInput = z.infer<typeof exportAdminReportSchema>["body"];
