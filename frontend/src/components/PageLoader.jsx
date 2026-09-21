import { LoaderCircle } from "lucide-react";

export default function PageLoader() {
  return (
    <div className="page-loader">
      <LoaderCircle size={36} className="spin-icon" strokeWidth={2} />
    </div>
  );
}
