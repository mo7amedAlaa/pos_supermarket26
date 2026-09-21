const Product = require("../models/Product");
const StockLog = require("../models/StockLog");
const Invoice = require("../models/Invoice");
const { withTransaction } = require("../utils/withTransaction");
const { emitEvent } = require("../utils/socket");

const generateInvoiceNumber = async () => {
  const count = await Invoice.countDocuments();
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate()
  ).padStart(2, "0")}`;
  return `INV-${datePart}-${String(count + 1).padStart(5, "0")}`;
};

// @route POST /api/invoices  (cashier)
// body: { items: [{ productId, quantity, unitPrice? }], discount, tax, paymentMethod, amountPaid }
exports.createInvoice = async (req, res) => {
  try {
    const { items, discount = 0, tax = 0, paymentMethod = "cash", amountPaid = 0 } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "الفاتورة فارغة - لا يوجد منتجات" });
    }

    // ------------------------------------------------------------------
    // withTransaction بيلف كل العملية دي بمعاملة MongoDB، وبيعيد المحاولة
    // تلقائيًا لو حصل تعارض كتابة بسبب كاشير تاني بيبيع نفس المنتج في نفس
    // اللحظة بالظبط (concurrency). ده الحل الفعلي لمشكلة "أكتر من طلب في
        // نفس الوقت" على مستوى صحة البيانات، مش بس الأداء.
    // ------------------------------------------------------------------
    const { invoice, lowStockAlerts } = await withTransaction(async (session) => {
      const invoiceItems = [];
      let total = 0;
      let totalCost = 0;
      const alerts = [];

      for (const line of items) {
        // .session(session) يضمن إن القراءة والكتابة جوه نفس المعاملة،
        // فمفيش منتج تاني يقدر يقرأ نسخة قديمة من الكمية أثناء ما إحنا
        // لسه بنعدلها.
        const product = await Product.findById(line.productId).session(session);
        if (!product) throw new Error(`منتج غير موجود: ${line.productId}`);

        const qty = Number(line.quantity);
        if (!qty || qty <= 0) throw new Error(`كمية غير صحيحة للمنتج: ${product.name}`);

        if (product.quantity < qty) {
          throw new Error(
            `الكمية غير متوفرة للمنتج: ${product.name} (المتاح: ${product.quantity} ${product.unit})`
          );
        }

        const quantityBefore = product.quantity;
        const { cost, shortfall } = product.deductQuantity(qty);
        if (shortfall > 0) {
          throw new Error(`الكمية غير متوفرة في الدفعات للمنتج: ${product.name}`);
        }
        await product.save({ session });

        await StockLog.create(
          [
            {
              product: product._id,
              type: "sale",
              quantityBefore,
              quantityChange: -qty,
              quantityAfter: product.quantity,
              note: "بيع عبر نقطة البيع",
              performedBy: req.user._id,
            },
          ],
          { session }
        );

        if (product.quantity <= product.lowStockThreshold) {
          alerts.push({
            productId: product._id,
            name: product.name,
            quantity: product.quantity,
            threshold: product.lowStockThreshold,
          });
        }

        const unitPrice = line.unitPrice !== undefined ? Number(line.unitPrice) : product.sellingPrice;
        const subtotal = Number((unitPrice * qty).toFixed(2));

        total += subtotal;
        totalCost += cost;

        invoiceItems.push({
          product: product._id,
          name: product.name,
          barcode: product.barcode || "",
          price: unitPrice,
          quantity: qty,
          isWeighted: product.isWeighted,
          unit: product.unit,
          cost: Number(cost.toFixed(2)),
          subtotal,
        });
      }

      total = Number(total.toFixed(2));
      const grandTotal = Number((total - discount + tax).toFixed(2));
      const change = amountPaid ? Number((amountPaid - grandTotal).toFixed(2)) : 0;
      const invoiceNumber = await generateInvoiceNumber();

      const created = await Invoice.create(
        [
          {
            invoiceNumber,
            items: invoiceItems,
            total,
            discount,
            tax,
            grandTotal,
            totalCost: Number(totalCost.toFixed(2)),
            profit: Number((grandTotal - totalCost).toFixed(2)),
            paymentMethod,
            amountPaid,
            change,
            cashier: req.user._id,
          },
        ],
        { session }
      );

      return { invoice: created[0], lowStockAlerts: alerts };
    });

    // ------------------------------------------------------------------
    // البث الفوري (Realtime) - بيتم بعد نجاح الـ commit تمامًا، مش جوه
    // المعاملة، عشان منبعتش إشعار لحدث ممكن يتلغى (rollback) بعدين.
    // ------------------------------------------------------------------
    emitEvent("invoice:created", {
      invoiceNumber: invoice.invoiceNumber,
      grandTotal: invoice.grandTotal,
      itemsCount: invoice.items.length,
      cashierId: req.user._id,
      cashierName: req.user.name,
      createdAt: invoice.createdAt,
    });

    for (const alert of lowStockAlerts) {
      emitEvent("stock:low", alert);
    }
    emitEvent("stock:changed", {
      productIds: invoice.items.map((i) => i.product),
    });

    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @route GET /api/invoices
// يدعم Pagination (?page=1&limit=25) عشان صفحة التقارير متجيبش آلاف
// الفواتير مرة واحدة مع نمو المحل - أداء أفضل وتحميل أسرع.
exports.getInvoices = async (req, res) => {
  try {
    const { from, to, cashier } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

    const filter = {};
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    if (cashier) filter.cashier = cashier;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate("cashier", "name username")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      data: invoices,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/invoices/:id
exports.getInvoice = async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate("cashier", "name username");
  if (!invoice) return res.status(404).json({ message: "الفاتورة غير موجودة" });
  res.json(invoice);
};

// @route GET /api/invoices/stats/summary
exports.getSummary = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayInvoices = await Invoice.find({ createdAt: { $gte: startOfDay } });
    const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const todayProfit = todayInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);

    const lowStockCount = await Product.countDocuments({
      isActive: true,
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
    });

    const totalProducts = await Product.countDocuments({ isActive: true });

    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const expiryProducts = await Product.find({ isActive: true, trackExpiry: true });
    let expiringSoonCount = 0;
    for (const p of expiryProducts) {
      if (p.batches.some((b) => b.quantity > 0 && b.expiryDate && b.expiryDate <= limit)) {
        expiringSoonCount++;
      }
    }

    res.json({
      todaySalesCount: todayInvoices.length,
      todaySalesTotal: Number(todaySales.toFixed(2)),
      todayProfit: Number(todayProfit.toFixed(2)),
      lowStockCount,
      totalProducts,
      expiringSoonCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/invoices/stats/top-products?days=30&limit=10  (admin)
// أكثر المنتجات مبيعًا خلال فترة معينة - بالكمية والإيراد، باستخدام
// aggregation pipeline على عناصر الفواتير (أسرع بكتير من تجميعها يدويًا
// في الكود لو عندك آلاف الفواتير).
exports.getTopProducts = async (req, res) => {
  try {
    const days = Number(req.query.days || 30);
    const limit = Math.min(50, Number(req.query.limit || 10));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await Invoice.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $last: "$items.name" },
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.subtotal" },
          totalProfit: { $sum: { $subtract: ["$items.subtotal", "$items.cost"] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
    ]);

    res.json(
      rows.map((r) => ({
        productId: r._id,
        name: r.name,
        totalQuantity: Number(r.totalQuantity.toFixed(3)),
        totalRevenue: Number(r.totalRevenue.toFixed(2)),
        totalProfit: Number(r.totalProfit.toFixed(2)),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
