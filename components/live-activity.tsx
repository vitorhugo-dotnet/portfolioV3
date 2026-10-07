"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  createActivityRefresh,
  isActivityStale,
} from "../lib/activity-refresh.ts";
import {
  type LiveActivityResponse,
  type Provider,
  parseLiveActivity,
  providers,
} from "../lib/live-activity.ts";
import { Reveal } from "./scroll-motion";

const labels: Record<
  Provider,
  { title: string; symbol: string; category: string }
> = {
  coding: { title: "WakaTime", symbol: "⌘", category: "CÓDIGO" },
  spotify: { title: "Spotify", symbol: "♫", category: "MÚSICA" },
  simkl: { title: "Simkl", symbol: "▶", category: "ANIME & SÉRIES" },
  steam: { title: "Steam", symbol: "✳", category: "JOGOS" },
};
function details(
  provider: Provider,
  data: LiveActivityResponse,
  stale: boolean,
  now: number,
) {
  if (provider === "coding" && data.coding)
    return {
      title:
        data.coding.project ?? data.coding.language ?? "Entre ideias e código",
      subtitle: [
        data.coding.file,
        data.coding.editor,
        data.coding.durationMinutes !== undefined
          ? `${data.coding.durationMinutes} min hoje`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      status:
        data.coding.observedAt &&
        now >= Date.parse(data.coding.observedAt) &&
        now - Date.parse(data.coding.observedAt) < 15 * 60000
          ? "Codando agora"
          : "Atividade de código recente",
      observedAt: data.coding.observedAt,
    };
  if (provider === "spotify" && data.spotify)
    return {
      title: data.spotify.track ?? "Música",
      subtitle: data.spotify.artist,
      status:
        data.spotify.isPlaying && !stale
          ? "Ouvindo agora"
          : "Ouvido recentemente",
      image: data.spotify.artworkUrl,
      url: data.spotify.externalUrl,
      observedAt: data.spotify.observedAt,
    };
  if (provider === "simkl" && data.simkl)
    return {
      title: data.simkl.title,
      subtitle: [
        data.simkl.mediaType === "tv"
          ? "Série"
          : data.simkl.mediaType === "movie"
            ? "Filme"
            : "Anime",
        data.simkl.episode ? `Episódio ${data.simkl.episode}` : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      status:
        data.simkl.isActive &&
        data.simkl.observedAt &&
        now - Date.parse(data.simkl.observedAt) < 40 * 60000
          ? "Assistindo agora"
          : "Assistido recentemente",
      image: data.simkl.posterUrl,
      url: data.simkl.externalUrl,
      observedAt: data.simkl.observedAt,
    };
  if (provider === "steam" && data.steam)
    return {
      title: data.steam.game ?? "Jogo",
      subtitle:
        data.steam.isPlaying && !stale
          ? "Uma pausa entre builds."
          : "Um dos jogos das últimas duas semanas.",
      status:
        data.steam.isPlaying && !stale
          ? "Jogando agora"
          : "Jogado recentemente",
      image: data.steam.imageUrl,
      url: data.steam.externalUrl,
      observedAt: data.steam.observedAt,
    };
  return undefined;
}
function displayTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function standbySignal(data: LiveActivityResponse) {
  const observations = [
    data.coding?.observedAt,
    data.spotify?.observedAt,
    data.simkl?.observedAt,
    data.steam?.observedAt,
  ].filter((value): value is string => Boolean(value));
  return observations.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function providerIdleState(
  state: LiveActivityResponse["providerStates"][Provider],
  idleLabel: string,
) {
  if (state === "unconfigured") return "offline";
  if (state === "unavailable") return "sem sinal";
  return idleLabel;
}

function StandbyPanel({
  data,
  now,
}: {
  data: LiveActivityResponse;
  now: number;
}) {
  const watchingStates = [data.providerStates.simkl, data.providerStates.steam];
  const watchingStatus = watchingStates.every(
    (state) => state === "unconfigured",
  )
    ? "offline"
    : watchingStates.some(
          (state) => state !== "unconfigured" && state !== "unavailable",
        )
      ? "idle"
      : "sem sinal";
  const latestSignal = standbySignal(data);
  const elapsedMinutes = latestSignal
    ? Math.max(0, Math.floor((now - Date.parse(latestSignal)) / 60000))
    : undefined;
  const signalLabel =
    elapsedMinutes === undefined
      ? "sem sinal anterior"
      : elapsedMinutes < 1
        ? "agora"
        : `há ${elapsedMinutes} min`;
  const statuses = [
    {
      icon: "</>",
      label: "CODE",
      state: providerIdleState(data.providerStates.coding, "idle"),
    },
    {
      icon: "♫",
      label: "MUSIC",
      state: providerIdleState(data.providerStates.spotify, "paused"),
    },
    {
      icon: "▣",
      label: "WATCHING",
      state: watchingStatus,
    },
  ];

  return (
    <div className="live-standby" aria-live="polite">
      <div className="live-standby-content">
        <div className="live-standby-heading">
          <p className="live-standby-label">
            <span aria-hidden="true" className="live-standby-indicator" />
            STANDBY
          </p>
          <h3>Nenhuma atividade detectada agora.</h3>
          <p>Provavelmente vivendo offline por alguns minutos.</p>
        </div>
        <div className="live-standby-statuses">
          {statuses.map((item) => (
            <div className="live-standby-status" key={item.label}>
              <span aria-hidden="true" className="live-standby-icon">
                {item.icon}
              </span>
              <span className="live-standby-service">
                <span>{item.label}</span>
                <span className="live-standby-state">
                  <i aria-hidden="true" /> {item.state}
                </span>
              </span>
              <span aria-hidden="true" className="live-standby-more">
                ···
              </span>
            </div>
          ))}
        </div>
        <p className="live-standby-signal">
          <span aria-hidden="true">▥</span>
          último sinal · {signalLabel}
        </p>
      </div>
      <span aria-hidden="true" className="live-standby-pattern" />
    </div>
  );
}

export function LiveActivitySection() {
  const section = useRef<HTMLElement>(null);
  const [data, setData] = useState<LiveActivityResponse | null>(null);
  const [error, setError] = useState(false);
  const [clock, setClock] = useState(0);
  const endpoint = process.env.NEXT_PUBLIC_ACTIVITY_API_URL;
  useEffect(() => {
    if (!endpoint || !section.current) return;
    const controller = createActivityRefresh({
      load: async (signal) => {
        const response = await fetch(endpoint, {
          signal,
          credentials: "omit",
          cache: "no-cache",
        });
        if (!response.ok) throw Error("Activity unavailable");
        const result = parseLiveActivity(await response.json());
        if (!result) throw Error("Invalid activity response");
        return result;
      },
      onData: (result) => {
        setData(result);
        setError(false);
        setClock(Date.now());
      },
      onError: () => {
        setError(true);
        setClock(Date.now());
      },
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: (timer) => window.clearTimeout(timer as number),
    });
    let intersecting = false;
    const updateVisibility = () =>
      controller.setVisible(
        intersecting && document.visibilityState === "visible",
      );
    const observer = new IntersectionObserver((entries) => {
      intersecting = entries.some((entry) => entry.isIntersecting);
      updateVisibility();
    });
    observer.observe(section.current);
    document.addEventListener("visibilitychange", updateVisibility);
    const timer = window.setInterval(() => setClock(Date.now()), 15000);
    return () => {
      controller.dispose();
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
      window.clearInterval(timer);
    };
  }, [endpoint]);
  const stale = data ? isActivityStale(data.generatedAt, clock) : false;
  const activeCards = data
    ? providers.flatMap((provider) => {
        const isActive =
          (provider === "coding" &&
            data.coding?.observedAt &&
            clock >= Date.parse(data.coding.observedAt) &&
            clock - Date.parse(data.coding.observedAt) < 15 * 60000) ||
          (provider === "spotify" && data.spotify?.isPlaying) ||
          (provider === "simkl" &&
            data.simkl?.isActive &&
            data.simkl.observedAt &&
            clock >= Date.parse(data.simkl.observedAt) &&
            clock - Date.parse(data.simkl.observedAt) < 40 * 60000) ||
          (provider === "steam" && data.steam?.isPlaying);
        const requiresFreshData =
          provider === "spotify" || provider === "steam";
        const info =
          isActive && (!requiresFreshData || !stale)
            ? details(provider, data, stale, clock)
            : null;
        return info ? [{ provider, info }] : [];
      })
    : [];
  return (
    <section ref={section} id="agora" className="chapter live-activity">
      <div className="section-label">
        <span>06 / AGORA</span>
        <span>HUGO.DEV ↙</span>
      </div>
      <Reveal>
        <h2>
          O que estou
          <br />
          fazendo <em>agora?</em>
        </h2>
      </Reveal>
      <div className="live-activity-heading">
        <p className="intro">
          Código, trilhas sonoras e outros universos. Um recorte do que anda
          acontecendo por aqui.
        </p>
        <p className={`live-update${stale ? " stale" : ""}`} aria-live="polite">
          {data ? (
            <>
              <span>{stale ? "Dados antigos" : "Atualizado"}</span>
              <time dateTime={data.generatedAt}>
                {displayTime(data.generatedAt)}
              </time>
            </>
          ) : endpoint ? (
            error ? (
              "Não foi possível atualizar agora."
            ) : (
              "Buscando atividades…"
            )
          ) : (
            "As integrações estão sendo preparadas."
          )}
          {error && data && (
            <small>
              Não foi possível atualizar. Exibindo a última consulta.
            </small>
          )}
        </p>
      </div>
      {activeCards.length ? (
        <div className="live-cards">
          {activeCards.map(({ provider, info }, index) => {
            return (
              <Reveal
                key={provider}
                delay={index * 0.06}
                className="live-card-reveal"
              >
                <article className={`live-card live-${provider}`}>
                  <div className="live-card-heading">
                    <span aria-hidden="true" className="live-symbol">
                      {labels[provider].symbol}
                    </span>
                    <span className="tag">{labels[provider].category}</span>
                    <span className="live-provider">
                      {labels[provider].title}
                    </span>
                  </div>
                  <p className="live-status">{info.status}</p>
                  <div className="live-card-content">
                    {info.image && (
                      <Image
                        src={info.image}
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div>
                      <h3>{info.title}</h3>
                      {info.subtitle && <p>{info.subtitle}</p>}
                    </div>
                  </div>
                  {info.observedAt && (
                    <time className="live-observed" dateTime={info.observedAt}>
                      Atividade em {displayTime(info.observedAt)}
                    </time>
                  )}
                  {info.url && (
                    <a
                      href={info.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver no {labels[provider].title} ↗
                    </a>
                  )}
                </article>
              </Reveal>
            );
          })}
        </div>
      ) : data ? (
        <StandbyPanel data={data} now={clock} />
      ) : error || !endpoint ? (
        <p className="live-fallback">
          Devo estar dormindo, no ônibus/dirigindo ou apenas o servidor saiu 💀
        </p>
      ) : null}
      <p className="footnote">
        Apenas atividades acontecendo agora. Atualização a cada minuto enquanto
        esta seção está visível.
      </p>
    </section>
  );
}
