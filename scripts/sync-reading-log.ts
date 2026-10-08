import { rename, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import GoodreadsShelf from "goodreads-bookshelf-api";
import { normalizeReadingLog } from "../lib/reading-log.ts";

const output = fileURLToPath(
  new URL("../public/reading-log.json", import.meta.url),
);
const temporary = `${output}.${process.pid}.tmp`;
const username = "164676427-ikkiartz";

try {
  const [currentlyReading, read, toRead] = await Promise.all([
    new GoodreadsShelf({ username, shelf: "currently-reading" }).fetch(),
    new GoodreadsShelf({ username, shelf: "read" }).fetch(),
    new GoodreadsShelf({ username, shelf: "to-read" }).fetch(),
  ]);
  const snapshot = normalizeReadingLog(
    { currentlyReading, read, toRead },
    new Date().toISOString(),
  );
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
  await rename(temporary, output);
  console.log(
    `Updated Goodreads reading log: ${snapshot.currentlyReading.length} currently reading, ${snapshot.recentlyFinished.length} recently finished, ${snapshot.toRead.length} to read.`,
  );
} catch (error) {
  await rm(temporary, { force: true }).catch(() => {});
  console.warn(
    "Goodreads reading log unavailable; keeping the committed snapshot.",
    error instanceof Error ? error.message : "Invalid response",
  );
}
