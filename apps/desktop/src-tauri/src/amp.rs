//! Painel Amp (desktop): liga a bancada A0 ao app. Mesmos limites da bancada:
//! interface externa única (sem Bluetooth nem alto-falante interno), um canal
//! de entrada, um canal de saída, buffer 64/128, teto de amostra -3 dBFS.
//! O stream vive numa thread própria porque os streams do cpal não são Send.

use audio_engine::amp::BlockProcessor;
use audio_engine::amp_io::{CallbackTiming, Monitor, MonitorConfig, MonitorStats};
use nam_rs::{Model, NamModel};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::State;

const MAX_MODEL_BYTES: u64 = 32_000_000;
const MAX_WARMUP: usize = 2_000_000;
/// Níveis aceitos para a saída do monitor. O padrão da bancada é -24 dB.
const OUTPUT_DB: [f32; 3] = [-24.0, -18.0, -12.0];

struct NamProcessor(Model);
impl BlockProcessor for NamProcessor {
    fn process(&mut self, data: &mut [f32]) {
        self.0.process_buffer(data);
    }
}

fn load_model(path: &str) -> Result<(Model, u32), String> {
    if !path.to_lowercase().ends_with(".nam") {
        return Err("Escolha um arquivo .nam.".into());
    }
    let size = std::fs::metadata(path).map_err(|e| format!("Não consegui abrir o modelo: {e}"))?.len();
    if size > MAX_MODEL_BYTES {
        return Err("Modelo maior que 32 MB.".into());
    }
    let file = NamModel::from_file(path).map_err(|e| format!("Modelo NAM não carregou: {e}"))?;
    let mut model = Model::from_nam(&file).map_err(|e| format!("Modelo NAM não carregou: {e}"))?;
    let sr = file.expected_sample_rate();
    if !sr.is_finite() || sr.fract() != 0.0 || !(8000.0..=192000.0).contains(&sr) {
        return Err("Taxa de amostragem do modelo fora da faixa.".into());
    }
    let count = model.receptive_field();
    if count > MAX_WARMUP {
        return Err("Modelo grande demais para aquecer.".into());
    }
    let mut silence = vec![0.0; count];
    model.process_buffer(&mut silence);
    Ok((model, sr as u32))
}

#[derive(Default)]
struct Live {
    /// Carga máxima do callback em % do prazo, em centésimos de ponto.
    load_max: AtomicU32,
    load_avg: AtomicU32,
}

struct Running {
    stats: Arc<MonitorStats>,
    live: Arc<Live>,
    stop: Arc<AtomicBool>,
    done: Arc<AtomicBool>,
    started: Instant,
    info: AmpInfo,
}

