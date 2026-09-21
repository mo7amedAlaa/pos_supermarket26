require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const { initSocket } = require("./utils/socket");

const { apiLimiter } = require("./middleware/rateLimiters");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(compression());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use(morgan("combined"));

app.use("/api", apiLimiter);

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/api/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];

  res.json({
    status: "ok",
    service: "POS Supermarket API",
    db: states[mongoose.connection.readyState] || "unknown",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/invoices", invoiceRoutes);

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "POS Supermarket API is running",
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);

initSocket(server);

module.exports = {
  app,
  server,
};
