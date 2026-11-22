import { useRef, useState } from "react";
import { MAX_PACKAGE_BYTES, downloadName, packageSummary, readMusicPackage, type MusicPackage } from "@gx/core";
import { useSongs } from "../lib/songs-state";
import { downloadText } from "../lib/download";

export function MusicTransfer() {
  const s = useSongs();
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [pack, setPack] = useState<MusicPackage | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summary = pack ? packageSummary(pack) : null;
  const read = async (file: File) => {
    setError(null); setMessage(null); setPack(null);
    try {
      if (file.size > MAX_PACKAGE_BYTES) throw new Error("O limite é 25 MB.");
      setPack(readMusicPackage(await file.text())); setFileName(file.name);
    } catch (e) { setError(String(e)); }
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setMessage(null);
    try { await action(); } catch (e) { setError(String(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <details className="music-transfer">
    <summary>Levar repertório para outro aparelho</summary>
    <p className="muted small">O JSON leva músicas, playlists, exclusões e histórico de cifras. Não inclui seus ajustes ou registros de prática.</p>
    <div className="actions">
      <button className="btn" disabled={!s.ready || busy} onClick={() => void run(async () => {
        const data = await s.exportMusic();
        const text = JSON.stringify(data, null, 2);
        if (new TextEncoder().encode(text).length > MAX_PACKAGE_BYTES) throw new Error("O repertório ultrapassa o limite de 25 MB.");
        downloadText(downloadName("pratica-repertorio", "json"), text, "application/json;charset=utf-8"); setMessage("Download do repertório solicitado.");
      })}>Exportar JSON</button>
      <button className="btn" disabled={!s.ready || busy} onClick={() => input.current?.click()}>Importar JSON</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void read(file); e.target.value = ""; }} />
    </div>
    {pack && summary && <div className="transfer-preview">
      <p>{fileName}: {summary.songs} músicas, {summary.playlists} playlists e {summary.revisions} revisões.</p>
      <p className="muted small">A importação combina os históricos. Metadados e playlists seguem a última gravação; cifras concorrentes ficam visíveis para comparar. {summary.deletions > 0 && `Inclui ${summary.deletions} eventos de exclusão.`} {summary.deferred > 0 && `${summary.deferred} eventos de tipos futuros serão guardados para uma versão compatível.`}</p>
      <div className="actions"><button className="btn ghost" disabled={busy} onClick={() => setPack(null)}>Cancelar</button><button className="btn primary" disabled={busy} onClick={() => void run(async () => { await s.importMusic(pack); setPack(null); setMessage("Repertório importado. Confira as músicas e os conflitos de cifra."); })}>{busy ? "Importando…" : "Confirmar importação"}</button></div>
    </div>}
    {message && <p role="status" className="small">{message}</p>}
    {error && <p role="alert" className="error-text small">Não deu para transferir o repertório. {error}</p>}
  </details>;
}
