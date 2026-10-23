import { type Request, type Response, type NextFunction } from "express";
import { type ZodError } from "zod";
import {
  HttpStatus,
  ErrorCode,
  type ErrorCodeType,
  type ApiErrorResponse,
  type ValidationError,
} from "@travenest/shared-types";

/**
 * Custom API Error class with HTTP status codes and error codes
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCodeType | string;
  public readonly isOperational: boolean;
  public readonly details?: ValidationError[] | Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    code: ErrorCodeType | string = ErrorCode.INTERNAL_ERROR,
    isOperational = true,
    details?: ValidationError[] | Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  // Factory methods for common errors
  static badRequest(
    message: string,
    code: ErrorCodeType = ErrorCode.INVALID_INPUT,
    details?: ValidationError[],
  ): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, message, code, true, details);
  }

  static unauthorized(
    message = "Authentication required",
    code: ErrorCodeType = ErrorCode.UNAUTHORIZED,
  ): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, message, code);
  }

  static forbidden(
    message = "Access denied",
    code: ErrorCodeType = ErrorCode.FORBIDDEN,
  ): ApiError {
    return new ApiError(HttpStatus.FORBIDDEN, message, code);
  }

  static notFound(
    resource = "Resource",
    code: ErrorCodeType = ErrorCode.RESOURCE_NOT_FOUND,
  ): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, `${resource} not found`, code);
  }

  static conflict(
    message: string,
    code: ErrorCodeType = ErrorCode.RESOURCE_CONFLICT,
  ): ApiError {
    return new ApiError(HttpStatus.CONFLICT, message, code);
  }

  static validationError(details: ValidationError[]): ApiError {
    return new ApiError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      "Validation failed",
      ErrorCode.VALIDATION_ERROR,
      true,
      details,
    );
  }

  static tooManyRequests(
    message = "Too many requests, please try again later",
  ): ApiError {
    return new ApiError(
      HttpStatus.TOO_MANY_REQUESTS,
      message,
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      ErrorCode.INTERNAL_ERROR,
      false,
    );
  }
}

/**
 * Format Zod validation errors into standard format
 */
const formatZodError = (error: ZodError): ValidationError[] => {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code,
  }));
};

/**
 * Generate a unique request ID for tracing
 */
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | ApiError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Get or generate request ID
  const requestId =
    (req.headers["x-request-id"] as string) || generateRequestId();

  // Default error values
  let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
  let message = "An unexpected error occurred";
  let code: ErrorCodeType | string = ErrorCode.INTERNAL_ERROR;
  let details: ValidationError[] | Record<string, unknown> | undefined;

  // Handle ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    details = err.details;
  }
  // Handle Zod validation errors
  else if (err.name === "ZodError") {
    statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
    message = "Validation failed";
    code = ErrorCode.VALIDATION_ERROR;
    details = formatZodError(err as ZodError);
  }
  // Handle JWT errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = "Invalid authentication token";
    code = ErrorCode.TOKEN_INVALID;
  } else if (err.name === "TokenExpiredError") {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = "Authentication token has expired";
    code = ErrorCode.TOKEN_EXPIRED;
  }
  // Multer upload limits (file too large, too many files)
  else if (err.name === "MulterError") {
    statusCode = HttpStatus.BAD_REQUEST;
    message = err.message;
    code = ErrorCode.INVALID_INPUT;
  }
  // Handle Prisma errors
  else if (err.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as Error & { code?: string };
    statusCode = HttpStatus.BAD_REQUEST;
    code = ErrorCode.DATABASE_ERROR;

    switch (prismaErr.code) {
      case "P2002":
        message = "A record with this value already exists";
        code = ErrorCode.RESOURCE_ALREADY_EXISTS;
        statusCode = HttpStatus.CONFLICT;
        break;
      case "P2025":
        message = "Record not found";
        code = ErrorCode.RESOURCE_NOT_FOUND;
        statusCode = HttpStatus.NOT_FOUND;
        break;
      default:
        message = "Database operation failed";
    }
  }

  // Build error response
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === "development" && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  // Log error with context
  const logLevel =
    statusCode >= HttpStatus.INTERNAL_SERVER_ERROR ? "error" : "warn";
  console[logLevel](`[${requestId}] ${statusCode} - ${code}: ${message}`, {
    path: req.path,
    method: req.method,
    statusCode,
    code,
    stack: err.stack,
  });

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl}`));
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
