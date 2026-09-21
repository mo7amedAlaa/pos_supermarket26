const mongoose = require("mongoose");

const stockLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    type: {
      type: String,
      enum: ["stock_in", "adjustment", "sale", "stocktake"], // إضافة, تعديل, بيع, جرد
      required: true,
    },
    quantityBefore: { type: Number, required: true },
    quantityChange: { type: Number, required: true }, // + or -
    quantityAfter: { type: Number, required: true },
    note: { type: String, default: "" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockLog", stockLogSchema);
