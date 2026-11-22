//! Persistência local, sem áudio nem dependência de WebView.
use chrono::DateTime;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::path::Path;

pub type StoreResult<T> = Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn string<'a>(v: &'a Value, key: &str) -> StoreResult<&'a str> {
    v.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("Campo inválido: {key}"))
}
fn ms(s: &str) -> StoreResult<i64> {
    DateTime::parse_from_rfc3339(s)
        .map(|t| t.timestamp_millis())
        .map_err(err)
}
fn serialize(v: &Value) -> StoreResult<String> {
    serde_json::to_string(v).map_err(err)
}
fn parse(s: String) -> StoreResult<Value> {
    serde_json::from_str(&s).map_err(err)
}

pub struct Store {
    pub connection: Connection,
}
impl Store {
    pub fn open(path: impl AsRef<Path>) -> StoreResult<Self> {
        let connection = Connection::open(path).map_err(err)?;
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .map_err(err)?;
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(err)?;
        if version > 2 {
            return Err("Este banco foi criado por uma versão mais nova do Prática.".into());
        }
        let store = Self { connection };
        store
            .connection
            .execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;")
            .map_err(err)?;
        if version == 0 {
            store.connection.execute_batch("BEGIN IMMEDIATE;
          CREATE TABLE IF NOT EXISTS practice_logs (
            id TEXT PRIMARY KEY, exercise_id TEXT NOT NULL, at_ms INTEGER NOT NULL,
            bpm REAL, count REAL, seconds REAL, duration_seconds REAL, note TEXT, device_id TEXT,
            metric_json TEXT, value_json TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS logs_at ON practice_logs(at_ms);
          CREATE INDEX IF NOT EXISTS logs_exercise_at ON practice_logs(exercise_id,at_ms);
          CREATE TABLE IF NOT EXISTS routines (id TEXT PRIMARY KEY,name TEXT NOT NULL,blocks_json TEXT NOT NULL,value_json TEXT NOT NULL,updated_at_ms INTEGER NOT NULL,event_id TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at_ms INTEGER NOT NULL,event_id TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,version INTEGER NOT NULL,device_id TEXT NOT NULL,at_ms INTEGER NOT NULL,type TEXT NOT NULL,data_json TEXT NOT NULL,value_json TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS events_device ON events(device_id);
          CREATE TABLE IF NOT EXISTS sync_outbox (event_id TEXT PRIMARY KEY REFERENCES events(id));
          CREATE TABLE IF NOT EXISTS local_meta (key TEXT PRIMARY KEY,value_json TEXT NOT NULL);
          PRAGMA user_version=1; COMMIT;").map_err(err)?;
        }
        if version < 2 {
            // v2: eventos de tipos que esta versão ainda não conhece ficam guardados
            // sem projeção e são aplicados quando o app passar a conhecê-los.
            store.connection.execute_batch("BEGIN IMMEDIATE;
          CREATE TABLE IF NOT EXISTS deferred_events (event_id TEXT PRIMARY KEY REFERENCES events(id));
          PRAGMA user_version=2; COMMIT;").map_err(err)?;
        }
        store.replay_deferred()?;
        Ok(store)
    }
    /// Projeta eventos guardados antes de o tipo ser conhecido.
    fn replay_deferred(&self) -> StoreResult<()> {
        let rows: Vec<String> = {
            let mut stmt = self.connection.prepare("SELECT e.value_json FROM deferred_events d JOIN events e ON e.id=d.event_id ORDER BY e.at_ms,e.id").map_err(err)?;
            let rows = stmt.query_map([], |r| r.get(0)).map_err(err)?;
            rows.collect::<Result<_, _>>().map_err(err)?
        };
        if rows.is_empty() { return Ok(()); }
        let tx = self.connection.unchecked_transaction().map_err(err)?;
        for raw in rows {
            let e = parse(raw)?;
            if validate_event(&e).is_err() { continue; }
            if project(&tx, &e)? {
                tx.execute("DELETE FROM deferred_events WHERE event_id=?1", [string(&e, "id")?]).map_err(err)?;
            }
        }
        tx.commit().map_err(err)
    }
    pub fn request(&mut self, operation: &str, args: &Value) -> StoreResult<Value> {
        match operation {
            "nextTimestamp" => {
                let tx = self.connection.transaction().map_err(err)?;
                let max_event: Option<i64> = tx.query_row("SELECT MAX(at_ms) FROM events", [], |r|r.get(0)).map_err(err)?;
                let reserved: Option<String> = tx.query_row("SELECT value_json FROM local_meta WHERE key='eventClock'", [], |r|r.get(0)).optional().map_err(err)?;
                let reserved = reserved.map(parse).transpose()?.and_then(|v|v.as_i64()).unwrap_or(0);
                let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(err)?.as_millis() as i64;
                let time = now.max(reserved + 1).max(max_event.unwrap_or(0) + 1);
                tx.execute("INSERT INTO local_meta VALUES ('eventClock',?1) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json", [time.to_string()]).map_err(err)?;
                tx.commit().map_err(err)?;
                Ok(json!(time))
            }
            "apply" => {
                let events = args["events"].as_array().ok_or("Eventos inválidos")?;
                for e in events { validate_event(e)?; }
                let tx = self.connection.transaction().map_err(err)?;
                for e in events {
                    let id = string(e,"id")?;
                    let previous: Option<String> = tx.query_row("SELECT value_json FROM events WHERE id=?1",[id],|r|r.get(0)).optional().map_err(err)?;
                    if let Some(previous) = previous {
                        if parse(previous)? != *e { return Err("ID de evento em conflito.".into()); }
                        continue;
                    }
                    let at = ms(string(e,"at")?)?;
                    let device = string(e,"deviceId")?;
                    let kind = string(e,"type")?;
                    let projected = project(&tx, e)?;
                    tx.execute("INSERT INTO events VALUES (?1,1,?2,?3,?4,?5,?6)",params![id,device,at,kind,serialize(&e["data"])?,serialize(e)?]).map_err(err)?;
                    if !projected { tx.execute("INSERT INTO deferred_events VALUES (?1)",[id]).map_err(err)?; }
                    tx.execute("INSERT INTO sync_outbox VALUES (?1)",[id]).map_err(err)?;
                }
                tx.commit().map_err(err)?;
                Ok(Value::Null)
            }
            "listLogs" => {
                let from = args["from"].as_str().map(ms).transpose()?;
                let to = args["to"].as_str().map(ms).transpose()?;
                self.values("SELECT value_json FROM practice_logs WHERE (?1 IS NULL OR at_ms>=?1) AND (?2 IS NULL OR at_ms<?2) AND (?3 IS NULL OR exercise_id=?3) ORDER BY at_ms,id",params![from,to,args["exerciseId"].as_str()])
            }
            "countByExercise" => {
                let mut stmt = self.connection.prepare("SELECT exercise_id,COUNT(*) FROM practice_logs GROUP BY exercise_id").map_err(err)?;
                let rows = stmt.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,i64>(1)?))).map_err(err)?;
                let mut result = serde_json::Map::new();
                for row in rows { let (k,v) = row.map_err(err)?; result.insert(k,json!(v)); }
                Ok(Value::Object(result))
            }
            "getRoutine" => {
                let row = self.connection.query_row("SELECT value_json FROM routines WHERE id=?1",[string(args,"id")?],|r|r.get::<_,String>(0)).optional().map_err(err)?;
                row.map(parse).transpose().map(|v|v.unwrap_or(Value::Null))
            }
            "getSettings" => {
                let mut stmt = self.connection.prepare("SELECT key,value_json FROM settings ORDER BY key").map_err(err)?;
                let rows = stmt.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).map_err(err)?;
                let mut out = vec![];
                for row in rows { let (key,v) = row.map_err(err)?; out.push(json!({"key":key,"value":parse(v)?})); }
                Ok(json!(out))
            }
            "events" => self.values("SELECT value_json FROM events ORDER BY at_ms,id",[]),
            "pending" => self.values("SELECT e.value_json FROM events e JOIN sync_outbox o ON e.id=o.event_id WHERE e.device_id=?1 ORDER BY e.at_ms,e.id",[string(args,"deviceId")?]),
            "ack" => { self.connection.execute("DELETE FROM sync_outbox WHERE event_id=?1",[string(args,"id")?]).map_err(err)?; Ok(Value::Null) }
            "metaGet" => {
                self.connection.query_row("SELECT value_json FROM local_meta WHERE key=?1",[string(args,"key")?],|r|r.get::<_,String>(0)).optional().map_err(err)?.map(parse).transpose().map(|v|v.unwrap_or(Value::Null))
            }
            "metaSet" => {
                self.connection.execute("INSERT INTO local_meta VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json",params![string(args,"key")?,serialize(&args["value"])?]).map_err(err)?;
                Ok(Value::Null)
            }
            _ => Err("Operação desconhecida.".into())
        }
    }
    fn values(&self, sql: &str, params: impl rusqlite::Params) -> StoreResult<Value> {
        let mut stmt = self.connection.prepare(sql).map_err(err)?;
        let rows = stmt
            .query_map(params, |r| r.get::<_, String>(0))
            .map_err(err)?;
        let mut values = vec![];
        for row in rows {
            values.push(parse(row.map_err(err)?)?);
        }
        Ok(json!(values))
    }
}

