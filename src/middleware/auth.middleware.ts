import type { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/error.utils";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env["API_KEY"];
  const provided = req.headers["x-api-key"];

  if (!provided || provided !== apiKey) {
    sendError(res, 401, "UNAUTHORIZED", "Invalid or missing X-API-Key header.");
    return;
  }

  next();
}
