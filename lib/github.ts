export const githubUsernameLookup = "vitorhugo-dotnet";

function checkedGitHubUsername(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z\d-]{1,39}$/i.test(value)
    ? value
    : undefined;
}

export function githubProfileUrl(username: string): string {
  const checked = checkedGitHubUsername(username);
  if (!checked) throw new Error("Invalid GitHub username");
  return `https://github.com/${encodeURIComponent(checked)}`;
}

export function githubRepositoryUrl(
  username: string,
  repository: string,
): string {
  const checked = checkedGitHubUsername(username);
  if (!checked) throw new Error("Invalid GitHub username");
  return `${githubProfileUrl(checked)}/${encodeURIComponent(repository)}`;
}

export async function fetchGitHubUsername(
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher(
    `https://api.github.com/users/${githubUsernameLookup}`,
    {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error(`GitHub user HTTP ${response.status}`);
  const user: unknown = await response.json();
  if (!user || typeof user !== "object" || Array.isArray(user))
    throw new Error("Unexpected GitHub user response");
  const username = checkedGitHubUsername(
    (user as Record<string, unknown>).login,
  );
  if (!username) throw new Error("Invalid GitHub username response");
  return username;
}
