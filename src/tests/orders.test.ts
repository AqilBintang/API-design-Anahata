/**
 * Automated tests — Order API
 * Covers:
 *  1. Successful order creation
 *  2. Invalid request validation
 *  3. Invalid status transition
 *  4. Discount calculation
 *  5. Idempotency
 *  6. API key authentication
 *  7. Order listing (filter, sort, pagination)
 *  8. Get order by ID
 *  9. Valid status transitions
 */

import "./helpers/testDb"; // must be first — patches the db module
import { resetStore, getStore } from "./helpers/testDb";
import request from "supertest";
import app from "../app";

const API_KEY = "test-api-key";

// Set env before all tests
beforeAll(() => {
  process.env["API_KEY"] = API_KEY;
});

// Reset in-memory store before each test
beforeEach(() => {
  resetStore();
});

const validBody = {
  customerName: "Budi",
  items: [{ name: "Kopi", qty: 2, price: 25000 }],
};

// ─── Helper ──────────────────────────────────────────────────────────────────
function post(path: string) {
  return request(app).post(path).set("x-api-key", API_KEY);
}
function get(path: string) {
  return request(app).get(path).set("x-api-key", API_KEY);
}
function patch(path: string) {
  return request(app).patch(path).set("x-api-key", API_KEY);
}

