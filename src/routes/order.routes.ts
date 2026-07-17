import { Router } from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
} from "../controllers/order.controller";

const router = Router();

router.post("/", createOrder);
router.get("/", getAllOrders);
router.get("/:id", getOrderById);
router.patch("/:id/status", updateOrderStatus);

export default router;