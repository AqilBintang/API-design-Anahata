import type { Request, Response } from "express";
import { readDB, writeDB, findByIdempotencyKey } from "../db/db";
import { checkStock, deductStock, readStock } from "../db/stock";
import type {
  CreateOrderDto,
  OrderStatus,
  UpdateOrderStatusDto,
  OrderQuery,
} from "../types/order";
import {
  calculateDiscount,
  calculateSubtotal,
  generateOrderId,
  isValidTransition,
  requiresReason,
} from "../utils/order.utils";
import { sendError } from "../utils/error.utils";

// POST /orders
export function createOrder(req: Request, res: Response): void {
  const body = req.body as Partial<CreateOrderDto>;
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

  // Idempotency: kembalikan order yang sama jika key sudah pernah dipakai
  if (idempotencyKey) {
    const existing = findByIdempotencyKey(idempotencyKey);
    if (existing) {
      res.status(200).json(existing);
      return;
    }
  }

  // Validasi input
  if (!body.customerName || typeof body.customerName !== "string" || !body.customerName.trim()) {
    sendError(res, 400, "VALIDATION_ERROR", "customerName must not be empty.");
    return;
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    sendError(res, 400, "VALIDATION_ERROR", "items must not be empty.");
    return;
  }

  for (const item of body.items) {
    if (
      typeof item.name !== "string" ||
      !item.name.trim() ||
      typeof item.qty !== "number" ||
      typeof item.price !== "number" ||
      item.qty <= 0 ||
      item.price < 0
    ) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Each item must have a non-empty name (string), qty (number > 0), and price (number >= 0)."
      );
      return;
    }
  }

  // C. Stock validation
  const stockError = checkStock(body.items);
  if (stockError) {
    sendError(res, 422, "INSUFFICIENT_STOCK", stockError);
    return;
  }

  // D. Kalkulasi harga
  const subtotal = calculateSubtotal(body.items);
  const discount = calculateDiscount(subtotal);
  const total = subtotal - discount;

  const newOrder = {
    id: generateOrderId(),
    customerName: body.customerName.trim(),
    items: body.items,
    subtotal,
    discount,
    total,
    status: "pending" as OrderStatus,
    createdAt: new Date().toISOString(),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };

  const orders = readDB();
  orders.push(newOrder);
  writeDB(orders);

  // Kurangi stok setelah order berhasil dibuat
  deductStock(body.items);

  res.status(201).json(newOrder);
}

// GET /orders
export function getAllOrders(req: Request, res: Response): void {
  const q = req.query as OrderQuery;
  let orders = readDB();

  // Filter by status
  if (q.status) {
    const validStatuses: OrderStatus[] = ["pending", "paid", "fulfilled", "cancelled"];
    if (!validStatuses.includes(q.status)) {
      sendError(res, 400, "VALIDATION_ERROR", `Invalid status filter: ${q.status}.`);
      return;
    }
    orders = orders.filter((o) => o.status === q.status);
  }

  // Filter by date range
  if (q.dateFrom) {
    const from = new Date(q.dateFrom).getTime();
    if (isNaN(from)) {
      sendError(res, 400, "VALIDATION_ERROR", "dateFrom must be a valid ISO date string.");
      return;
    }
    orders = orders.filter((o) => new Date(o.createdAt).getTime() >= from);
  }

  if (q.dateTo) {
    const to = new Date(q.dateTo).getTime();
    if (isNaN(to)) {
      sendError(res, 400, "VALIDATION_ERROR", "dateTo must be a valid ISO date string.");
      return;
    }
    orders = orders.filter((o) => new Date(o.createdAt).getTime() <= to);
  }

  // Sorting
  const sortBy = q.sortBy ?? "createdAt";
  const sortOrder = q.sortOrder ?? "desc";

  if (sortBy !== "createdAt" && sortBy !== "total") {
    sendError(res, 400, "VALIDATION_ERROR", "sortBy must be 'createdAt' or 'total'.");
    return;
  }

  orders.sort((a, b) => {
    const aVal = sortBy === "total" ? a.total : new Date(a.createdAt).getTime();
    const bVal = sortBy === "total" ? b.total : new Date(b.createdAt).getTime();
    return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
  });

  // Pagination
  const page = Math.max(1, parseInt(q.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "10", 10)));
  const total = orders.length;
  const totalPages = Math.ceil(total / limit);
  const data = orders.slice((page - 1) * limit, page * limit);

  res.json({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  });
}

// GET /orders/:id
export function getOrderById(req: Request, res: Response): void {
  const orders = readDB();
  const order = orders.find((o) => o.id === req.params["id"]);

  if (!order) {
    sendError(res, 404, "NOT_FOUND", `Order with id '${req.params["id"]}' not found.`);
    return;
  }

  res.json(order);
}

// PATCH /orders/:id/status
export function updateOrderStatus(req: Request, res: Response): void {
  const body = req.body as Partial<UpdateOrderStatusDto>;
  const validStatuses: OrderStatus[] = ["pending", "paid", "fulfilled", "cancelled"];

  if (!body.status || !validStatuses.includes(body.status)) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      `status is required and must be one of: ${validStatuses.join(", ")}.`
    );
    return;
  }

  const orders = readDB();
  const index = orders.findIndex((o) => o.id === req.params["id"]);

  if (index === -1) {
    sendError(res, 404, "NOT_FOUND", `Order with id '${req.params["id"]}' not found.`);
    return;
  }

  const order = orders[index]!;

  if (!isValidTransition(order.status, body.status)) {
    sendError(
      res,
      422,
      "INVALID_TRANSITION",
      `Cannot transition order from '${order.status}' to '${body.status}'.`
    );
    return;
  }

  // paid → cancelled requires a reason
  if (requiresReason(order.status, body.status)) {
    if (!body.reason || typeof body.reason !== "string" || !body.reason.trim()) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "A reason is required when cancelling a paid order."
      );
      return;
    }
  }

  orders[index] = { ...order, status: body.status };
  writeDB(orders);

  res.json(orders[index]);
}

// ─── GET /orders/stock ───────────────────────────────────────────────────────
export function getStock(_req: Request, res: Response): void {
  res.json(readStock());
}