#[derive(Default)]
pub struct AmpState(Mutex<Option<Running>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AmpInfo {
    pub model_name: String,
    pub sample_rate: u32,
    pub frames: u32,
    pub output_db: f32,
    pub input_channel: u16,
    pub output_channel: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AmpStatus {
    pub running: bool,
    pub info: AmpInfo,
    pub seconds: f64,
    pub load_avg_percent: f64,
    pub load_max_percent: f64,
    pub processed_frames: u64,
    pub input_clips: u64,
    pub input_overflows: u64,
    pub output_underruns: u64,
    pub resynced_samples: u64,
    pub invalid_samples: u64,
    pub error_flags: u32,
    pub ok: bool,
}

fn spawn_monitor(
    config: MonitorConfig,
    path: String,
    stats_tx: mpsc::Sender<Result<(Arc<MonitorStats>, u32), String>>,
    live: Arc<Live>,
    stop: Arc<AtomicBool>,
    done: Arc<AtomicBool>,
) {
    std::thread::spawn(move || {
        let (model, sample_rate) = match load_model(&path) {
            Ok(m) => m,
            Err(e) => {
                let _ = stats_tx.send(Err(e));
                done.store(true, Ordering::Relaxed);
                return;
            }
        };
        let config = MonitorConfig { sample_rate, ..config };
        let mut monitor = match Monitor::open(config, NamProcessor(model)) {
            Ok(m) => m,
            Err(e) => {
                let _ = stats_tx.send(Err(e));
                done.store(true, Ordering::Relaxed);
                return;
            }
        };
        let _ = stats_tx.send(Ok((monitor.stats.clone(), sample_rate)));
        let mut timings: Vec<CallbackTiming> = Vec::with_capacity(8192);
        let (mut sum, mut count, mut max) = (0.0f64, 0u64, 0.0f64);
        while !stop.load(Ordering::Relaxed) && monitor.stats.error_flags.load(Ordering::Relaxed) == 0 {
            timings.clear();
            monitor.drain_timings(&mut timings);
            for t in &timings {
                let percent = t.nanoseconds as f64 / (t.frames as f64 / sample_rate as f64 * 1e9) * 100.0;
                sum += percent;
                count += 1;
                max = max.max(percent);
            }
            if count > 0 {
                live.load_avg.store((sum / count as f64 * 100.0) as u32, Ordering::Relaxed);
                live.load_max.store((max * 100.0) as u32, Ordering::Relaxed);
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        monitor.fade_out();
        std::thread::sleep(Duration::from_millis(80));
        drop(monitor);
        done.store(true, Ordering::Relaxed);
    });
}

/// Abre o seletor de arquivos do macOS. Não copia o modelo: usa o caminho escolhido.
#[tauri::command]
pub fn amp_pick_model() -> Result<Option<String>, String> {
    let output = std::process::Command::new("/usr/bin/osascript")
        .args([
            "-e",
            "try\nPOSIX path of (choose file with prompt \"Escolha um modelo .nam\")\non error number -128\nreturn \"\"\nend try",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("Não consegui abrir o seletor de arquivos.".into());
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(if path.is_empty() { None } else { Some(path) })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn amp_start(
    audio: State<crate::Audio>,
    amp: State<AmpState>,
    device_id: String,
    model_path: String,
    input_channel: u16,
    output_channel: u16,
    frames: u32,
    output_db: f32,
) -> Result<AmpInfo, String> {
    if ![64, 128].contains(&frames) {
        return Err("Use buffer de 64 ou 128 amostras.".into());
    }
    if !(1..=256).contains(&input_channel) || !(1..=256).contains(&output_channel) {
        return Err("Canal de entrada e de saída começam em 1.".into());
    }
    if !OUTPUT_DB.contains(&output_db) {
        return Err("Nível de saída inválido.".into());
    }
    let mut guard = amp.0.lock().map_err(|_| "Estado do Amp indisponível.")?;
    if let Some(run) = guard.as_ref() {
        if !run.done.load(Ordering::Relaxed) {
            return Err("O Amp já está ligado. Pare antes de iniciar de novo.".into());
        }
    }
    // A bancada exige o dispositivo livre: metrônomo, afinador e prévias desligados.
    audio.0.stop_metronome();
    audio.0.stop_tuner();
    audio.0.stop_preview();
    std::thread::sleep(Duration::from_millis(150));

    let model_name = std::path::Path::new(&model_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "modelo.nam".into());
    let live = Arc::new(Live::default());
    let stop = Arc::new(AtomicBool::new(false));
    let done = Arc::new(AtomicBool::new(false));
    let (tx, rx) = mpsc::channel();
    spawn_monitor(
        MonitorConfig {
            device_id,
            input_channel: input_channel - 1,
            output_channel: output_channel - 1,
            sample_rate: 0,
            frames,
            output_db,
        },
        model_path,
        tx,
        live.clone(),
        stop.clone(),
        done.clone(),
    );
    let (stats, sample_rate) = rx
        .recv_timeout(Duration::from_secs(20))
        .map_err(|_| "O Amp demorou demais para abrir.".to_string())??;
    let info = AmpInfo { model_name, sample_rate, frames, output_db, input_channel, output_channel };
    *guard = Some(Running { stats, live, stop, done, started: Instant::now(), info: info.clone() });
    Ok(info)
}

#[tauri::command]
pub fn amp_stop(amp: State<AmpState>) -> Result<(), String> {
    let guard = amp.0.lock().map_err(|_| "Estado do Amp indisponível.")?;
    if let Some(run) = guard.as_ref() {
        run.stop.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub fn amp_status(amp: State<AmpState>) -> Result<Option<AmpStatus>, String> {
    let guard = amp.0.lock().map_err(|_| "Estado do Amp indisponível.")?;
    let Some(run) = guard.as_ref() else { return Ok(None) };
    let s = &run.stats;
    let (overflows, underruns, resynced, invalid, flags) = (
        s.input_overflows.load(Ordering::Relaxed),
        s.output_underruns.load(Ordering::Relaxed),
        s.resynced_samples.load(Ordering::Relaxed),
        s.invalid_samples.load(Ordering::Relaxed),
        s.error_flags.load(Ordering::Relaxed),
    );
    let max = run.live.load_max.load(Ordering::Relaxed) as f64 / 100.0;
    Ok(Some(AmpStatus {
        running: !run.done.load(Ordering::Relaxed),
        info: run.info.clone(),
        seconds: run.started.elapsed().as_secs_f64(),
        load_avg_percent: run.live.load_avg.load(Ordering::Relaxed) as f64 / 100.0,
        load_max_percent: max,
        processed_frames: s.processed_frames.load(Ordering::Relaxed),
        input_clips: s.input_clips.load(Ordering::Relaxed),
        input_overflows: overflows,
        output_underruns: underruns,
        resynced_samples: resynced,
        invalid_samples: invalid,
        error_flags: flags,
        ok: flags == 0 && overflows == 0 && underruns == 0 && resynced == 0 && invalid == 0 && max < 100.0,
    }))
}
