"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../i18n/config.ts";
import styles from "./secret-terminal.module.css";

const DESKTOP_GAME_URL = "https://holy-violet-c21b.hugoalves-java.workers.dev/";
const MOBILE_GAME_URL = "https://icy-snow-6925.hugoalves-java.workers.dev/";

export default function SecretTerminalOverlay({
  locale,
  motion,
  game,
  onClose,
}: {
  locale: Locale;
  motion: boolean;
  game: "desktop" | "mobile";
  onClose: () => void;
}) {
  const [showTerminal, setShowTerminal] = useState(false);
  const [loading, setLoading] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isPortuguese = locale === "pt-BR";
  const isMobileGame = game === "mobile";
  const gameUrl = isMobileGame ? MOBILE_GAME_URL : DESKTOP_GAME_URL;

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
      aria-label={
        isMobileGame
          ? isPortuguese
            ? "Arcade secreto"
            : "Secret arcade"
          : isPortuguese
            ? "Terminal secreto"
            : "Secret terminal"
      }
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
                ? "Conectando ao jogo secreto..."
                : "Connecting to the secret game..."}
            </div>
          )}
          <iframe
            className={styles.frame}
            src={gameUrl}
            title={
              isMobileGame
                ? isPortuguese
                  ? "Jogo secreto para celular"
                  : "Secret mobile game"
                : isPortuguese
                  ? "Jogo no terminal retrô"
                  : "Retro terminal game"
            }
            loading="eager"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
            allow="autoplay; fullscreen"
            allowFullScreen
            onLoad={() => setLoading(false)}
          />
          <div className={styles.credit}>
            <span>
              {isMobileGame
                ? isPortuguese
                  ? "Arcade secreto • Mobile"
                  : "Secret Arcade • Mobile"
                : "Terminal by Remo H. Jansen"}
            </span>
            <a
              href={gameUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={
                isPortuguese
                  ? "Se o iframe não carregar, abrir a versão hospedada"
                  : "If the iframe fails, open the hosted version"
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
