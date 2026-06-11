import type { Response } from "express";

export interface AdminPagination {
  page: number;
  limit: number;
  skip: number;
}

export const parseAdminPagination = (
  pageInput: unknown,
  limitInput: unknown,
  maxLimit = 100,
): AdminPagination => {
  const page = Math.max(1, Number(pageInput) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(limitInput) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

// Backward-compatible alias used by multiple admin submodules.
export const parsePagination = parseAdminPagination;

export const escapeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value).replace(/\r?\n|\r/g, " ");
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
};

export const buildCsv = (headers: string[], rows: unknown[][]): string => {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return [headerLine, ...dataLines].join("\n");
};

export const sendCsv = (
  res: Response,
  filenamePrefix: string,
  csv: string,
): Response => {
  const filename = `${filenamePrefix}-${Date.now()}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
};

// Backward-compatible alias used by controllers.
export const sendCsvResponse = sendCsv;
