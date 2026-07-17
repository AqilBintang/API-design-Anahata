# Order API — Take-Home Test PT Anahata

REST API untuk manajemen order menggunakan **Node.js**, **TypeScript**, **Express**, dan **JSON file** sebagai penyimpanan data.

---

## Versi Node JS
- Node.js >= 18
- npm >= 9

---

## Setup & Menjalankan

```bash
# 1. Install dependensi
npm install

# 2. Salin file env dan isi nilai API key
cp .env.example .env

# 3. Jalankan server (development)
npm run dev
```

Server berjalan di `http://localhost:3000`.

```bash
# Production build
npm run build
npm start

# Jalankan automated tests
npm test
```

---

## Environment Variables

Buat file `.env` (atau salin dari `.env.example`):

```env
API_KEY=your-secret-api-key
PORT=3000
```

---

## Struktur Proyek

```
├── index.ts                        # Entry point
├── src/
│   ├── app.ts                      # Setup Express + middleware
│   ├── controllers/
│   │   └── order.controller.ts     # Logic semua endpoint
│   ├── db/
│   │   ├── db.ts                   # Helper baca/tulis JSON
│   │   └── orders.json             # Database (dibuat otomatis)
│   ├── middleware/
│   │   └── auth.middleware.ts      # X-API-Key authentication
│   ├── routes/
│   │   └── order.routes.ts
│   ├── tests/
│   │   ├── helpers/
│   │   │   └── testDb.ts           # In-memory DB mock untuk test
│   │   └── orders.test.ts          # 31 automated tests
│   ├── types/
│   │   └── order.ts
│   └── utils/
│       ├── error.utils.ts          # Standard error response helper
│       └── order.utils.ts          # Kalkulasi harga + validasi transisi
├── .env.example
├── package.json
├── tsconfig.json
└── tsconfig.test.json
```

---

## Authentication

Semua endpoint `/orders` memerlukan header:

```
X-API-Key: <nilai dari API_KEY di .env>
```

Tanpa key yang valid → `401 Unauthorized`.

---

## Endpoints

### Base URL: `http://localhost:3000`

| Method  | Endpoint               | Deskripsi              |
|---------|------------------------|------------------------|
| `POST`  | `/orders`              | Buat order baru        |
| `GET`   | `/orders`              | Ambil semua order      |
| `GET`   | `/orders/:id`          | Ambil order by ID      |
| `PATCH` | `/orders/:id/status`   | Update status order    |

---

### POST `/orders` — Buat Order

**Headers:**
```
X-API-Key: secret-api-key-anahata
Idempotency-Key: unique-client-key   (opsional)
Content-Type: application/json
```

**Request Body:**
```json
{
  "customerName": "Budi",
  "items": [
    { "name": "Kopi", "qty": 2, "price": 25000 }
  ]
}
```

**Response `201`:**
```json
{
  "id": "ord_1234567890_abc12",
  "customerName": "Budi",
  "items": [{ "name": "Kopi", "qty": 2, "price": 25000 }],
  "subtotal": 50000,
  "discount": 0,
  "total": 50000,
  "status": "pending",
  "createdAt": "2026-01-15T08:00:00.000Z"
}
```

**Aturan Diskon:**
| Subtotal        | Diskon |
|-----------------|--------|
| >= Rp 500.000   | 5%     |
| < Rp 500.000    | 0%     |

**Idempotency:**
Jika header `Idempotency-Key` dikirim dan key sudah pernah digunakan sebelumnya, server mengembalikan order yang sama (`200 OK`) tanpa membuat duplikat.

---

### GET `/orders` — Semua Order

**Headers:** `X-API-Key`

**Query Parameters:**

| Parameter   | Tipe    | Deskripsi                                  |
|-------------|---------|---------------------------------------------|
| `status`    | string  | Filter: `pending`, `paid`, `fulfilled`, `cancelled` |
| `dateFrom`  | string  | Filter dari tanggal (ISO 8601)             |
| `dateTo`    | string  | Filter sampai tanggal (ISO 8601)           |
| `sortBy`    | string  | `createdAt` (default) atau `total`         |
| `sortOrder` | string  | `asc` atau `desc` (default)                |
| `page`      | number  | Halaman (default: 1)                       |
| `limit`     | number  | Item per halaman (default: 10, max: 100)   |

**Response `200`:**
```json
{
  "data": [...],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

---

### GET `/orders/:id` — Order by ID

**Response `200`:** Object order.
**Response `404`:** Error not found.

---

### PATCH `/orders/:id/status` — Update Status

**Request Body:**
```json
{ "status": "paid" }
```

Untuk transisi `paid → cancelled`, wajib sertakan `reason`:
```json
{ "status": "cancelled", "reason": "Customer changed mind" }
```

**Transisi status yang diizinkan:**
```
pending  →  paid
pending  →  cancelled
paid     →  fulfilled
paid     →  cancelled  (wajib reason)
```
Semua transisi lain ditolak dengan `422 Unprocessable Entity`.

---

## Standard Error Response

Semua error menggunakan format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "items must not be empty"
  }
}
```

| Code                 | HTTP Status | Keterangan                        |
|----------------------|-------------|-----------------------------------|
| `UNAUTHORIZED`       | 401         | API key tidak valid atau tidak ada|
| `VALIDATION_ERROR`   | 400         | Input tidak valid                 |
| `NOT_FOUND`          | 404         | Resource tidak ditemukan          |
| `INVALID_TRANSITION` | 422         | Transisi status tidak diizinkan   |

---

## Automated Tests

```bash
npm test
```

31 test cases mencakup:
- Authentication (missing/invalid API key)
- Successful order creation
- Validation errors (customerName, items, qty, price)
- Price calculation (discount 5% >= 500k, multiple items)
- Status transitions (valid dan invalid)
- Idempotency
- Get order by ID
- Order listing (filter, sort, pagination)

---

## Contoh cURL/lebih mudah memakai Postman


```bash
# Buat order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-api-key-anahata" \
  -d '{"customerName":"Budi","items":[{"name":"Kopi","qty":2,"price":25000}]}'

# Buat order dengan idempotency key
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-api-key-anahata" \
  -H "Idempotency-Key: order-client-001" \
  -d '{"customerName":"Budi","items":[{"name":"Kopi","qty":2,"price":25000}]}'

# Ambil semua order (dengan filter & pagination)
curl "http://localhost:3000/orders?status=pending&sortBy=total&sortOrder=asc&page=1&limit=5" \
  -H "X-API-Key: secret-api-key-anahata"

# Ambil order by ID
curl http://localhost:3000/orders/ord_1234567890_abc12 \
  -H "X-API-Key: secret-api-key-anahata"

# Update status ke paid
curl -X PATCH http://localhost:3000/orders/ord_1234567890_abc12/status \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-api-key-anahata" \
  -d '{"status":"paid"}'

# Cancel paid order (wajib reason)
curl -X PATCH http://localhost:3000/orders/ord_1234567890_abc12/status \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-api-key-anahata" \
  -d '{"status":"cancelled","reason":"Customer changed mind"}'
```