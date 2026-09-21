const express = require("express");
const router = express.Router();
const {
  createInvoice,
  getInvoices,
  getInvoice,
  getSummary,
  getTopProducts,
} = require("../controllers/invoiceController");
const { protect, authorize } = require("../middleware/auth");

router.post("/", protect, authorize("cashier", "admin"), createInvoice);
router.get("/", protect, authorize("admin"), getInvoices);
router.get("/stats/summary", protect, authorize("admin"), getSummary);
router.get("/stats/top-products", protect, authorize("admin"), getTopProducts);
router.get("/:id", protect, getInvoice);

module.exports = router;
