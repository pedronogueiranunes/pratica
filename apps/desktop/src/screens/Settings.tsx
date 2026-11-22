import type { Theme } from "@gx/core";
import { useApp } from "../lib/app-state";
import { suggestion, useDevices } from "../lib/devices";
import { usePractice } from "../lib/practice-state";
import { engine } from "../lib/engine";

const THEMES: Theme[] = ["sistema", "claro", "escuro"];

export function Settings() {
  const { t, settings, update } = useApp();
  const { sync } = usePractice();
  const { devices, instrument, playback, latency } = useDevices();
  const inputs = devices.filter((d) => d.isInput && d.inputChannels > 0);
  const outputs = devices.filter((d) => d.isOutput && d.outputChannels > 0);
  const inSuggest = suggestion(instrument, settings.tuner.inputDeviceId, devices, true);
  const outSuggest = suggestion(playback, settings.metronome.outputDeviceId, devices, false);
  const nameOf = (id: string) => devices.find((d) => d.id === id)?.name ?? id;
  const reason = (id: string, list: typeof instrument) => {
    const r = list.find((x) => x.deviceId === id);
    return r ? t(`devices.reason.${r.reason}`) : "";
  };
  const ms = (id: string, dir: "input" | "output", list: typeof instrument) => {
    const measured = latency[id]?.[dir];
    if (measured != null) return `${t("devices.latency", { ms: measured })} medido`;
    const est = list.find((x) => x.deviceId === id)?.estimatedMs;
    return est != null ? `cerca de ${t("devices.latency", { ms: Math.round(est) })}` : "";
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
            <button className="btn" onClick={() => void engine.refresh()}>
              Procurar de novo
            </button>
          </div>
          {inSuggest && (
            <div className="notice">
              <span>{t("devices.suggest", { name: nameOf(inSuggest.deviceId) })}</span>
              <span className="spacer" />
              <button className="btn primary" onClick={() => update({ tuner: { inputDeviceId: inSuggest.deviceId, inputChannel: 0 } })}>
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
          <div className="field">
            <label htmlFor="in">{t("devices.input")}</label>
            <select
              id="in"
              value={settings.tuner.inputDeviceId ?? ""}
              onChange={(e) => update({ tuner: { inputDeviceId: e.target.value || undefined, inputChannel: 0 } })}
            >
              <option value="">{t("devices.default")}</option>
              {inputs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <h3 className="phase-title" style={{ marginTop: 24 }}>Entradas, da melhor para a pior</h3>
          <div className="list">
            {instrument.length === 0 && <p className="muted">Nenhuma entrada encontrada.</p>}
            {instrument.map((r) => (
              <div className="row" key={r.deviceId}>
                <span className="title">{nameOf(r.deviceId)}</span>
                <span className="meta">
                  <span className="tag">{reason(r.deviceId, instrument)}</span>
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
                  <span className="tag">{reason(r.deviceId, playback)}</span>
                  <span>{ms(r.deviceId, "output", playback)}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            O app confere os dispositivos a cada 3 segundos. A latência medida aparece depois de usar o metrônomo ou o afinador.
          </p>
        </section>

        <section className="panel">
          <h2>Seus dados</h2>
          <p className="muted" role="status">{sync?.message ?? "Abrindo os dados locais…"}</p>
        </section>

        <section className="panel">
          <h2>Conexões</h2>
          <p className="muted" style={{ margin: 0 }}>
            Login com Spotify, YouTube, Jamendo e outros chega na Fase 3. Por enquanto, o teste do Spotify e do YouTube está no Laboratório.
          </p>
        </section>
      </div>
    </div>
  );
}
