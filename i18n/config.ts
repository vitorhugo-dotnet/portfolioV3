export const locales = ["pt-BR", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "pt-BR";

export function intlLocale(locale: Locale): string {
  return locale === "pt-BR" ? "pt-BR" : "en-US";
}
