//! Leitura idempotente de JSONL e publicação atômica do arquivo deste dispositivo.
use crate::{Store, StoreResult};
use serde_json::{json, Value};
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::Path,
};

#[derive(Default, Debug)]
pub struct SyncReport {
    pub imported: usize,
    pub warnings: Vec<String>,
}

pub fn sync_folder(store: &mut Store, folder: &Path, device: &str) -> StoreResult<SyncReport> {
    if device.is_empty()
        || !device
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
    {
        return Err("Identidade de dispositivo inválida".into());
    }
    fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    let mut report = SyncReport::default();
    let mut own_file_invalid = false;
    // Inclui cópias de conflito do iCloud: IDs repetidos são ignorados pelo banco.
    for entry in fs::read_dir(folder).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|s| s.to_str()) != Some("jsonl") || !path.is_file() {
            continue;
        }
        let own_file =
            path.file_name().and_then(|s| s.to_str()) == Some(&format!("{device}.jsonl"));
        let mut content = String::new();
        if let Err(error) = fs::File::open(&path).and_then(|mut f| f.read_to_string(&mut content)) {
            own_file_invalid |= own_file;
            report.warnings.push(format!(
                "Não foi possível ler {}: {error}.",
                path.file_name().unwrap().to_string_lossy()
            ));
            continue;
        }
        for (i, line) in content.split_inclusive('\n').enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            if !line.ends_with('\n') {
                own_file_invalid |= own_file;
                report.warnings.push(format!(
                    "{}: última linha incompleta; será lida na próxima sincronização.",
                    path.file_name().unwrap().to_string_lossy()
                ));
                continue;
            }
            let event: Value = match serde_json::from_str(line) {
                Ok(v) => v,
                Err(_) => {
                    own_file_invalid |= own_file;
                    report.warnings.push(format!(
                        "{}: linha {} inválida.",
                        path.file_name().unwrap().to_string_lossy(),
                        i + 1
                    ));
                    continue;
                }
            };
            let before: i64 = store
                .connection
                .query_row(
                    "SELECT COUNT(*) FROM events WHERE id=?1",
                    [event["id"].as_str().unwrap_or("")],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
            if let Err(error) = store.request("apply", &json!({"events":[event]})) {
                own_file_invalid |= own_file;
                report.warnings.push(format!(
                    "{}: linha {}: {error}",
                    path.file_name().unwrap().to_string_lossy(),
                    i + 1
                ));
                continue;
            }
            if before == 0 {
                report.imported += 1;
            }
        }
    }
    if own_file_invalid {
        return Err("O arquivo deste dispositivo está incompleto ou contém eventos incompatíveis. Aguardando uma cópia íntegra do iCloud".into());
    }
    // Snapshot do log imutável: cada evento mantém ID e conteúdo. Renomear só
    // depois de fsync evita publicar uma linha cortada após queda de energia.
    let events = store.request("events", &json!({}))?;
    let relayed: std::collections::HashSet<String> = {
        let mut stmt = store.connection.prepare("SELECT key FROM local_meta WHERE key LIKE 'musicRelay:%'").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?.into_iter().filter_map(|key| key.strip_prefix("musicRelay:").map(str::to_string)).collect()
    };
    let own: Vec<&Value> = events
        .as_array()
        .unwrap()
        .iter()
        .filter(|e| e["deviceId"] == device || e["id"].as_str().is_some_and(|id| relayed.contains(id)))
        .collect();
    let path = folder.join(format!("{device}.jsonl"));
    let mut content = Vec::new();
    for event in &own {
        serde_json::to_writer(&mut content, event).map_err(|e| e.to_string())?;
        content.push(b'\n');
    }
    let unchanged = fs::read(&path).is_ok_and(|old| old == content);
    if !unchanged {
        let temp = folder.join(format!(".{device}-{}.tmp", std::process::id()));
        let publish = (|| -> StoreResult<()> {
            let mut file = OpenOptions::new()
                .create(true)
                .truncate(true)
                .write(true)
                .open(&temp)
                .map_err(|e| e.to_string())?;
            file.write_all(&content).map_err(|e| e.to_string())?;
            file.sync_all().map_err(|e| e.to_string())?;
            fs::rename(&temp, &path).map_err(|e| e.to_string())?;
            fs::File::open(folder)
                .and_then(|f| f.sync_all())
                .map_err(|e| e.to_string())?;
            Ok(())
        })();
        if publish.is_err() {
            let _ = fs::remove_file(temp);
        }
        publish?;
    }
    // Após a publicação, qualquer interrupção só causa reexportação idempotente.
    for event in events.as_array().unwrap() {
        store.request("ack", &json!({"id":event["id"]}))?;
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn event(id: &str, device: &str) -> Value {
        json!({"version":1,"id":id,"deviceId":device,"at":"2026-11-20T12:00:00Z","type":"practice.added","data":{"id":id,"exerciseId":"f1-spider","at":"2026-11-20T12:00:00Z","bpm":60}})
    }
    #[test]
    fn pacote_web_chega_ao_outro_mac_sem_mudar_a_autoria() {
        let root = std::env::temp_dir().join(format!("pratica-relay-{}", std::process::id()));
        let cloud = root.join("cloud");
        let db = root.join("a.sqlite3");
        fs::create_dir_all(&root).unwrap();
        let incoming = json!({"version":1,"id":"web-song","deviceId":"browser","at":"2026-11-22T12:00:00Z","type":"song.saved","data":{"id":"song","title":"Texto neutro","links":[],"tracks":[],"tags":[]}});
        {
            let mut a = Store::open(&db).unwrap();
            a.request("apply", &json!({"events":[incoming.clone()],"relayMusic":true})).unwrap();
            assert!(a.request("apply", &json!({"events":[event("not-music","browser")],"relayMusic":true})).is_err());
        }
        let mut a = Store::open(&db).unwrap();
        sync_folder(&mut a, &cloud, "a").unwrap();
        assert!(!cloud.join("browser.jsonl").exists());
        let published = fs::read_to_string(cloud.join("a.jsonl")).unwrap();
        assert_eq!(serde_json::from_str::<Value>(published.trim()).unwrap(), incoming);
        let mut b = Store::open(":memory:").unwrap();
        assert_eq!(sync_folder(&mut b, &cloud, "b").unwrap().imported, 1);
        assert_eq!(b.request("listSongs", &json!({})).unwrap()[0]["title"], "Texto neutro");
        assert_eq!(sync_folder(&mut a, &cloud, "a").unwrap().imported, 0);
        assert_eq!(fs::read_to_string(cloud.join("a.jsonl")).unwrap(), published);
        drop(a); drop(b);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn evento_de_tipo_futuro_nao_trava_a_sincronizacao() {
        let folder = std::env::temp_dir().join(format!("pratica-sync-futuro-{}", std::process::id()));
        fs::create_dir_all(&folder).unwrap();
        let futuro = json!({"version":1,"id":"n1","deviceId":"novo","at":"2026-11-21T12:00:00Z","type":"exemplo.futuro","data":{"id":"x1"}});
        fs::write(folder.join("novo.jsonl"), format!("{}\n{}\n", futuro, event("n2", "novo"))).unwrap();
        let mut a = Store::open(":memory:").unwrap();
        let report = sync_folder(&mut a, &folder, "a").unwrap();
        assert_eq!(report.imported, 2);
        assert!(report.warnings.is_empty(), "{:?}", report.warnings);
        assert_eq!(a.request("countByExercise", &json!({})).unwrap()["f1-spider"], 1);
        let guardado: i64 = a.connection.query_row("SELECT COUNT(*) FROM deferred_events WHERE event_id='n1'", [], |r| r.get(0)).unwrap();
        assert_eq!(guardado, 1);
        // Ler de novo não duplica nem reclama.
        assert_eq!(sync_folder(&mut a, &folder, "a").unwrap().imported, 0);
        fs::remove_dir_all(folder).unwrap();
    }
    #[test]
    fn funde_dois_dispositivos_recupera_arquivo_e_ignora_cauda_incompleta() {
        let folder = std::env::temp_dir().join(format!("pratica-sync-{}", std::process::id()));
        fs::create_dir_all(&folder).unwrap();
        let mut a = Store::open(":memory:").unwrap();
        let mut b = Store::open(":memory:").unwrap();
        a.request("apply", &json!({"events":[event("a1","a")]}))
            .unwrap();
        sync_folder(&mut a, &folder, "a").unwrap();
        b.request("apply", &json!({"events":[event("b1","b")]}))
            .unwrap();
        assert_eq!(sync_folder(&mut b, &folder, "b").unwrap().imported, 1);
        assert_eq!(sync_folder(&mut a, &folder, "a").unwrap().imported, 1);
        fs::copy(folder.join("b.jsonl"), folder.join("b (conflict).jsonl")).unwrap();
        fs::write(
            folder.join("partial.jsonl"),
            format!("{}\n{{\"version\":", event("c1", "c")),
        )
        .unwrap();
        let report = sync_folder(&mut a, &folder, "a").unwrap();
        assert_eq!(report.imported, 1);
        assert!(!report.warnings.is_empty());
        assert_eq!(
            a.request("countByExercise", &json!({})).unwrap()["f1-spider"],
            3
        );
        // A linha cortada chega completa na próxima leitura do iCloud.
        fs::write(
            folder.join("partial.jsonl"),
            format!("{}\n{}\n", event("c1", "c"), event("c2", "c")),
        )
        .unwrap();
        assert_eq!(sync_folder(&mut a, &folder, "a").unwrap().imported, 1);
        assert_eq!(sync_folder(&mut a, &folder, "a").unwrap().imported, 0);
        assert_eq!(
            a.request("countByExercise", &json!({})).unwrap()["f1-spider"],
            4
        );
        fs::write(folder.join("a.jsonl"), "{broken").unwrap();
        assert!(sync_folder(&mut a, &folder, "a").is_err());
        assert_eq!(
            fs::read_to_string(folder.join("a.jsonl")).unwrap(),
            "{broken"
        );
        fs::write(folder.join("a.jsonl"), format!("{}\n", event("a1", "a"))).unwrap();
        sync_folder(&mut a, &folder, "a").unwrap();
        fs::remove_dir_all(folder).unwrap();
    }
    #[test]
    fn falha_de_exportacao_preserva_fila_e_registro() {
        let file = std::env::temp_dir().join(format!("pratica-sync-file-{}", std::process::id()));
        fs::write(&file, "não é pasta").unwrap();
        let mut store = Store::open(":memory:").unwrap();
        store
            .request("apply", &json!({"events":[event("a1","a")]}))
            .unwrap();
        assert!(sync_folder(&mut store, &file, "a").is_err());
        assert_eq!(
            store
                .request("pending", &json!({"deviceId":"a"}))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
        fs::remove_file(file).unwrap();
    }
    #[test]
    fn retoma_exportacao_pendente_depois_de_reabrir_o_banco() {
        let root = std::env::temp_dir().join(format!("pratica-restart-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let database = root.join("state.sqlite3");
        let cloud = root.join("events");
        fs::write(&cloud, "falha de acesso simulada").unwrap();
        {
            let mut store = Store::open(&database).unwrap();
            store
                .request("apply", &json!({"events":[event("a1", "a")]}))
                .unwrap();
            assert!(sync_folder(&mut store, &cloud, "a").is_err());
        }
        {
            let mut store = Store::open(&database).unwrap();
            assert_eq!(
                store
                    .request("pending", &json!({"deviceId":"a"}))
                    .unwrap()
                    .as_array()
                    .unwrap()
                    .len(),
                1
            );
            fs::remove_file(&cloud).unwrap();
            sync_folder(&mut store, &cloud, "a").unwrap();
            assert_eq!(
                store.request("pending", &json!({"deviceId":"a"})).unwrap(),
                json!([])
            );
            assert_eq!(
                fs::read_to_string(cloud.join("a.jsonl"))
                    .unwrap()
                    .lines()
                    .count(),
                1
            );
        }
        {
            let mut store = Store::open(&database).unwrap();
            assert_eq!(sync_folder(&mut store, &cloud, "a").unwrap().imported, 0);
            assert_eq!(
                store.request("countByExercise", &json!({})).unwrap()["f1-spider"],
                1
            );
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn funde_ajustes_e_rotinas_com_eventos_antigos_e_copias_de_conflito() {
        let folder =
            std::env::temp_dir().join(format!("pratica-settings-sync-{}", std::process::id()));
        let mut a = Store::open(":memory:").unwrap();
        let mut b = Store::open(":memory:").unwrap();
        let changes = |id: &str, device: &str, at: &str, theme: &str| json!({"version":1,"id":id,"deviceId":device,"at":at,"type":"settings.changed","data":[{"key":"theme","value":theme}]});
        let routine = |id: &str, device: &str, at: &str, name: &str| json!({"version":1,"id":id,"deviceId":device,"at":at,"type":"routine.saved","data":{"id":"personal","name":name,"blocks":[{"kind":"aquecimento","minutes":5,"exerciseId":"f1-spider"}]}});
        let old_at = "2026-11-20T10:00:00Z";
        let new_at = "2026-11-20T12:00:00Z";
        a.request("apply", &json!({"events":[changes("settings-a", "a", old_at, "claro"), routine("routine-a", "a", old_at, "Anterior")]})).unwrap();
        b.request("apply", &json!({"events":[changes("settings-b", "b", new_at, "escuro"), routine("routine-b", "b", new_at, "Atual")]})).unwrap();
        sync_folder(&mut a, &folder, "a").unwrap();
        sync_folder(&mut b, &folder, "b").unwrap();
        fs::copy(folder.join("b.jsonl"), folder.join("b (conflict).jsonl")).unwrap();
        sync_folder(&mut a, &folder, "a").unwrap();
        sync_folder(&mut b, &folder, "b").unwrap();
        for store in [&mut a, &mut b] {
            let settings = store.request("getSettings", &json!({})).unwrap();
            let theme = settings
                .as_array()
                .unwrap()
                .iter()
                .find(|row| row["key"] == "theme")
                .unwrap();
            assert_eq!(theme["value"], "escuro");
            assert_eq!(
                store
                    .request("getRoutine", &json!({"id":"personal"}))
                    .unwrap()["name"],
                "Atual"
            );
            assert_eq!(
                store
                    .request("events", &json!({}))
                    .unwrap()
                    .as_array()
                    .unwrap()
                    .len(),
                4
            );
        }
        fs::remove_dir_all(folder).unwrap();
    }
}
