const express = require("express");
const router = express.Router();
const {
  getProducts,
  scanCode,
  getProductByBarcode,
  createProduct,
  updateProduct,
  adjustStock,
  repackage,
  getExpiringProducts,
  generateBarcode,
  deleteProduct,
  getProductLogs,
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/auth");

router.get("/", protect, getProducts);
router.get("/scan/:code", protect, scanCode); // المسح الذكي (ميزان أو باركود عادي)
router.get("/barcode/:barcode", protect, getProductByBarcode);
router.get("/expiring", protect, authorize("admin"), getExpiringProducts);
router.post("/generate-barcode", protect, authorize("admin"), generateBarcode);
router.get("/:id/logs", protect, authorize("admin"), getProductLogs);

router.post("/", protect, authorize("admin"), createProduct);
router.put("/:id", protect, authorize("admin"), updateProduct);
router.patch("/:id/stock", protect, authorize("admin"), adjustStock);
router.post("/:id/repackage", protect, authorize("admin"), repackage);
router.delete("/:id", protect, authorize("admin"), deleteProduct);

module.exports = router;