/// Aplica o evento às tabelas de leitura. Devolve false para tipos desconhecidos.
fn project(tx: &rusqlite::Transaction, e: &Value) -> StoreResult<bool> {
    let id = string(e, "id")?;
    let at = ms(string(e, "at")?)?;
    let device = string(e, "deviceId")?;
    let data = &e["data"];
    let kind = string(e, "type")?;
    match kind {
        "practice.added" => {
            let log_id = string(data,"id")?;
            let old: Option<String> = tx.query_row("SELECT value_json FROM practice_logs WHERE id=?1",[log_id],|r|r.get(0)).optional().map_err(err)?;
            if let Some(old) = old {
                if parse(old)? != *data { return Err("ID de registro em conflito.".into()); }
            } else {
                let duration = data["durationSeconds"].as_f64().or_else(||data["durationMin"].as_f64().map(|m|m*60.));
                tx.execute("INSERT INTO practice_logs VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",params![log_id,string(data,"exerciseId")?,ms(string(data,"at")?)?,data["bpm"].as_f64(),data["count"].as_f64(),data["seconds"].as_f64(),duration,data["note"].as_str(),device,serialize(&data["metric"])?,serialize(data)?]).map_err(err)?;
            }
        }
        "routine.saved" => {
            tx.execute("INSERT INTO routines VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET name=excluded.name,blocks_json=excluded.blocks_json,value_json=excluded.value_json,updated_at_ms=excluded.updated_at_ms,event_id=excluded.event_id WHERE excluded.updated_at_ms>routines.updated_at_ms OR (excluded.updated_at_ms=routines.updated_at_ms AND excluded.event_id>routines.event_id)",params![string(data,"id")?,string(data,"name")?,serialize(&data["blocks"])?,serialize(data)?,at,id]).map_err(err)?;
        }
        "settings.changed" => {
            for change in data.as_array().ok_or("Ajustes inválidos")? {
                tx.execute("INSERT INTO settings VALUES (?1,?2,?3,?4) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at_ms=excluded.updated_at_ms,event_id=excluded.event_id WHERE excluded.updated_at_ms>settings.updated_at_ms OR (excluded.updated_at_ms=settings.updated_at_ms AND excluded.event_id>settings.event_id)",params![string(change,"key")?,serialize(&change["value"])?,at,id]).map_err(err)?;
            }
        }
        _ => return Ok(false),
    }
    Ok(true)
}

