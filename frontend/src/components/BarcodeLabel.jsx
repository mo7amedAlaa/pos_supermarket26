import { forwardRef, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// بيرسم باركود حقيقي قابل للمسح (مش مجرد أرقام) باستخدام JsBarcode،
// ويعرض معاه اسم المنتج والسعر - جاهز للطباعة على ملصق ولزقه على المنتج.
const BarcodeLabel = forwardRef(({ barcode, name, price, unit }, ref) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!barcode || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, barcode, {
        format: "EAN13",
        width: 2,
        height: 60,
        fontSize: 14,
        margin: 8,
        displayValue: true,
      });
    } catch (err) {
      console.error("تعذر رسم الباركود:", err.message);
    }
  }, [barcode]);

  return (
    <div ref={ref} className="barcode-label">
      <div className="barcode-label-name">{name}</div>
      <svg ref={svgRef} />
      {price !== undefined && (
        <div className="barcode-label-price">
          {Number(price).toFixed(2)} ج.م {unit ? `/${unit}` : ""}
        </div>
      )}
    </div>
  );
});

export default BarcodeLabel;
