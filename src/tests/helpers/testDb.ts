/**
 * Helper untuk mock DB pada saat testing.
 * Mengganti readDB/writeDB dengan in-memory store.
 */
import type { Order } from "../../types/order";
import type { StockItem } from "../../db/stock";

let store: Order[] = [];
let stockStore: StockItem[] = [
  { name: "Kopi", stock: 100 },
  { name: "Teh", stock: 80 },
  { name: "Nasi Goreng", stock: 50 },
  { name: "Makan Siang", stock: 40 },
  { name: "Laptop", stock: 10 },
];

export function getStore(): Order[] {
  return store;
}

export function resetStore(initial: Order[] = []): void {
  store = [...initial];
}

export function resetStockStore(initial?: StockItem[]): void {
  stockStore = initial ?? [
    { name: "Kopi", stock: 100 },
    { name: "Teh", stock: 80 },
    { name: "Nasi Goreng", stock: 50 },
    { name: "Makan Siang", stock: 40 },
    { name: "Laptop", stock: 10 },
  ];
}

// Patch orders DB
jest.mock("../../db/db", () => ({
  readDB: () => store,
  writeDB: (orders: Order[]) => {
    store = orders;
  },
  findByIdempotencyKey: (key: string) => store.find((o) => o.idempotencyKey === key),
}));

// Patch stock DB
jest.mock("../../db/stock", () => ({
  readStock: () => stockStore,
  writeStock: (items: StockItem[]) => {
    stockStore = items;
  },
  checkStock: (orderItems: Array<{ name: string; qty: number }>) => {
    for (const item of orderItems) {
      const found = stockStore.find(
        (s) => s.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!found) return `Item '${item.name}' not found in stock.`;
      if (found.stock < item.qty)
        return `Insufficient stock for '${item.name}'. Available: ${found.stock}, requested: ${item.qty}.`;
    }
    return null;
  },
  deductStock: (orderItems: Array<{ name: string; qty: number }>) => {
    for (const item of orderItems) {
      const found = stockStore.find(
        (s) => s.name.toLowerCase() === item.name.toLowerCase()
      );
      if (found) found.stock -= item.qty;
    }
  },
}));
