import { z } from "zod";

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce
      .number()
      .int()
      .min(1, "Page must be at least 1")
      .optional()
      .default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, "Limit must be at least 1")
      .max(100, "Limit cannot exceed 100")
      .optional()
      .default(20),
    unreadOnly: z.coerce.boolean().optional().default(false),
  }),
});

export const markAsReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Notification ID is required"),
  }),
});

export const deleteNotificationSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Notification ID is required"),
  }),
});

// Type exports
export type GetNotificationsInput = z.infer<
  typeof getNotificationsSchema
>["query"];
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>["params"];
export type DeleteNotificationInput = z.infer<
  typeof deleteNotificationSchema
>["params"];
