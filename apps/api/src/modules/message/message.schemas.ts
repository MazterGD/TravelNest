import { z } from "zod";

export const listConversationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    unreadOnly: z.coerce.boolean().optional().default(false),
  }),
});

export const conversationIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Conversation ID is required"),
  }),
});

export const getMessagesSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Conversation ID is required"),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Conversation ID is required"),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, "Message cannot be empty")
      .max(2000, "Message cannot exceed 2000 characters"),
  }),
});

export const openConversationSchema = z.object({
  body: z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
  }),
});

export type ListConversationsQuery = z.infer<typeof listConversationsSchema>["query"];
export type GetMessagesInput = z.infer<typeof getMessagesSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type OpenConversationInput = z.infer<typeof openConversationSchema>["body"];
