import { intlLocale, type Locale } from "./config.ts";
import en from "./dictionaries/en.ts";
import ptBR from "./dictionaries/pt-BR.ts";

export type DictionaryKey = keyof typeof ptBR;

const dictionaries = { "pt-BR": ptBR, en };

export function translate(
  locale: Locale,
  key: DictionaryKey,
  values: Record<string, string | number> = {},
): string {
  return dictionaries[locale][key].replace(
    /{{\s*(\w+)\s*}}/g,
    (_match, name: string) => {
      const value = values[name];
      if (value === undefined)
        throw new Error(`Missing translation value "${name}" for "${key}"`);
      return String(value);
    },
  );
}

export function translatePlural(
  locale: Locale,
  oneKey: DictionaryKey,
  otherKey: DictionaryKey,
  count: number,
  values: Record<string, string | number> = {},
): string {
  const category = new Intl.PluralRules(intlLocale(locale)).select(count);
  return translate(locale, category === "one" ? oneKey : otherKey, {
    ...values,
    count,
  });
}

export function formatDate(
  locale: Locale,
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(value);
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatDuration(locale: Locale, minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  const hour = locale === "pt-BR" ? "h" : "hr";
  const minute = "min";
  if (hours === 0) return `${formatNumber(locale, remainder)} ${minute}`;
  return `${formatNumber(locale, hours)} ${hour}${remainder ? ` ${formatNumber(locale, remainder)} ${minute}` : ""}`;
}

export function formatRelativeTime(
  locale: Locale,
  value: Date | string | number,
  now: Date | number = Date.now(),
): string {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  const current = now instanceof Date ? now.getTime() : now;
  const delta = timestamp - current;
  const seconds = Math.round(delta / 1000);
  const absSeconds = Math.abs(seconds);
  const [amount, unit]: [number, Intl.RelativeTimeFormatUnit] =
    absSeconds < 60
      ? [seconds, "second"]
      : absSeconds < 60 * 60
        ? [Math.round(seconds / 60), "minute"]
        : absSeconds < 24 * 60 * 60
          ? [Math.round(seconds / 3600), "hour"]
          : absSeconds < 365 * 24 * 60 * 60
            ? [Math.round(seconds / 86400), "day"]
            : [Math.round(seconds / (365 * 86400)), "year"];
  return new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "always",
  }).format(amount, unit);
}
