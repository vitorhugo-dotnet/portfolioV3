import Image from "next/image";
import type { Locale } from "../i18n/config.ts";
import { formatDate, translate } from "../i18n/translate.ts";
import type { ReadingLogBook, ReadingLogSnapshot } from "../lib/reading-log.ts";
import snapshot from "../public/reading-log.json";
import { Reveal } from "./scroll-motion";

const readingLog = snapshot as ReadingLogSnapshot;

function Shelf({
  title,
  books,
  locale,
}: {
  title: string;
  books: ReadingLogBook[];
  locale: Locale;
}) {
  return (
    <section className="reading-shelf" aria-label={title}>
      <h3>{title}</h3>
      {books.length ? (
        <ul className="reading-book-list">
          {books.map((book) => (
            <li key={book.id}>
              <a
                className="reading-book"
                href={book.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="reading-book-cover">
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt=""
                      width={112}
                      height={156}
                      loading="lazy"
                      unoptimized
                    />
                  ) : (
                    <span aria-hidden="true" className="reading-cover-fallback">
                      読
                    </span>
                  )}
                </span>
                <span className="reading-book-copy">
                  <strong>{book.title}</strong>
                  <span>
                    {book.author || translate(locale, "reading.unknownAuthor")}
                  </span>
                  {book.finishedAt && (
                    <span>
                      {translate(locale, "reading.finishedOn", {
                        date: formatDate(locale, book.finishedAt, {
                          dateStyle: "medium",
                        }),
                      })}
                    </span>
                  )}
                </span>
                <span className="reading-book-link" aria-hidden="true">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="reading-empty">{translate(locale, "reading.empty")}</p>
      )}
    </section>
  );
}

export function ReadingLogSection({ locale }: { locale: Locale }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <section id="leitura" className="chapter reading-log">
      <div className="section-label">
        <span>
          08 / {t("reading.chapter")} · <span lang="ja">読書</span>
        </span>
        <span>HUGO.DEV ↙</span>
      </div>
      <Reveal>
        <h2>
          {t("reading.title.firstLine")}
          <br />
          <em>{t("reading.title.secondLine")}</em>
        </h2>
      </Reveal>
      <p className="intro">{t("reading.intro")}</p>
      <div className="reading-shelves">
        <Shelf
          title={t("reading.currentlyReading")}
          books={readingLog.currentlyReading}
          locale={locale}
        />
        <Shelf
          title={t("reading.recentlyFinished")}
          books={readingLog.recentlyFinished}
          locale={locale}
        />
        <Shelf
          title={t("reading.toRead")}
          books={readingLog.toRead}
          locale={locale}
        />
      </div>
    </section>
  );
}
