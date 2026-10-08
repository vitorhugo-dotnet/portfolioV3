"use client";
import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "../i18n/config.ts";
import type { DictionaryKey } from "../i18n/translate.ts";
import {
  formatDate,
  formatRelativeTime,
  translate,
} from "../i18n/translate.ts";
import {
  fetchGitHubUsername,
  githubProfileUrl,
  githubRepositoryUrl,
  githubUsernameLookup,
} from "../lib/github.ts";
import {
  describeGitHubEvent,
  type GitHubEventPresentation,
} from "../lib/github-event-presentation.ts";
import { linkedInProfileForHostname } from "../lib/site-config.ts";
import { LanguageSwitcher } from "./language-switcher";
import { LiveActivitySection } from "./live-activity";
import { ReadingLogSection } from "./reading-log";
import {
  DepthLayer,
  HeroScene,
  Reveal,
  ScrollExperience,
  ScrollProgress,
  TechnologyBadges,
  useActiveSection,
} from "./scroll-motion";

type StudyLanguage = "Java" | "C#";
type StudyFilter = "all" | StudyLanguage;
type ActivityTab = "all" | "commits" | "pullRequests" | "issues" | "releases";

type GitHubEvent = GitHubEventPresentation & {
  id: string;
  repo: { name: string };
  payload?: GitHubEventPresentation["payload"] & {
    pull_request?: { title?: string; html_url?: string };
    issue?: { title?: string; html_url?: string };
    release?: { name?: string; tag_name?: string; html_url?: string };
  };
  created_at: string;
};

type Repository = {
  name: string;
  url: string;
  archived: boolean;
};

type ChapterProps = {
  n: string;
  label: string;
  title: ReactNode;
  children: ReactNode;
  id: string;
  className?: string;
};

type ExternalProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};
const studies = [
  ["springboot-microservice-resilience", "Java", "resilience"],
  ["java-distributed-job-lock", "Java", "singleJob"],
  ["dotnet-distributed-job-lock", "C#", "concurrency"],
  ["springboot-feature-flag-kill-switch", "Java", "emergency"],
  ["dotnet-feature-flag-kill-switch", "C#", "deploy"],
  ["finance-tracker-services", "Java", "money"],
  ["aspnet-rate-limit-ip", "C#", "limits"],
  ["distributed-gateway-order-system", "Java", "gateway"],
] as const;

