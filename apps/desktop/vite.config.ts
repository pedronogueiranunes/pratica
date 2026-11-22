import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { offlinePlugin } from "./build/offline-plugin";

// Porta fixa: o Tauri aponta para ela em src-tauri/tauri.conf.json.
export default defineConfig({
  plugins: [react(), offlinePlugin()],
  // Webapp no GitHub Pages fica em /pratica/; o app do Mac usa a raiz.
  base: process.env.VITE_BASE ?? "/",
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: "127.0.0.1" },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "safari17", outDir: "dist" },
});
