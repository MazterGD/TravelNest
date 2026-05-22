import type { Request, Response } from "express";
import { ResponseHelper } from "../../utils/response.js";
import * as messageService from "./message.service.js";

export const listConversations = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const result = await messageService.listConversations(userId, page, limit);
  return ResponseHelper.success(res, result);
};

export const getConversation = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const conversationId = Array.isArray(id) ? id[0] : id;

  const conversation = await messageService.getConversation(userId, conversationId);
  return ResponseHelper.success(res, { conversation });
};

export const getMessages = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const conversationId = Array.isArray(id) ? id[0] : id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

  const result = await messageService.getMessages(userId, conversationId, page, limit);
  return ResponseHelper.success(res, result);
};

export const sendMessage = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const conversationId = Array.isArray(id) ? id[0] : id;
  const { content } = req.body as { content: string };

  const message = await messageService.sendMessage(userId, conversationId, content);
  return ResponseHelper.created(res, { message }, "Message sent");
};

export const markRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const conversationId = Array.isArray(id) ? id[0] : id;

  const count = await messageService.markConversationRead(userId, conversationId);
  return ResponseHelper.success(res, { count }, `${count} message(s) marked as read`);
};

export const openConversation = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { bookingId } = req.body as { bookingId: string };

  const conversation = await messageService.openConversationForBooking(userId, bookingId);
  return ResponseHelper.success(res, { conversation });
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const unreadCount = await messageService.getTotalUnreadCount(userId);
  return ResponseHelper.success(res, { unreadCount });
};
