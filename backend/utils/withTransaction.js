const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// المشكلة اللي بيحلها الملف ده:
// -----------------------------
// لو كاشيرين اتنين ضغطوا "إتمام البيع" في نفس اللحظة بالظبط على نفس المنتج،
// MongoDB بيكتشف تعارض الكتابة (Write Conflict) بين الـ transaction بتوعهم
// ويفشل واحد منهم برسالة "TransientTransactionError". ده سلوك طبيعي ومتوقع
// من MongoDB نفسه — مش خطأ في تصميمنا — لكن لازم نتعامل معاه بإعادة محاولة
// المعاملة تلقائيًا بدل ما نرجّع خطأ للكاشير على طول.
//
// الكود ده هو الـ pattern الرسمي الموصى بيه من MongoDB نفسها للتعامل مع
// المعاملات (transactions) تحت الضغط والتزامن العالي.
// ---------------------------------------------------------------------------

const TRANSIENT_ERROR_LABEL = "TransientTransactionError";
const UNKNOWN_COMMIT_LABEL = "UnknownTransactionCommitResult";

async function commitWithRetry(session) {
  while (true) {
    try {
      await session.commitTransaction();
      return;
    } catch (err) {
      // فشل تأكيد الـ commit نفسه بسبب مشكلة شبكة مؤقتة -> نعيد محاولة الـ commit
      // فقط (مش المعاملة كلها من الأول) لأن العملية ممكن تكون نجحت فعلًا.
      if (err.hasErrorLabel?.(UNKNOWN_COMMIT_LABEL)) {
        continue;
      }
      throw err;
    }
  }
}

/**
 * ينفّذ دالة `fn(session)` جوه MongoDB transaction، وبيعيد المحاولة تلقائيًا
 * لو حصل تعارض كتابة مؤقت بسبب طلبات متزامنة على نفس البيانات.
 *
 * @param {(session: mongoose.ClientSession) => Promise<any>} fn
 * @param {{ maxRetries?: number }} options
 */
async function withTransaction(fn, { maxRetries = 6 } = {}) {
  const session = await mongoose.startSession();
  try {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });
      try {
        const result = await fn(session);
        await commitWithRetry(session);
        return result;
      } catch (err) {
        await session.abortTransaction().catch(() => {});

        const isTransient =
          err.hasErrorLabel?.(TRANSIENT_ERROR_LABEL) || err.code === 112; // 112 = WriteConflict

        if (isTransient && attempt < maxRetries) {
          // انتظار قصير متزايد (backoff) قبل إعادة المحاولة عشان منضغطش
          // على القاعدة أكتر وقت الزحمة
          await new Promise((resolve) => setTimeout(resolve, 30 * attempt));
          continue;
        }
        throw err;
      }
    }
  } finally {
    session.endSession();
  }
}

module.exports = { withTransaction };
