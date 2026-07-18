import fs from "fs";
import path from "path";

export interface StockItem {
  name: string;
  stock: number;
}

const STOCK_PATH = path.join(__dirname, "stock.json");

const DEFAULT_STOCK: StockItem[] = [
  { name: "Kopi", stock: 100 },
  { name: "Teh", stock: 80 },
  { name: "Nasi Goreng", stock: 50 },
  { name: "Makan Siang", stock: 40 },
  { name: "Laptop", stock: 10 },
  { name: "Steak", stock: 20 },
];

export function readStock(): StockItem[] {
  if (!fs.existsSync(STOCK_PATH)) {
    fs.writeFileSync(STOCK_PATH, JSON.stringify(DEFAULT_STOCK, null, 2));
  }
  const raw = fs.readFileSync(STOCK_PATH, "utf-8");
  return JSON.parse(raw) as StockItem[];
}

export function writeStock(items: StockItem[]): void {
  fs.writeFileSync(STOCK_PATH, JSON.stringify(items, null, 2));
}

/**
 * Cek apakah semua item dalam order tersedia di stok.
 * Return null jika semua OK, atau pesan error jika ada yang kurang.
 */
export function checkStock(
  orderItems: Array<{ name: string; qty: number }>
): string | null {
  const stock = readStock();

  for (const item of orderItems) {
    const found = stock.find(
      (s) => s.name.toLowerCase() === item.name.toLowerCase()
    );
    if (!found) {
      return `Item '${item.name}' not found in stock.`;
    }
    if (found.stock < item.qty) {
      return `Insufficient stock for '${item.name}'. Available: ${found.stock}, requested: ${item.qty}.`;
    }
  }
  return null;
}

/**
 * Kurangi stok setelah order berhasil dibuat.
 */
export function deductStock(
  orderItems: Array<{ name: string; qty: number }>
): void {
  const stock = readStock();

  for (const item of orderItems) {
    const found = stock.find(
      (s) => s.name.toLowerCase() === item.name.toLowerCase()
    );
    if (found) {
      found.stock -= item.qty;
    }
  }

  writeStock(stock);
}
