import type { OrderItem, OrderStatus } from "../types/order";

// Hitung subtotal dari semua item.
export function calculateSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}


// discount subtotal >= 500.000 => diskon 5%
export function calculateDiscount(subtotal: number): number {
  if (subtotal >= 500_000) return subtotal * 0.05;
  return 0;
}

/**
 * Generate id unik dengan prefix "ord_".
 */
export function generateOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Allowed status transitions:
 *   pending  => paid
 *   pending  => cancelled
 *   paid     => fulfilled
 *   paid     => cancelled  (requires reason)
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:   ["paid", "cancelled"],
  paid:      ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
};

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function requiresReason(from: OrderStatus, to: OrderStatus): boolean {
  return from === "paid" && to === "cancelled";
}