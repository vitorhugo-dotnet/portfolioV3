"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../i18n/config.ts";
import {
  advanceSecretSequence,
  INITIAL_SECRET_SEQUENCE_STATE,
  type SecretSequenceState,
} from "../lib/secret-sequence.ts";
import styles from "./secret-terminal.module.css";

const SecretTerminalOverlay = dynamic(
  () => import("./secret-terminal-overlay"),
  {
    ssr: false,
  },
);

const HINT_KEYS = [
  { id: "up-one", arrow: "↑" },
  { id: "down-one", arrow: "↓" },
  { id: "up-two", arrow: "↑" },
  { id: "down-two", arrow: "↓" },
  { id: "up-three", arrow: "↑" },
  { id: "down-three", arrow: "↓" },
] as const;

type HintPosition = { top: number; left: number };

export function SecretTerminalController({
  locale,
  motion,
}: {
  locale: Locale;
  motion: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hint, setHint] = useState<HintPosition | null>(null);
  const progressRef = useRef<SecretSequenceState>(
    INITIAL_SECRET_SEQUENCE_STATE,
  );
  const hintTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        isOpen ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"]',
        )
      ) {
        progressRef.current = INITIAL_SECRET_SEQUENCE_STATE;
        return;
      }

      const result = advanceSecretSequence(
        progressRef.current,
        event.key,
        performance.now(),
      );
      progressRef.current = result.state;
      if (result.unlocked) {
        event.preventDefault();
        setHint(null);
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const onLogoClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const logo = event.target.closest<HTMLAnchorElement>(
        'a.logo[href="#inicio"]',
      );
      if (!logo) return;

      const rect = logo.getBoundingClientRect();
      setHint({
        top: Math.min(window.innerHeight - 55, rect.bottom + 10),
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 214)),
      });

      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current);
      }
      hintTimerRef.current = window.setTimeout(() => setHint(null), 3000);
    };

    document.addEventListener("click", onLogoClick);
    return () => {
      document.removeEventListener("click", onLogoClick);
      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      {hint && !isOpen && (
        <div
          className={styles.hint}
          style={{ top: hint.top, left: hint.left }}
          role="status"
          aria-label={
            locale === "pt-BR"
              ? "Pista secreta: seta para cima e para baixo, três vezes"
              : "Secret hint: up arrow then down arrow, three times"
          }
        >
          {HINT_KEYS.map(({ arrow, id }) => (
            <span className={styles.hintKey} key={id}>
              {arrow}
            </span>
          ))}
        </div>
      )}
      {isOpen && (
        <SecretTerminalOverlay
          locale={locale}
          motion={motion}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