function useTranslation(locale: Locale) {
  return useCallback(
    (key: DictionaryKey, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    [locale],
  );
}

function Chapter({ n, label, title, children, id, className }: ChapterProps) {
  return (
    <section id={id} className={className ? `chapter ${className}` : "chapter"}>
      <div className="section-label">
        <span>
          {n} / {label}
        </span>
        <span>HUGO.DEV ↙</span>
      </div>
      <Reveal>
        <h2>{title}</h2>
      </Reveal>
      {children}
    </section>
  );
}
function External({ href, children, ...props }: ExternalProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}
function Landscape({ locale }: { locale: Locale }) {
  return (
    <svg
      className="landscape"
      viewBox="0 0 1200 900"
      role="img"
      aria-label={translate(locale, "image.japaneseLandscape")}
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#161c25" />
          <stop offset="1" stopColor="#343237" />
        </linearGradient>
        <linearGradient id="sun" x2="0" y2="1">
          <stop stopColor="#ff604b" />
          <stop offset="1" stopColor="#bb3937" />
        </linearGradient>
        <pattern id="lines" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0H6" stroke="#080e14" opacity=".2" />
        </pattern>
      </defs>
      <rect width="1200" height="900" fill="url(#sky)" />
      <circle cx="670" cy="330" r="195" fill="url(#sun)" />
      <circle cx="670" cy="330" r="195" fill="url(#lines)" />
      <g className="mountain-back">
        <path
          d="M0 620L200 400 340 530 530 310 790 600 930 370 1200 590V900H0"
          fill="#4d5157"
        />
        <path
          d="M380 470L530 310 662 461 551 421 519 384 480 436Z"
          fill="#d0c9bc"
          opacity=".7"
        />
      </g>
      <path
        d="M0 700L260 530 480 715 700 535 970 670 1200 530V900H0"
        fill="#252e37"
      />
      <path d="M0 760Q220 650 440 750T850 750T1200 700V900H0" fill="#141d25" />
      <g className="torii" fill="#12171b">
        <path d="M760 370Q950 406 1140 370L1130 402Q947 440 768 401Z" />
        <path d="M794 442H1110V459H794Z" />
        <path d="M816 395H845L832 820H795Z" />
        <path d="M1065 395H1093L1115 820H1078Z" />
        <path d="M944 410H963V452H944Z" />
      </g>
      <path d="M0 840Q300 750 700 850T1200 820V900H0" fill="#0c1117" />
      <g stroke="#73817c" opacity=".2">
        <path d="M0 805H700M50 830H750M430 858H1100" />
      </g>
    </svg>
  );
}
export function PortfolioPage({ locale }: { locale: Locale }) {
  const t = useTranslation(locale);
  const [filter, setFilter] = useState<StudyFilter>("all");
  const [tab, setTab] = useState<ActivityTab>("all");
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [statusKey, setStatusKey] = useState<DictionaryKey>(
    "github.status.loading",
  );
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [limit, setLimit] = useState(8);
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<Repository[]>([]);
  const [menu, setMenu] = useState(false);
  const [motion, setMotion] = useState(true);
  const [githubUsername, setGithubUsername] = useState(githubUsernameLookup);
  const [linkedinProfile, setLinkedinProfile] = useState(
    linkedInProfileForHostname(""),
  );
  const gh = githubProfileUrl(githubUsername);
  const githubRepo = (repository: string) =>
    githubRepositoryUrl(githubUsername, repository);
  const activeSection = useActiveSection();
  useEffect(() => {
    setLinkedinProfile(linkedInProfileForHostname(window.location.hostname));
    fetch("/repos.json")
      .then(async (r) => r.json() as Promise<Repository[]>)
      .then(setRepos)
      .catch(() => {});
    let live = true;
    async function load() {
      try {
        const username = await fetchGitHubUsername();
        if (live) setGithubUsername(username);
        const r = await fetch(
          `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`,
        );
        if (!r.ok) throw Error();
        const e = (await r.json()) as GitHubEvent[];
        if (live) {
          setEvents(e);
          setStatusKey("github.status.public");
          setUpdatedAt(Date.now());
        }
      } catch {
        try {
          const r = await fetch("/events.json");
          const e = (await r.json()) as GitHubEvent[];
          if (live) {
            setEvents(e);
            setStatusKey("github.status.snapshot");
          }
        } catch {
          if (live) setStatusKey("github.status.unavailable");
        }
      }
    }
    load();
    return () => {
      live = false;
    };
  }, []);
  const types: Record<Exclude<ActivityTab, "all">, readonly string[]> = {
    commits: ["PushEvent"],
    pullRequests: [
      "PullRequestEvent",
      "PullRequestReviewEvent",
      "PullRequestReviewCommentEvent",
    ],
    issues: ["IssuesEvent", "IssueCommentEvent"],
    releases: ["ReleaseEvent"],
  };
  const shown = events.filter(
    (e) => tab === "all" || types[tab]?.includes(e.type),
  );
  return (
    <ScrollExperience preference={motion}>
      <ScrollProgress />
      <a className="skip" href="#sobre">
        {t("skip.professional")}
      </a>
      <header>
        <a href="#inicio" className="logo">
          H<span>.</span>
          <small>VITOR HUGO / DEV</small>
        </a>
        <button
          type="button"
          className="mobile-menu"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-label={menu ? t("menu.close") : t("menu.open")}
        >
          {t("menu.open")} {menu ? "−" : "+"}
        </button>
        <nav className={menu ? "open" : ""}>
          {[
            { id: "sobre", key: "nav.professional" },
            { id: "produtos", key: "nav.products" },
            { id: "android", key: "nav.android" },
            { id: "laboratorio", key: "nav.studies" },
            { id: "atividade", key: "nav.githubActivity" },
            { id: "agora", key: "nav.liveActivity" },
            { id: "leitura", key: "nav.reading" },
            { id: "alem-do-codigo", key: "nav.about" },
          ].map(({ id, key }) => (
            <a
              key={id}
              aria-current={activeSection === id ? "location" : undefined}
              href={`#${id}`}
              onClick={() => setMenu(false)}
            >
              {t(key as DictionaryKey)}
            </a>
          ))}
          <Link href="/hub" onClick={() => setMenu(false)}>
            {t("nav.hub")}
          </Link>
        </nav>
        <div className="header-socials">
          <LanguageSwitcher locale={locale} />
          <External className="header-link" href={linkedinProfile}>
            LinkedIn ↗
          </External>
          <External className="header-link" href={gh}>
            GitHub ↗
          </External>
        </div>
      </header>
      <main>
        <HeroScene
          art={
            <>
              <Landscape locale={locale} />
              <DepthLayer className="vertical-jp" distance={55}>
                <span lang="ja">創造 · 探求 · コード</span>
              </DepthLayer>
            </>
          }
        >
          <div className="hero-content">
            <div className="eyebrow">
              <i /> {t("hero.label")}
            </div>
            <h1>
              {t("hero.title.firstLine")}
              <br />
              <em>{t("hero.title.secondLine")}</em>
            </h1>
            <p>
              {t("hero.intro.firstLine")}
              <br />
              {t("hero.intro.secondLine")}
            </p>
            <div className="hero-actions">
              <a className="button" href="#produtos">
                {t("hero.action.projects")} <span>↘</span>
              </a>
              <External href={gh}>{t("hero.action.github")} ↗</External>
            </div>
            <div className="hero-stack">
              JAVA / SPRING <b>✳</b> C# / .NET <b>✳</b> REACT / FLUTTER
            </div>
          </div>
          <div className="hero-bottom">
            <span>{t("hero.storyline")}</span>
            <button
              type="button"
              onClick={() => setMotion(!motion)}
              aria-pressed={motion}
            >
              {t("hero.motion")} {motion ? "ON" : "OFF"}
            </button>
            <a href="#produtos">{t("hero.scroll")} ↓</a>
          </div>
        </HeroScene>
        <div className="ticker" aria-hidden="true">
          BUILD. BREAK. LEARN. REPEAT. <span>作る</span> JAVA + C#{" "}
          <span>探求</span> BUILD. BREAK. LEARN. REPEAT.
        </div>
        <Chapter
          n="02"
          label={t("professional.chapter")}
          id="sobre"
          className="professional-about"
          title={t("professional.title")}
        >
          <div className="professional-copy">
            <Reveal>
              <p>{t("professional.paragraph.one")}</p>
            </Reveal>
            <Reveal delay={0.08}>
              <p>{t("professional.paragraph.two")}</p>
            </Reveal>
            <Reveal delay={0.16}>
              <p>{t("professional.paragraph.three")}</p>
            </Reveal>
          </div>
        </Chapter>
        <Chapter
          n="03"
          label={t("product.chapter")}
          id="produtos"
          title={
            <>
              {t("product.title.firstLine")}
              <br />
              <em>{t("product.title.secondLine")}</em>
            </>
          }
        >
          <p className="intro">{t("product.intro")}</p>
          <div className="products">
            <Reveal className="product-reveal">
              <article className="product sonic">
                <DepthLayer className="product-depth" distance={18}>
                  <div className="product-visual waveform" aria-hidden="true">
                    {Array.from(
                      { length: 35 },
                      (_, i) => 18 + Math.abs(Math.sin(i * 0.55)) * 105,
                    ).map((height) => (
                      <i
                        key={height}
                        style={{
                          height: height,
                        }}
                      />
                    ))}
                    <span>PC → MOBILE</span>
                  </div>
                </DepthLayer>
                <div className="product-copy">
                  <span className="tag">{t("product.sonic.tag")}</span>
                  <h3>SonicRelay</h3>
                  <p>{t("product.sonic.description")}</p>
                  <TechnologyBadges
                    labels={["C#", "Avalonia", "Flutter", "WebRTC"]}
                  />
                  <External href={githubRepo("desktop_dotnet_SonicRelay")}>
                    {t("product.desktop")} ↗
                  </External>
                  <External href={githubRepo("flutter_mobile-web_SonicRelay")}>
                    {t("product.mobile")} ↗
                  </External>
                </div>
              </article>
            </Reveal>
            <Reveal className="product-reveal" delay={0.12}>
              <article className="product frame">
                <DepthLayer className="product-depth" distance={28}>
                  <div className="product-visual monitor" aria-hidden="true">
                    <div>
                      <span>FRAME_RELAY /</span>
                      <div className="screen-grid" />
                      <small>SCREEN + AUDIO</small>
                    </div>
                  </div>
                </DepthLayer>
                <div className="product-copy">
                  <span className="tag">{t("product.frame.tag")}</span>
                  <h3>FrameRelay</h3>
                  <p>{t("product.frame.description")}</p>
                  <TechnologyBadges labels={[".NET", "Avalonia", "WebRTC"]} />
                  <External href={githubRepo("dotnet_FrameRelay")}>
                    {t("product.explore")} ↗
                  </External>
                </div>
              </article>
            </Reveal>
            <Reveal className="product-reveal" delay={0.24}>
              <article className="product tracker">
                <DepthLayer className="product-depth" distance={20}>
                  <div className="product-visual pipeline" aria-hidden="true">
                    <span>APPLICATION_PIPELINE</span>
                    {(
                      [
                        "product.job.stage.applied",
                        "product.job.stage.interview",
                        "product.job.stage.nextStep",
                      ] as const
                    ).map((key, i) => (
                      <div key={key}>
                        <b>0{i + 1}</b>
                        {t(key)}
                        <i>↗</i>
                      </div>
                    ))}
                  </div>
                </DepthLayer>
                <div className="product-copy">
                  <span className="tag">{t("product.job.tag")}</span>
                  <h3>JobApplyTracker</h3>
                  <p>{t("product.job.description")}</p>
                  <TechnologyBadges
                    labels={["Spring Boot", "React", "OAuth2"]}
                  />
                  <External href={githubRepo("SpringBoot-JobApplyTracker")}>
                    {t("product.backend")} ↗
                  </External>
                  <External href={githubRepo("React-JobApplyTracker")}>
                    {t("product.frontend")} ↗
                  </External>
                </div>
              </article>
            </Reveal>
          </div>
        </Chapter>
        <Chapter
          n="04"
          label={t("android.chapter")}
          id="android"
          title={
            <>
              {t("android.title.firstLine")}
              <br />
              <em>{t("android.title.secondLine")}</em>
            </>
          }
        >
          <div className="android-layout">
            <DepthLayer className="phone-stage" distance={45}>
              <div
                className="phone"
                role="img"
                aria-label={t("android.imageAlt")}
              >
                <div className="notch" />
                <small>{t("android.concept")}</small>
                <div className="phone-symbol">◉</div>
                <h3>
                  {t("android.phone.firstLine")}
                  <br />
                  {t("android.phone.secondLine")}
                </h3>
                <div className="phone-wave">▂ ▄ ▆ █ ▅ ▃ ▆ █ ▄ ▂</div>
                <span>PC ↔ ANDROID</span>
              </div>
            </DepthLayer>
            <div className="app-list">
              {[
                [
                  "SonicRelay",
                  "flutter_mobile-web_SonicRelay",
                  "android.sonic.description",
                ],
                [
                  "The Universe Decides",
                  "the_universe_decides",
                  "android.universe.description",
                ],
                [
                  "Hydration Tracker",
                  "Hydration-Tracker",
                  "android.hydration.description",
                ],
              ].map(([name, repo, desc], i) => (
                <Reveal key={name} delay={i * 0.08}>
                  <article>
                    <span className="tag">
                      {t("android.app.tag", {
                        number: i + 1,
                        platform: t("android.app.platform"),
                      })}
                    </span>
                    <h3>{name}</h3>
                    <p>{t(desc as DictionaryKey)}</p>
                    <External href={githubRepo(repo)}>
                      {t("android.documentation")} ↗
                    </External>
                    <External href={`${githubRepo(repo)}/releases`}>
                      {t("android.releases")} ↗
                    </External>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </Chapter>
        <Chapter
          n="05"
          label={t("lab.chapter")}
          id="laboratorio"
          title={
            <>
              {t("lab.title.firstLine")}
              <br />
              <em>{t("lab.title.secondLine")}</em>
            </>
          }
        >
          <div className="filter-row">
            <fieldset className="tabs" aria-label={t("lab.filter.label")}>
              {(
                [
                  ["all", "lab.filter.all"],
                  ["Java", "Java"],
                  ["C#", "C#"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                >
                  {label === "Java" || label === "C#" ? label : t(label)}
                </button>
              ))}
            </fieldset>
            <span className="tag">{t("lab.experiments")}</span>
          </div>
          <div className="studies">
            {studies
              .filter((s) => filter === "all" || s[1] === filter)
              .map(([repo, lang, copy], i) => (
                <Reveal
                  key={repo}
                  className="study-reveal"
                  delay={(i % 2) * 0.08}
                >
                  <External href={githubRepo(repo)} className="study">
                    <span className="tag">
                      {lang} <span>↗</span>
                    </span>
                    <h3>{t(`lab.study.${copy}.title` as DictionaryKey)}</h3>
                    <p>{t(`lab.study.${copy}.description` as DictionaryKey)}</p>
                    <code>{repo}</code>
                  </External>
                </Reveal>
              ))}
          </div>
          <details className="repo-browser">
            <summary>
              {t("lab.repo.summary")} <span>+</span>
            </summary>
            <label>
              {t("lab.repo.search")}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("lab.repo.placeholder")}
              />
            </label>
            <div className="repo-results">
              {repos
                .filter((r) =>
                  r.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((r) => (
                  <External key={r.name} href={githubRepo(r.name)}>
                    {r.name}
                    {r.archived ? ` · ${t("lab.repo.archived")}` : ""} ↗
                  </External>
                ))}
            </div>
          </details>
        </Chapter>
        <Chapter
          n="06"
          label={t("github.chapter")}
          id="atividade"
          title={
            <>
              {t("github.title.firstLine")}
              <br />
              <em>{t("github.title.secondLine")}</em>
            </>
          }
        >
          <div className="activity-heading">
            <p>
              {t(statusKey)}
              {updatedAt && (
                <small>
                  {t("github.status.updated", {
                    date: formatDate(locale, updatedAt, {
                      dateStyle: "short",
                      timeStyle: "short",
                    }),
                  })}
                </small>
              )}
            </p>
            <External href={gh}>{t("github.profile")} ↗</External>
          </div>
          <fieldset
            className="tabs activity-tabs"
            aria-label={t("github.filter.label")}
          >
            {(
              [
                ["all", "github.filter.all"],
                ["commits", "github.filter.commits"],
                ["pullRequests", "github.filter.pullRequests"],
                ["issues", "github.filter.issues"],
                ["releases", "github.filter.releases"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={tab === value ? "active" : ""}
                onClick={() => {
                  setTab(value);
                  setLimit(8);
                }}
                aria-pressed={tab === value}
              >
                {t(label)}
              </button>
            ))}
          </fieldset>
          <div className="events">
            {shown.slice(0, limit).map((e) => (
              <External
                className="event"
                key={e.id}
                href={
                  e.payload?.pull_request?.html_url ||
                  e.payload?.issue?.html_url ||
                  e.payload?.release?.html_url ||
                  `https://github.com/${e.repo.name}`
                }
              >
                <span className="event-symbol">
                  {e.type === "PushEvent"
                    ? "⌘"
                    : e.type.includes("PullRequest")
                      ? "⑂"
                      : "↗"}
                </span>
                <div>
                  <b>{e.repo.name.replace("vitorhugo-dotnet/", "")}</b>
                  <p>{describeGitHubEvent(locale, e)}</p>
                </div>
                <time dateTime={e.created_at}>
                  {formatRelativeTime(locale, e.created_at)}
                </time>
                <span>↗</span>
              </External>
            ))}
            {!shown.length && (
              <p className="empty">
                {t("github.empty")}{" "}
                <External href={gh}>{t("github.empty.profile")} ↗</External>
              </p>
            )}
          </div>
          {shown.length > limit && (
            <button
              type="button"
              className="load-more"
              onClick={() => setLimit(limit + 12)}
            >
              {t("github.loadMore")} +
            </button>
          )}
          <p className="footnote">{t("github.footnote")}</p>
        </Chapter>
        <LiveActivitySection locale={locale} />
        <ReadingLogSection locale={locale} />
        <section className="about" id="alem-do-codigo">
          <div className="about-number">{t("about.chapter")}</div>
          <Reveal className="about-title">
            <span lang="ja">探求</span>
            <h2>
              {t("about.title")}
              <br />
              {t("about.title.secondLine")} <em>return.</em>
            </h2>
          </Reveal>
          <div className="about-bottom">
            <p>{t("about.description")}</p>
            <div>
              <span>{t("about.interests.japan")}</span>
              <span>{t("about.interests.games")}</span>
              <span>{t("about.interests.space")}</span>
              <span>{t("about.interests.philosophy")}</span>
            </div>
          </div>
        </section>
        <section className="contact" id="contato">
          <Reveal>
            <span className="tag">{t("contact.chapter")}</span>
          </Reveal>
          <h2>
            {t("contact.title.firstLine")}
            <br />
            <em>{t("contact.title.secondLine")}</em>
          </h2>
          <External className="button" href={linkedinProfile}>
            {t("contact.linkedin")} ↗
          </External>
          <External href={gh}>{t("contact.github")} ↗</External>
        </section>
      </main>
      <footer>
        <a className="logo" href="#inicio">
          H<span>.</span>
        </a>
        <span>{t("footer.signature")}</span>
        <Link href="/hub">{t("footer.hub")} ↗</Link>
        <a href="#inicio">{t("footer.backToTop")} ↑</a>
      </footer>
    </ScrollExperience>
  );
}
