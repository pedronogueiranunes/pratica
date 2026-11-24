import { inputChannelOptions, outputChannelOptions, type Theme } from "@gx/core";
import { useApp } from "../lib/app-state";
import { suggestion, useDevices } from "../lib/devices";
import { usePractice } from "../lib/practice-state";
import { engine, isNative } from "../lib/engine";

import { OfflineStatus } from "../components/OfflineStatus";

const THEMES: Theme[] = ["sistema", "claro", "escuro"];

export function Settings() {
  const { t, settings, update } = useApp();
  const { sync } = usePractice();
  const { devices, instrument, playback, latency, measuring, measureResult, measure } = useDevices();
  const inputs = devices.filter((d) => d.isInput && d.inputChannels > 0);
  const outputs = devices.filter((d) => d.isOutput && d.outputChannels > 0);
  const inSuggest = suggestion(instrument, settings.tuner.inputDeviceId, devices, true);
  const outSuggest = suggestion(playback, settings.metronome.outputDeviceId, devices, false);
  const outId = settings.metronome.outputDeviceId, inId = settings.tuner.inputDeviceId;
  const outChannels = settings.metronome.outputChannels ?? {};
  const outOptions = outputChannelOptions(devices.find((d) => d.id === outId)?.outputChannels ?? 0);
  const outChannel = outId ? outChannels[outId] ?? 0 : 0;
  const inOptions = inputChannelOptions(devices.find((d) => d.id === inId)?.inputChannels ?? 0);
  const inChannel = settings.tuner.inputChannel;
  const nameOf = (id: string) => devices.find((d) => d.id === id)?.name ?? id;
  // O selo só aparece onde diz algo: o melhor da lista e avisos de Bluetooth.
  const reason = (id: string, list: typeof instrument) => {
    const index = list.findIndex((x) => x.deviceId === id);
    const r = list[index];
    if (!r) return "";
    if (r.reason === "bluetoothWarning") return t("devices.reason.bluetoothWarning");
    if (index !== 0 || list.length < 2) return r.reason === "onlyOption" ? t("devices.reason.onlyOption") : "";
    const measuredBest = latency[id]?.[list === instrument ? "input" : "output"] != null;
    return r.reason === "audioInterface" ? t("devices.reason.audioInterface") : measuredBest ? t("devices.reason.lowestLatency") : "";
  };
  const ms = (id: string, dir: "input" | "output", list: typeof instrument) => {
    const measured = latency[id]?.[dir];
    if (measured != null) return `${t("devices.latency", { ms: measured })} no stream`;
    const profile = dir === "input" ? settings.tuner.inputProfiles.find((p) => p.deviceId === id) : null;
    if (profile?.inputMs != null) return `${t("devices.latency", { ms: profile.inputMs.toFixed(1) })} no perfil salvo`;
    // Sem medida, a estimativa vem do menor buffer possível e quase sempre dá ~0 ms. Não mostrar um número falso.
    const est = list.find((x) => x.deviceId === id)?.estimatedMs;
    return est != null && est >= 5 ? `cerca de ${t("devices.latency", { ms: Math.round(est) })}` : "sem medida";
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>{t("nav.ajustes")}</h1>
      </header>
      <div className="panels two">
        <section className="panel">
          <h2>Aparência</h2>
          <div className="field">
            <span className="label">Tema</span>
            <div className="seg" role="group">
              {THEMES.map((th) => (
                <button key={th} aria-pressed={settings.theme === th} onClick={() => update({ theme: th })}>
                  {t(`theme.${th}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">Idioma</span>
            <div className="seg" role="group">
              <button aria-pressed={settings.locale === "pt-BR"} onClick={() => update({ locale: "pt-BR" })}>
                Português
              </button>
              <button aria-pressed={settings.locale === "en"} onClick={() => update({ locale: "en" })}>
                English
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Áudio</h2>
            <span className="spacer" />
            {isNative && <button className="btn" disabled={measuring} onClick={measure}>{measuring ? "Medindo…" : "Medir atraso"}</button>}
            <button className="btn" onClick={() => void engine.refresh()}>
              Procurar de novo
            </button>
          </div>
          {inSuggest && (
            <div className="notice">
              <span>{t("devices.suggest", { name: nameOf(inSuggest.deviceId) })}</span>
              <span className="spacer" />
              <button className="btn primary" onClick={() => update({ tuner: { inputDeviceId: inSuggest.deviceId, inputChannel: settings.tuner.inputProfiles.find((p) => p.deviceId === inSuggest.deviceId)?.channel ?? 0 } })}>
                Usar
              </button>
            </div>
          )}
          {outSuggest && (
            <div className="notice">
              <span>{t("devices.suggest", { name: nameOf(outSuggest.deviceId) })}</span>
              <span className="spacer" />
              <button className="btn primary" onClick={() => update({ metronome: { outputDeviceId: outSuggest.deviceId } })}>
                Usar
              </button>
            </div>
          )}
          <div className="field">
            <label htmlFor="out">{t("devices.output")}</label>
            <select
              id="out"
              value={settings.metronome.outputDeviceId ?? ""}
              onChange={(e) => update({ metronome: { outputDeviceId: e.target.value || undefined } })}
            >
              <option value="">{t("devices.default")}</option>
              {outputs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {outId && (outOptions.length > 0 || outChannel > 0) && <div className="field">
            <label htmlFor="out-ch">Canal de saída</label>
            <select id="out-ch" value={outChannel} onChange={(e) => update({ metronome: { outputChannels: { ...outChannels, [outId]: Number(e.target.value) } } })}>
              {outChannel > 0 && !outOptions.some((o) => o.value === outChannel) && <option value={outChannel}>Só {outChannel} (indisponível)</option>}
              {outOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>}
          <div className="field">
            <label htmlFor="in">{t("devices.input")}</label>
            <select
              id="in"
              value={settings.tuner.inputDeviceId ?? ""}
              onChange={(e) => update({ tuner: { inputDeviceId: e.target.value || undefined, inputChannel: settings.tuner.inputProfiles.find((p) => p.deviceId === e.target.value)?.channel ?? 0 } })}
            >
              <option value="">{t("devices.default")}</option>
              {inputs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {inId && (inOptions.length > 0 || inChannel > 0) && <div className="field">
            <label htmlFor="in-ch">Canal de entrada</label>
            <select id="in-ch" value={inChannel} onChange={(e) => { const channel = Number(e.target.value); const profiles = settings.tuner.inputProfiles; update({ tuner: { inputChannel: channel, ...(profiles.some((p) => p.deviceId === inId) ? { inputProfiles: profiles.map((p) => p.deviceId === inId ? { ...p, channel } : p) } : {}) } }); }}>
              {inChannel > 0 && !inOptions.some((o) => o.value === inChannel) && <option value={inChannel}>Entrada {inChannel + 1} (indisponível)</option>}
              {inOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>}

          {measuring && <p className="muted small" role="status">Abrindo cada entrada e saída por um instante, em silêncio. Leva alguns segundos.</p>}
          {measureResult && !measuring && <p className={`small ${measureResult.busy ? "error-text" : "muted"}`} role="status">
            {measureResult.busy ? "Pare o metrônomo, o afinador e a prévia de acordes. Aguarde dois segundos e tente medir." : measureResult.measured ? `${measureResult.measured} medições feitas agora.` : "Nenhum dispositivo respondeu."}
            {measureResult.failed.length > 0 && ` Sem resposta: ${measureResult.failed.join(", ")}.`}
          </p>}
          <h3 className="phase-title" style={{ marginTop: 24 }}>Entradas, da melhor para a pior</h3>
          <div className="list">
            {instrument.length === 0 && <p className="muted">Nenhuma entrada encontrada.</p>}
            {instrument.map((r) => (
              <div className="row" key={r.deviceId}>
                <span className="title">{nameOf(r.deviceId)}</span>
                <span className="meta">
                  {reason(r.deviceId, instrument) && <span className="tag">{reason(r.deviceId, instrument)}</span>}
                  <span>{ms(r.deviceId, "input", instrument)}</span>
                </span>
              </div>
            ))}
          </div>
          <h3 className="phase-title">Saídas</h3>
          <div className="list">
            {playback.map((r) => (
              <div className="row" key={r.deviceId}>
                <span className="title">{nameOf(r.deviceId)}</span>
                <span className="meta">
                  {reason(r.deviceId, playback) && <span className="tag">{reason(r.deviceId, playback)}</span>}
                  <span>{ms(r.deviceId, "output", playback)}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            {isNative ? "Medir atraso abre cada dispositivo por um instante e guarda o resultado neste Mac. O número vem dos horários que o macOS informa para o áudio; não inclui o caminho do som pelo ar nem o cabo. Medidas podem mudar ao reconectar." : "No navegador, o atraso aparece depois de usar o metrônomo ou o afinador com cada dispositivo."}
          </p>
        </section>

        <section className="panel">
          <h2>Seus dados</h2>
          <p className="muted" role="status">{sync?.message ?? "Abrindo os dados locais…"}</p>
          <OfflineStatus />
        </section>

        <section className="panel">
          <h2>Conexões</h2>
          <p className="muted" style={{ margin: 0 }}>
            Login e importação de playlists do Spotify e YouTube ficam para a Fase 4. Por enquanto, o teste do Spotify e do YouTube está no Laboratório.
          </p>
        </section>
      </div>
    </div>
  );
}
