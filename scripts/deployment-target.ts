import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export interface DeploymentTarget {
  environment: "preview" | "production";
  pagesBranch: string;
}
export function resolveDeploymentTarget(input: {
  eventName: string;
  ref: string;
  requestedEnvironment?: string;
  prNumber?: number;
  isFork: boolean;
  runId: string;
}): DeploymentTarget | null {
  if (input.eventName === "pull_request") {
    if (input.isFork) return null;
    if (!Number.isSafeInteger(input.prNumber) || Number(input.prNumber) < 1)
      throw Error("Invalid PR number");
    return { environment: "preview", pagesBranch: `pr-${input.prNumber}` };
  }
  if (input.eventName === "workflow_dispatch") {
    const environment = input.requestedEnvironment ?? "preview";
    if (
      !["preview", "production"].includes(environment) ||
      !/^\d+$/.test(input.runId)
    )
      throw Error("Invalid manual deployment target");
    return {
      environment: environment as DeploymentTarget["environment"],
      pagesBranch:
        environment === "production" ? "main" : `manual-${input.runId}`,
    };
  }
  if (
    ["push", "schedule"].includes(input.eventName) &&
    input.ref === "refs/heads/main"
  )
    return { environment: "production", pagesBranch: "main" };
  return null;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH ?? "", "utf8"),
  );
  const target = resolveDeploymentTarget({
    eventName: process.env.GITHUB_EVENT_NAME ?? "",
    ref: process.env.GITHUB_REF ?? "",
    requestedEnvironment: event.inputs?.environment,
    prNumber: event.pull_request?.number,
    isFork: event.pull_request
      ? event.pull_request.head.repo.full_name !== process.env.GITHUB_REPOSITORY
      : false,
    runId: process.env.GITHUB_RUN_ID ?? "",
  });
  const output = target
    ? `deploy=true\nenvironment=${target.environment}\npages_branch=${target.pagesBranch}\n`
    : "deploy=false\nenvironment=preview\npages_branch=checks-only\n";
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, output);
  else process.stdout.write(output);
}
