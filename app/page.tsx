"use client";
import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { LiveActivitySection } from "../components/live-activity";
import {
  DepthLayer,
  HeroScene,
  Reveal,
  ScrollExperience,
  ScrollProgress,
  TechnologyBadges,
  useActiveSection,
} from "../components/scroll-motion";
import {
  fetchGitHubUsername,
  githubProfileUrl,
  githubRepositoryUrl,
  githubUsernameLookup,
} from "../lib/github.ts";
import { linkedInProfileForHostname } from "../lib/site-config.ts";

type StudyLanguage = "Java" | "C#";
type StudyFilter = "Todos" | StudyLanguage;
type ActivityTab = "Tudo" | "Commits" | "PRs" | "Issues" | "Releases";

type GitHubEventPayload = {
  ref?: string;
  ref_type?: string;
  action?: string;
  pull_request?: { title?: string; html_url?: string };
  issue?: { title?: string; html_url?: string };
  release?: { name?: string; tag_name?: string; html_url?: string };
};

type GitHubEvent = {
  id: string;
  type: string;
  repo: { name: string };
  payload?: GitHubEventPayload;
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
};

type ExternalProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};
const studies = [
  [
    "springboot-microservice-resilience",
    "Java",
    "Resiliência sob pressão",
    "Falhas, retries e circuit breakers em microsserviços.",
  ],
  [
    "java-distributed-job-lock",
    "Java",
    "Um job. Uma execução.",
    "Coordenação de tarefas em ambientes distribuídos.",
  ],
  [
    "dotnet-distributed-job-lock",
    "C#",
    "Concorrência sob controle",
    "Distributed locks para processamento de jobs.",
  ],
  [
    "springboot-feature-flag-kill-switch",
    "Java",
    "O botão de emergência",
    "Feature flags em runtime e kill switch.",
  ],
  [
    "dotnet-feature-flag-kill-switch",
    "C#",
    "Desligar sem redeploy",
    "Controle de funcionalidades com .NET.",
  ],
  [
    "finance-tracker-services",
    "Java",
    "Eventos que movem dinheiro",
    "Estudo de arquitetura financeira distribuída.",
  ],
  [
    "aspnet-rate-limit-ip",
    "C#",
    "Cada requisição tem seu limite",
    "Rate limiting por IP com ASP.NET Core.",
  ],
  [
    "distributed-gateway-order-system",
    "Java",
    "Do gateway ao pedido",
    "Gateway e serviços para um fluxo distribuído.",
  ],
];
function Chapter({ n, label, title, children, id }: ChapterProps) {
  return (
    <section id={id} className="chapter">
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
function Landscape() {
  return (
    <svg
      className="landscape"
      viewBox="0 0 1200 900"
      role="img"
      aria-label="Paisagem japonesa ilustrada, com montanhas, um sol vermelho e um portal torii"
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
export default function Page() {
  const [filter, setFilter] = useState<StudyFilter>("Todos");
  const [tab, setTab] = useState<ActivityTab>("Tudo");
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [status, setStatus] = useState("Carregando atividades…");
  const [updated, setUpdated] = useState("");
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
          setStatus("Atividades públicas do GitHub");
          setUpdated(new Date().toLocaleString("pt-BR"));
        }
      } catch {
        try {
          const r = await fetch("/events.json");
          const e = (await r.json()) as GitHubEvent[];
          if (live) {
            setEvents(e);
            setStatus("Snapshot público · 07/10/2026");
          }
        } catch {
          if (live) setStatus("Não foi possível carregar. Veja o GitHub.");
        }
      }
    }
    load();
    return () => {
      live = false;
    };
  }, []);
  const types: Record<Exclude<ActivityTab, "Tudo">, readonly string[]> = {
    Commits: ["PushEvent"],
    PRs: [
      "PullRequestEvent",
      "PullRequestReviewEvent",
      "PullRequestReviewCommentEvent",
    ],
    Issues: ["IssuesEvent", "IssueCommentEvent"],
    Releases: ["ReleaseEvent"],
  };
  const shown = events.filter(
    (e) => tab === "Tudo" || types[tab]?.includes(e.type),
  );
  function describe(e: GitHubEvent): string {
    const p: GitHubEventPayload = e.payload ?? {};
    if (e.type === "PushEvent")
      return (
        "Código atualizado" +
        (p.ref ? ` · ${p.ref.replace("refs/heads/", "")}` : "")
      );
    if (e.type === "PullRequestEvent")
      return (
        "Pull request " +
        (p.action || "") +
        " · " +
        (p.pull_request?.title || "")
      );
    if (e.type === "IssuesEvent")
      return `Issue ${p.action || ""} · ${p.issue?.title || ""}`;
    if (e.type === "IssueCommentEvent")
      return `Comentário · ${p.issue?.title || ""}`;
    if (e.type === "ReleaseEvent")
      return `Release · ${p.release?.name || p.release?.tag_name || ""}`;
    if (e.type === "WatchEvent") return "Adicionado aos favoritos";
    if (e.type === "CreateEvent")
      return `Criado: ${p.ref || p.ref_type || "repositório"}`;
    if (e.type === "ForkEvent") return "Fork criado";
    return e.type.replace("Event", "").replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  return (
    <ScrollExperience preference={motion}>
      <ScrollProgress />
      <a className="skip" href="#produtos">
        Pular para projetos
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
        >
          Menu {menu ? "−" : "+"}
        </button>
        <nav className={menu ? "open" : ""}>
          {[
            ["produtos", "Produtos"],
            ["android", "Android"],
            ["laboratorio", "Laboratório"],
            ["atividade", "Atividade"],
            ["agora", "Agora"],
            ["sobre", "Além do código"],
          ].map(([id, label]) => (
            <a
              key={id}
              aria-current={activeSection === id ? "location" : undefined}
              href={`#${id}`}
              onClick={() => setMenu(false)}
            >
              {label}
            </a>
          ))}
          <Link href="/hub" onClick={() => setMenu(false)}>
            Hub
          </Link>
        </nav>
        <div className="header-socials">
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
              <Landscape />
              <DepthLayer className="vertical-jp" distance={55}>
                <span lang="ja">創造 · 探求 · コード</span>
              </DepthLayer>
            </>
          }
        >
          <div className="hero-content">
            <div className="eyebrow">
              <i /> FULL-STACK DEVELOPER · BRASIL
            </div>
            <h1>
              Entre código
              <br />e <em>caos.</em>
            </h1>
            <p>
              Construo sistemas. Exploro ideias.
              <br />
              Java, C# e uma curiosidade que não cabe no terminal.
            </p>
            <div className="hero-actions">
              <a className="button" href="#produtos">
                Explore meus projetos <span>↘</span>
              </a>
              <External href={gh}>Conheça o código ↗</External>
            </div>
            <div className="hero-stack">
              JAVA / SPRING <b>✳</b> C# / .NET <b>✳</b> REACT / FLUTTER
            </div>
          </div>
          <div className="hero-bottom">
            <span>01 — UMA JORNADA EM CONSTRUÇÃO</span>
            <button
              type="button"
              onClick={() => setMotion(!motion)}
              aria-pressed={motion}
            >
              Movimento {motion ? "ON" : "OFF"}
            </button>
            <a href="#produtos">SCROLL PARA EXPLORAR ↓</a>
          </div>
        </HeroScene>
        <div className="ticker" aria-hidden="true">
          BUILD. BREAK. LEARN. REPEAT. <span>作る</span> JAVA + C#{" "}
          <span>探求</span> BUILD. BREAK. LEARN. REPEAT.
        </div>
        <Chapter
          n="02"
          label="PRODUTOS & PLATAFORMAS"
          id="produtos"
          title={
            <>
              Ideias que saíram
              <br />
              do <em>localhost.</em>
            </>
          }
        >
          <p className="intro">
            Áudio, vídeo e automação. Projetos com uma finalidade, uma
            arquitetura e bastante código por trás.
          </p>
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
                  <span className="tag">01 / ÁUDIO EM TEMPO REAL</span>
                  <h3>SonicRelay</h3>
                  <p>
                    O áudio do seu PC, no seu celular. Publisher desktop e
                    viewer mobile conectados por WebRTC.
                  </p>
                  <TechnologyBadges
                    labels={["C#", "Avalonia", "Flutter", "WebRTC"]}
                  />
                  <External href={githubRepo("desktop_dotnet_SonicRelay")}>
                    Desktop ↗
                  </External>
                  <External href={githubRepo("flutter_mobile-web_SonicRelay")}>
                    Mobile ↗
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
                  <span className="tag">02 / COMPARTILHAMENTO DE TELA</span>
                  <h3>FrameRelay</h3>
                  <p>
                    Tela e áudio em tempo real. Um laboratório de captura,
                    codecs e comunicação entre dispositivos.
                  </p>
                  <TechnologyBadges labels={[".NET", "Avalonia", "WebRTC"]} />
                  <External href={githubRepo("dotnet_FrameRelay")}>
                    Explorar projeto ↗
                  </External>
                </div>
              </article>
            </Reveal>
            <Reveal className="product-reveal" delay={0.24}>
              <article className="product tracker">
                <DepthLayer className="product-depth" distance={20}>
                  <div className="product-visual pipeline" aria-hidden="true">
                    <span>APPLICATION_PIPELINE</span>
                    {["APPLIED", "INTERVIEW", "NEXT STEP"].map((s, i) => (
                      <div key={s}>
                        <b>0{i + 1}</b>
                        {s}
                        <i>↗</i>
                      </div>
                    ))}
                  </div>
                </DepthLayer>
                <div className="product-copy">
                  <span className="tag">03 / ORGANIZAÇÃO & AUTOMAÇÃO</span>
                  <h3>JobApplyTracker</h3>
                  <p>
                    Uma plataforma para organizar candidaturas, acompanhar o
                    processo e integrar o fluxo de busca.
                  </p>
                  <TechnologyBadges
                    labels={["Spring Boot", "React", "OAuth2"]}
                  />
                  <External href={githubRepo("SpringBoot-JobApplyTracker")}>
                    Backend ↗
                  </External>
                  <External href={githubRepo("React-JobApplyTracker")}>
                    Frontend ↗
                  </External>
                </div>
              </article>
            </Reveal>
          </div>
        </Chapter>
        <Chapter
          n="03"
          label="ANDROID APPS"
          id="android"
          title={
            <>
              Código para levar
              <br />
              no <em>bolso.</em>
            </>
          }
        >
          <div className="android-layout">
            <DepthLayer className="phone-stage" distance={45}>
              <div
                className="phone"
                role="img"
                aria-label="Ilustração conceitual do SonicRelay, não uma captura real"
              >
                <div className="notch" />
                <small>SONICRELAY / CONCEITO VISUAL</small>
                <div className="phone-symbol">◉</div>
                <h3>
                  Seu áudio.
                  <br />
                  Outro lugar.
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
                  "Viewer mobile para receber o áudio transmitido pelo desktop.",
                ],
                [
                  "The Universe Decides",
                  "the_universe_decides",
                  "Projeto de aplicativo: explore a implementação e os recursos no repositório.",
                ],
                [
                  "Hydration Tracker",
                  "Hydration-Tracker",
                  "Projeto dedicado ao acompanhamento da hidratação.",
                ],
              ].map(([name, repo, desc], i) => (
                <Reveal key={name} delay={i * 0.08}>
                  <article>
                    <span className="tag">0{i + 1} / MOBILE</span>
                    <h3>{name}</h3>
                    <p>{desc}</p>
                    <External href={githubRepo(repo)}>
                      Código & documentação ↗
                    </External>
                    <External href={`${githubRepo(repo)}/releases`}>
                      Ver releases ↗
                    </External>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </Chapter>
        <Chapter
          n="04"
          label="LABORATÓRIO"
          id="laboratorio"
          title={
            <>
              Curiosidade.
              <br />
              <em>Em execução.</em>
            </>
          }
        >
          <div className="filter-row">
            <fieldset className="tabs" aria-label="Filtrar estudos">
              {(["Todos", "Java", "C#"] as const).map((f) => (
                <button
                  type="button"
                  key={f}
                  className={filter === f ? "active" : ""}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                >
                  {f}
                </button>
              ))}
            </fieldset>
            <span className="tag">
              EXPERIMENTOS / ARQUITETURA / APRENDIZADO
            </span>
          </div>
          <div className="studies">
            {studies
              .filter((s) => filter === "Todos" || s[1] === filter)
              .map(([repo, lang, title, desc], i) => (
                <Reveal
                  key={repo}
                  className="study-reveal"
                  delay={(i % 2) * 0.08}
                >
                  <External href={githubRepo(repo)} className="study">
                    <span className="tag">
                      {lang} <span>↗</span>
                    </span>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                    <code>{repo}</code>
                  </External>
                </Reveal>
              ))}
          </div>
          <details className="repo-browser">
            <summary>
              Explorar todos os repositórios públicos <span>+</span>
            </summary>
            <label>
              Buscar repositório
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Java, Flutter, MCP…"
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
                    {r.archived ? " · arquivado" : ""} ↗
                  </External>
                ))}
            </div>
          </details>
        </Chapter>
        <Chapter
          n="05"
          label="GITHUB ACTIVITY"
          id="atividade"
          title={
            <>
              O código
              <br />
              não <em>para.</em>
            </>
          }
        >
          <div className="activity-heading">
            <p>
              {status}
              {updated && <small>Atualizado em {updated}</small>}
            </p>
            <External href={gh}>Perfil completo ↗</External>
          </div>
          <fieldset
            className="tabs activity-tabs"
            aria-label="Tipo de atividade"
          >
            {(["Tudo", "Commits", "PRs", "Issues", "Releases"] as const).map(
              (t) => (
                <button
                  type="button"
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => {
                    setTab(t);
                    setLimit(8);
                  }}
                  aria-pressed={tab === t}
                >
                  {t}
                </button>
              ),
            )}
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
                  <p>{describe(e)}</p>
                </div>
                <time dateTime={e.created_at}>
                  {new Date(e.created_at).toLocaleDateString("pt-BR")}
                </time>
                <span>↗</span>
              </External>
            ))}
            {!shown.length && (
              <p className="empty">
                Nenhum evento desse tipo no período disponível.{" "}
                <External href={gh}>Confira o perfil ↗</External>
              </p>
            )}
          </div>
          {shown.length > limit && (
            <button
              type="button"
              className="load-more"
              onClick={() => setLimit(limit + 12)}
            >
              Carregar mais +
            </button>
          )}
          <p className="footnote">
            Eventos públicos recentes. Esta timeline não representa o calendário
            anual de contribuições nem atividades privadas.
          </p>
        </Chapter>
        <LiveActivitySection />
        <section className="about" id="sobre">
          <div className="about-number">07 / ALÉM DO CÓDIGO</div>
          <Reveal className="about-title">
            <span lang="ja">探求</span>
            <h2>
              Nem toda pergunta
              <br />
              tem um <em>return.</em>
            </h2>
          </Reveal>
          <div className="about-bottom">
            <p>
              Entre sistemas distribuídos e universos fictícios. Cultura
              japonesa, games, astronomia e filosofia alimentam a mesma vontade:
              entender como as coisas funcionam — e o que podemos criar com
              elas.
            </p>
            <div>
              <span>JAPÃO & ANIME</span>
              <span>GAMES & NARRATIVAS</span>
              <span>ASTRONOMIA & FÍSICA</span>
              <span>CAMUS & NIETZSCHE</span>
            </div>
          </div>
        </section>
        <section className="contact" id="contato">
          <Reveal>
            <span className="tag">08 / PRÓXIMO CAPÍTULO</span>
          </Reveal>
          <h2>
            Vamos construir
            <br />
            algo <em>interessante?</em>
          </h2>
          <External className="button" href={linkedinProfile}>
            Conversar no LinkedIn ↗
          </External>
          <External href={gh}>Explorar o GitHub ↗</External>
        </section>
      </main>
      <footer className="site-footer">
        <a className="logo" href="#inicio">
          H<span>.</span>
        </a>
        <span>VITOR HUGO · JAVA / C# · FEITO COM CURIOSIDADE</span>
        <a href="#inicio">VOLTAR AO TOPO ↑</a>
      </footer>
    </ScrollExperience>
  );
}
