import { AlertTriangle, RotateCw } from "lucide-react";

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <AlertTriangle size={28} strokeWidth={1.5} />
      <div className="error-state-message">{message || "حدث خطأ أثناء تحميل البيانات"}</div>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          <RotateCw size={15} /> إعادة المحاولة
        </button>
      )}
    </div>
  );
}
