const Product = require("../models/Product");
const StockLog = require("../models/StockLog");
const { parseScaleBarcode } = require("../utils/scaleBarcode");
const { emitEvent } = require("../utils/socket");
const { generateInternalBarcode } = require("../utils/barcodeGenerator");
const { getNextSequence } = require("../models/Counter");
const { withTransaction } = require("../utils/withTransaction");

// @route POST /api/products/generate-barcode  (admin)
// بيولّد باركود EAN-13 داخلي فريد وصالح للمنتجات اللي مالهاش باركود من
// المصنع (عيش، بقالة سايبة، منتجات محلية). الرقم التسلسلي بيتزود بأمان
// عبر Counter ذري (atomic) حتى لو أدمن تاني بيولّد باركود في نفس اللحظة.
exports.generateBarcode = async (req, res) => {
  try {
    let barcode;
    let attempts = 0;
    do {
      const seq = await getNextSequence("internal_barcode");
      barcode = generateInternalBarcode(seq);
      attempts++;
    } while ((await Product.exists({ barcode })) && attempts < 5);

    res.json({ barcode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const { search, category, lowStock, expiringDays } = req.query;
    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { scaleItemCode: { $regex: search, $options: "i" } },
      ];
    }
    if (category) filter.category = category;

    let products = await Product.find(filter)
      .populate("category", "name")
      .populate("recipeFrom.product", "name quantity unit isWeighted")
      .sort({ createdAt: -1 });

    if (lowStock === "true") {
      products = products.filter((p) => p.quantity <= p.lowStockThreshold);
    }

    if (expiringDays) {
      const limit = new Date();
      limit.setDate(limit.getDate() + Number(expiringDays));
      products = products.filter((p) => {
        const nearest = p.nearestExpiry;
        return nearest && nearest <= limit;
      });
    }

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------------------------------------------------------------
// @route GET /api/products/scan/:code
// نقطة المسح الذكية المستخدمة في شاشة الكاشير.
// بتفرّق أوتوماتيك بين:
//   1. باركود ميزان (منتج بالوزن) -> بترجع الوزن/السعر المدمج فيه
//   2. باركود مصنع عادي          -> بترجع المنتج بكمية 1
// ---------------------------------------------------------------------------
exports.scanCode = async (req, res) => {
  try {
    const code = req.params.code;

    // (1) نجرب الأول نفكه كباركود ميزان
    const scale = parseScaleBarcode(code);
    if (scale) {
      const product = await Product.findOne({
        scaleItemCode: scale.itemCode,
        isActive: true,
      });
      if (!product) {
        return res.status(404).json({
          message: `صنف الميزان رقم (${scale.itemCode}) غير مسجل في النظام`,
        });
      }

      // لو الميزان مدمج فيه الوزن -> نحسب السعر من سعر الكيلو
      // لو مدمج فيه السعر -> نحسب الوزن عكسيًا
      let quantity;
      let unitPrice = product.sellingPrice; // سعر الكيلو
      if (scale.weightKg !== undefined) {
        quantity = scale.weightKg;
      } else {
        quantity =
          product.sellingPrice > 0 ? scale.priceEGP / product.sellingPrice : 0;
      }

      return res.json({
        source: "scale",
        product,
        quantity: Number(quantity.toFixed(3)),
        unitPrice,
        lineTotal: Number((quantity * unitPrice).toFixed(2)),
      });
    }

    // (2) باركود مصنع عادي
    const product = await Product.findOne({ barcode: code, isActive: true });
    if (!product) {
      return res.status(404).json({ message: "المنتج غير موجود" });
    }

    res.json({
      source: "barcode",
      product,
      quantity: 1,
      unitPrice: product.sellingPrice,
      lineTotal: product.sellingPrice,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/products/barcode/:barcode  (محتفظ بيها للتوافق)
exports.getProductByBarcode = async (req, res) => {
  try {
    const product = await Product.findOne({
      barcode: req.params.barcode,
      isActive: true,
    });
    if (!product) return res.status(404).json({ message: "المنتج غير موجود" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route POST /api/products  (admin)
// ---------------------------------------------------------------------------
// دالة مشتركة: بتخصم كمية "portions" من خامة المنتج (recipeFrom) وتضيفها
// لرصيد المنتج نفسه، وتحسب التكلفة الفعلية. مستخدمة في مكانين:
//   1) عند إنشاء منتج جديد مربوط بخامة برصيد افتتاحي (خصم فوري وقت الإنشاء)
//   2) عند "تعبئة" دفعة جديدة لمنتج موجود بالفعل (من زرار "تعبئة")
// لازم تتنفذ جوه transaction (session) عشان تبقى ذرية مع أي عمليات تانية
// بتحصل في نفس الوقت (منتج تاني بيستهلك من نفس الخامة مثلًا).
// ---------------------------------------------------------------------------
async function performRepackage({ finished, portions, note, userId, session }) {
  if (!finished.recipeFrom?.product || !finished.recipeFrom?.quantityPerUnit) {
    throw new Error(
      "المنتج ده لازم يتربط بخامة وكمية استهلاك لكل وحدة الأول (من فورم إضافة/تعديل المنتج)",
    );
  }

  const raw = await Product.findById(finished.recipeFrom.product).session(
    session,
  );
  if (!raw) throw new Error("الخامة المرتبطة بالمنتج غير موجودة");

  const rawNeeded = Number(
    (portions * finished.recipeFrom.quantityPerUnit).toFixed(3),
  );
  if (raw.quantity < rawNeeded) {
    throw new Error(
      `الخامة "${raw.name}" غير كافية - المطلوب ${rawNeeded} ${raw.unit}، المتاح ${raw.quantity} ${raw.unit}`,
    );
  }

  // خصم الخامة (بنظام FEFO لو بتتبع صلاحية) - وده بيرجع التكلفة الفعلية
  // للكمية المستهلكة حسب سعر الشراء الحقيقي للدفعة
  const rawQuantityBefore = raw.quantity;
  const { cost: rawCost } = raw.deductQuantity(rawNeeded);
  await raw.save({ session });

  await StockLog.create(
    [
      {
        product: raw._id,
        type: "adjustment",
        quantityBefore: rawQuantityBefore,
        quantityChange: -rawNeeded,
        quantityAfter: raw.quantity,
        note: `استهلاك في تعبئة ${portions} ${finished.unit} من "${finished.name}"${note ? " - " + note : ""}`,
        performedBy: userId,
      },
    ],
    { session },
  );

  // إضافة الوحدات الجاهزة + تحديث سعر الشراء (التكلفة) تلقائيًا من التكلفة
  // الفعلية للخامة المستهلكة - ده بيخلي حساب الأرباح دقيق
  const finishedQuantityBefore = finished.quantity;
  finished.quantity += portions;
  const costPerPortion = Number((rawCost / portions).toFixed(2));
  finished.purchasePrice = costPerPortion;
  await finished.save({ session });

  await StockLog.create(
    [
      {
        product: finished._id,
        type: "stock_in",
        quantityBefore: finishedQuantityBefore,
        quantityChange: portions,
        quantityAfter: finished.quantity,
        note: `تعبئة من الخامة "${raw.name}" (${rawNeeded} ${raw.unit})${note ? " - " + note : ""}`,
        performedBy: userId,
      },
    ],
    { session },
  );

  return { finished, raw, rawNeeded, costPerPortion };
}

exports.createProduct = async (req, res) => {
  try {
    const body = { ...req.body };

    // نطهّر القيمتين من المسافات الفاضية الأول عشان نتحقق صح
    // (مثلاً " " ملهاش قيمة حقيقية لكنها truthy في جافاسكريبت)
    const trimmedBarcode =
      typeof body.barcode === "string" ? body.barcode.trim() : body.barcode;
    const trimmedScaleCode =
      typeof body.scaleItemCode === "string"
        ? body.scaleItemCode.trim()
        : body.scaleItemCode;

    if (body.isWeighted) {
      if (!trimmedScaleCode) {
        return res
          .status(400)
          .json({ message: "المنتج بالوزن لازم يكون له كود صنف في الميزان" });
      }
      body.scaleItemCode = trimmedScaleCode;
      body.unit = body.unit || "kg";
      body.unitsPerCarton = 1;
      delete body.barcode; // المنتج الموزون مالهوش باركود ثابت
    } else {
      if (!trimmedBarcode) {
        return res
          .status(400)
          .json({ message: "الباركود مطلوب للمنتجات المعبأة" });
      }
      body.barcode = trimmedBarcode;
      delete body.scaleItemCode; // المنتج المعبأ مالهوش كود ميزان
    }

    // منع التكرار (نتحقق بعد التطهير، ومفيش داعي نتحقق من قيم فاضية)
    if (body.barcode) {
      const dup = await Product.findOne({ barcode: body.barcode });
      if (dup)
        return res
          .status(400)
          .json({ message: "الباركود مستخدم بالفعل لمنتج آخر" });
    }
    if (body.scaleItemCode) {
      const dup = await Product.findOne({ scaleItemCode: body.scaleItemCode });
      if (dup)
        return res
          .status(400)
          .json({ message: "كود صنف الميزان مستخدم بالفعل" });
    }

    const openingQty = Number(body.quantity || 0);
    const hasRecipe =
      body.recipeFrom?.product && body.recipeFrom?.quantityPerUnit;

    // ------------------------------------------------------------------
    // الحالة 1: منتج مربوط بخامة (زي طبق جبنة) وله رصيد افتتاحي > 0
    // بنخصم الخامة المطلوبة فورًا وقت الإنشاء نفسه، مش محتاجين خطوة
    // "تعبئة" منفصلة بعدها. كل ده جوه معاملة واحدة (transaction) عشان
    // لو الخامة مش كفاية، إنشاء المنتج نفسه يتلغي بالكامل (مفيش منتج
    // يتعمل بكمية 0 بالغلط لو فشل الخصم).
    // ------------------------------------------------------------------
    if (hasRecipe && openingQty > 0) {
      try {
        const result = await withTransaction(async (session) => {
          const created = await Product.create([{ ...body, quantity: 0 }], {
            session,
          });
          const finished = created[0];
          return performRepackage({
            finished,
            portions: openingQty,
            note: "رصيد افتتاحي (تعبئة تلقائية عند الإنشاء)",
            userId: req.user._id,
            session,
          });
        });

        emitEvent("product:created", {
          productId: result.finished._id,
          name: result.finished.name,
        });
        emitEvent("stock:changed", {
          productIds: [result.finished._id, result.raw._id],
        });

        return res.status(201).json({
          ...result.finished.toObject(),
          rawConsumed: result.rawNeeded,
          rawRemaining: result.raw.quantity,
        });
      } catch (err) {
        // أخطاء منطقية (خامة غير كافية، الخامة مش موجودة) لازم ترجع 400
        // مش 500 - مش خطأ سيرفر، طلب غير صالح من المستخدم
        return res.status(400).json({ message: err.message });
      }
    }

    // ------------------------------------------------------------------
    // الحالة 2: الرصيد الافتتاحي عادي (مش مربوط بخامة) - لو الصنف بيتتبع
    // الصلاحية نحطه كأول دفعة
    // ------------------------------------------------------------------
    if (body.trackExpiry && openingQty > 0) {
      body.batches = [
        {
          quantity: openingQty,
          expiryDate: body.expiryDate || undefined,
          purchasePrice: Number(body.purchasePrice || 0),
          note: "رصيد افتتاحي",
        },
      ];
    }
    delete body.expiryDate;

    const product = await Product.create(body);

    if (openingQty > 0) {
      await StockLog.create({
        product: product._id,
        type: "stock_in",
        quantityBefore: 0,
        quantityChange: openingQty,
        quantityAfter: openingQty,
        note: "رصيد افتتاحي عند إضافة المنتج",
        performedBy: req.user._id,
      });
    }

    emitEvent("product:created", {
      productId: product._id,
      name: product.name,
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/products/:id  (admin) - تعديل البيانات بدون الكمية
// ملحوظة: barcode و scaleItemCode مش قابلين للتعديل هنا عن قصد — تغييرهم
// ممكن يبعت قيمة فاضية "" من الفورم ويمسح القيمة الأصلية، وده سبب مشكلة
// duplicate key سابقة. لو محتاج تغيّر الباركود فعليًا، احذف المنتج وأضفه
// تاني بباركود جديد.
exports.updateProduct = async (req, res) => {
  try {
    const { quantity, batches, barcode, scaleItemCode, isWeighted, ...rest } =
      req.body;
    const product = await Product.findByIdAndUpdate(req.params.id, rest, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: "المنتج غير موجود" });
    emitEvent("product:changed", { productId: product._id });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------------------------------------------------------------
// @route PATCH /api/products/:id/stock  (admin)
// توريد / تعديل / جرد — مع دعم الكرتونة وتاريخ الصلاحية
//
// توريد بالكراتين:
//   { type: "stock_in", cartons: 3, looseUnits: 5, expiryDate, purchasePrice }
// توريد بالكمية مباشرة:
//   { type: "stock_in", quantityChange: 72, expiryDate, purchasePrice }
// جرد (تصحيح للكمية الفعلية):
//   { type: "stocktake", countedQuantity: 68, note }
// ---------------------------------------------------------------------------
exports.adjustStock = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "المنتج غير موجود" });

    const {
      quantityChange,
      cartons,
      looseUnits = 0,
      countedQuantity,
      expiryDate,
      purchasePrice,
      type = "adjustment",
      note = "",
    } = req.body;

    const quantityBefore = product.quantity;
    let change;

    // --- جرد: الكمية الفعلية المعدودة ---
    if (type === "stocktake" && countedQuantity !== undefined) {
      const counted = Number(countedQuantity);
      change = counted - quantityBefore;

      if (product.trackExpiry) {
        if (change > 0) {
          // زيادة غير مبررة -> دفعة جديدة بدون تاريخ
          product.batches.push({
            quantity: change,
            expiryDate: expiryDate || undefined,
            purchasePrice: Number(purchasePrice ?? product.purchasePrice),
            note: "فرق جرد (زيادة)",
          });
        } else if (change < 0) {
          // عجز -> نخصمه بنظام FEFO
          product.deductQuantity(Math.abs(change));
        }
        product.recalcQuantityFromBatches();
      } else {
        product.quantity = counted;
      }
    } else {
      // --- توريد أو تعديل ---
      if (cartons !== undefined) {
        // الكرتونة × عدد القطع في الكرتونة + القطع السايبة
        change = Number(cartons) * product.unitsPerCarton + Number(looseUnits);
      } else {
        change = Number(quantityChange);
      }

      if (product.trackExpiry) {
        if (change > 0) {
          product.batches.push({
            quantity: change,
            expiryDate: expiryDate || undefined,
            purchasePrice: Number(purchasePrice ?? product.purchasePrice),
            note,
          });
        } else if (change < 0) {
          product.deductQuantity(Math.abs(change));
        }
        product.recalcQuantityFromBatches();
      } else {
        product.quantity = quantityBefore + change;
      }

      // ------------------------------------------------------------------
      // متوسط سعر الشراء المرجّح (Weighted Average Cost) - مش تغطية السعر
      // القديم بالكامل. لو عندك 10 قطع بسعر 5ج.م وورّدت 10 قطع بسعر 7ج.م،
      // المتوسط الجديد = (10×5 + 10×7) ÷ 20 = 6ج.م، مش 7ج.م زي ما كان
      // بيحصل قبل كده (كان بيمسح تاريخ التكلفة القديمة بالكامل عند أي
      // توريد جديد، وده كان بيدي أرباح غلط لو باعت من المخزون القديم
      // والجديد مع بعض).
      // ------------------------------------------------------------------
      let avgCostNote = "";
      if (purchasePrice !== undefined && change > 0) {
        const newPrice = Number(purchasePrice);
        if (quantityBefore > 0 && product.purchasePrice > 0) {
          const totalCost =
            quantityBefore * product.purchasePrice + change * newPrice;
          const totalQty = quantityBefore + change;
          const oldAvg = product.purchasePrice;
          product.purchasePrice = Number((totalCost / totalQty).toFixed(4));
          avgCostNote = ` [متوسط التكلفة: ${oldAvg.toFixed(2)} ← ${product.purchasePrice.toFixed(2)} ج.م]`;
        } else {
          // مفيش رصيد قديم بتكلفة معروفة (أول توريد للمنتج) - ناخد السعر
          // الجديد مباشرة، مفيش حاجة نعمل لها متوسط معاها
          product.purchasePrice = newPrice;
        }
      }
    }

    if (product.quantity < 0) {
      return res
        .status(400)
        .json({ message: "الكمية الناتجة لا يمكن أن تكون أقل من صفر" });
    }

    await product.save();

    await StockLog.create({
      product: product._id,
      type,
      quantityBefore,
      quantityChange: change,
      quantityAfter: product.quantity,
      note:
        (cartons !== undefined
          ? `${note} (${cartons} كرتونة × ${product.unitsPerCarton} + ${looseUnits} قطعة)`.trim()
          : note) + avgCostNote,
      performedBy: req.user._id,
    });

    emitEvent("stock:changed", { productIds: [product._id] });
    if (product.quantity <= product.lowStockThreshold) {
      emitEvent("stock:low", {
        productId: product._id,
        name: product.name,
        quantity: product.quantity,
        threshold: product.lowStockThreshold,
      });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------------------------------------------------------------
// @route POST /api/products/:id/repackage  (admin)
// "تعبئة/تقسيم" - بتحوّل كمية من منتج "خامة" (عادة موزون بالكيلو، زي جبنة
// سايبة) لعدد من وحدات منتج جاهز (زي "طبق جبنة 100 جم"). بتخصم الخامة
// المستهلكة تلقائيًا وبتحسب تكلفة الوحدة الواحدة من التكلفة الفعلية
// للخامة (بنظام FEFO لو الخامة بتتبع صلاحية) بدل ما الأدمن يحسبها يدوي.
//
// body: { portions: <عدد الوحدات المراد إنتاجها>, note }
// المنتج (finished) لازم يكون له recipeFrom.product و recipeFrom.quantityPerUnit
// محددين مسبقًا من فورم إضافة/تعديل المنتج.
// ---------------------------------------------------------------------------
exports.repackage = async (req, res) => {
  try {
    const finishedId = req.params.id;
    const portions = Number(req.body.portions);
    const note = req.body.note || "";

    if (!portions || portions <= 0) {
      return res
        .status(400)
        .json({ message: "عدد الوحدات المطلوب إنتاجها غير صحيح" });
    }

    const result = await withTransaction(async (session) => {
      const finished = await Product.findById(finishedId).session(session);
      if (!finished) throw new Error("المنتج غير موجود");
      return performRepackage({
        finished,
        portions,
        note,
        userId: req.user._id,
        session,
      });
    });

    emitEvent("stock:changed", {
      productIds: [result.finished._id, result.raw._id],
    });

    res.json({
      finished: result.finished,
      rawRemaining: result.raw.quantity,
      rawConsumed: result.rawNeeded,
      costPerPortion: result.costPerPortion,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @route GET /api/products/expiring?days=30  (admin) - تقرير الأصناف القريبة من الانتهاء
exports.getExpiringProducts = async (req, res) => {
  try {
    const days = Number(req.query.days || 30);
    const limit = new Date();
    limit.setDate(limit.getDate() + days);

    const products = await Product.find({
      isActive: true,
      trackExpiry: true,
    }).populate("category", "name");

    const rows = [];
    for (const p of products) {
      for (const batch of p.batches) {
        if (
          batch.quantity > 0 &&
          batch.expiryDate &&
          batch.expiryDate <= limit
        ) {
          const daysLeft = Math.ceil(
            (batch.expiryDate - new Date()) / (1000 * 60 * 60 * 24),
          );
          rows.push({
            productId: p._id,
            name: p.name,
            barcode: p.barcode,
            category: p.category?.name || "-",
            batchId: batch._id,
            quantity: batch.quantity,
            expiryDate: batch.expiryDate,
            daysLeft,
            expired: daysLeft < 0,
          });
        }
      }
    }

    rows.sort((a, b) => a.daysLeft - b.daysLeft);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route DELETE /api/products/:id  (admin)
// حذف فعلي (Hard Delete) - المنتج بيتشال تمامًا من قاعدة البيانات، مش
// بس بيتعطّل. الفواتير وسجلات المخزون القديمة بتحتفظ بنسخة من اسم/سعر
// المنتج وقت البيع (snapshot) فمش بتتأثر ولا بتتعطل لو المنتج اتحذف بعدها.
exports.deleteProduct = async (req, res) => {
  try {
    // حماية: لو المنتج ده مستخدم كخامة لمنتج تاني (زي "جبنة سايب" خامة
    // لـ"طبق جبنة")، منسمحش بالحذف عشان منسيبش المنتج التاني معلّق بربط
    // بخامة مش موجودة. لازم يفكّ الربط من المنتج التاني الأول.
    const dependents = await Product.find({
      "recipeFrom.product": req.params.id,
    }).select("name");
    if (dependents.length > 0) {
      const names = dependents.map((d) => d.name).join("، ");
      return res.status(400).json({
        message: `مينفعش تحذف المنتج ده - مستخدم كخامة لـ: ${names}. فُكّ الربط من المنتجات دي الأول من فورم التعديل.`,
      });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "المنتج غير موجود" });

    emitEvent("product:deleted", { productId: product._id });
    res.json({ message: "تم حذف المنتج نهائيًا" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/products/:id/logs  (admin)
exports.getProductLogs = async (req, res) => {
  try {
    const logs = await StockLog.find({ product: req.params.id })
      .populate("performedBy", "name username")
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
