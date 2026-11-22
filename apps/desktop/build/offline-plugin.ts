import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

/** Só build:web. O app nativo continua sem service worker. */
export function offlinePlugin(): Plugin {
  return {
    name: "pratica-offline", apply: "build", enforce: "post",
    generateBundle(_options, bundle) {
      if (process.env.VITE_BASE !== "/pratica/") return;
      const files = Object.keys(bundle).filter((name) => !name.endsWith(".map")).sort();
      const hash = createHash("sha256");
      for (const name of files) {
        const asset = bundle[name]!;
        hash.update(name).update(asset.type === "chunk" ? asset.code : asset.source);
      }
      const code = readFileSync(new URL("../src/service-worker.js", import.meta.url), "utf8")
        .replace("__CACHE_VERSION__", hash.digest("hex").slice(0, 16))
        .replace("__PRECACHE__", JSON.stringify(files.map((file) => `/pratica/${file}`)));
      this.emitFile({ type: "asset", fileName: "sw.js", source: code });
    },
  };
}
