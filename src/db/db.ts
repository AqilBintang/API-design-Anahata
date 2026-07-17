import fs from "fs";
import path from "path";
import type { Order } from "../types/order";

const DB_PATH = path.join(__dirname, "orders.json");

export function readDB(): Order[] {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw) as Order[];
}

export function writeDB(orders: Order[]): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(orders, null, 2));
}

export function findByIdempotencyKey(key: string): Order | undefined {
  return readDB().find((o) => o.idempotencyKey === key);
}
