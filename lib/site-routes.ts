import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function publishedRoutes(
  directory = join(process.cwd(), "app"),
  segments: string[] = [],
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const routes: string[] = [];
  if (
    entries.some((entry) => entry.isFile() && /^page\.tsx?$/.test(entry.name))
  ) {
    routes.push(
      `/${segments.filter((segment) => !segment.startsWith("(")).join("/")}`,
    );
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !/^(?:_|@|\[)/.test(entry.name)) {
      routes.push(
        ...(await publishedRoutes(join(directory, entry.name), [
          ...segments,
          entry.name,
        ])),
      );
    }
  }
  return routes.sort();
}