pub fn validate_event(e: &Value) -> StoreResult<()> {
    if e["version"] != 1 {
        return Err("Versão de evento incompatível.".into());
    }
    string(e, "id")?;
    string(e, "deviceId")?;
    ms(string(e, "at")?)?;
    let data = &e["data"];
    match string(e, "type")? {
        "practice.added" => {
            string(data, "id")?;
            string(data, "exerciseId")?;
            ms(string(data, "at")?)?;
            for key in ["bpm", "count", "seconds", "durationSeconds", "durationMin"] {
                if let Some(v) = data.get(key) {
                    let n = v.as_f64().ok_or("Métrica inválida.")?;
                    if !n.is_finite()
                        || n < 0.
                        || (key == "bpm" && !(20. ..=400.).contains(&n))
                        || (key == "count" && n.fract() != 0.)
                    {
                        return Err("Métrica inválida.".into());
                    }
                }
            }
            if data.get("note").is_some_and(|v| !v.is_string()) {
                return Err("Nota inválida.".into());
            }
            if let Some(metric) = data.get("metric") {
                if !["bpm", "contagem", "tempo", "feito"].contains(&string(metric, "tipo")?) {
                    return Err("Métrica inválida.".into());
                }
            }
        }
        "routine.saved" => {
            string(data, "id")?;
            string(data, "name")?;
            let blocks = data["blocks"]
                .as_array()
                .filter(|a| !a.is_empty())
                .ok_or("Rotina vazia.")?;
            for b in blocks {
                if !["aquecimento", "dexteridade", "teoria", "musica", "ouvido"]
                    .contains(&string(b, "kind")?)
                    || !b["minutes"]
                        .as_f64()
                        .is_some_and(|m| m > 0. && m.is_finite())
                    || !(b["exerciseId"].is_null()
                        || b["exerciseId"].as_str().is_some_and(|s| !s.is_empty()))
                {
                    return Err("Bloco inválido.".into());
                }
            }
        }
        "settings.changed" => {
            let changes = data
                .as_array()
                .filter(|a| !a.is_empty())
                .ok_or("Ajustes inválidos.")?;
            for c in changes {
                validate_setting(c)?;
            }
        }
        // Tipo de uma versão mais nova: o envelope foi validado; o conteúdo
        // será validado quando esta versão passar a conhecer o tipo.
        _ => {}
    }
    Ok(())
}
fn valid_input_profiles(value: &Value) -> bool {
    let Some(profiles) = value.as_array() else { return false };
    let mut ids = std::collections::HashSet::new();
    profiles.len() <= 128 && profiles.iter().all(|p| {
        let Some(id) = p["deviceId"].as_str() else { return false };
        !id.is_empty() && ids.insert(id)
            && p["channel"].as_u64().is_some_and(|n| n <= 255)
            && (p["bufferFrames"].is_null() || p["bufferFrames"].as_u64().is_some_and(|n| (32..=8192).contains(&n)))
            && p["sampleRate"].as_u64().is_some_and(|n| (8000..=768000).contains(&n))
            && (p["inputMs"].is_null() || p["inputMs"].as_f64().is_some_and(|n| n.is_finite() && (0.0..=10000.0).contains(&n)))
            && p["source"].as_str().is_some_and(|s| ["nativeTimestamp", "browserReported"].contains(&s))
            && p["measuredAt"].as_str().is_some_and(|s| chrono::DateTime::parse_from_rfc3339(s).is_ok())
    })
}

