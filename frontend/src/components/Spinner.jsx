export default function Spinner({ size = 16 }) {
  return (
    <span
      className="inline-spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="جاري التحميل"
    />
  );
}
