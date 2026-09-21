import { Component } from "react";
import { AlertOctagon } from "lucide-react";

// لازم يكون Class Component - React مبيدعمش error boundaries كـ hooks
// لحد دلوقتي. بيلتقط أي خطأ في العرض (render) في أي صفحة تحت منه
// ويعرض شاشة استرداد بدل ما المستخدم يشوف صفحة بيضا فاضية.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("خطأ غير متوقع في الواجهة:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <AlertOctagon size={48} strokeWidth={1.5} className="error-boundary-icon" />
          <h2>حدث خطأ غير متوقع</h2>
          <p className="muted">حاول تحديث الصفحة. لو المشكلة استمرت، تواصل مع الدعم الفني.</p>
          <button className="btn btn-primary" onClick={this.handleReload}>
            تحديث الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
