// Lista de dispositivos, latência medida e recomendação do melhor para cada uso.

import { useEffect, useState } from "react";
import type { DeviceInfo, Recommendation } from "@gx/core";
import { engine, onEngine } from "./engine";

export interface DevicesState {
  devices: DeviceInfo[];
  instrument: Recommendation[];
  playback: Recommendation[];
  latency: Record<string, { input?: number; output?: number }>;
}

export function useDevices(): DevicesState {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [latency, setLatency] = useState<DevicesState["latency"]>({});
  const [instrument, setInstrument] = useState<Recommendation[]>([]);
  const [playback, setPlayback] = useState<Recommendation[]>([]);

  useEffect(() => {
    void engine.devices().then(setDevices);
    return onEngine((e) => {
      if (e.type === "devices") setDevices(e.devices);
      if (e.type === "latency") {
        setLatency((prev) => ({
          ...prev,
          [e.deviceId]: { ...prev[e.deviceId], [e.direction]: Math.round(e.ms * 10) / 10 },
        }));
      }
    });
  }, []);

  useEffect(() => {
    // A latência medida entra na conta da recomendação.
    const withMeasured = devices.map((d) => ({
      ...d,
      measuredInputMs: latency[d.id]?.input ?? d.measuredInputMs,
      measuredOutputMs: latency[d.id]?.output ?? d.measuredOutputMs,
    }));
    void engine.rank(withMeasured, "instrument").then(setInstrument);
    void engine.rank(withMeasured, "playback").then(setPlayback);
  }, [devices, latency]);

  return { devices, instrument, playback, latency };
}

/** Mesma regra do Rust (latency::should_suggest_switch). */
export function suggestion(ranked: Recommendation[], currentId: string | undefined, devices: DeviceInfo[], input: boolean) {
  const best = ranked[0];
  if (!best) return null;
  const effective =
    currentId ?? devices.find((d) => (input ? d.isDefaultInput : d.isDefaultOutput))?.id;
  const current = ranked.find((r) => r.deviceId === effective);
  if (!current || current.deviceId === best.deviceId) return null;
  if (best.score - current.score >= 10 || current.reason === "bluetoothWarning") return best;
  return null;
}
