// Mesma regra de crates/audio-engine/src/latency.rs, para o webapp.
import type { Connection, DeviceInfo, Recommendation } from "./audio";

const EXTRA: Partial<Record<Connection, number>> = {
  bluetooth: 150, network: 40, hdmi: 20, displayPort: 20, virtual: 5, aggregate: 5,
};
const INTERFACE: Connection[] = ["usb", "thunderbolt", "pci", "fireWire"];

export function estimatedMs(d: DeviceInfo, input: boolean): number {
  const measured = input ? d.measuredInputMs : d.measuredOutputMs;
  if (measured != null) return measured;
  const sr = d.sampleRate ?? 48000;
  return ((d.bufferMin ?? 512) / sr) * 1000 + (EXTRA[d.connection] ?? 0);
}

export function rankDevices(devices: DeviceInfo[], purpose: "instrument" | "playback"): Recommendation[] {
  const input = purpose === "instrument";
  const c = devices.filter((d) => (input ? d.isInput && d.inputChannels > 0 : d.isOutput && d.outputChannels > 0));
  return c
    .map((d) => {
      const ms = estimatedMs(d, input);
      let score = 100 - ms;
      const iface = INTERFACE.includes(d.connection);
      if (input && iface) score += 25;
      if (d.connection === "bluetooth") score -= 60;
      if (d.connection === "virtual" || d.connection === "aggregate") score -= 10;
      const reason: Recommendation["reason"] =
        d.connection === "bluetooth" ? "bluetoothWarning" : c.length === 1 ? "onlyOption" : input && iface ? "audioInterface" : "lowestLatency";
      return { deviceId: d.id, score, estimatedMs: ms, reason };
    })
    .sort((a, b) => b.score - a.score);
}

/** Palpite do tipo de conexão pelo nome (o navegador não informa). */
export function guessConnection(label: string): Connection {
  const l = label.toLowerCase();
  if (/airpods|bluetooth|beats|bose|sony wh|jbl/.test(l)) return "bluetooth";
  if (/usb|focusrite|scarlett|audient|motu|presonus|behringer|irig|line ?6|zoom|steinberg|ssl|universal audio|apollo|volt/.test(l)) return "usb";
  if (/macbook|built-in|interno|internal|imac|alto-falante|microfone/.test(l)) return "builtIn";
  if (/hdmi|display|monitor|lg|dell/.test(l)) return "hdmi";
  if (/blackhole|loopback|soundflower|aggregate|agregado|virtual|teams|zoom audio/.test(l)) return "virtual";
  return "unknown";
}
