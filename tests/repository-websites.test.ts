import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  fetchRepositoryCatalog,
  repositoryWebsites,
} from "../lib/repository-websites.ts";

test("extracts Website fields without allowing unsafe URLs or assuming descriptions", () => {
  assert.deepEqual(
    repositoryWebsites([
      { name: "app", homepage: "app.example.com" },
      { name: "bad", homepage: "javascript:alert(1)" },
      { name: "empty", homepage: null },
    ]),
    [
      {
        name: "app",
        website: "https://app.example.com/",
        repository: "https://github.com/vitorhugo-dotnet/app",
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
    assert.match(requested[1] ?? "", /page=2$/);
  } finally {
    fetchMock.mock.restore();
  }
});

test("refreshes the complete catalog across pages, keeping search fields and Website metadata", async () => {
  let page = 0;
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    page++;
    return Response.json(
      page === 1
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
      url: "https://github.com/vitorhugo-dotnet/final-app",
      archived: true,
      homepage: "https://app.hugodotnet.dev",
      description: "App description",
    });
  } finally {
    fetchMock.mock.restore();
  }
});
