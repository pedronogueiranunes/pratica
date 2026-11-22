use practice_store::Store;
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::State;

pub struct Practice(pub Mutex<Store>);
pub fn device_id(store: &mut Store) -> Result<String, String> {
    let value = store.request("metaGet", &json!({"key":"deviceId"}))?;
    if let Some(id) = value.as_str() {
        return Ok(id.into());
    }
    // Identidade aleatória e opaca, sem nome de usuário/hostname.
    use rand::Rng;
    let id = format!("{:032x}", rand::rng().random::<u128>());
    store.request("metaSet", &json!({"key":"deviceId","value":id}))?;
    Ok(id)
}
#[tauri::command]
pub async fn practice_request(
    state: State<'_, Practice>,
    operation: String,
    data: Value,
) -> Result<Value, String> {
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    match operation.as_str() {
        "deviceId" => Ok(json!(device_id(&mut store)?)),
        "nextTimestamp" | "apply" | "listLogs" | "countByExercise" | "saveRoutine"
        | "getRoutine" | "getSettings" | "events" | "metaGet" | "metaSet" => {
            store.request(&operation, &data)
        }
        _ => Err("Operação desconhecida.".into()),
    }
}
#[tauri::command]
pub async fn practice_sync(state: State<'_, Practice>) -> Result<Value, String> {
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    let device = device_id(&mut store)?;
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME").ok_or("Pasta pessoal indisponível.")?;
        let cloud =
            std::path::PathBuf::from(home).join("Library/Mobile Documents/com~apple~CloudDocs");
        if !cloud.is_dir() {
            return Ok(
                json!({"state":"pending","message":"iCloud Drive indisponível. Seus dados estão salvos neste Mac."}),
            );
        }
        let folder = cloud.join("Pratica/events");
        match practice_store::sync::sync_folder(&mut store, &folder, &device) {
            Ok(report) => Ok(
                json!({"state":if report.warnings.is_empty(){"ok"}else{"pending"},"message":if report.warnings.is_empty(){"iCloud atualizado.".to_string()}else{report.warnings.join(" ")},"imported":report.imported}),
            ),
            Err(error) => Ok(
                json!({"state":"error","message":format!("iCloud pendente: {error}. Seus dados estão salvos neste Mac.")}),
            ),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = device;
        Ok(json!({"state":"local","message":"Dados salvos neste dispositivo."}))
    }
}
