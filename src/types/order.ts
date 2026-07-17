// Status baru sesuai challenge: pending → paid → fulfilled, bisa cancel dari pending/paid
export type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled";

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  idempotencyKey?: string;
}

export interface CreateOrderDto {
  customerName: string;
  items: OrderItem[];
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
  reason?: string;
}

// Query params untuk GET /orders
export interface OrderQuery {
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "createdAt" | "total";
  sortOrder?: "asc" | "desc";
  page?: string;
  limit?: string;
}
