//! Camada Tauri: liga a interface (React) ao motor de áudio e às provas de
//! integração. Não guarda regra de negócio: isso fica em `packages/core` e
//! em `crates/audio-engine`.

mod spotify;
mod storage;

use audio_engine::engine::{list_devices, start_engine, EngineHandle};
use audio_engine::{rank, DeviceInfo, MetronomeSettings, Purpose, Recommendation};
use tauri::{Emitter, Manager, State};

struct Audio(EngineHandle);

#[tauri::command]
fn audio_devices() -> Vec<DeviceInfo> {
    list_devices()
}

#[tauri::command]
fn audio_rank(devices: Vec<DeviceInfo>, purpose: Purpose) -> Vec<Recommendation> {
    rank(&devices, purpose)
}

#[tauri::command]
fn metronome_start(audio: State<Audio>, device_id: Option<String>, settings: MetronomeSettings) {
    audio.0.start_metronome(device_id, settings);
}

#[tauri::command]
fn metronome_update(audio: State<Audio>, settings: MetronomeSettings) {
    audio.0.update_metronome(settings);
}

#[tauri::command]
fn metronome_stop(audio: State<Audio>) {
    audio.0.stop_metronome();
}

#[tauri::command]
fn tuner_start(audio: State<Audio>, device_id: Option<String>, channel: u16, a4: f32, buffer_frames: Option<u32>) {
    audio.0.start_tuner_with_buffer(device_id, channel, a4, buffer_frames);
}

#[tauri::command]
fn tuner_set_a4(audio: State<Audio>, a4: f32) {
    audio.0.set_a4(a4);
}

#[tauri::command]
fn tuner_stop(audio: State<Audio>) {
    audio.0.stop_tuner();
}

#[tauri::command]
fn audio_refresh(audio: State<Audio>) {
    audio.0.refresh_devices();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(spotify::SpotifyState::default())
        .setup(|app| {
            let data_dir = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let store = practice_store::Store::open(data_dir.join("pratica.sqlite3"))
                .map_err(std::io::Error::other)?;
            app.manage(storage::Practice(std::sync::Mutex::new(store)));
            let handle = app.handle().clone();
            let engine = start_engine(move |event| {
                let _ = handle.emit("engine", event);
            });
            app.manage(Audio(engine));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage::practice_request,
            storage::practice_sync,
            audio_devices,
            audio_rank,
            audio_refresh,
            metronome_start,
            metronome_update,
            metronome_stop,
            tuner_start,
            tuner_set_a4,
            tuner_stop,
            spotify::spotify_login,
            spotify::spotify_request,
            spotify::spotify_logout,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o app");
}
