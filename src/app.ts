import express from "express";
import { apiKeyAuth } from "./middleware/auth.middleware";
import orderRoutes from "./routes/order.routes";

const app = express();

app.use(express.json());

// Public health check
app.get("/", (_req, res) => {
  res.json({ message: "Order API berjalan!" });
});

// All /orders routes require API key
app.use("/orders", apiKeyAuth, orderRoutes);

export default app;
