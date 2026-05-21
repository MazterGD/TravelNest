import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { validate } from "../../middleware/validate.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { config } from "../../config/index.js";
import * as messageController from "./message.controller.js";
import {
  conversationIdParamSchema,
  getMessagesSchema,
  listConversationsSchema,
  openConversationSchema,
  sendMessageSchema,
} from "./message.schemas.js";

const router = Router();

// Per-user throttle on message sends. The global limiter is IP-keyed and is
// disabled outside production; this caps message-spam per authenticated user.
// Runs after `authenticate`, so `req.user` is always populated here.
const sendMessageLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "anonymous",
  message: {
    error: "You're sending messages too quickly. Please slow down for a moment.",
  },
  skip: () => config.env !== "production",
});

router.get(
  "/conversations",
  authenticate,
  validate(listConversationsSchema),
  asyncHandler(messageController.listConversations),
);

router.get(
  "/unread-count",
  authenticate,
  asyncHandler(messageController.getUnreadCount),
);

router.post(
  "/conversations",
  authenticate,
  csrfProtection,
  validate(openConversationSchema),
  asyncHandler(messageController.openConversation),
);

router.get(
  "/conversations/:id",
  authenticate,
  validate(conversationIdParamSchema),
  asyncHandler(messageController.getConversation),
);

router.get(
  "/conversations/:id/messages",
  authenticate,
  validate(getMessagesSchema),
  asyncHandler(messageController.getMessages),
);

router.post(
  "/conversations/:id/messages",
  authenticate,
  sendMessageLimiter,
  csrfProtection,
  validate(sendMessageSchema),
  asyncHandler(messageController.sendMessage),
);

router.patch(
  "/conversations/:id/read",
  authenticate,
  csrfProtection,
  validate(conversationIdParamSchema),
  asyncHandler(messageController.markRead),
);

export default router;
