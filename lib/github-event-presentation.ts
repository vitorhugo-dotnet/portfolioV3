import type { Locale } from "../i18n/config.ts";
import { translate } from "../i18n/translate.ts";

export type GitHubEventPresentation = {
  type: string;
  payload?: {
    ref?: string;
    ref_type?: string;
    action?: string;
    pull_request?: { title?: string };
    issue?: { title?: string };
    release?: { name?: string; tag_name?: string };
  };
};

function eventAction(locale: Locale, action = "") {
  if (action === "opened") return translate(locale, "github.action.opened");
  if (action === "closed") return translate(locale, "github.action.closed");
  if (action === "reopened") return translate(locale, "github.action.reopened");
  return action;
}

export function describeGitHubEvent(
  locale: Locale,
  event: GitHubEventPresentation,
): string {
  const payload = event.payload ?? {};
  if (event.type === "PushEvent") {
    const branch = payload.ref?.replace("refs/heads/", "");
    return branch
      ? translate(locale, "github.event.pushBranch", { branch })
      : translate(locale, "github.event.push");
  }
  if (event.type === "PullRequestEvent") {
    const action = eventAction(locale, payload.action);
    const title = payload.pull_request?.title;
    if (action && title)
      return translate(locale, "github.event.pullRequest", { action, title });
    if (title)
      return translate(locale, "github.event.pullRequestTitle", { title });
    if (action)
      return translate(locale, "github.event.pullRequestAction", { action });
    return translate(locale, "github.event.pullRequestEmpty");
  }
  if (event.type === "IssuesEvent") {
    const action = eventAction(locale, payload.action);
    const title = payload.issue?.title;
    if (action && title)
      return translate(locale, "github.event.issue", { action, title });
    if (title) return translate(locale, "github.event.issueTitle", { title });
    if (action)
      return translate(locale, "github.event.issueAction", { action });
    return translate(locale, "github.event.issueEmpty");
  }
  if (event.type === "IssueCommentEvent") {
    const title = payload.issue?.title;
    return title
      ? translate(locale, "github.event.issueComment", { title })
      : translate(locale, "github.event.issueCommentEmpty");
  }
  if (event.type === "ReleaseEvent") {
    const title = payload.release?.name || payload.release?.tag_name;
    return title
      ? translate(locale, "github.event.release", { title })
      : translate(locale, "github.event.releaseEmpty");
  }
  if (event.type === "WatchEvent")
    return translate(locale, "github.event.watched");
  if (event.type === "CreateEvent")
    return translate(locale, "github.event.created", {
      item:
        payload.ref ||
        payload.ref_type ||
        translate(locale, "github.repository"),
    });
  if (event.type === "ForkEvent")
    return translate(locale, "github.event.forked");
  return translate(locale, "github.event.other");
}
