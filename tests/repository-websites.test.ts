import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  fetchGitHubUsername,
  githubProfileUrl,
  githubRepositoryUrl,
} from "../lib/github.ts";
import {
  fetchRepositoryCatalog,
  repositoryWebsites,
} from "../lib/repository-websites.ts";
import { linkedInProfileForHostname } from "../lib/site-config.ts";

test("extracts Website fields without allowing unsafe URLs or assuming descriptions", () => {
  assert.deepEqual(
    repositoryWebsites([
      {
        name: "app",
        homepage: "app.example.com",
        url: "https://github.com/canonical-user/app",
      },
      { name: "bad", homepage: "javascript:alert(1)" },
      { name: "empty", homepage: null },
    ]),
    [
      {
        name: "app",
        website: "https://app.example.com/",
        repository: "https://github.com/canonical-user/app",
        description: "",
      },
    ],
  );
});

test("fetches every page and rejects incomplete catalogs rather than replacing the snapshot", async () => {
  const requested: string[] = [];
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request) => {
      requested.push(String(input));
      if (requested.length === 1)
        return Response.json({ login: "canonical-user" });
      if (requested.length === 2)
        return Response.json(
          Array.from({ length: 100 }, (_, index) => ({
            name: `app-${index}`,
            homepage: index === 0 ? "https://app.example.com" : null,
          })),
        );
      return new Response("Unavailable", { status: 503 });
    },
  );
  try {
    await assert.rejects(fetchRepositoryCatalog(), /GitHub HTTP 503/);
    assert.match(requested[0] ?? "", /\/users\/vitorhugo-dotnet$/);
    assert.match(requested[1] ?? "", /\/users\/canonical-user\/repos\?/);
    assert.match(requested[2] ?? "", /page=2$/);
  } finally {
    fetchMock.mock.restore();
  }
});

test("refreshes the complete catalog across pages, keeping search fields and Website metadata", async () => {
  let page = 0;
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    page++;
    if (page === 1) return Response.json({ login: "renamed-account" });
    return Response.json(
      page === 2
        ? Array.from({ length: 100 }, (_, index) => ({
            name: `app-${index}`,
            archived: false,
            homepage: null,
          }))
        : [
            {
              name: "final-app",
              archived: true,
              homepage: "https://app.hugodotnet.dev",
              description: "App description",
            },
          ],
    );
  });
  try {
    const result = await fetchRepositoryCatalog();
    assert.equal(result.length, 101);
    assert.deepEqual(result[100], {
      name: "final-app",
      url: "https://github.com/renamed-account/final-app",
      archived: true,
      homepage: "https://app.hugodotnet.dev",
      description: "App description",
    });
  } finally {
    fetchMock.mock.restore();
  }
});

test("GitHub links use the username resolved from the public users API", async () => {
  const requested: string[] = [];
  const username = await fetchGitHubUsername(async (input) => {
    requested.push(String(input));
    return Response.json({ login: "renamed-account" });
  });
  assert.equal(username, "renamed-account");
  assert.deepEqual(requested, [
    "https://api.github.com/users/vitorhugo-dotnet",
  ]);
  assert.equal(
    githubProfileUrl(username),
    "https://github.com/renamed-account",
  );
  assert.equal(
    githubRepositoryUrl(username, "repo with spaces"),
    "https://github.com/renamed-account/repo%20with%20spaces",
  );
});

test("LinkedIn profile selection uses the portfolio hostname", () => {
  assert.equal(
    linkedInProfileForHostname("hugojava.dev"),
    "https://www.linkedin.com/in/hugo-java/",
  );
  assert.equal(
    linkedInProfileForHostname("www.hugojava.dev"),
    "https://www.linkedin.com/in/hugo-java/",
  );
  assert.equal(
    linkedInProfileForHostname("hugodotnet.dev"),
    "https://www.linkedin.com/in/vitorhugo-dotnet/",
  );
  assert.equal(
    linkedInProfileForHostname("preview.pages.dev"),
    "https://www.linkedin.com/in/vitorhugo-dotnet/",
  );
});
