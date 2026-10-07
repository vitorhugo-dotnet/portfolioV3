import { getRepositoryWebsites } from "./repository-websites";
import { publishedRoutes } from "./site-routes";
import { sitemapGroups } from "./site-urls";
export async function sitemapData() {
  return sitemapGroups(
    await publishedRoutes(),
    getRepositoryWebsites().map((repo) => repo.website),
  );
}
