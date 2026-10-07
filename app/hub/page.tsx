import type { Metadata } from "next";
import Link from "next/link";
import { ResourceShell } from "../../components/document-layout";
import { hubResources } from "../../components/hub-resources";
import { getRepositoryWebsites } from "../../lib/repository-websites";
import { createPageMetadata } from "../../lib/site-config";
import { isPortfolioWebsite } from "../../lib/site-urls";
export const metadata: Metadata = createPageMetadata(
  "Hub — App resources | Hugo",
  "Public documents and privacy resources for SonicRelay, The Universe Decides and published apps by Vitor Hugo.",
);
export const dynamic = "force-static";
export default function Hub() {
  const repositories = getRepositoryWebsites();
  const owned = repositories.filter((repo) => isPortfolioWebsite(repo.website));
  const others = repositories.filter(
    (repo) => !isPortfolioWebsite(repo.website),
  );
  return (
    <ResourceShell>
      <section className="hub" lang="en">
        <div className="section-label">
          <span>HUB / PUBLIC RESOURCES</span>
          <span>HUGO.DEV ↙</span>
        </div>
        <h1>
          Apps. Documents.
          <br />
          <em>One place.</em>
        </h1>
        <p className="intro">Privacy resources for published apps.</p>
        <div className="hub-resources">
          {hubResources.map((resource) => (
            <Link className="hub-card" key={resource.href} href={resource.href}>
              <span className="tag">{resource.application}</span>
              <h2>
                {resource.title} <span aria-hidden="true">↗</span>
              </h2>
              <p>{resource.description}</p>
              <span className="resource-open">Read document →</span>
            </Link>
          ))}
        </div>
        {(
          [
            {
              title: "Project websites",
              id: "repository-sites-title",
              items: owned,
            },
            { title: "Outros", id: "other-sites-title", items: others },
          ] as const
        ).map(
          (group) =>
            (group.items.length > 0 || group.id === "other-sites-title") && (
              <section
                key={group.id}
                className="repository-sites"
                aria-labelledby={group.id}
              >
                <h2
                  id={group.id}
                  lang={group.title === "Outros" ? "pt-BR" : "en"}
                >
                  {group.title}
                </h2>
                <p className="intro">
                  Public websites listed in the GitHub repositories.
                </p>
                {group.items.length === 0 && (
                  <p className="intro" lang="pt-BR">
                    Nenhum link externo disponível no catálogo atual.
                  </p>
                )}
                <div className="hub-resources">
                  {group.items.map((repo) => (
                    <article className="hub-card" key={repo.name}>
                      <span className="tag">GITHUB / WEBSITE</span>
                      <h3>{repo.name}</h3>
                      {repo.description && <p>{repo.description}</p>}
                      <a
                        className="resource-open"
                        href={repo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Visit website ↗
                      </a>
                      <br />
                      <a
                        className="resource-open"
                        href={repo.repository}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Repository ↗
                      </a>
                    </article>
                  ))}
                </div>
              </section>
            ),
        )}
      </section>
    </ResourceShell>
  );
}
