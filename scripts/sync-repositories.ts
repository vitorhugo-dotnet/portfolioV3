import { writeFile } from "node:fs/promises";
import { fetchRepositoryCatalog } from "../lib/repository-websites.ts";

try {
  const repositories = await fetchRepositoryCatalog();
  await writeFile(
    new URL("../public/repos.json", import.meta.url),
    `${JSON.stringify(repositories, null, 2)}\n`,
  );
  console.log(
    `Updated GitHub repository catalog: ${repositories.length} repositories.`,
  );
} catch (error) {
  console.warn(
    "GitHub Website catalog unavailable; keeping the committed repository snapshot.",
    error instanceof Error ? error.message : "Invalid response",
  );
}
