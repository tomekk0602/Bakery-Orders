"use client";
import { useEffect, useState, type RefObject } from "react";
import { money } from "../home/format";

/** The mobile shortcut disappears when checkout is visible, so it never covers its fields. */
export function MobileBasket({
  pieces,
  total,
  checkout,
  onContinue,
}: {
  pieces: number;
  total: number;
  checkout: RefObject<HTMLDivElement | null>;
  onContinue: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const catalogue = document.getElementById("pecivo");
    const form = checkout.current;
    if (!catalogue || !form) return;
    let inCatalogue = false;
    let inCheckout = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === catalogue) inCatalogue = entry.isIntersecting;
        if (entry.target === form) inCheckout = entry.isIntersecting;
      }
      setVisible(inCatalogue && !inCheckout);
    });
    observer.observe(catalogue);
    observer.observe(form);
    return () => observer.disconnect();
  }, [checkout]);
  if (!visible) return null;
  return (
    <div className="mobile-basket">
      <span aria-live="polite">
        {pieces} ks <strong>{money(total)}</strong>
      </span>
      <button type="button" className="button primary" onClick={onContinue}>
        Pokračovat
      </button>
    </div>
  );
}
