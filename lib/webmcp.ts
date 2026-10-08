/** Read-only WebMCP tools backed exclusively by the currently rendered homepage. */

const portfolioSections = [
  "sobre",
  "produtos",
  "android",
  "laboratorio",
  "atividade",
  "agora",
  "leitura",
  "alem-do-codigo",
  "contato",
] as const;

type PortfolioSection = (typeof portfolioSections)[number];
type ToolInput = Record<string, unknown>;

type PortfolioTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  annotations: { readOnlyHint: true; untrustedContentHint: true };
  execute: (input?: ToolInput) => unknown;
};

type ModelContext = {
  registerTool: (
    tool: PortfolioTool,
    options: { signal: AbortSignal },
  ) => void | Promise<unknown>;
};

type WebMCPDocument = Document & { modelContext?: ModelContext };

function visibleText(element: Element | null): string {
  if (!element) return "";
  const rendered = (element as HTMLElement).innerText;
  return (typeof rendered === "string" ? rendered : element.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function pageUrl(doc: Document): string {
  return doc.location?.href ?? doc.baseURI;
}

function safeLink(doc: Document, anchor: Element): string | null {
  const href = anchor.getAttribute("href");
  if (!href) return null;
  try {
    const url = new URL(href, pageUrl(doc));
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function getSection(doc: Document, id: PortfolioSection) {
  const section = doc.getElementById(id);
  if (!section) return null;
  return {
    id,
    title: visibleText(section.querySelector("h2")),
    url: new URL("#" + id, pageUrl(doc)).href,
    text: visibleText(section),
    links: Array.from(section.querySelectorAll("a[href]"))
      .map((anchor) => ({ label: visibleText(anchor), url: safeLink(doc, anchor) }))
      .filter((link): link is { label: string; url: string } =>
        Boolean(link.url && link.label),
      ),
  };
}

function readingDetails(doc: Document) {
  const section = doc.getElementById("leitura");
  return {
    section: getSection(doc, "leitura"),
    shelves: section
      ? Array.from(section.querySelectorAll(".reading-shelf")).map((shelf) => ({
          name: visibleText(shelf.querySelector("h3")),
          books: Array.from(shelf.querySelectorAll(".reading-book")).map(
            (book) => {
              const details = book.querySelectorAll(".reading-book-copy > span");
              return {
                title: visibleText(book.querySelector("strong")),
                author: visibleText(details[0] ?? null),
                finished: visibleText(details[1] ?? null) || null,
                url: safeLink(doc, book),
              };
            },
          ),
          emptyMessage: visibleText(shelf.querySelector(".reading-empty")) || null,
        }))
      : [],
  };
}

function nowDetails(doc: Document) {
  const section = doc.getElementById("agora");
  return {
    section: getSection(doc, "agora"),
    status: section ? visibleText(section.querySelector(".live-update")) : null,
    activities: section
      ? Array.from(section.querySelectorAll(".live-card")).map((card) => ({
          provider: visibleText(card.querySelector(".live-provider")),
          status: visibleText(card.querySelector(".live-status")),
          title: visibleText(card.querySelector("h3")),
          details: visibleText(card.querySelector(".live-card-content p")) || null,
          observedAt: card.querySelector("time")?.getAttribute("datetime") ?? null,
          url: safeLink(doc, card.querySelector("a[href]") ?? card),
        }))
      : [],
    standby: section ? visibleText(section.querySelector(".live-standby")) || null : null,
  };
}

/** Describes only content already exposed by the portfolio UI; never fetches or mutates. */
export function createPortfolioWebMCPTools(doc: Document): PortfolioTool[] {
  const readOnly = { readOnlyHint: true, untrustedContentHint: true } as const;
  const noInput = {
    type: "object" as const,
    properties: {},
    additionalProperties: false as const,
  };

  return [
    {
      name: "portfolio_list_sections",
      description:
        "List sections actually available on Vitor Hugo's current portfolio page, with titles and direct links.",
      inputSchema: noInput,
      annotations: readOnly,
      execute: () => ({
        page: pageUrl(doc),
        sections: portfolioSections.flatMap((id) => {
          const section = getSection(doc, id);
          return section ? [{ id, title: section.title, url: section.url }] : [];
        }),
      }),
    },
    {
      name: "portfolio_get_about",
      description:
        "Read Vitor Hugo's professional introduction and personal interests as displayed on this page.",
      inputSchema: noInput,
      annotations: readOnly,
      execute: () => ({
        professional: getSection(doc, "sobre"),
        personal: getSection(doc, "alem-do-codigo"),
      }),
    },
    {
      name: "portfolio_get_reading",
      description:
        "Read the displayed Goodreads reading shelves: currently reading, recently finished and to-read books. Empty shelves remain empty.",
      inputSchema: noInput,
      annotations: readOnly,
      execute: () => readingDetails(doc),
    },
    {
      name: "portfolio_get_now",
      description:
        "Read the currently displayed activity panel (coding, music, watching and gaming). Reports loading, stale, offline and idle states instead of guessing live activity.",
      inputSchema: noInput,
      annotations: readOnly,
      execute: () => nowDetails(doc),
    },
    {
      name: "portfolio_get_section",
      description:
        "Read the text and public links of a specific section already displayed on the current portfolio page, such as products, Android projects, lab experiments or GitHub activity.",
      inputSchema: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: [...portfolioSections],
            description: "Section identifier from portfolio_list_sections.",
          },
        },
        required: ["section"],
        additionalProperties: false,
      },
      annotations: readOnly,
      execute: (input) => {
        const id = input?.section;
        if (
          typeof id !== "string" ||
          !portfolioSections.includes(id as PortfolioSection)
        ) {
          return { error: "Unknown portfolio section. Use portfolio_list_sections." };
        }
        return { section: getSection(doc, id as PortfolioSection) };
      },
    },
  ];
}

/** Safe no-op on browsers without document.modelContext. Abort unregisters on unmount. */
export function registerPortfolioWebMCP(doc: Document): () => void {
  if (!("modelContext" in doc)) return () => {};
  const context = (doc as WebMCPDocument).modelContext;
  if (!context || typeof context.registerTool !== "function") return () => {};

  const controller = new AbortController();
  for (const tool of createPortfolioWebMCPTools(doc)) {
    try {
      // One unsupported tool must not stop registration of the remaining tools.
      Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(
        () => {},
      );
    } catch {
      // Experimental browser API: keep the portfolio usable if registration fails.
    }
  }
  return () => controller.abort();
}
