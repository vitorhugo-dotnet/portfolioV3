import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPortfolioWebMCPTools,
  registerPortfolioWebMCP,
} from "../lib/webmcp.ts";

class FakeElement {
  public innerText: string;
  private readonly children: Record<string, FakeElement | FakeElement[]>;
  private readonly attributes: Record<string, string>;

  constructor(
    innerText = "",
    children: Record<string, FakeElement | FakeElement[]> = {},
    attributes: Record<string, string> = {},
  ) {
    this.innerText = innerText;
    this.children = children;
    this.attributes = attributes;
  }

  get textContent() {
    return this.innerText;
  }

  querySelector(selector: string): FakeElement | null {
    const value = this.children[selector];
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const value = this.children[selector];
    return Array.isArray(value) ? value : value ? [value] : [];
  }

  getAttribute(attribute: string): string | null {
    return this.attributes[attribute] ?? null;
  }
}

function makeDocument(sections: Record<string, FakeElement> = {}) {
  return {
    location: { href: "https://hugodotnet.dev/en" },
    baseURI: "https://hugodotnet.dev/en",
    getElementById: (id: string) => sections[id] ?? null,
  } as unknown as Document;
}

test("silently skips browsers with missing or malformed WebMCP support", () => {
  const absent = makeDocument();
  assert.doesNotThrow(() => registerPortfolioWebMCP(absent)());
  const malformed = Object.assign(makeDocument(), { modelContext: {} });
  assert.doesNotThrow(() => registerPortfolioWebMCP(malformed)());
});

test("registers read-only tools and cleans up using AbortSignal", async () => {
  const registered: {
    tool: ReturnType<typeof createPortfolioWebMCPTools>[number];
    signal: AbortSignal;
  }[] = [];
  const doc = Object.assign(makeDocument(), {
    modelContext: {
      registerTool(
        tool: ReturnType<typeof createPortfolioWebMCPTools>[number],
        options: { signal: AbortSignal },
      ) {
        registered.push({ tool, signal: options.signal });
        if (tool.name === "portfolio_get_reading") {
          return Promise.reject(new Error("experimental API rejected tool"));
        }
        return Promise.resolve();
      },
    },
  });
  const dispose = registerPortfolioWebMCP(doc);
  await Promise.resolve();
  assert.deepEqual(
    registered.map(({ tool }) => tool.name),
    [
      "portfolio_list_sections",
      "portfolio_get_about",
      "portfolio_get_reading",
      "portfolio_get_now",
      "portfolio_get_section",
    ],
  );
  for (const { tool, signal } of registered) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.untrustedContentHint, true);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal(signal.aborted, false);
  }
  dispose();
  assert.ok(registered.every(({ signal }) => signal.aborted));
});

test("continues after an individual registration throws synchronously", () => {
  const names: string[] = [];
  const doc = Object.assign(makeDocument(), {
    modelContext: {
      registerTool(tool: { name: string }) {
        names.push(tool.name);
        if (tool.name === "portfolio_get_about") throw new Error("unsupported");
      },
    },
  });
  assert.doesNotThrow(() => registerPortfolioWebMCP(doc)());
  assert.equal(names.length, 5);
});

test("uses only rendered content and allowlisted section IDs", () => {
  const professional = new FakeElement("I'm a developer.", {
    h2: new FakeElement("About me"),
    "a[href]": [
      new FakeElement("My GitHub", {}, {
        href: "https://github.com/vitorhugo-dotnet",
      }),
      new FakeElement("Unsafe", {}, { href: "javascript:alert(1)" }),
    ],
  });
  const personal = new FakeElement("Games and astronomy", {
    h2: new FakeElement("Beyond code"),
  });
  const doc = makeDocument({
    sobre: professional,
    "alem-do-codigo": personal,
  });
  const tools = createPortfolioWebMCPTools(doc);
  const invoke = (name: string, input?: Record<string, unknown>) => {
    const tool = tools.find((item) => item.name === name);
    assert.ok(tool);
    return tool.execute(input) as Record<string, unknown>;
  };
  const listed = invoke("portfolio_list_sections").sections as { id: string }[];
  assert.deepEqual(listed.map((section) => section.id), ["sobre", "alem-do-codigo"]);
  const about = invoke("portfolio_get_about");
  assert.equal((about.professional as { text: string }).text, "I'm a developer.");
  assert.equal((about.personal as { text: string }).text, "Games and astronomy");
  assert.deepEqual((about.professional as { links: unknown[] }).links, [
    { label: "My GitHub", url: "https://github.com/vitorhugo-dotnet" },
  ]);
  assert.deepEqual(invoke("portfolio_get_section", { section: "unlisted" }), {
    error: "Unknown portfolio section. Use portfolio_list_sections.",
  });
  assert.deepEqual(invoke("portfolio_get_section", { section: "agora" }), {
    section: null,
  });
  professional.innerText = "The on-screen content changed";
  assert.equal(
    (invoke("portfolio_get_section", { section: "sobre" }).section as { text: string }).text,
    "The on-screen content changed",
  );
});

test("reading reflects empty shelves and structured visible books", () => {
  const book = new FakeElement("Book", {
    strong: new FakeElement("The Stranger"),
    ".reading-book-copy > span": [
      new FakeElement("Camus"),
      new FakeElement("Finished today"),
    ],
  }, { href: "https://www.goodreads.com/book/show/1" });
  const reading = new FakeElement("Reading", {
    h2: new FakeElement("Reading log"),
    ".reading-shelf": [
      new FakeElement("Currently reading", {
        h3: new FakeElement("Currently reading"),
        ".reading-book": [book],
      }),
      new FakeElement("To read", {
        h3: new FakeElement("To read"),
        ".reading-empty": new FakeElement("No books yet"),
      }),
    ],
  });
  const tool = createPortfolioWebMCPTools(makeDocument({ leitura: reading })).find(
    ({ name }) => name === "portfolio_get_reading",
  );
  assert.ok(tool);
  const result = tool.execute() as {
    shelves: Array<{ books: unknown[]; emptyMessage: string | null }>;
  };
  assert.deepEqual(result.shelves[0].books, [
    {
      title: "The Stranger",
      author: "Camus",
      finished: "Finished today",
      url: "https://www.goodreads.com/book/show/1",
    },
  ]);
  assert.equal(result.shelves[1].books.length, 0);
  assert.equal(result.shelves[1].emptyMessage, "No books yet");
});

test("now reads the latest UI state without inventing activity", () => {
  const status = new FakeElement("Loading activities…");
  const activities: FakeElement[] = [];
  const now = new FakeElement("Loading activities…", {
    h2: new FakeElement("What I'm doing"),
    ".live-update": status,
    ".live-card": activities,
  });
  const doc = makeDocument({ agora: now });
  const tool = createPortfolioWebMCPTools(doc).find(({ name }) => name === "portfolio_get_now");
  assert.ok(tool);
  assert.deepEqual((tool.execute() as { activities: unknown[] }).activities, []);
  status.innerText = "Updated at 23:00";
  activities.push(new FakeElement("Spotify", {
    ".live-provider": new FakeElement("Spotify"),
    ".live-status": new FakeElement("Now listening"),
    h3: new FakeElement("Track title"),
    time: new FakeElement("", {}, { datetime: "2026-10-08T02:00:00Z" }),
  }));
  const result = tool.execute() as {
    status: string;
    activities: Array<{ provider: string; title: string }>;
  };
  assert.equal(result.status, "Updated at 23:00");
  assert.equal(result.activities[0].provider, "Spotify");
  assert.equal(result.activities[0].title, "Track title");
});
