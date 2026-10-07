import Link from "next/link";
import type { ReactNode } from "react";

export function ResourceShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#resource-content">
        Skip to content
      </a>
      <header className="resource-header">
        <Link href="/" className="logo" aria-label="Hugo — Portfolio">
          H<span>.</span>
          <small>VITOR HUGO / DEV</small>
        </Link>
        <nav aria-label="Resources">
          <Link href="/">Portfolio ↗</Link>
          <Link href="/hub">Hub</Link>
        </nav>
      </header>
      <main id="resource-content" className="resource-page">
        {children}
      </main>
      <footer>
        <Link href="/" className="logo">
          H<span>.</span>
        </Link>
        <span>VITOR HUGO · PUBLIC APP RESOURCES</span>
        <Link href="/hub">HUB ↗</Link>
      </footer>
    </>
  );
}

export function DocumentLayout({
  application,
  updated,
  children,
}: {
  application: string;
  updated: string;
  children: ReactNode;
}) {
  const date = new Date(`${updated}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <ResourceShell>
      <article lang="en" className="document">
        <Link href="/hub" className="document-back">
          ← All resources
        </Link>
        <div className="document-heading">
          <p className="section-label">{application}</p>
          <h1>
            Privacy <em>Policy.</em>
          </h1>
          <p className="document-updated">
            Last updated: <time dateTime={updated}>{date}</time>
          </p>
        </div>
        <div className="document-sections">{children}</div>
      </article>
    </ResourceShell>
  );
}

export function DocumentSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="document-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
