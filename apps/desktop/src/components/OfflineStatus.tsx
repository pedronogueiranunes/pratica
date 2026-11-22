import { isNative } from "../lib/engine";
import { activateOfflineUpdate, requestPersistence, useOffline } from "../lib/offline";
export function OfflineStatus() {
  const state = useOffline();
  if (isNative) return null;
  return <div className="offline-status">
    <p className="small" role="status">{state.ready ? "App preparado para abrir offline neste navegador." : "Offline ainda não preparado. Requer a versão web compilada, HTTPS e uma primeira abertura com internet."}</p>
    <p className="small">{state.persistence === "granted" ? "Armazenamento persistente concedido." : state.persistence === "notGranted" ? "Os dados ainda estão sujeitos à limpeza automática do navegador." : state.persistence === "checking" ? "Conferindo armazenamento…" : "O navegador não informa suporte à persistência."}</p>
    {state.persistence === "notGranted" && <button className="btn" disabled={state.busy} onClick={() => void requestPersistence()}>{state.busy ? "Solicitando…" : "Pedir armazenamento persistente"}</button>}
    {state.update && <div className="offline-update"><p>Há uma atualização pronta. Salve suas edições e feche as outras abas do Prática antes de recarregar.</p><button className="btn" onClick={activateOfflineUpdate}>Atualizar e recarregar</button></div>}
    <p className="muted small">No Safari, sites não instalados podem perder dados após períodos sem uso. Adicionar à Tela de Início ou ao Dock ajuda; exporte o JSON como cópia. Limpar os dados do site também apaga o repertório local. Links e vídeos externos precisam de internet.</p>
    {state.error && <p className="error-text small" role="alert">{state.error}</p>}
  </div>;
}
