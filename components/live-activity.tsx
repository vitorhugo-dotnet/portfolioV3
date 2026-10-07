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
) {
  if (provider === "coding" && data.coding)
    return {
      title:
        data.coding.project ?? data.coding.language ?? "Entre ideias e código",
      subtitle: [
        data.coding.editor,
        data.coding.durationMinutes !== undefined
          ? `${data.coding.durationMinutes} min hoje`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      status:
        data.coding.status === "active" && !stale
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
      status: "Assistido recentemente",
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
          (provider === "coding" && data.coding?.status === "active") ||
          (provider === "spotify" && data.spotify?.isPlaying) ||
          (provider === "steam" && data.steam?.isPlaying);
        const info = isActive && !stale ? details(provider, data, stale) : null;
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
      ) : data || error || !endpoint ? (
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
