import repositorySnapshot from "../public/repos.json" with { type: "json" };
import { fetchGitHubUsername, githubRepositoryUrl } from "./github.ts";
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
    if (!website || typeof row.url !== "string") return [];
    let owner: string;
    try {
      const url = new URL(row.url);
      const [urlOwner, repository, ...extra] = url.pathname
        .split("/")
        .filter(Boolean);
      owner = urlOwner ?? "";
      if (
        url.protocol !== "https:" ||
        url.hostname !== "github.com" ||
        url.username ||
        url.password ||
        decodeURIComponent(repository ?? "") !== row.name ||
        extra.length > 0
      )
        return [];
    } catch {
      return [];
    }
    if (!/^[a-z\d-]{1,39}$/i.test(owner)) return [];
    return [
      {
        name: row.name,
        website,
        repository: githubRepositoryUrl(owner, row.name),
        description: typeof row.description === "string" ? row.description : "",
      },
    ];
  });
}
export function getRepositoryWebsites(): RepositoryWebsite[] {
  return repositoryWebsites(repositorySnapshot);
}
export async function fetchRepositoryCatalog(
  fetcher: typeof fetch = fetch,
): Promise<RepositoryRecord[]> {
  const username = await fetchGitHubUsername(fetcher);
  const repositories: RepositoryRecord[] = [];
  for (let page = 1; ; page++) {
    const response = await fetcher(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=full_name&page=${page}`,
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
        url: githubRepositoryUrl(username, row.name),
        archived: row.archived === true,
        homepage: typeof row.homepage === "string" ? row.homepage : "",
        description: typeof row.description === "string" ? row.description : "",
      });
    }
    if (rows.length < 100) return repositories;
  }
}
