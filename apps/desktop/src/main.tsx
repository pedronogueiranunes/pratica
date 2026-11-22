import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/silkscreen/400.css";
import "./styles.css";
import { AppStateProvider } from "./lib/app-state";
import { MetronomeProvider } from "./lib/metronome";
import { PracticeProvider } from "./lib/practice-state";
import { App } from "./App";
import { TunerProvider } from "./lib/tuner";
import { initOffline } from "./lib/offline";
import { SongsProvider } from "./lib/songs-state";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppStateProvider>
      <PracticeProvider>
      <MetronomeProvider>
        <TunerProvider><SongsProvider><App /></SongsProvider></TunerProvider>
      </MetronomeProvider>
      </PracticeProvider>
    </AppStateProvider>
  </StrictMode>,
);

void initOffline();
