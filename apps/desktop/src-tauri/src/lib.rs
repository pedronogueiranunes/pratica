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
fn chord_preview(audio: State<Audio>, device_id: Option<String>, frequencies: Vec<f32>, volume: f32) -> Result<(), String> {
    if audio_engine::preview::PreviewPlan::new(&frequencies, volume).is_none() { return Err("Prévia inválida.".into()); }
    audio.0.preview_chord(device_id, frequencies, volume); Ok(())
}
#[tauri::command]
fn chord_preview_stop(audio: State<Audio>) { audio.0.stop_preview(); }

#[tauri::command]
fn sequence_start(audio: State<Audio>, device_id: Option<String>, settings: MetronomeSettings, steps: Vec<audio_engine::sequence::SequenceStep>, volume: f32, click: bool, run_id: u32, drums: Option<audio_engine::drums::DrumConfig>) -> Result<(), String> {
    let drums = drums.unwrap_or_default();
    if drums.enabled && settings.beats_per_bar != 4 { return Err("A bateria precisa de compasso 4/4.".into()); }
    let mut plan = audio_engine::sequence::SequencePlan::with_drums(&steps, volume, click, drums).ok_or("Sequência inválida.")?;
    plan.run_id = run_id;
    audio.0.start_sequence(device_id, settings, plan); Ok(())
}

#[tauri::command]
fn sequence_mixer(audio: State<Audio>, run_id: u32, mixer: audio_engine::sequence::SequenceMixer) -> Result<(), String> {
    if !mixer.valid() { return Err("Volumes ou bateria inválidos.".into()); }
    audio.0.sequence_mixer(run_id, mixer); Ok(())
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

#[tauri::command]
fn audio_measure(audio: State<Audio>) {
    audio.0.measure_latency();
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
            audio_measure,
            metronome_start,
            metronome_update,
            metronome_stop,
            chord_preview,
            chord_preview_stop,
            sequence_start,
            sequence_mixer,
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
