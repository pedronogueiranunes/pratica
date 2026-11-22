// Lista de dispositivos, latência medida e recomendação do melhor para cada uso.

import { useEffect, useState } from "react";
import type { DeviceInfo, Recommendation } from "@gx/core";
import { engine, onEngine } from "./engine";
import { useApp } from "./app-state";

export interface DevicesState {
  devices: DeviceInfo[];
  instrument: Recommendation[];
  playback: Recommendation[];
  latency: Record<string, { input?: number; output?: number }>;
}

export function useDevices(): DevicesState {
  const { settings } = useApp();
  const profiles = settings.tuner.inputProfiles;
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [latency, setLatency] = useState<DevicesState["latency"]>({});
  const [instrument, setInstrument] = useState<Recommendation[]>([]);
  const [playback, setPlayback] = useState<Recommendation[]>([]);

  useEffect(() => {
    let active = true;
    void engine.devices().then((items) => { if (active) setDevices(items); }).catch(() => {});
    const off = onEngine((e) => {
      if (e.type === "devices") setDevices(e.devices);
      if (e.type === "latency") {
        setLatency((prev) => ({
          ...prev,
          [e.deviceId]: { ...prev[e.deviceId], [e.direction]: Math.round(e.ms * 10) / 10 },
        }));
      }
    });
    return () => { active = false; off(); };
  }, []);

  useEffect(() => {
    // A latência medida entra na conta da recomendação.
    const withMeasured = devices.map((d) => ({
      ...d,
      measuredInputMs: latency[d.id]?.input ?? d.measuredInputMs ?? profiles.find((p) => p.deviceId === d.id)?.inputMs ?? null,
      measuredOutputMs: latency[d.id]?.output ?? d.measuredOutputMs,
    }));
    let active = true;
    void engine.rank(withMeasured, "instrument").then((items) => { if (active) setInstrument(items); }).catch(() => {});
    void engine.rank(withMeasured, "playback").then((items) => { if (active) setPlayback(items); }).catch(() => {});
    return () => { active = false; };
  }, [devices, latency, profiles]);

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
