// اختبار خفيف لمنطق إعادة المحاولة في withTransaction، من غير ما نحتاج
// اتصال حقيقي بـ MongoDB - بيحاكي فشل المعاملة (Write Conflict) فعليًا.
// التشغيل: node scripts/testTransactionRetry.js
const assert = require("assert");
const mongoose = require("mongoose");

function makeFakeSession() {
  const calls = { start: 0, commit: 0, abort: 0, end: 0 };
  return {
    calls,
    startTransaction: () => { calls.start++; },
    commitTransaction: async () => { calls.commit++; },
    abortTransaction: async () => { calls.abort++; },
    endSession: async () => { calls.end++; },
  };
}

function transientError() {
  const err = new Error("WriteConflict");
  err.code = 112; // نفس الكود اللي MongoDB بيرجعه فعليًا عند تعارض الكتابة
  return err;
}

async function testRetriesThenSucceeds() {
  const session = makeFakeSession();
  mongoose.startSession = async () => session;
  delete require.cache[require.resolve("../utils/withTransaction")];
  const { withTransaction } = require("../utils/withTransaction");

  let attempts = 0;
  const result = await withTransaction(async () => {
    attempts++;
    if (attempts <= 2) throw transientError(); // يفشل مرتين بسبب تعارض كتابة
    return "تم البيع بنجاح";
  });

  assert.strictEqual(result, "تم البيع بنجاح");
  assert.strictEqual(attempts, 3, "المفروض يحاول 3 مرات (فشل مرتين ونجح في الثالثة)");
  assert.strictEqual(session.calls.abort, 2, "المفروض يعمل abort مرتين على المحاولات الفاشلة");
  assert.strictEqual(session.calls.commit, 1, "المفروض يعمل commit مرة واحدة بس عند النجاح");
  console.log("✅ اختبار 1 نجح: إعادة المحاولة عند تعارض الكتابة (concurrency) شغالة صح");
}

async function testNonTransientFailsImmediately() {
  const session = makeFakeSession();
  mongoose.startSession = async () => session;
  delete require.cache[require.resolve("../utils/withTransaction")];
  const { withTransaction } = require("../utils/withTransaction");

  let attempts = 0;
  await assert.rejects(
    withTransaction(async () => {
      attempts++;
      throw new Error("الكمية غير متوفرة"); // خطأ عادي (مش تعارض كتابة)
    }),
    /الكمية غير متوفرة/
  );
  assert.strictEqual(attempts, 1, "خطأ عادي مالوش داعي يتعاد - المفروض يفشل من أول مرة");
  console.log("✅ اختبار 2 نجح: الأخطاء العادية (زي نقص المخزون) بترجع فورًا من غير إعادة محاولة");
}

async function testGivesUpAfterMaxRetries() {
  const session = makeFakeSession();
  mongoose.startSession = async () => session;
  delete require.cache[require.resolve("../utils/withTransaction")];
  const { withTransaction } = require("../utils/withTransaction");

  let attempts = 0;
  await assert.rejects(
    withTransaction(
      async () => {
        attempts++;
        throw transientError(); // فشل دائم (تزاحم شديد جدًا)
      },
      { maxRetries: 3 }
    )
  );
  assert.strictEqual(attempts, 3, "لازم يوقف بعد الحد الأقصى للمحاولات بدل ما يحاول للأبد");
  console.log("✅ اختبار 3 نجح: بيوقف بعد الحد الأقصى للمحاولات بدل التكرار اللانهائي");
}

(async () => {
  await testRetriesThenSucceeds();
  await testNonTransientFailsImmediately();
  await testGivesUpAfterMaxRetries();
  console.log("\n🎉 كل اختبارات منطق التزامن (concurrency retry) نجحت");
  process.exit(0);
})().catch((err) => {
  console.error("❌ فشل اختبار:", err);
  process.exit(1);
});
