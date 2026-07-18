import { Router } from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getStock,
} from "../controllers/order.controller";
import { createOrderLimiter } from "../middleware/rateLimiter.middleware";

const router = Router();

router.post("/", createOrderLimiter, createOrder);
router.get("/", getAllOrders);
router.get("/stock", getStock);
router.get("/:id", getOrderById);
router.patch("/:id/status", updateOrderStatus);

export default router;