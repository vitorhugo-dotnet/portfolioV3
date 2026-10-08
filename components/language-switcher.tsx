"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import type { Locale } from "../i18n/config.ts";
import { localeHref } from "../i18n/routing.ts";
import { translate } from "../i18n/translate.ts";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const english = locale === "en";

  function preserveHash(
    targetLocale: Locale,
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    if (!window.location.hash) return;
    event.preventDefault();
    router.push(localeHref(targetLocale, window.location.hash), {
      scroll: false,
    });
  }

  return (
    <fieldset className="language-switcher">
      <legend className="sr-only">
        {translate(locale, "language.select")}
      </legend>
      <Link
        href={localeHref("pt-BR")}
        onClick={(event) => preserveHash("pt-BR", event)}
        aria-label={translate(locale, "language.switchToPortuguese")}
        aria-current={!english ? "page" : undefined}
        lang="pt-BR"
        className={!english ? "active" : ""}
      >
        🇧🇷 PT
      </Link>
      <span aria-hidden="true">|</span>
      <Link
        href={localeHref("en")}
        onClick={(event) => preserveHash("en", event)}
        aria-label={translate(locale, "language.switchToEnglish")}
        aria-current={english ? "page" : undefined}
        lang="en"
        className={english ? "active" : ""}
      >
        🇺🇸 EN
      </Link>
    </fieldset>
  );
}
