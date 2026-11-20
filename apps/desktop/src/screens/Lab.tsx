// Provas da Fase 0: YouTube dentro do WebView e login do Spotify.
// Esta tela some quando as integrações forem para Músicas e Ajustes.

import { useEffect, useRef, useState } from "react";
import { isNative, spotify } from "../lib/engine";

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YtPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}
interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  destroy(): void;
}

const YT_ERRORS: Record<number, string> = {
  2: "parâmetro inválido",
  5: "erro no player HTML5",
  100: "vídeo não encontrado",
  101: "o dono não permite tocar embutido",
  150: "o dono não permite tocar embutido",
  153: "faltou a identificação (Referer). É o risco que estamos testando.",
};

function loadYtApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
}

function useLog() {
  const [lines, setLines] = useState<string[]>([]);
  const add = (l: string) => setLines((p) => [...p.slice(-40), `${new Date().toLocaleTimeString()}  ${l}`]);
  return [lines, add] as const;
}

function YouTubeTest() {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YtPlayer | null>(null);
  const [videoId, setVideoId] = useState("DBNNf4Ri3yc");
  const [pos, setPos] = useState<number | null>(null);
  const [log, add] = useLog();

  const load = async () => {
    add(`origem da página: ${window.location.origin}`);
    await loadYtApi();
    player.current?.destroy();
    if (!host.current || !window.YT) return;
    const el = document.createElement("div");
    host.current.replaceChildren(el);
    player.current = new window.YT.Player(el, {
      videoId,
      playerVars: { playsinline: 1, origin: window.location.origin },
      events: {
        onReady: () => add("player pronto"),
        onStateChange: (e: { data: number }) => add(`estado: ${e.data}`),
        onError: (e: { data: number }) => add(`ERRO ${e.data}: ${YT_ERRORS[e.data] ?? "desconhecido"}`),
      },
    });
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      const p = player.current;
      if (p && typeof p.getCurrentTime === "function") setPos(p.getCurrentTime());
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="panel">
      <h2>YouTube embutido</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Passou se o vídeo toca e a posição atual anda. Se aparecer o erro 153, o Referer precisa de outro caminho.
      </p>
      <div className="field">
        <label htmlFor="yt-id">ID do vídeo</label>
        <input id="yt-id" type="text" value={videoId} onChange={(e) => setVideoId(e.target.value.trim())} />
      </div>
      <div className="metro-controls" style={{ justifyContent: "flex-start", marginTop: 12 }}>
        <button className="btn primary" onClick={() => void load()}>
          Carregar
        </button>
        <button className="btn" onClick={() => player.current?.playVideo()}>
          Tocar
        </button>
        <button className="btn" onClick={() => player.current?.pauseVideo()}>
          Pausar
        </button>
        <span className="num muted" style={{ alignSelf: "center" }}>
          posição {pos == null ? "-" : `${pos.toFixed(2)} s`}
        </span>
      </div>
      <div className="yt-frame" ref={host} />
      <div className="log">{log.join("\n") || "Sem eventos ainda."}</div>
    </section>
  );
}

function SpotifyTest() {
  const [clientId, setClientId] = useState(() => localStorage.getItem("pratica.spotify.clientId") ?? "");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, add] = useLog();

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const r = await fn();
      add(`${label}: ${JSON.stringify(r).slice(0, 400)}`);
      return r;
    } catch (e) {
      add(`${label} falhou: ${String(e)}`);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    localStorage.setItem("pratica.spotify.clientId", clientId.trim());
    add("abrindo o navegador para o login...");
    const r = await run("login", () => spotify.login(clientId));
    if (r) setConnected(true);
  };

  return (
    <section className="panel">
      <h2>Spotify</h2>
      <ol className="muted" style={{ marginTop: 0, paddingLeft: 18 }}>
        <li>Crie um app em developer.spotify.com/dashboard, marcando Web API.</li>
        <li>
          Em Redirect URIs, cadastre <span className="num">http://127.0.0.1/callback</span> (sem porta: o app escolhe uma livre).
        </li>
        <li>Cole o Client ID aqui. Não precisa do Client Secret.</li>
      </ol>
      {!isNative && <p className="error-text small">Só funciona no app nativo.</p>}
      <div className="field">
        <label htmlFor="sp-id">Client ID</label>
        <input id="sp-id" type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} spellCheck={false} />
      </div>
      <div className="metro-controls" style={{ justifyContent: "flex-start", marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn primary" disabled={busy || !clientId.trim() || !isNative} onClick={() => void connect()}>
          {connected ? "Conectar de novo" : "Conectar"}
        </button>
        <button className="btn" disabled={busy || !connected} onClick={() => void run("tocando agora", () => spotify.request("GET", "/me/player"))}>
          O que está tocando
        </button>
        <button className="btn" disabled={busy || !connected} onClick={() => void run("pausar", () => spotify.request("PUT", "/me/player/pause"))}>
          Pausar
        </button>
        <button className="btn" disabled={busy || !connected} onClick={() => void run("continuar", () => spotify.request("PUT", "/me/player/play"))}>
          Continuar
        </button>
      </div>
      <p className="muted small">Deixe o app do Spotify aberto e tocando algo antes de testar o controle.</p>
      <div className="log">{log.join("\n") || "Sem eventos ainda."}</div>
    </section>
  );
}

export function Lab() {
  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Laboratório</h1>
        <span className="sub">Testes de integração da Fase 0</span>
      </header>
      <div className="panels two">
        <YouTubeTest />
        <SpotifyTest />
      </div>
    </div>
  );
}
