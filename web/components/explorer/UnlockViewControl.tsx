"use client";

// "What does this course unlock?" is a preference, not a default: a student
// deciding what to take next cares about what they NEED; what a course
// unlocks is a second question, and a noisy one (partial unlocks especially).
// So it is off unless asked for, and when on it has two clearly different
// levels — the convention this control and its legend spell out.

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "./icons";
import styles from "./explorer.module.css";

export type UnlockView = "off" | "sole" | "all";

export const UNLOCK_OPTIONS: { value: UnlockView; label: string; hint: string }[] = [
  {
    value: "off",
    label: "Oculto",
    hint: "Solo ves lo que necesitas antes de este curso. Nada de lo que viene después se resalta.",
  },
  {
    value: "sole",
    label: "Único requisito",
    hint: "Resalta solo los cursos que este curso desbloquea por sí solo: con aprobarlo ya puedes verlos.",
  },
  {
    value: "all",
    label: "Todo el pensum",
    hint: "Para medir qué tan importante es: muestra todo lo que depende de este curso, directa o indirectamente, incluidos los que solo desbloquea en parte.",
  },
];

export const UNLOCK_STORAGE_KEY = "pensum:unlock-view";

export function readStoredUnlockView(): UnlockView {
  try {
    const v = localStorage.getItem(UNLOCK_STORAGE_KEY);
    return v === "sole" || v === "all" ? v : "off";
  } catch {
    return "off";
  }
}

export default function UnlockViewControl({
  value,
  onChange,
  label = "Ver lo que desbloquea",
}: {
  value: UnlockView;
  onChange: (v: UnlockView) => void;
  label?: string;
}) {
  return (
    <div className={styles.segSm} role="group" aria-label={label}>
      {UNLOCK_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${styles.segSmBtn} ${value === o.value ? styles.active : ""}`}
          aria-pressed={value === o.value}
          title={o.hint}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Toolbar version: one compact button that opens a menu where each level is
 * explained — the convention lives right where the choice is made. */
export function UnlockViewMenu({ value, onChange }: { value: UnlockView; onChange: (v: UnlockView) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // The toolbar scrolls horizontally (overflow-x: auto), which clips an
  // absolutely-positioned child — so the menu is `fixed`, placed from the button.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 356)) });
    }
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);
  const current = UNLOCK_OPTIONS.find((o) => o.value === value)!;
  return (
    <div className={styles.unlockMenuWrap} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={`${styles.unlockMenuBtn} ${value !== "off" ? styles.unlockMenuBtnOn : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className={styles.unlockMenuLabel}>Desbloqueos</span>
        <strong>{current.label}</strong>
        <ChevronDownIcon size={10} />
      </button>
      {open && pos && (
        <div className={styles.unlockMenu} style={{ top: pos.top, left: pos.left }} role="menu" aria-label="Ver lo que desbloquea">
          <p className={styles.unlockMenuIntro}>Qué mostrar de lo que viene <em>después</em> del curso que seleccionas.</p>
          {UNLOCK_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === o.value}
              className={`${styles.unlockMenuItem} ${value === o.value ? styles.unlockMenuItemOn : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className={styles.unlockMenuRadio} aria-hidden />
              <span>
                <strong>{o.label}</strong>
                <span>{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
