import type { Response } from "express";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "RATE_LIMIT_EXCEEDED";

/**
 * Kirim standard error response:
 * { "error": { "code": "...", "message": "..." } }
 */
export function sendError(
  res: Response,
  httpStatus: number,
  code: ErrorCode,
  message: string
): void {
  res.status(httpStatus).json({ error: { code, message } });
}