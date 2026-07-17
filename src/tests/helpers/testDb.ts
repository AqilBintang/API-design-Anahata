/**
 * Helper untuk mock DB pada saat testing.
 * Mengganti readDB/writeDB dengan in-memory store.
 */
import type { Order } from "../../types/order";

let store: Order[] = [];

export function getStore(): Order[] {
  return store;
}

export function resetStore(initial: Order[] = []): void {
  store = [...initial];
}

// Patch module — dipanggil sebelum test suite
jest.mock("../../db/db", () => ({
  readDB: () => store,
  writeDB: (orders: Order[]) => {
    store = orders;
  },
  findByIdempotencyKey: (key: string) => store.find((o) => o.idempotencyKey === key),
}));
