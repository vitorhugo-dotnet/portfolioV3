import repositorySnapshot from "../public/repos.json" with { type: "json" };
import { normalizeWebsite } from "./site-urls.ts";
export type RepositoryWebsite = {
  name: string;
  website: string;
  repository: string;
  description: string;
};
export type RepositoryRecord = {
  name: string;
  url: string;
  archived: boolean;
  homepage: string;
  description: string;
};
export function repositoryWebsites(rows: unknown): RepositoryWebsite[] {
  if (!Array.isArray(rows))
    throw new Error("Unexpected GitHub repositories response");
  return rows.flatMap((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.name !== "string" ||
      typeof row.homepage !== "string"
    )
      return [];
    const website = normalizeWebsite(row.homepage);
    if (!website) return [];
    return [
      {
        name: row.name,
        website,
        repository: `https://github.com/vitorhugo-dotnet/${encodeURIComponent(row.name)}`,
        description: typeof row.description === "string" ? row.description : "",
      },
    ];
  });
}
export function getRepositoryWebsites(): RepositoryWebsite[] {
  return repositoryWebsites(repositorySnapshot);
}
export async function fetchRepositoryCatalog(): Promise<RepositoryRecord[]> {
  const repositories: RepositoryRecord[] = [];
  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://api.github.com/users/vitorhugo-dotnet/repos?per_page=100&type=owner&sort=full_name&page=${page}`,
      {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows))
      throw new Error("Unexpected GitHub repositories response");
    for (const row of rows) {
      if (!row || typeof row !== "object" || typeof row.name !== "string")
        throw new Error("Invalid GitHub repository");
      repositories.push({
        name: row.name,
        url: `https://github.com/vitorhugo-dotnet/${encodeURIComponent(row.name)}`,
        archived: row.archived === true,
        homepage: typeof row.homepage === "string" ? row.homepage : "",
        description: typeof row.description === "string" ? row.description : "",
      });
    }
    if (rows.length < 100) return repositories;
  }
}
