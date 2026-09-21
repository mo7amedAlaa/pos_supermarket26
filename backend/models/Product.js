const mongoose = require("mongoose");

// دفعة توريد: كل شحنة ليها تاريخ صلاحية وسعر شراء خاص بيها
const batchSchema = new mongoose.Schema(
  {
    quantity: { type: Number, required: true, default: 0 }, // الكمية المتبقية من الدفعة دي
    expiryDate: { type: Date }, // تاريخ الصلاحية (اختياري لغير الأصناف الغذائية)
    purchasePrice: { type: Number, required: true, default: 0 }, // سعر شراء الوحدة في الشحنة دي
    receivedAt: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { _id: true },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // باركود المصنع (EAN-13 المطبوع على العبوة) - للمنتجات المعبأة
    // ملحوظة: التفرّد (unique) بيتضمن تحت عن طريق partial index وليس هنا،
    // عشان لا يتعارض مع منتجات كتير قيمتها فاضية "" أو غير موجودة (المنتجات الموزونة).
    barcode: {
      type: String,
      required: function () {
        return !this.isWeighted;
      },
      trim: true,
    },

    // ---- منتجات بالوزن (جبنة، لحوم، خضار) ----
    isWeighted: { type: Boolean, default: false },
    // كود الصنف المبرمج جوه الميزان (5 أرقام) - بيتقرأ من باركود الميزان
    scaleItemCode: { type: String, trim: true },

    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },

    // للمنتجات بالوزن: السعر ده بيبقى سعر الكيلو
    purchasePrice: { type: Number, required: true, default: 0 },
    sellingPrice: { type: Number, required: true, default: 0 },

    // الكمية الإجمالية (قطع للمعبأ / كيلوجرام للموزون) - محسوبة من مجموع الدفعات
    quantity: { type: Number, required: true, default: 0 },

    // ---- الكرتونة مقابل القطعة ----
    unitsPerCarton: { type: Number, default: 1, min: 1 }, // مثال: كرتونة شيبسي = 24 كيس

    // ---- منتج مُعبّأ من خامة (زي طبق جبنة 100 جم من قالب جبنة سايب) ----
    // لو موجودة، ده معناه إن المنتج ده مش بيتوّرد مباشرة، لكن بيتعبّى/يتقسّم
    // من منتج "خامة" تاني (عادة منتج موزون بالكيلو) عن طريق إجراء "تعبئة".
    recipeFrom: {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      // الكمية المستهلكة من الخامة لكل وحدة واحدة من هذا المنتج
      // (بنفس وحدة الخامة - عادة كجم، مثال: 0.1 لطبق 100 جرام)
      quantityPerUnit: { type: Number, min: 0 },
    },

    unit: { type: String, default: "piece" }, // piece, kg, box...
    lowStockThreshold: { type: Number, default: 5 },

    // ---- تاريخ الصلاحية ----
    trackExpiry: { type: Boolean, default: false },
    batches: [batchSchema],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ name: "text", barcode: "text" });

// ---------------------------------------------------------------------------
// Unique indexes حقيقية على مستوى قاعدة البيانات (partial index).
// بتفرض التفرّد فقط على المستندات اللي فيها قيمة نصية حقيقية (مش فاضية)،
// فمنتجات كتير بـ barcode غير موجود (موزونة) أو scaleItemCode غير موجود
// (معبأة) تقدر تتعايش مع بعض من غير ما تتعارض على "".
// ده أقوى من sparse: true لأنه بيتفعّل حتى لو حد ضاف بيانات مباشرة في
// MongoDB من برّه الـ API بتاعنا (Compass، سكريبت استيراد، إلخ).
// ---------------------------------------------------------------------------
productSchema.index(
  { barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: "string", $gt: "" } },
    name: "barcode_unique_nonempty",
  },
);
productSchema.index(
  { scaleItemCode: 1 },
  {
    unique: true,
    partialFilterExpression: { scaleItemCode: { $type: "string", $gt: "" } },
    name: "scaleItemCode_unique_nonempty",
  },
);

// حماية إضافية على مستوى التطبيق: أي "" أو مسافات فاضية تتحول لـ undefined
// قبل الحفظ، عشان الحقل يتشال تمامًا بدل ما يتخزن كقيمة فاضية.
function blankToUndefined(v) {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

productSchema.pre("validate", function (next) {
  this.barcode = blankToUndefined(this.barcode);
  this.scaleItemCode = blankToUndefined(this.scaleItemCode);
  next();
});

// أقرب تاريخ صلاحية بين الدفعات اللي لسه فيها كمية
productSchema.virtual("nearestExpiry").get(function () {
  const dated = (this.batches || []).filter(
    (b) => b.quantity > 0 && b.expiryDate,
  );
  if (dated.length === 0) return null;
  return dated.reduce(
    (min, b) => (b.expiryDate < min ? b.expiryDate : min),
    dated[0].expiryDate,
  );
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

// يعيد حساب الكمية الإجمالية من الدفعات (لو الصنف بيتتبع الصلاحية)
productSchema.methods.recalcQuantityFromBatches = function () {
  if (!this.trackExpiry) return this.quantity;
  this.quantity = (this.batches || []).reduce((sum, b) => sum + b.quantity, 0);
  return this.quantity;
};

/**
 * يخصم كمية بنظام FEFO (First Expired, First Out) - الأقرب انتهاءً يتباع الأول.
 * بيرجع تكلفة البضاعة المباعة عشان حساب الأرباح يبقى دقيق.
 */
productSchema.methods.deductQuantity = function (amount) {
  let remaining = amount;
  let cost = 0;

  const batches = (this.batches || [])
    .filter((b) => b.quantity > 0)
    .sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) {
        return new Date(a.receivedAt) - new Date(b.receivedAt);
      }

      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;

      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });

  if (batches.length > 0) {
    for (const batch of batches) {
      if (remaining <= 0) break;

      const take = Math.min(batch.quantity, remaining);

      batch.quantity -= take;
      remaining -= take;

      cost += take * batch.purchasePrice;
    }

    if (remaining > 0) {
      return {
        cost: 0,
        shortfall: remaining,
      };
    }

    if (this.trackExpiry) {
      this.recalcQuantityFromBatches();
    } else {
      this.quantity -= amount;
    }
  } else {
    if (this.quantity < amount) {
      return {
        cost: 0,
        shortfall: amount - this.quantity,
      };
    }

    this.quantity -= amount;
    cost = amount * this.purchasePrice;
  }

  return {
    cost,
    shortfall: 0,
  };
};

module.exports = mongoose.model("Product", productSchema);
