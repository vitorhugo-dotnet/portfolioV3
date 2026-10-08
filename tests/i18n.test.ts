import assert from "node:assert/strict";
import { test } from "node:test";
import en from "../i18n/dictionaries/en.ts";
import ptBR from "../i18n/dictionaries/pt-BR.ts";
import { languageHref } from "../i18n/routing.ts";
import {
  formatDate,
  formatDuration,
  formatNumber,
  formatRelativeTime,
  translate,
  translatePlural,
} from "../i18n/translate.ts";
import { describeGitHubEvent } from "../lib/github-event-presentation.ts";

test("dictionaries have the same keys", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ptBR).sort());
});

test("translate interpolates named values", () => {
  assert.equal(
    translate("en", "github.event.pushBranch", { branch: "main" }),
    "Code updated · main",
  );
  assert.equal(
    translate("pt-BR", "github.event.pushBranch", { branch: "main" }),
    "Código atualizado · main",
  );
});

test("translate uses locale plural rules for count messages", () => {
  assert.equal(
    translatePlural(
      "en",
      "live.coding.today.one",
      "live.coding.today.other",
      1,
      { duration: "1 min" },
    ),
    "1 min today",
  );
  assert.equal(
    translatePlural(
      "en",
      "live.coding.today.one",
      "live.coding.today.other",
      2,
      { duration: "2 hr" },
    ),
    "2 hr today",
  );
  assert.equal(
    translatePlural(
      "pt-BR",
      "live.coding.today.one",
      "live.coding.today.other",
      2,
      { duration: "2 h" },
    ),
    "2 h hoje",
  );
  assert.equal(
    translatePlural(
      "en",
      "live.coding.today.one",
      "live.coding.today.other",
      1200,
      { duration: "20 hr" },
    ),
    "20 hr today",
  );
});

test("formatters follow each locale", () => {
  const date = new Date("2025-12-31T12:00:00.000Z");
  assert.equal(formatDate("pt-BR", date), "31/12/2025");
  assert.equal(formatDate("pt-BR", "2025-12-31T12:00:00.000Z"), "31/12/2025");
  assert.equal(formatDate("en", date), "12/31/2025");
  assert.equal(formatNumber("pt-BR", 123456.789), "123.456,789");
  assert.equal(formatNumber("en", 123456.789), "123,456.789");
  assert.equal(formatDuration("pt-BR", 90), "1 h 30 min");
  assert.equal(formatDuration("en", 90), "1 hr 30 min");
  const now = Date.parse("2025-01-02T12:00:00.000Z");
  const yesterday = Date.parse("2025-01-01T12:00:00.000Z");
  assert.equal(formatRelativeTime("pt-BR", yesterday, now), "há 1 dia");
  assert.equal(formatRelativeTime("en", yesterday, now), "1 day ago");
});

test("english dictionary covers portfolio and live activity copy", () => {
  const requiredKeys = [
    "nav.products",
    "nav.android",
    "nav.studies",
    "nav.githubActivity",
    "nav.liveActivity",
    "hero.title.firstLine",
    "hero.title.secondLine",
    "github.status.loading",
    "github.status.unavailable",
    "github.filter.all",
    "github.filter.commits",
    "github.filter.pullRequests",
    "github.filter.issues",
    "github.filter.releases",
    "github.empty",
    "github.loadMore",
    "live.coding.now",
    "live.coding.recent",
    "live.spotify.now",
    "live.spotify.recent",
    "live.simkl.now",
    "live.simkl.recent",
    "live.steam.now",
    "live.steam.recent",
    "live.loading",
    "live.error",
    "live.empty",
    "live.stale",
    "live.updated",
    "live.standby.title",
    "live.provider.offline",
    "about.title",
    "contact.title.firstLine",
    "footer.backToTop",
  ];

  for (const key of requiredKeys) {
    assert.ok(key in ptBR, `Portuguese dictionary is missing ${key}`);
    assert.ok(key in en, `English dictionary is missing ${key}`);
    assert.notEqual(en[key as keyof typeof en], "");
  }
  assert.notEqual(en["nav.products"], ptBR["nav.products"]);
});

test("live activity states have locale copy", () => {
  for (const key of [
    "live.coding.now",
    "live.spotify.now",
    "live.simkl.now",
    "live.steam.now",
    "live.provider.offline",
    "live.provider.unavailable",
    "live.error.previousData",
  ] as const) {
    assert.notEqual(translate("pt-BR", key), "");
    assert.notEqual(translate("en", key), "");
  }
});

test("GitHub event fallback labels are localized and preserve external titles", () => {
  const pullRequest = {
    type: "PullRequestEvent",
    payload: { action: "opened", pull_request: { title: "Título original" } },
  };
  assert.equal(
    describeGitHubEvent("en", pullRequest),
    "Pull request opened · Título original",
  );
  assert.equal(
    describeGitHubEvent("pt-BR", pullRequest),
    "Pull request aberto · Título original",
  );
  assert.equal(
    describeGitHubEvent("en", { type: "UnrecognizedEvent", payload: {} }),
    "Other activity",
  );
  assert.equal(
    describeGitHubEvent("en", { type: "PullRequestEvent" }),
    "Pull request",
  );
});

test("language target preserves section anchors", () => {
  assert.equal(languageHref("en", "#atividade"), "/#atividade");
  assert.equal(languageHref("pt-BR", "#atividade"), "/en#atividade");
});
