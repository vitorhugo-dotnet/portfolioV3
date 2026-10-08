"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../i18n/config.ts";
import styles from "./secret-terminal.module.css";

const TERMINAL_URL = "https://www.remojansen.com/";

export default function SecretTerminalOverlay({
  locale,
  motion,
  onClose,
}: {
  locale: Locale;
  motion: boolean;
  onClose: () => void;
}) {
  const [showTerminal, setShowTerminal] = useState(false);
  const [loading, setLoading] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isPortuguese = locale === "pt-BR";

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  useEffect(() => {
    const prefersLessMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!motion || prefersLessMotion) {
      setShowTerminal(true);
      return;
    }

    const timeout = window.setTimeout(() => setShowTerminal(true), 700);
    return () => window.clearTimeout(timeout);
  }, [motion]);

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={isPortuguese ? "Terminal secreto" : "Secret terminal"}
    >
      {!showTerminal && (
        <div className={styles.glitch} role="status" aria-live="polite">
          <span className={styles.glitchTitle}>SYSTEM BREACH</span>
          <span className={styles.glitchSubtitle}>
            INITIALIZING HIDDEN TERMINAL...
          </span>
        </div>
      )}

      {showTerminal && (
        <>
          {loading && (
            <div className={styles.loading} role="status">
              {isPortuguese
                ? "Conectando ao terminal externo..."
                : "Connecting to external terminal..."}
            </div>
          )}
          <iframe
            className={styles.frame}
            src={TERMINAL_URL}
            title={
              isPortuguese ? "Jogo no terminal retro" : "Retro terminal game"
            }
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
            allow="autoplay; fullscreen"
            allowFullScreen
            onLoad={() => setLoading(false)}
          />
          <div className={styles.credit}>
            <span>Terminal by Remo H. Jansen</span>
            <a
              href={TERMINAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={
                isPortuguese
                  ? "Se o site bloquear o iframe, abrir a versão original"
                  : "If the website blocks embedding, open the original"
              }
            >
              {isPortuguese ? "Não carregou? ↗" : "Not loading? ↗"}
            </a>
          </div>
        </>
      )}

      <button
        ref={closeRef}
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label={
          isPortuguese
            ? "Fechar terminal e voltar ao portfólio"
            : "Close terminal and return to portfolio"
        }
      >
        <span aria-hidden="true">×</span>
        <span>{isPortuguese ? "Fechar" : "Close"}</span>
      </button>
    </div>,
    document.body,
  );
}
