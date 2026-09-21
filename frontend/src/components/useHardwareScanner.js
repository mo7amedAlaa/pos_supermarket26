import { useEffect, useRef } from "react";

// Most USB/Bluetooth barcode & QR scanners behave like a keyboard:
// they type the code's characters very fast then send Enter.
// This hook listens globally and detects that pattern, calling onScan(code).
// It ignores normal (slow) typing so it won't interfere with regular inputs.
export default function useHardwareScanner(onScan, { active = true, maxDelayMs = 50 } = {}) {
  const buffer = useRef("");
  const lastTime = useRef(0);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e) => {
      const now = Date.now();
      const elapsed = now - lastTime.current;
      lastTime.current = now;

      if (e.key === "Enter") {
        if (buffer.current.length >= 3) {
          onScan(buffer.current);
        }
        buffer.current = "";
        return;
      }

      if (e.key.length === 1) {
        // if too slow, this is human typing -> reset buffer to avoid false triggers
        if (elapsed > maxDelayMs && buffer.current.length > 0) {
          buffer.current = "";
        }
        buffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, active, maxDelayMs]);
}
