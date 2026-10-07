import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deployCloudflare,
  validateDeployment,
} from "../scripts/deploy-cloudflare.ts";
import { resolveDeploymentTarget } from "../scripts/deployment-target.ts";

test("deployment policy separates manual preview on main from production", () => {
  const input = {
    eventName: "workflow_dispatch",
    ref: "refs/heads/main",
    runId: "123",
    isFork: false,
  };
  assert.deepEqual(
    resolveDeploymentTarget({ ...input, requestedEnvironment: "preview" }),
    { environment: "preview", pagesBranch: "manual-123" },
  );
  assert.deepEqual(
    resolveDeploymentTarget({ ...input, requestedEnvironment: "production" }),
    { environment: "production", pagesBranch: "main" },
  );
  assert.throws(() =>
    resolveDeploymentTarget({ ...input, requestedEnvironment: "unexpected" }),
  );
  assert.throws(() =>
    resolveDeploymentTarget({
      ...input,
      requestedEnvironment: "preview",
      runId: "$(bad)",
    }),
  );
});
test("PR previews are stable and forks never deploy", () => {
  const input = {
    eventName: "pull_request",
    ref: "refs/pull/2/merge",
    prNumber: 2,
    runId: "123",
    isFork: false,
  };
  assert.deepEqual(resolveDeploymentTarget(input), {
    environment: "preview",
    pagesBranch: "pr-2",
  });
  assert.equal(resolveDeploymentTarget({ ...input, isFork: true }), null);
});
test("push and schedule main preserve production and unknown triggers do not deploy", () => {
  for (const eventName of ["push", "schedule"])
    assert.deepEqual(
      resolveDeploymentTarget({
        eventName,
        ref: "refs/heads/main",
        runId: "123",
        isFork: false,
      }),
      { environment: "production", pagesBranch: "main" },
    );
  assert.equal(
    resolveDeploymentTarget({
      eventName: "push",
      ref: "refs/heads/feature",
      runId: "123",
      isFork: false,
    }),
    null,
  );
  assert.equal(
    resolveDeploymentTarget({
      eventName: "pull_request_target",
      ref: "refs/heads/main",
      runId: "123",
      isFork: false,
    }),
    null,
  );
});
test("deployment configuration rejects injection and wrong environment URLs", () => {
  const input = {
    environment: "preview",
    pagesBranch: "pr-2",
    project: "portfolio",
    activityUrl:
      "https://portfolio-activity-preview.example.workers.dev/api/activity",
    commitSha: "a".repeat(40),
  };
  assert.equal(validateDeployment(input).environment, "preview");
  for (const change of [
    { project: "$(evil)" },
    { pagesBranch: "main" },
    { pagesBranch: "--evil" },
    { activityUrl: "https://user:secret@example.com/api/activity" },
    { activityUrl: "https://example.com/api/activity?secret=value" },
    { commitSha: "bad" },
    { environment: "unknown" },
  ])
    assert.throws(() => validateDeployment({ ...input, ...change }));
});

test("failed Worker deployment prevents Pages publication", async () => {
  const config = validateDeployment({
    environment: "preview",
    pagesBranch: "pr-2",
    project: "portfolio",
    activityUrl: "https://worker.example/api/activity",
    commitSha: "a".repeat(40),
  });
  const calls: string[][] = [];
  await assert.rejects(
    deployCloudflare(config, async (args) => {
      calls.push(args);
      throw Error("worker failed");
    }),
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "deploy");
  const successful: string[][] = [];
  await deployCloudflare(config, async (args) => {
    successful.push(args);
  });
  assert.equal(successful[0][0], "deploy");
  assert.equal(successful[1][0], "pages");
  assert.equal(successful[1][successful[1].indexOf("--branch") + 1], "pr-2");
});
