"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../i18n/config.ts";
import {
  advanceMobileLogoSequence,
  advanceSecretSequence,
  INITIAL_MOBILE_LOGO_SEQUENCE_STATE,
  INITIAL_SECRET_SEQUENCE_STATE,
  MOBILE_LOGO_CLICKS,
  type MobileLogoSequenceState,
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
type SecretGame = "desktop" | "mobile";
type Hint = HintPosition & (
  | { mode: "keyboard" }
  | { mode: "touch"; count: number }
);

export function SecretTerminalController({
  locale,
  motion,
}: {
  locale: Locale;
  motion: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [game, setGame] = useState<SecretGame>("desktop");
  const [hint, setHint] = useState<Hint | null>(null);
  const progressRef = useRef<SecretSequenceState>(
    INITIAL_SECRET_SEQUENCE_STATE,
  );
  const mobileProgressRef = useRef<MobileLogoSequenceState>(
    INITIAL_MOBILE_LOGO_SEQUENCE_STATE,
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
        setGame("desktop");
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const onLogoClick = (event: MouseEvent) => {
      if (isOpen || !(event.target instanceof Element)) return;

      const logo = event.target.closest<HTMLAnchorElement>(
        'a.logo[href="#inicio"]',
      );
      if (!logo) return;

      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }

      const rect = logo.getBoundingClientRect();
      const position = {
        top: Math.max(12, Math.min(window.innerHeight - 70, rect.bottom + 10)),
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 260)),
      };

      if (window.matchMedia("(pointer: coarse)").matches) {
        const result = advanceMobileLogoSequence(
          mobileProgressRef.current,
          performance.now(),
        );
        mobileProgressRef.current = result.state;

        if (result.unlocked) {
          event.preventDefault();
          setHint(null);
          setGame("mobile");
          setIsOpen(true);
          return;
        }

        setHint({ ...position, mode: "touch", count: result.state.count });
      } else {
        setHint({ ...position, mode: "keyboard" });
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
  }, [isOpen]);

  return (
    <>
      {hint && !isOpen && (
        <div
          className={styles.hint}
          style={{ top: hint.top, left: hint.left }}
          role="status"
          aria-label={
            hint.mode === "touch"
              ? locale === "pt-BR"
                ? "Toque na logo mais " + (MOBILE_LOGO_CLICKS - hint.count) + " vezes para abrir o jogo"
                : "Tap the logo " + (MOBILE_LOGO_CLICKS - hint.count) + " more times to open the game"
              : locale === "pt-BR"
                ? "Pista secreta: seta para cima e para baixo, três vezes"
                : "Secret hint: up arrow then down arrow, three times"
          }
        >
          {hint.mode === "touch" ? (
            <div className={styles.touchHint}>
              <span>
                {locale === "pt-BR" ? "Segredo: mais " : "Secret: "}
                <strong>{MOBILE_LOGO_CLICKS - hint.count}</strong>
                {locale === "pt-BR" ? " toques na logo" : " more logo taps"}
              </span>
              <span className={styles.hintCounter}>
                {hint.count}/{MOBILE_LOGO_CLICKS}
              </span>
            </div>
          ) : (
            HINT_KEYS.map(({ arrow, id }) => (
              <span className={styles.hintKey} key={id}>
                {arrow}
              </span>
            ))
          )}
        </div>
      )}
      {isOpen && (
        <SecretTerminalOverlay
          locale={locale}
          motion={motion}
          game={game}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
