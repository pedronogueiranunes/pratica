import { useApp } from "../lib/app-state";
import { MetronomePanel } from "../components/MetronomePanel";
import { TunerPanel } from "../components/TunerPanel";
import { DrumPanel } from "../components/DrumPanel";

export function Tools() {
  const { t } = useApp();
  return (
    <div className="screen">
      <header className="screen-head">
        <h1>{t("nav.ferramentas")}</h1>
      </header>
      <div className="panels two">
        <MetronomePanel />
        <TunerPanel />
      </div>
      <DrumPanel />
    </div>
  );
}
