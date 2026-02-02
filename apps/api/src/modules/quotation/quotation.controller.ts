import type { Request, Response } from "express";
import * as quotationService from "./quotation.service.js";

/**
 * Get owner's quotation requests (PENDING)
 */
export const getOwnerQuotationRequests = async (
  req: Request,
  res: Response,
) => {
  const ownerId = req.user!.id;
  const { status, page, limit } = req.query;

  const result = await quotationService.getOwnerQuotationRequests(ownerId, {
    status: status as any,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Get owner's sent quotations
 */
export const getOwnerSentQuotations = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { status, page, limit } = req.query;

  const result = await quotationService.getOwnerSentQuotations(ownerId, {
    status: status as any,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Get customer's quotations
 */
export const getCustomerQuotations = async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { status, page, limit } = req.query;

  const result = await quotationService.getCustomerQuotations(customerId, {
    status: status as any,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Get single quotation by ID
 */
export const getQuotationById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const quotation = await quotationService.getQuotationById(
    id as string,
    userId,
    userRole,
  );

  res.json({
    success: true,
    data: { quotation },
  });
};

/**
 * Create a quotation request (customer)
 */
export const createQuotationRequest = async (req: Request, res: Response) => {
  const customerId = req.user!.id;

  const quotation = await quotationService.createQuotationRequest(
    customerId,
    req.body,
  );

  res.status(201).json({
    success: true,
    message: "Quotation request submitted successfully",
    data: { quotation },
  });
};

/**
 * Send quotation (owner responds)
 */
export const sendQuotation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownerId = req.user!.id;

  const quotation = await quotationService.sendQuotation(
    id as string,
    ownerId,
    req.body,
  );

  res.json({
    success: true,
    message: "Quotation sent successfully",
    data: { quotation },
  });
};

/**
 * Respond to quotation (customer accepts/rejects)
 */
export const respondToQuotation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const customerId = req.user!.id;

  const quotation = await quotationService.respondToQuotation(
    id as string,
    customerId,
    req.body,
  );

  res.json({
    success: true,
    message: `Quotation ${req.body.status.toLowerCase()} successfully`,
    data: { quotation },
  });
};

/**
 * Get all quotations (admin)
 */
export const getAllQuotations = async (req: Request, res: Response) => {
  const { status, page, limit } = req.query;

  const result = await quotationService.getAllQuotations({
    status: status as any,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Get pricing suggestions for a quotation (owner)
 * Helps owners price their quotations according to industry standards
 */
export const getPricingSuggestions = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { vehicleId } = req.query;
  const ownerId = req.user!.id;

  if (!vehicleId || typeof vehicleId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Vehicle ID is required",
    });
  }

  const suggestions = await quotationService.getPricingSuggestions(
    id as string,
    vehicleId,
    ownerId,
  );

  res.json({
    success: true,
    data: suggestions,
  });
};
