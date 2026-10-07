import { spawn } from "node:child_process";
import { appendFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { DeploymentTarget } from "./deployment-target.ts";

interface DeploymentConfiguration extends DeploymentTarget {
  project: string;
  activityUrl: string;
  commitSha: string;
}
export function validateDeployment(input: {
  environment: string;
  pagesBranch: string;
  project: string;
  activityUrl: string;
  commitSha: string;
}): DeploymentConfiguration {
  if (!["preview", "production"].includes(input.environment))
    throw Error("Select preview or production");
  if (!/^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$/.test(input.project))
    throw Error(
      "Configure CLOUDFLARE_PAGES_PROJECT (2–59 lowercase characters)",
    );
  if (
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(input.pagesBranch) ||
    (input.environment === "preview" && input.pagesBranch === "main") ||
    (input.environment === "production" && input.pagesBranch !== "main")
  )
    throw Error("Invalid Pages deployment branch");
  if (!/^[a-f0-9]{40}$/.test(input.commitSha))
    throw Error("Invalid build commit SHA");
  const url = new URL(input.activityUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    url.pathname !== "/api/activity"
  )
    throw Error(
      "Configure the public HTTPS /api/activity URL for this environment",
    );
  return {
    ...input,
    environment: input.environment as DeploymentTarget["environment"],
  };
}
export async function deployCloudflare(
  config: DeploymentConfiguration,
  run: (args: string[]) => Promise<void>,
): Promise<void> {
  await run([
    "deploy",
    "--config",
    "worker/wrangler.jsonc",
    "--env",
    config.environment,
    "--keep-vars",
    "--var",
    `PAGES_PROJECT:${config.project}`,
  ]);
  await run([
    "pages",
    "deploy",
    "out",
    "--project-name",
    config.project,
    "--branch",
    config.pagesBranch,
    "--commit-hash",
    config.commitSha,
    "--commit-dirty=false",
  ]);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = validateDeployment({
    environment: process.env.DEPLOY_ENVIRONMENT ?? "",
    pagesBranch: process.env.PAGES_BRANCH ?? "",
    project: process.env.CLOUDFLARE_PAGES_PROJECT ?? "",
    activityUrl: process.env.ACTIVITY_API_URL ?? "",
    commitSha: process.env.GITHUB_SHA ?? "",
  });
  if (!(await stat("out/index.html")).size)
    throw Error("Missing static build artifact");
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
    throw Error("Configure Cloudflare deployment credentials");
  await deployCloudflare(
    config,
    (args) =>
      new Promise((accept, reject) => {
        const command = spawn(
          process.execPath,
          [resolve("node_modules/wrangler/bin/wrangler.js"), ...args],
          { stdio: "inherit", shell: false },
        );
        command.on("error", reject);
        command.on("close", (code) =>
          code === 0 ? accept() : reject(Error("Cloudflare deployment failed")),
        );
      }),
  );
  if (process.env.GITHUB_STEP_SUMMARY) {
    const pagesUrl =
      config.environment === "production"
        ? `https://${config.project}.pages.dev`
        : `https://${config.pagesBranch}.${config.project}.pages.dev`;
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Cloudflare ${config.environment}\n\n- [Portfolio](${pagesUrl})\n- [Activity endpoint](${config.activityUrl})\n- Commit: ${config.commitSha}\n`,
    );
  }
}
