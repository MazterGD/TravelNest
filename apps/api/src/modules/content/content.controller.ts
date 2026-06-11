import type { Request, Response } from "express";
import { ResponseHelper } from "../../utils/response.js";
import * as contentService from "./content.service.js";

/**
 * GET /api/v1/content/:slug — public, published content pages only.
 */
export const getContentPage = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const page = await contentService.getPublishedContentPage(slug);
  return ResponseHelper.success(res, { page });
};
