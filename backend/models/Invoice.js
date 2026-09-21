const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true }, // نسخة من الاسم وقت البيع
    barcode: { type: String, default: "" },
    price: { type: Number, required: true }, // سعر الوحدة (أو سعر الكيلو للموزون)
    quantity: { type: Number, required: true }, // ممكن تكون كسرية للموزون (1.250 كجم)
    isWeighted: { type: Boolean, default: false },
    unit: { type: String, default: "piece" },
    cost: { type: Number, default: 0 }, // تكلفة البضاعة المباعة (FEFO) لحساب الربح
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    items: [invoiceItemSchema],
    total: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    totalCost: { type: Number, default: 0 }, // إجمالي تكلفة الأصناف
    profit: { type: Number, default: 0 }, // الربح الفعلي للفاتورة
    paymentMethod: { type: String, enum: ["cash", "card"], default: "cash" },
    amountPaid: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["completed", "refunded"], default: "completed" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