fn validate_setting(c: &Value) -> StoreResult<()> {
    let raw = string(c, "key")?;
    let key = if raw.starts_with("device:") {
        raw.splitn(3, ':').nth(2).unwrap_or("")
    } else {
        raw
    };
    let x = &c["value"];
    let num = |a: f64, b: f64| {
        x.as_f64()
            .is_some_and(|v| v.is_finite() && v >= a && v <= b)
    };
    let choices = |values: &[&str]| x.as_str().is_some_and(|v| values.contains(&v));
    let valid = match key {
        "routineSource" => choices(&["suggested", "custom"]),
        "theme" => choices(&["sistema", "claro", "escuro"]),
        "locale" => choices(&["pt-BR", "en"]),
        "dedication" => choices(&["baixa", "media", "alta"]),
        "currentPhase" => num(1., 4.) && x.as_u64().is_some(),
        "metronome.sound" => choices(&["madeira", "bip", "aro", "cowbell", "suave"]),
        "metronome.progression" => choices(&["auto", "manual"]),
        "metronome.volume" => num(0., 1.),
        "metronome.beatsPerBar" => num(1., 7.) && x.as_u64().is_some(),
        "metronome.subdivision" => num(1., 4.) && x.as_u64().is_some(),
        "metronome.accentFirstBeat" => x.is_boolean(),
        "tuner.a4" => num(430., 450.),
        "tuner.inputChannel" => num(0., 255.) && x.as_u64().is_some(),
        "tuner.inputProfiles" => raw.starts_with("device:") && valid_input_profiles(x),
        "metronome.outputDeviceId" | "tuner.inputDeviceId" => x.is_null() || x.is_string(),
        _ => false,
    };
    if valid {
        Ok(())
    } else {
        Err("Ajuste inválido.".into())
    }
}