// ─── A. Authentication ───────────────────────────────────────────────────────
describe("Authentication", () => {
  it("returns 401 when X-API-Key is missing", async () => {
    const res = await request(app).post("/orders").send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when X-API-Key is wrong", async () => {
    const res = await request(app)
      .post("/orders")
      .set("x-api-key", "wrong-key")
      .send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

// ─── B. Create Order ─────────────────────────────────────────────────────────
describe("POST /orders — Successful creation", () => {
  it("creates an order and returns 201 with correct fields", async () => {
    const res = await post("/orders").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      customerName: "Budi",
      status: "pending",
      subtotal: 50000,
      discount: 0,
      total: 50000,
    });
    expect(res.body.id).toMatch(/^ord_/);
    expect(res.body.createdAt).toBeDefined();
  });

  it("persists the order in the store", async () => {
    await post("/orders").send(validBody);
    expect(getStore()).toHaveLength(1);
  });
});

// ─── C. Validation ───────────────────────────────────────────────────────────
describe("POST /orders — Validation errors", () => {
  it("returns 400 when customerName is missing", async () => {
    const res = await post("/orders").send({ items: validBody.items });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toMatch(/customerName/);
  });

  it("returns 400 when items is empty array", async () => {
    const res = await post("/orders").send({ customerName: "Budi", items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toMatch(/items/);
  });

  it("returns 400 when items is missing", async () => {
    const res = await post("/orders").send({ customerName: "Budi" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when item has invalid qty", async () => {
    const res = await post("/orders").send({
      customerName: "Budi",
      items: [{ name: "Kopi", qty: -1, price: 25000 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when item price is negative", async () => {
    const res = await post("/orders").send({
      customerName: "Budi",
      items: [{ name: "Kopi", qty: 1, price: -100 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ─── D. Price Calculation ────────────────────────────────────────────────────
describe("POST /orders — Price calculation", () => {
  it("applies no discount when subtotal < 500000", async () => {
    const res = await post("/orders").send({
      customerName: "Ani",
      items: [{ name: "Teh", qty: 1, price: 100000 }],
    });
    expect(res.body.subtotal).toBe(100000);
    expect(res.body.discount).toBe(0);
    expect(res.body.total).toBe(100000);
  });

  it("applies 5% discount when subtotal >= 500000", async () => {
    const res = await post("/orders").send({
      customerName: "Cici",
      items: [{ name: "Laptop", qty: 1, price: 500000 }],
    });
    expect(res.body.subtotal).toBe(500000);
    expect(res.body.discount).toBe(25000);
    expect(res.body.total).toBe(475000);
  });

  it("calculates subtotal correctly for multiple items", async () => {
    const res = await post("/orders").send({
      customerName: "Dedi",
      items: [
        { name: "A", qty: 3, price: 100000 },
        { name: "B", qty: 2, price: 200000 },
      ],
    });
    // 3*100000 + 2*200000 = 700000 → discount 5% = 35000 → total 665000
    expect(res.body.subtotal).toBe(700000);
    expect(res.body.discount).toBe(35000);
    expect(res.body.total).toBe(665000);
  });
});

// ─── E. Status Transition ────────────────────────────────────────────────────
describe("PATCH /orders/:id/status — Status transitions", () => {
  async function createOrder() {
    const res = await post("/orders").send(validBody);
    return res.body as { id: string };
  }

  it("allows pending → paid", async () => {
    const order = await createOrder();
    const res = await patch(`/orders/${order.id}/status`).send({ status: "paid" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("paid");
  });

  it("allows pending → cancelled", async () => {
    const order = await createOrder();
    const res = await patch(`/orders/${order.id}/status`).send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("allows paid → fulfilled", async () => {
    const order = await createOrder();
    await patch(`/orders/${order.id}/status`).send({ status: "paid" });
    const res = await patch(`/orders/${order.id}/status`).send({ status: "fulfilled" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("fulfilled");
  });

  it("allows paid → cancelled with reason", async () => {
    const order = await createOrder();
    await patch(`/orders/${order.id}/status`).send({ status: "paid" });
    const res = await patch(`/orders/${order.id}/status`).send({
      status: "cancelled",
      reason: "Customer changed mind",
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("rejects paid → cancelled without reason", async () => {
    const order = await createOrder();
    await patch(`/orders/${order.id}/status`).send({ status: "paid" });
    const res = await patch(`/orders/${order.id}/status`).send({ status: "cancelled" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toMatch(/reason/);
  });

  it("rejects invalid transition: pending → fulfilled", async () => {
    const order = await createOrder();
    const res = await patch(`/orders/${order.id}/status`).send({ status: "fulfilled" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("rejects invalid transition: cancelled → paid", async () => {
    const order = await createOrder();
    await patch(`/orders/${order.id}/status`).send({ status: "cancelled" });
    const res = await patch(`/orders/${order.id}/status`).send({ status: "paid" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("rejects invalid transition: fulfilled → cancelled", async () => {
    const order = await createOrder();
    await patch(`/orders/${order.id}/status`).send({ status: "paid" });
    await patch(`/orders/${order.id}/status`).send({ status: "fulfilled" });
    const res = await patch(`/orders/${order.id}/status`).send({ status: "cancelled" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("returns 400 for unknown status value", async () => {
    const order = await createOrder();
    const res = await patch(`/orders/${order.id}/status`).send({ status: "shipped" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for non-existent order", async () => {
    const res = await patch("/orders/ord_nonexistent/status").send({ status: "paid" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ─── F. Idempotency ──────────────────────────────────────────────────────────
describe("POST /orders — Idempotency", () => {
  it("returns same order on duplicate request with same Idempotency-Key", async () => {
    const key = "idem-key-001";
    const first = await post("/orders")
      .set("idempotency-key", key)
      .send(validBody);
    const second = await post("/orders")
      .set("idempotency-key", key)
      .send(validBody);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(getStore()).toHaveLength(1); // hanya 1 order tersimpan
  });

  it("creates separate orders for different Idempotency-Keys", async () => {
    await post("/orders").set("idempotency-key", "key-A").send(validBody);
    await post("/orders").set("idempotency-key", "key-B").send(validBody);
    expect(getStore()).toHaveLength(2);
  });
});

// ─── G. Get Order by ID ──────────────────────────────────────────────────────
describe("GET /orders/:id", () => {
  it("returns the order for a valid id", async () => {
    const created = await post("/orders").send(validBody);
    const res = await get(`/orders/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it("returns 404 for unknown id", async () => {
    const res = await get("/orders/ord_unknown");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ─── H. Order Listing ────────────────────────────────────────────────────────
describe("GET /orders — Listing, filter, sort, pagination", () => {
  beforeEach(async () => {
    // Seed 3 orders with different statuses
    await post("/orders").send({ customerName: "A", items: [{ name: "X", qty: 1, price: 10000 }] });
    await post("/orders").send({ customerName: "B", items: [{ name: "Y", qty: 2, price: 50000 }] });
    await post("/orders").send({ customerName: "C", items: [{ name: "Z", qty: 1, price: 600000 }] });
  });

  it("returns all orders with pagination metadata", async () => {
    const res = await get("/orders");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination).toMatchObject({ total: 3, page: 1, limit: 10, totalPages: 1 });
  });

  it("filters by status", async () => {
    // Mark one as paid
    const all = await get("/orders");
    const firstId = all.body.data[0].id as string;
    await patch(`/orders/${firstId}/status`).send({ status: "paid" });

    const res = await get("/orders?status=paid");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe("paid");
  });

  it("returns 400 for invalid status filter", async () => {
    const res = await get("/orders?status=shipped");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("sorts by total ascending", async () => {
    const res = await get("/orders?sortBy=total&sortOrder=asc");
    const totals = res.body.data.map((o: { total: number }) => o.total) as number[];
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it("paginates correctly", async () => {
    const res = await get("/orders?page=1&limit=2");
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
  });
});
