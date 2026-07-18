/**
 * Rate limiter khusus untuk POST /orders.
 * Maksimal 10 request per menit per IP.
 */
import rateLimit from "express-rate-limit";
import { sendError } from "../utils/error.utils";
import type { Request, Response, NextFunction } from "express";

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 10,             // maks 10 request per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(
      res,
      429,
      "RATE_LIMIT_EXCEEDED" as Parameters<typeof sendError>[2],
      "Too many requests. You can create at most 10 orders per minute."
    );
  },
});

export function createOrderLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env["NODE_ENV"] === "test") {
    next();
    return;
  }
  limiter(req, res, next);
}