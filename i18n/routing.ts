import type { Locale } from "./config.ts";

export function localeHref(locale: Locale, hash = ""): string {
  return `${locale === "en" ? "/en" : "/"}${hash}`;
}

export function languageHref(locale: Locale, hash = ""): string {
  return localeHref(locale === "en" ? "pt-BR" : "en", hash);
}
