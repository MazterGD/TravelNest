import type { Request, Response } from "express";
import * as quotationService from "./quotation.service.js";
import { ResponseHelper } from "../../utils/response.js";

/**
 * Get owner's quotation requests (PENDING)
 */
export const getOwnerQuotationRequests = async (
  req: Request,
  res: Response,
) => {
  const ownerId = req.user!.id;
  const {
    status,
    page,
    limit,
    startDate,
    endDate,
    vehicleType,
    passengerMin,
    passengerMax,
    sortBy,
  } = req.query;

  const result = await quotationService.getOwnerQuotationRequests(ownerId, {
    status: status as any,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    startDate: typeof startDate === "string" ? startDate : undefined,
    endDate: typeof endDate === "string" ? endDate : undefined,
    vehicleType: typeof vehicleType === "string" ? vehicleType : undefined,
    passengerMin: passengerMin ? Number(passengerMin) : undefined,
    passengerMax: passengerMax ? Number(passengerMax) : undefined,
    sortBy: typeof sortBy === "string" ? sortBy : undefined,
  });

  return ResponseHelper.success(res, result);
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

  return ResponseHelper.success(res, result);
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

  return ResponseHelper.success(res, result);
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

  return ResponseHelper.success(res, { quotation });
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

  return ResponseHelper.created(
    res,
    { quotation },
    "Quotation request submitted successfully",
  );
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

  return ResponseHelper.success(
    res,
    { quotation },
    "Quotation sent successfully",
  );
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

  return ResponseHelper.success(
    res,
    { quotation },
    `Quotation ${req.body.status.toLowerCase()} successfully`,
  );
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

  return ResponseHelper.success(res, result);
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

  return ResponseHelper.success(res, suggestions);
};