pub mod sync;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migra_v1_para_v2_e_aplica_eventos_guardados_ao_reabrir() {
        let path = std::env::temp_dir().join(format!("pratica-deferred-{}.sqlite3", std::process::id()));
        let _ = std::fs::remove_file(&path);
        {
            let mut store = Store::open(&path).unwrap();
            let v: i64 = store.connection.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
            assert_eq!(v, 2);
            store.request("apply", &json!({"events":[{"version":1,"id":"e1","deviceId":"b","at":"2026-11-20T12:00:00Z","type":"practice.added","data":{"id":"l1","exerciseId":"f1-spider","at":"2026-11-20T12:00:00Z","bpm":60}}]})).unwrap();
            // Simula um app antigo que guardou o evento sem conhecer o tipo.
            store.connection.execute_batch("DELETE FROM practice_logs; INSERT INTO deferred_events VALUES ('e1');").unwrap();
        }
        let mut store = Store::open(&path).unwrap();
        assert_eq!(store.request("countByExercise", &json!({})).unwrap()["f1-spider"], 1);
        let restantes: i64 = store.connection.query_row("SELECT COUNT(*) FROM deferred_events", [], |r| r.get(0)).unwrap();
        assert_eq!(restantes, 0);
        drop(store);
        for suffix in ["", "-wal", "-shm"] { let _ = std::fs::remove_file(format!("{}{suffix}", path.display())); }
    }
    #[test]
    fn rejeita_versao_futura_sem_rebaixar_banco() {
        let path =
            std::env::temp_dir().join(format!("pratica-future-{}.sqlite3", std::process::id()));
        let connection = Connection::open(&path).unwrap();
        connection.pragma_update(None, "user_version", 99).unwrap();
        drop(connection);
        assert!(Store::open(&path).is_err());
        let connection = Connection::open(&path).unwrap();
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 99);
        drop(connection);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn reserva_relogio_depois_de_importacao_nativa_e_nao_reusa_instante() {
        let mut store = Store::open(":memory:").unwrap();
        store.request("apply", &json!({"events":[{"version":1,"id":"future","deviceId":"b","at":"2090-01-01T12:00:00Z","type":"settings.changed","data":[{"key":"theme","value":"escuro"}]}]})).unwrap();
        let first = store
            .request("nextTimestamp", &json!({}))
            .unwrap()
            .as_i64()
            .unwrap();
        let second = store
            .request("nextTimestamp", &json!({}))
            .unwrap()
            .as_i64()
            .unwrap();
        assert!(first > ms("2090-01-01T12:00:00Z").unwrap());
        assert_eq!(second, first + 1);
    }
}
