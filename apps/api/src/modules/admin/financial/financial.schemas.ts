import { z } from "zod";

const settlementStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

const processSettlementStatusSchema = z.enum(["COMPLETED", "FAILED", "CANCELLED"]);

const commissionTypeSchema = z.enum(["PERCENTAGE", "FIXED", "TIERED"]);

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const commissionTierSchema = z.object({
  min: z.number().min(0),
  max: z.number().positive(),
  rate: z.number().positive().max(100),
});

const commissionRuleFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: commissionTypeSchema,
  percentage: z.number().positive().max(100).optional(),
  fixedAmount: z.number().positive().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().positive().optional(),
  tiers: z.array(commissionTierSchema).min(1).optional(),
  appliesFrom: z.coerce.date().optional(),
  appliesTo: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const listSettlementsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(200).optional(),
    status: settlementStatusSchema.optional(),
    period: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
    ownerId: z.string().trim().min(1).optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const settlementIdParamsSchema = z.object({
  params: z.object({
    settlementId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const processSettlementSchema = z.object({
  params: z.object({
    settlementId: z.string().trim().min(1),
  }),
  body: z.object({
    status: processSettlementStatusSchema.optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  query: z.object({}).optional(),
});

export const listCommissionRulesSchema = z.object({
  query: z.object({
    includeInactive: z.coerce.boolean().optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const createCommissionRuleSchema = z.object({
  body: commissionRuleFieldsSchema.refine(
    (value) => {
      if (value.type === "PERCENTAGE") {
        return value.percentage !== undefined;
      }

      if (value.type === "FIXED") {
        return value.fixedAmount !== undefined;
      }

      if (value.type === "TIERED") {
        return (value.tiers?.length ?? 0) > 0;
      }

      return true;
    },
    {
      message: "Rule payload is missing required values for selected commission type",
    },
  ).refine(
    (value) => {
      if (!value.appliesFrom || !value.appliesTo) {
        return true;
      }

      return value.appliesFrom <= value.appliesTo;
    },
    {
      message: "appliesFrom must be before appliesTo",
      path: ["appliesTo"],
    },
  ),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const commissionRuleIdParamsSchema = z.object({
  params: z.object({
    ruleId: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const updateCommissionRuleSchema = z.object({
  params: z.object({
    ruleId: z.string().trim().min(1),
  }),
  body: commissionRuleFieldsSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    {
      message: "At least one field is required",
    },
  ).refine(
    (value) => {
      if (!value.appliesFrom || !value.appliesTo) {
        return true;
      }

      return value.appliesFrom <= value.appliesTo;
    },
    {
      message: "appliesFrom must be before appliesTo",
      path: ["appliesTo"],
    },
  ),
  query: z.object({}).optional(),
});

export type SettlementStatus = z.infer<typeof settlementStatusSchema>;
export type ProcessSettlementInput = z.infer<typeof processSettlementSchema>["body"];
export type CommissionType = z.infer<typeof commissionTypeSchema>;
export type CreateCommissionRuleInput = z.infer<typeof createCommissionRuleSchema>["body"];
export type UpdateCommissionRuleInput = z.infer<typeof updateCommissionRuleSchema>["body"];
