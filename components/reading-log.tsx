import Image from "next/image";
import type { ReadingLogBook, ReadingLogSnapshot } from "../lib/reading-log.ts";
import snapshot from "../public/reading-log.json";
import { Reveal } from "./scroll-motion";

const readingLog = snapshot as ReadingLogSnapshot;

function Shelf({ title, books }: { title: string; books: ReadingLogBook[] }) {
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
                  <span>{book.author}</span>
                </span>
                <span className="reading-book-link" aria-hidden="true">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="reading-empty">
          Nenhum livro nesta estante por enquanto.
        </p>
      )}
    </section>
  );
}

export function ReadingLogSection() {
  return (
    <section id="leitura" className="chapter reading-log">
      <div className="section-label">
        <span>
          08 / <span lang="ja">読書</span>
        </span>
        <span>HUGO.DEV ↙</span>
      </div>
      <Reveal>
        <h2>
          Registro de
          <br />
          <em>leitura</em>
        </h2>
      </Reveal>
      <p className="intro">
        Histórias, ideias e mundos para explorar, uma página de cada vez.
      </p>
      <div className="reading-shelves">
        <Shelf title="Lendo atualmente" books={readingLog.currentlyReading} />
        <Shelf
          title="Últimos livros finalizados"
          books={readingLog.recentlyFinished}
        />
        <Shelf title="Próximos para ler" books={readingLog.toRead} />
      </div>
    </section>
  );
}
