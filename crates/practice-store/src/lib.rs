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
        if version > 3 {
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
            // v2: músicas, playlists e revisões de cifra; eventos de tipos que esta versão ainda não conhece ficam guardados
            // sem projeção e são aplicados quando o app passar a conhecê-los.
            store.connection.execute_batch("BEGIN IMMEDIATE;
          CREATE TABLE IF NOT EXISTS deferred_events (event_id TEXT PRIMARY KEY REFERENCES events(id));
          CREATE TABLE IF NOT EXISTS songs (id TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at_ms INTEGER NOT NULL,event_id TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS playlists (id TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at_ms INTEGER NOT NULL,event_id TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS chart_revisions (revision TEXT PRIMARY KEY,chart_id TEXT NOT NULL,song_id TEXT NOT NULL,created_at_ms INTEGER NOT NULL,value_json TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS chart_revisions_chart ON chart_revisions(chart_id);
          PRAGMA user_version=2; COMMIT;").map_err(err)?;
        }
        if version < 3 {
            store.connection.execute_batch("BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS sequences (id TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at_ms INTEGER NOT NULL,event_id TEXT NOT NULL); PRAGMA user_version=3; COMMIT;").map_err(err)?;
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
                for e in events {
                    validate_event(e)?;
                    if args["relayMusic"] == true && !["song.", "playlist.", "chart.", "sequence."].iter().any(|prefix| string(e, "type").is_ok_and(|t| t.starts_with(prefix))) {
                        return Err("O pacote só pode conter eventos de repertório.".into());
                    }
                }
                let tx = self.connection.transaction().map_err(err)?;
                for e in events {
                    let id = string(e,"id")?;
                    if args["relayMusic"] == true {
                        // Metadado local de transporte. Autoria e envelope original permanecem intactos.
                        tx.execute("INSERT OR IGNORE INTO local_meta VALUES (?1,'true')", [format!("musicRelay:{id}")]).map_err(err)?;
                    }
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
            "listSequences" => self.values("SELECT value_json FROM sequences ORDER BY id",[]),
            "listSongs" => self.values("SELECT value_json FROM songs ORDER BY id",[]),
            "listPlaylists" => self.values("SELECT value_json FROM playlists ORDER BY id",[]),
            "chartRevisions" => self.values("SELECT value_json FROM chart_revisions WHERE chart_id=?1 ORDER BY created_at_ms,revision",[string(args,"chartId")?]),
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
        "song.saved" | "playlist.saved" | "sequence.saved" => {
            let table = if kind == "song.saved" { "songs" } else if kind == "sequence.saved" { "sequences" } else { "playlists" };
            tx.execute(&format!("INSERT INTO {table} VALUES (?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,updated_at_ms=excluded.updated_at_ms,event_id=excluded.event_id WHERE excluded.updated_at_ms>{table}.updated_at_ms OR (excluded.updated_at_ms={table}.updated_at_ms AND excluded.event_id>{table}.event_id)"),params![string(data,"id")?,serialize(data)?,at,id]).map_err(err)?;
        }
        "chart.revised" => {
            let revision = string(data,"revision")?;
            let old: Option<String> = tx.query_row("SELECT value_json FROM chart_revisions WHERE revision=?1",[revision],|r|r.get(0)).optional().map_err(err)?;
            if let Some(old) = old {
                if parse(old)? != *data { return Err("Revisão de cifra em conflito.".into()); }
            } else {
                tx.execute("INSERT INTO chart_revisions VALUES (?1,?2,?3,?4,?5)",params![revision,string(data,"chartId")?,string(data,"songId")?,ms(string(data,"createdAt")?)?,serialize(data)?]).map_err(err)?;
            }
        }
        _ => return Ok(false),
    }
    Ok(true)
}

fn validate_sequence(v: &Value) -> StoreResult<()> {
    let id = string(v,"id")?; let name = string(v,"name")?;
    if id.trim().is_empty() || id.len()>128 || name.trim().is_empty() || name.chars().count()>80 { return Err("Nome ou ID de sequência inválido.".into()); }
    ms(string(v,"updatedAt")?)?; opt_bool(v,"deleted")?;
    let level = |x: &Value| x.as_f64().is_some_and(|n| n.is_finite() && (0.0..=1.0).contains(&n));
    if !v["bpm"].as_f64().is_some_and(|n| n.is_finite() && (20.0..=400.0).contains(&n)) || !level(&v["volume"]) || !level(&v["clickVolume"]) || !v["click"].is_boolean() || !level(&v["drums"]["volume"]) || !v["drums"]["enabled"].is_boolean() || !["rock","reggae","indie","metal","ska","afrobeat","simple4","simple8"].contains(&string(&v["drums"],"pattern")?) { return Err("Configuração da sequência inválida.".into()); }
    let steps = v["steps"].as_array().filter(|a| a.len()<=16).ok_or("Sequência grande demais.")?;
    let mut ids=std::collections::HashSet::new();
    for step in steps {
        let id = string(step,"id")?; if id.trim().is_empty() || !ids.insert(id) || !step["beats"].as_u64().is_some_and(|n| [1,2,4,8].contains(&n)) { return Err("Bloco inválido.".into()); }
        let d=&step["diagram"]; if string(d,"name")?.chars().count()>64 { return Err("Nome de acorde inválido.".into()); }
        let notes=d["notes"].as_array().filter(|a| !a.is_empty() && a.len()<=6).ok_or("Forma inválida.")?;
        let mut strings=std::collections::HashSet::new();
        for n in notes {
            let string=n["string"].as_u64().filter(|n| (1..=6).contains(n)).ok_or("Corda inválida.")?;
            if !strings.insert(string) || !n["fret"].as_u64().is_some_and(|n| n<=24) || n.get("finger").is_some_and(|x| !x.as_u64().is_some_and(|n| n<=4)) || n.get("root").is_some_and(|x| !x.is_boolean()) { return Err("Nota inválida.".into()); }
        }
        if let Some(muted)=d.get("muted") { let muted=muted.as_array().filter(|a| a.len()<=6).ok_or("Cordas inválidas.")?; for m in muted { if !m.as_u64().is_some_and(|n| (1..=6).contains(&n) && !strings.contains(&n)) { return Err("Corda abafada inválida.".into()); } } }
        if let Some(b)=d.get("barre") { if !b["fret"].as_u64().is_some_and(|n| (1..=24).contains(&n)) || !b["from"].as_u64().is_some_and(|n| (1..=6).contains(&n)) || !b["to"].as_u64().is_some_and(|n| n>=1 && n<=b["from"].as_u64().unwrap_or(0)) || !b["finger"].as_u64().is_some_and(|n| (1..=4).contains(&n)) { return Err("Pestana inválida.".into()); } }
    }
    Ok(())
}

fn http_url(v: &Value) -> bool {
    v.as_str().is_some_and(|u| (u.starts_with("https://") || u.starts_with("http://")) && u.len() > 8 && !u.contains(char::is_whitespace))
}
fn opt_bool(v: &Value, key: &str) -> StoreResult<()> {
    if v.get(key).is_some_and(|x| !x.is_boolean()) { return Err(format!("Campo inválido: {key}")); }
    Ok(())
}
fn opt_str(v: &Value, key: &str) -> StoreResult<()> {
    if v.get(key).is_some_and(|x| !x.is_string()) { return Err(format!("Campo inválido: {key}")); }
    Ok(())
}
fn valid_origin(v: &Value) -> bool {
    match v["kind"].as_str() {
        Some("usuario") | Some("cifra") => true,
        Some("arquivo") => v["name"].as_str().is_some_and(|s| !s.trim().is_empty()),
        Some("fonte") => v["source"].as_str().is_some_and(|s| !s.trim().is_empty()) && v.get("attribution").is_none_or(Value::is_string),
        _ => false,
    }
}
fn valid_key(k: &str) -> bool {
    let b = k.as_bytes();
    let mut i = 1;
    if b.is_empty() || !(b'A'..=b'G').contains(&b[0]) { return false; }
    if b.get(i).is_some_and(|c| *c == b'#' || *c == b'b') { i += 1; }
    if b.get(i) == Some(&b'm') { i += 1; }
    i == b.len()
}
/// Espelho de validateSong em packages/core/src/songs.ts.
fn validate_song(s: &Value) -> StoreResult<()> {
    let fail = |m: &str| Err(format!("Música inválida: {m}."));
    if string(s, "id").is_err() || s["title"].as_str().is_none_or(|t| t.trim().is_empty()) { return fail("id ou título"); }
    for k in ["artist", "notes", "chartId"] { opt_str(s, k)?; }
    if let Some(b) = s.get("bpm") {
        if !b["value"].as_f64().is_some_and(|n| n.is_finite() && (20. ..=400.).contains(&n)) || !valid_origin(&b["origin"]) { return fail("BPM"); }
    }
    if let Some(k) = s.get("key") {
        if !k["value"].as_str().is_some_and(valid_key) || !valid_origin(&k["origin"]) { return fail("tom"); }
    }
    if let Some(t) = s.get("timeSignature") {
        let ok = t.as_str().and_then(|t| t.split_once('/')).is_some_and(|(a, b)| a.parse::<u8>().is_ok_and(|a| (1..=19).contains(&a)) && !a.starts_with('0') && ["2", "4", "8", "16"].contains(&b));
        if !ok { return fail("compasso"); }
    }
    if s.get("capo").is_some_and(|c| !c.as_u64().is_some_and(|c| c <= 12)) { return fail("capo"); }
    if s.get("phase").is_some_and(|p| !p.as_u64().is_some_and(|p| (1..=4).contains(&p))) { return fail("fase"); }
    let links = s["links"].as_array().ok_or("Música inválida: links.")?;
    for l in links {
        if !["origem", "youtube", "spotify", "outro"].contains(&l["kind"].as_str().unwrap_or("")) || !http_url(&l["url"]) || l.get("label").is_some_and(|x| !x.is_string()) { return fail("links"); }
    }
    let tracks = s["tracks"].as_array().ok_or("Música inválida: faixas.")?;
    for t in tracks {
        if !["local", "youtube", "spotify", "jamendo", "audius", "soundcloud", "deezer"].contains(&t["source"].as_str().unwrap_or("")) || string(t, "id").is_err() || t["title"].as_str().is_none_or(|x| x.trim().is_empty()) { return fail("faixas"); }
    }
    let tags = s["tags"].as_array().ok_or("Música inválida: tags.")?;
    if !tags.iter().all(|t| t.as_str().is_some_and(|t| !t.trim().is_empty())) { return fail("tags"); }
    opt_bool(s, "deleted")
}

pub fn validate_event(e: &Value) -> StoreResult<()> {
    if e.get("data").is_none() { return Err("Dados do evento ausentes.".into()); }
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
        "sequence.saved" => { validate_sequence(data)?; if data["updatedAt"] != e["at"] { return Err("Data da sequência incompatível com o evento.".into()); } }
        "song.saved" => validate_song(data)?,
        "playlist.saved" => {
            string(data, "id")?;
            string(data, "name")?;
            let ids = data["songIds"].as_array().ok_or("Playlist inválida.")?;
            let mut seen = std::collections::HashSet::new();
            for id in ids {
                let id = id.as_str().filter(|s| !s.trim().is_empty()).ok_or("Playlist inválida.")?;
                if !seen.insert(id) { return Err("Playlist inválida.".into()); }
            }
            opt_bool(data, "deleted")?;
        }
        "chart.revised" => {
            string(data, "chartId")?;
            string(data, "songId")?;
            let revision = string(data, "revision")?;
            ms(string(data, "createdAt")?)?;
            let chordpro = data["chordpro"].as_str().ok_or("Cifra inválida.")?;
            if chordpro.chars().count() > 200_000
                || !["colado", "chordpro", "txt", "manual"].contains(&string(data, "importedFrom")?)
                || data.get("parentRevision").is_some_and(|p| p.as_str().is_none_or(|p| p.is_empty() || p == revision))
                || data.get("sourceUrl").is_some_and(|u| !http_url(u))
                || data.get("supersedes").is_some_and(|v| !v.as_array().is_some_and(|a| a.iter().all(|x| x.as_str().is_some_and(|x| !x.trim().is_empty() && x != revision))))
            {
                return Err("Cifra inválida.".into());
            }
        }
        // Tipo de uma versão mais nova: o envelope foi validado; o conteúdo
        // será validado quando esta versão passar a conhecer o tipo.
        _ => {}
    }
    Ok(())
}
/// Mapa interface → canal de saída (0 = todos, n = só o canal n), igual ao core.
fn valid_output_channels(value: &Value) -> bool {
    value.as_object().is_some_and(|m| m.len() <= 128 && m.iter().all(|(id, ch)| !id.is_empty() && id.len() <= 512 && ch.as_u64().is_some_and(|c| c <= 128)))
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
        "metronome.outputChannels" => raw.starts_with("device:") && valid_output_channels(x),
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
    fn migra_v2_para_v3_e_recupera_sequencia_adiada() {
        let path = std::env::temp_dir().join(format!("pratica-sequence-migration-{}.sqlite3", std::process::id()));
        let _ = std::fs::remove_file(&path);
        {
            let mut store = Store::open(&path).unwrap();
            let at = "2026-11-23T12:00:00Z";
            let sequence = json!({"id":"seq1","name":"Teste original","steps":[],"bpm":90,"volume":0.5,"click":false,"clickVolume":0.4,"drums":{"enabled":true,"pattern":"rock","volume":0.3},"updatedAt":at});
            store.request("apply", &json!({"events":[{"version":1,"id":"seq-event","deviceId":"outro","at":at,"type":"sequence.saved","data":sequence}]})).unwrap();
            store.connection.execute_batch("DROP TABLE sequences; INSERT INTO deferred_events VALUES ('seq-event'); PRAGMA user_version=2;").unwrap();
        }
        let mut store = Store::open(&path).unwrap();
        assert_eq!(store.request("listSequences", &json!({})).unwrap()[0]["id"], "seq1");
        let count: i64 = store.connection.query_row("SELECT COUNT(*) FROM deferred_events", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);
        drop(store);
        for suffix in ["", "-wal", "-shm"] { let _ = std::fs::remove_file(format!("{}{suffix}", path.display())); }
    }
    #[test]
    fn migra_v1_para_v2_e_aplica_eventos_guardados_ao_reabrir() {
        let path = std::env::temp_dir().join(format!("pratica-deferred-{}.sqlite3", std::process::id()));
        let _ = std::fs::remove_file(&path);
        {
            let mut store = Store::open(&path).unwrap();
            let v: i64 = store.connection.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
            assert_eq!(v, 3);
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
    fn musicas_playlists_e_revisoes_de_cifra() {
        let mut store = Store::open(":memory:").unwrap();
        let ev = |id: &str, dev: &str, at: &str, kind: &str, data: Value| json!({"version":1,"id":id,"deviceId":dev,"at":at,"type":kind,"data":data});
        let song = |title: &str| json!({"id":"s1","title":title,"links":[],"tracks":[],"tags":[],"bpm":{"value":90,"origin":{"kind":"usuario"}},"key":{"value":"Em","origin":{"kind":"cifra"}}});
        // Fora de ordem: a gravação mais nova vence.
        store.request("apply", &json!({"events":[ev("e2","b","2026-11-22T12:00:00Z","song.saved",song("Nova"))]})).unwrap();
        store.request("apply", &json!({"events":[ev("e1","a","2026-11-22T11:00:00Z","song.saved",song("Antiga"))]})).unwrap();
        let songs = store.request("listSongs", &json!({})).unwrap();
        assert_eq!(songs[0]["title"], "Nova");
        assert_eq!(songs.as_array().unwrap().len(), 1);
        store.request("apply", &json!({"events":[ev("p1","a","2026-11-22T11:00:00Z","playlist.saved",json!({"id":"p","name":"Treino","songIds":["s1"]}))]})).unwrap();
        assert_eq!(store.request("listPlaylists", &json!({})).unwrap()[0]["songIds"][0], "s1");
        // Duas edições sobre a mesma revisão ficam guardadas: o conflito é visível.
        let rev = |r: &str, parent: Option<&str>| { let mut v = json!({"chartId":"c1","songId":"s1","revision":r,"chordpro":"[Em]x\n","importedFrom":"colado","createdAt":"2026-11-22T11:00:00Z"}); if let Some(p) = parent { v["parentRevision"] = json!(p); } v };
        store.request("apply", &json!({"events":[ev("c1","a","2026-11-22T11:00:00Z","chart.revised",rev("r1",None)),ev("c2","a","2026-11-22T11:01:00Z","chart.revised",rev("ra",Some("r1"))),ev("c3","b","2026-11-22T11:02:00Z","chart.revised",rev("rb",Some("r1")))]})).unwrap();
        assert_eq!(store.request("chartRevisions", &json!({"chartId":"c1"})).unwrap().as_array().unwrap().len(), 3);
        // Mesmo ID de revisão com conteúdo diferente é recusado sem gravar nada.
        let mut other = rev("ra", Some("r1")); other["chordpro"] = json!("[Am]y\n");
        assert!(store.request("apply", &json!({"events":[ev("c4","b","2026-11-22T11:03:00Z","chart.revised",other)]})).is_err());
        // Validação espelhada do core.
        for bad in [json!({"id":"s2","title":"x","links":[],"tracks":[],"tags":[],"bpm":{"value":90}}), json!({"id":"s2","title":"x","links":[],"tracks":[],"tags":[],"key":{"value":"Em7","origin":{"kind":"usuario"}}}), json!({"id":"s2","title":"x","links":[{"kind":"origem","url":"javascript:x"}],"tracks":[],"tags":[]})] {
            assert!(store.request("apply", &json!({"events":[ev("bad","a","2026-11-22T11:00:00Z","song.saved",bad)]})).is_err());
        }
        assert!(store.request("apply", &json!({"events":[ev("bad","a","2026-11-22T11:00:00Z","playlist.saved",json!({"id":"p","name":"x","songIds":["a","a"]}))]})).is_err());
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
