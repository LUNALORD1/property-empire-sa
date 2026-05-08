import { createPortal } from "react-dom";
import { useEffect } from "react";

/**
 * Renders children into document.body so the overlay always escapes any
 * stacking context (Leaflet map panes, sticky headers, transformed parents).
 * Pair with an explicit zIndex from src/lib/z.ts.
 */
export function Overlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  useEffect(() => {
    if (!onClose) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);
  if (typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}
