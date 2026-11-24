//! Ligação com os dispositivos reais (cpal).
//!
//! Uma thread própria é dona dos streams de áudio e recebe comandos por canal.
//! As callbacks de áudio não alocam nem travam: conversam com o resto por
//! ring buffers sem lock (rtrb).

use crate::click::ClickBank;
use crate::sequence::{SequencePlan, SequencePlayer, SequenceMixer};
use crate::drums::DrumPlayer;
use crate::preview::{ChordPreview, PreviewPlan};
use crate::latency::{Connection, DeviceInfo};
use crate::metronome::{Metronome, MetronomeSettings, Tick};
use crate::spectrum::SpectrumAnalyzer;
use crate::pitch::{note_from_frequency, rms, NoteReading, PitchDetector};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, InterfaceType, SampleFormat, SizedSample};
use serde::Serialize;
use std::str::FromStr;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU16, AtomicU32, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

const DEVICE_POLL: Duration = Duration::from_secs(3);
const TUNER_WINDOW: usize = 4096;
const TUNER_EMIT_EVERY: Duration = Duration::from_millis(30);
const SILENCE_RMS: f32 = 0.004;
const MEASURE_TIMEOUT: Duration = Duration::from_millis(1500);
const MEASURE_SETTLE: Duration = Duration::from_millis(250);

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EngineEvent {
    #[serde(rename_all = "camelCase")]
    SequenceState { running: bool, run_id: u32 },
    #[serde(rename_all = "camelCase")]
    SequenceBeat { run_id: u32, step: usize, beats_left: u32, audible_in_ms: f32 },
    #[serde(rename_all = "camelCase")]
    Tick { tick: Tick, audible_in_ms: f32 },
    #[serde(rename_all = "camelCase")]
    Spectrum { powers: Vec<f32>, sample_rate: u32, fft_size: usize, level: f32, a4: f32 },
    #[serde(rename_all = "camelCase")]
    Pitch { reading: Option<NoteReading>, clarity: f32, level: f32 },
    #[serde(rename_all = "camelCase")]
    Latency { direction: Direction, device_id: String, ms: f32 },
    #[serde(rename_all = "camelCase")]
    Devices { devices: Vec<DeviceInfo> },
    #[serde(rename_all = "camelCase")]
    MetronomeState { running: bool, device_id: Option<String> },
    #[serde(rename_all = "camelCase")]
    TunerState { running: bool, device_id: Option<String> },
    #[serde(rename_all = "camelCase")]
    Error { code: ErrorCode, message: String, direction: Option<Direction> },
    #[serde(rename_all = "camelCase")]
    TunerStream { device_id: String, channel: u16, channels: u16, sample_rate: u32, buffer_frames: Option<u32>, source: &'static str },
    /// Medição de atraso de todos os dispositivos: começou, terminou ou foi recusada.
    #[serde(rename_all = "camelCase")]
    MeasureState { running: bool, measured: u32, failed: Vec<String>, busy: bool },
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Direction {
    Input,
    Output,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    NoDevice,
    DeviceLost,
    StreamFailed,
    UnsupportedFormat,
}

// Plano fixo via canal: evita alocar ou liberar a sequência na callback.
#[allow(clippy::large_enum_variant)]
enum Command {
    SequenceMixer { run_id: u32, mixer: SequenceMixer },
    StartSequence { device_id: Option<String>, settings: MetronomeSettings, plan: SequencePlan },
    Preview { device_id: Option<String>, frequencies: Vec<f32>, volume: f32 },
    StopPreview,
    /// Canal de saída por interface (0 = todos os canais, como antes; n = só o canal n).
    SetOutputChannels(HashMap<String, u16>),
    StartMetronome { device_id: Option<String>, settings: MetronomeSettings },
    UpdateMetronome(MetronomeSettings),
    StopMetronome,
    StartTuner { device_id: Option<String>, channel: u16, a4: f32, buffer_frames: Option<u32> },
    SetA4(f32),
    SetSpectrum(bool),
    StopTuner,
    RefreshDevices,
    MeasureLatency,
    Shutdown,
}

#[allow(clippy::large_enum_variant)]
enum AudioCmd {
    Sequence(SequencePlan),
    Mixer(u32, SequenceMixer),
    Start,
    Stop,
    Preview(PreviewPlan),
    StopPreview,
    Settings(MetronomeSettings),
    Bank(Box<ClickBank>),
}

/// Ponta de controle do motor. Pode ser clonada e usada de qualquer thread.
#[derive(Clone)]
pub struct EngineHandle {
    tx: Sender<Command>,
    _thread: Arc<ThreadGuard>,
}

struct ThreadGuard {
    tx: Sender<Command>,
    handle: Option<JoinHandle<()>>,
}

impl Drop for ThreadGuard {
    fn drop(&mut self) {
        let _ = self.tx.send(Command::Shutdown);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

impl EngineHandle {
    pub fn sequence_mixer(&self, run_id: u32, mixer: SequenceMixer) { let _ = self.tx.send(Command::SequenceMixer { run_id, mixer }); }
    pub fn start_sequence(&self, device_id: Option<String>, settings: MetronomeSettings, plan: SequencePlan) {
        let _ = self.tx.send(Command::StartSequence { device_id, settings, plan });
    }
    pub fn preview_chord(&self, device_id: Option<String>, frequencies: Vec<f32>, volume: f32) {
        let _ = self.tx.send(Command::Preview { device_id, frequencies, volume });
    }
    pub fn stop_preview(&self) { let _ = self.tx.send(Command::StopPreview); }
    /// Canal de saída por interface. Vale para metrônomo, prévia, sequência e bateria.
    pub fn set_output_channels(&self, channels: HashMap<String, u16>) { let _ = self.tx.send(Command::SetOutputChannels(channels)); }
    /// Abre cada entrada e saída por um instante para medir o atraso real.
    /// Recusa enquanto o metrônomo ou o afinador estiverem ligados.
    pub fn measure_latency(&self) {
        let _ = self.tx.send(Command::MeasureLatency);
    }
    pub fn start_metronome(&self, device_id: Option<String>, settings: MetronomeSettings) {
        let _ = self.tx.send(Command::StartMetronome { device_id, settings });
    }
    pub fn update_metronome(&self, settings: MetronomeSettings) {
        let _ = self.tx.send(Command::UpdateMetronome(settings));
    }
    pub fn stop_metronome(&self) {
        let _ = self.tx.send(Command::StopMetronome);
    }
    pub fn start_tuner(&self, device_id: Option<String>, channel: u16, a4: f32) {
        self.start_tuner_with_buffer(device_id, channel, a4, None);
    }
    pub fn start_tuner_with_buffer(&self, device_id: Option<String>, channel: u16, a4: f32, buffer_frames: Option<u32>) {
        let _ = self.tx.send(Command::StartTuner { device_id, channel, a4, buffer_frames });
    }
    pub fn set_spectrum(&self, enabled: bool) { let _ = self.tx.send(Command::SetSpectrum(enabled)); }
    pub fn set_a4(&self, a4: f32) {
        let _ = self.tx.send(Command::SetA4(a4));
    }
    pub fn stop_tuner(&self) {
        let _ = self.tx.send(Command::StopTuner);
    }
    pub fn refresh_devices(&self) {
        let _ = self.tx.send(Command::RefreshDevices);
    }
}

pub fn start_engine(on_event: impl Fn(EngineEvent) + Send + 'static) -> EngineHandle {
    let (tx, rx) = mpsc::channel::<Command>();
    let handle = std::thread::Builder::new()
        .name("audio-engine".into())
        .spawn(move || EngineThread::new(Box::new(on_event)).run(rx))
        .expect("não foi possível criar a thread de áudio");
    EngineHandle {
        tx: tx.clone(),
        _thread: Arc::new(ThreadGuard { tx, handle: Some(handle) }),
    }
}

/// Lista os dispositivos agora (também usado pela thread do motor).
pub fn list_devices() -> Vec<DeviceInfo> {
    let host = cpal::default_host();
    let default_in = host.default_input_device().and_then(|d| d.id().ok()).map(|i| i.to_string());
    let default_out = host.default_output_device().and_then(|d| d.id().ok()).map(|i| i.to_string());
    let Ok(devices) = host.devices() else { return Vec::new() };

    let mut out = Vec::new();
    for d in devices {
        let Ok(id) = d.id() else { continue };
        let id = id.to_string();
        let desc = d.description().ok();
        let name = desc.as_ref().map(|x| x.name().to_string()).unwrap_or_else(|| id.clone());
        let manufacturer = desc.as_ref().and_then(|x| x.manufacturer().map(str::to_string));
        let connection = desc.as_ref().map(|x| map_interface(x.interface_type())).unwrap_or(Connection::Unknown);
        let in_cfg = d.default_input_config().ok();
        let out_cfg = d.default_output_config().ok();
        let any_cfg = in_cfg.as_ref().or(out_cfg.as_ref());
        let (buffer_min, buffer_max) = match any_cfg.map(|c| *c.buffer_size()) {
            Some(cpal::SupportedBufferSize::Range { min, max }) => (Some(min), Some(max)),
            _ => (None, None),
        };
        out.push(DeviceInfo {
            is_default_input: default_in.as_deref() == Some(id.as_str()),
            is_default_output: default_out.as_deref() == Some(id.as_str()),
            id,
            name,
            manufacturer,
            connection,
            is_input: in_cfg.is_some(),
            is_output: out_cfg.is_some(),
            input_channels: in_cfg.as_ref().map(|c| c.channels()).unwrap_or(0),
            output_channels: out_cfg.as_ref().map(|c| c.channels()).unwrap_or(0),
            sample_rate: any_cfg.map(|c| c.sample_rate()),
            buffer_min,
            buffer_max,
            measured_input_ms: None,
            measured_output_ms: None,
        });
    }
    out
}

fn map_interface(t: InterfaceType) -> Connection {
    match t {
        InterfaceType::BuiltIn => Connection::BuiltIn,
        InterfaceType::Usb => Connection::Usb,
        InterfaceType::Bluetooth => Connection::Bluetooth,
        InterfaceType::Pci => Connection::Pci,
        InterfaceType::FireWire => Connection::FireWire,
        InterfaceType::Thunderbolt => Connection::Thunderbolt,
        InterfaceType::Hdmi => Connection::Hdmi,
        InterfaceType::Line => Connection::Line,
        InterfaceType::Spdif => Connection::Spdif,
        InterfaceType::Network => Connection::Network,
        InterfaceType::Virtual => Connection::Virtual,
        InterfaceType::DisplayPort => Connection::DisplayPort,
        InterfaceType::Aggregate => Connection::Aggregate,
        _ => Connection::Unknown,
    }
}

fn find_device(input: bool, id: Option<&str>) -> Option<cpal::Device> {
    let host = cpal::default_host();
    if let Some(id) = id {
        if let Ok(parsed) = cpal::DeviceId::from_str(id) {
            if let Some(d) = host.device_by_id(&parsed) {
                return Some(d);
            }
        }
    }
    if input { host.default_input_device() } else { host.default_output_device() }
}

struct MetronomeStream {
    sequence_run: u32,
    drums_enabled: bool,
    running: bool,
    preview_until: Option<Instant>,
    _stream: cpal::Stream,
    device_id: String,
    cmd: rtrb::Producer<AudioCmd>,
    ticks: rtrb::Consumer<(Tick, f32)>,
    sequence_beats: rtrb::Consumer<(usize, u32, u32, f32)>,
    garbage: rtrb::Consumer<Box<ClickBank>>,
    sample_rate: u32,
    settings: MetronomeSettings,
    latency_ms: Arc<AtomicU32>,
    last_latency: f32,
    channels: u16,
    route: Arc<AtomicU16>,
}

struct TunerStream {
    channels: u16,
    sample_rate: u32,
    _stream: cpal::Stream,
    device_id: String,
    samples: rtrb::Consumer<f32>,
    detector: PitchDetector,
    spectrum: Option<SpectrumAnalyzer>,
    last_spectrum: Instant,
    window: Vec<f32>,
    a4: f32,
    last_emit: Instant,
    latency_ms: Arc<AtomicU32>,
    last_latency: f32,
}

struct EngineThread {
    emit: Box<dyn Fn(EngineEvent) + Send>,
    metronome: Option<MetronomeStream>,
    tuner: Option<TunerStream>,
    spectrum_enabled: bool,
    errors_tx: Sender<(Direction, String)>,
    output_channels: HashMap<String, u16>,
    errors_rx: mpsc::Receiver<(Direction, String)>,
    known_devices: Vec<String>,
    last_poll: Instant,
}

impl EngineThread {
    fn new(emit: Box<dyn Fn(EngineEvent) + Send>) -> Self {
        let (errors_tx, errors_rx) = mpsc::channel();
        Self {
            emit,
            metronome: None,
            tuner: None,
            spectrum_enabled: false,
            errors_tx,
            output_channels: HashMap::new(),
            errors_rx,
            known_devices: Vec::new(),
            last_poll: Instant::now() - DEVICE_POLL,
        }
    }

    fn run(mut self, rx: mpsc::Receiver<Command>) {
        loop {
            match rx.recv_timeout(Duration::from_millis(8)) {
                Ok(Command::Shutdown) | Err(RecvTimeoutError::Disconnected) => break,
                Ok(cmd) => self.handle(cmd),
                Err(RecvTimeoutError::Timeout) => {}
            }
            self.pump();
        }
    }

    fn error(&self, code: ErrorCode, message: impl Into<String>) {
        (self.emit)(EngineEvent::Error { code, message: message.into(), direction: None });
    }

    fn handle(&mut self, cmd: Command) {
        match cmd {
            Command::SequenceMixer { run_id, mixer } => {
                if let Some(m) = self.metronome.as_mut() {
                    if m.running && m.sequence_run == run_id && mixer.valid() {
                        if mixer.drums.enabled && m.settings.beats_per_bar != 4 { self.error(ErrorCode::StreamFailed, "A bateria precisa de compasso 4/4."); return; }
                        if m.cmd.push(AudioCmd::Mixer(run_id, mixer)).is_err() { self.error(ErrorCode::StreamFailed, "Aguarde um instante antes de ajustar o som."); }
                        else { m.drums_enabled = mixer.drums.enabled; }
                    }
                }
            }
            Command::StartSequence { device_id, settings, plan } => {
                if self.metronome.as_ref().is_some_and(|m| device_id.as_ref().is_some_and(|id| *id != m.device_id)) { self.metronome = None; }
                if self.metronome.is_none() {
                    match self.open_metronome(device_id.as_deref(), settings, false) {
                        Ok(m) => self.metronome = Some(m),
                        Err((code, message)) => { self.error(code, message); (self.emit)(EngineEvent::SequenceState { running: false, run_id: plan.run_id }); return; }
                    }
                }
                if let Some(m) = self.metronome.as_mut() { m.drums_enabled = plan.drums.enabled; }
                self.handle(Command::UpdateMetronome(settings));
                if let Some(m) = self.metronome.as_mut() {
                    if m.cmd.push(AudioCmd::Sequence(plan)).is_ok() {
                        m.running = true;
                        m.sequence_run = plan.run_id;
                        m.drums_enabled = plan.drums.enabled;
                        (self.emit)(EngineEvent::MetronomeState { running: true, device_id: Some(m.device_id.clone()) });
                        (self.emit)(EngineEvent::SequenceState { running: true, run_id: plan.run_id });
                    } else {
                        self.handle(Command::StopMetronome);
                        self.error(ErrorCode::StreamFailed, "Aguarde um instante e tente iniciar novamente.");
                    }
                } else { (self.emit)(EngineEvent::SequenceState { running: false, run_id: self.metronome.as_ref().map_or(0, |m| m.sequence_run) }); }
            }
            Command::Preview { device_id, frequencies, volume } => {
                let Some(plan) = PreviewPlan::new(&frequencies, volume) else {
                    self.error(ErrorCode::StreamFailed, "Prévia de acorde inválida."); return;
                };
                if self.metronome.as_ref().is_some_and(|m| !m.running && device_id.as_ref().is_some_and(|id| *id != m.device_id)) { self.metronome = None; }
                if self.metronome.is_none() {
                    match self.open_metronome(device_id.as_deref(), MetronomeSettings::default(), false) {
                        Ok(m) => self.metronome = Some(m),
                        Err((code, message)) => { self.error(code, message); return; }
                    }
                }
                if let Some(m) = self.metronome.as_mut() {
                    m.preview_until = Some(Instant::now() + Duration::from_secs(2));
                    if m.cmd.push(AudioCmd::Preview(plan)).is_err() {
                        self.error(ErrorCode::StreamFailed, "Aguarde um instante e toque de novo.");
                    }
                }
            }
            Command::SetOutputChannels(map) => {
                self.output_channels = map;
                if let Some(m) = self.metronome.as_ref() {
                    let ch = self.output_channels.get(&m.device_id).copied().unwrap_or(0);
                    if ch > m.channels {
                        m.route.store(0, Ordering::Relaxed);
                        self.error(ErrorCode::StreamFailed, format!("A saída não tem canal {ch}. Tocando em todos os canais; escolha outro em Ajustes."));
                    } else {
                        m.route.store(ch, Ordering::Relaxed);
                    }
                }
            }
            Command::StopPreview => {
                if let Some(m) = self.metronome.as_mut() { let _ = m.cmd.push(AudioCmd::StopPreview); }
            }
            Command::StartMetronome { device_id, settings } => {
                (self.emit)(EngineEvent::SequenceState { running: false, run_id: self.metronome.as_ref().map_or(0, |m| m.sequence_run) });
                if self.metronome.as_ref().is_some_and(|m| device_id.as_ref().is_none_or(|id| *id == m.device_id)) {
                    self.handle(Command::UpdateMetronome(settings));
                    if let Some(m) = self.metronome.as_mut() {
                        let _ = m.cmd.push(AudioCmd::Start); m.running = true;
                        (self.emit)(EngineEvent::MetronomeState { running: true, device_id: Some(m.device_id.clone()) });
                    }
                    return;
                }
                self.metronome = None;
                match self.open_metronome(device_id.as_deref(), settings, true) {
                    Ok(m) => {
                        (self.emit)(EngineEvent::MetronomeState { running: true, device_id: Some(m.device_id.clone()) });
                        self.metronome = Some(m);
                    }
                    Err((code, msg)) => {
                        self.error(code, msg);
                        (self.emit)(EngineEvent::MetronomeState { running: false, device_id: None });
                    }
                }
            }
            Command::UpdateMetronome(settings) => {
                let settings = settings.sanitized();
                if self.metronome.as_ref().is_some_and(|m| m.running && m.drums_enabled && settings.beats_per_bar != 4) {
                    self.error(ErrorCode::StreamFailed, "A bateria precisa de compasso 4/4."); self.handle(Command::StopMetronome); return;
                }
                if let Some(m) = self.metronome.as_mut() {
                    if settings.sound != m.settings.sound {
                        let bank = Box::new(ClickBank::new(settings.sound, m.sample_rate));
                        let _ = m.cmd.push(AudioCmd::Bank(bank));
                    }
                    let _ = m.cmd.push(AudioCmd::Settings(settings));
                    m.settings = settings;
                }
            }
            Command::StopMetronome => {
                (self.emit)(EngineEvent::SequenceState { running: false, run_id: self.metronome.as_ref().map_or(0, |m| m.sequence_run) });
                if let Some(m) = self.metronome.as_mut() {
                    let _ = m.cmd.push(AudioCmd::Stop); m.running = false;
                    let tail = Instant::now() + Duration::from_millis(200);
                    m.preview_until = Some(m.preview_until.map_or(tail, |until| until.max(tail)));
                }
                (self.emit)(EngineEvent::MetronomeState { running: false, device_id: None });
            }
            Command::StartTuner { device_id, channel, a4, buffer_frames } => {
                self.tuner = None;
                match self.open_tuner(device_id.as_deref(), channel, a4, buffer_frames) {
                    Ok(t) => {
                        (self.emit)(EngineEvent::TunerStream { device_id: t.device_id.clone(), channel, channels: t.channels, sample_rate: t.sample_rate, buffer_frames, source: "nativeTimestamp" });
                        (self.emit)(EngineEvent::TunerState { running: true, device_id: Some(t.device_id.clone()) });
                        self.tuner = Some(t);
                    }
                    Err((code, msg)) => {
                        (self.emit)(EngineEvent::Error { code, message: msg, direction: Some(Direction::Input) });
                        (self.emit)(EngineEvent::TunerState { running: false, device_id: None });
                    }
                }
            }
            Command::SetSpectrum(enabled) => {
                self.spectrum_enabled = enabled;
                if let Some(t) = self.tuner.as_mut() {
                    t.spectrum = enabled.then(|| SpectrumAnalyzer::new(t.sample_rate));
                    t.window.clear();
                }
            }
            Command::SetA4(a4) => {
                if let Some(t) = self.tuner.as_mut() {
                    t.a4 = a4.clamp(400.0, 480.0);
                }
            }
            Command::StopTuner => {
                self.tuner = None;
                (self.emit)(EngineEvent::TunerState { running: false, device_id: None });
            }
            Command::MeasureLatency => self.measure_latency(),
            Command::RefreshDevices => {
                self.known_devices.clear();
                self.last_poll = Instant::now() - DEVICE_POLL;
            }
            Command::Shutdown => {}
        }
    }

    fn measure_latency(&mut self) {
        if self.metronome.is_some() || self.tuner.is_some() {
            (self.emit)(EngineEvent::MeasureState { running: false, measured: 0, failed: Vec::new(), busy: true });
            return;
        }
        (self.emit)(EngineEvent::MeasureState { running: true, measured: 0, failed: Vec::new(), busy: false });
        let mut measured = 0;
        let mut failed = Vec::new();
        // Lê o atraso do stream assim que o primeiro callback publica um valor.
        let wait = |cell: &Arc<AtomicU32>| -> Option<f32> {
            let start = Instant::now();
            while start.elapsed() < MEASURE_TIMEOUT {
                std::thread::sleep(Duration::from_millis(20));
                let ms = f32::from_bits(cell.load(Ordering::Relaxed));
                if ms > 0.0 && ms.is_finite() {
                    // Mais alguns callbacks para não ficar com o primeiro, que costuma variar.
                    std::thread::sleep(MEASURE_SETTLE);
                    let settled = f32::from_bits(cell.load(Ordering::Relaxed));
                    return Some(if settled > 0.0 && settled.is_finite() { settled } else { ms });
                }
            }
            None
        };
        for d in list_devices() {
            if d.is_input && d.input_channels > 0 {
                match self.open_tuner(Some(&d.id), 0, 440.0, None) {
                    Ok(t) => match wait(&t.latency_ms) {
                        Some(ms) => { measured += 1; (self.emit)(EngineEvent::Latency { direction: Direction::Input, device_id: d.id.clone(), ms }); }
                        None => failed.push(d.name.clone()),
                    },
                    Err(_) => failed.push(d.name.clone()),
                }
            }
            if d.is_output && d.output_channels > 0 {
                let silent = MetronomeSettings { volume: 0.0, ..MetronomeSettings::default() };
                match self.open_metronome(Some(&d.id), silent, false) {
                    Ok(m) => match wait(&m.latency_ms) {
                        Some(ms) => { measured += 1; (self.emit)(EngineEvent::Latency { direction: Direction::Output, device_id: d.id.clone(), ms }); }
                        None => failed.push(d.name.clone()),
                    },
                    Err(_) => failed.push(d.name.clone()),
                }
            }
        }
        // Erros de stream gerados durante a medição não devem derrubar nada depois.
        while self.errors_rx.try_recv().is_ok() {}
        failed.dedup();
        (self.emit)(EngineEvent::MeasureState { running: false, measured, failed, busy: false });
    }

    /// Trabalho periódico: repassa cliques, analisa o afinador, vigia dispositivos.
    fn pump(&mut self) {
        if self.metronome.as_ref().is_some_and(|m| !m.running && m.preview_until.is_some_and(|until| Instant::now() >= until)) { self.metronome = None; }
        if let Some(m) = self.metronome.as_mut() {
            while let Ok((tick, audible_in_ms)) = m.ticks.pop() {
                (self.emit)(EngineEvent::Tick { tick, audible_in_ms });
            }
            while let Ok((step, beats_left, run_id, audible_in_ms)) = m.sequence_beats.pop() {
                (self.emit)(EngineEvent::SequenceBeat { step, beats_left, run_id, audible_in_ms });
            }
            while m.garbage.pop().is_ok() {}
            let ms = f32::from_bits(m.latency_ms.load(Ordering::Relaxed));
            if ms > 0.0 && (ms - m.last_latency).abs() >= 1.0 {
                m.last_latency = ms;
                (self.emit)(EngineEvent::Latency { direction: Direction::Output, device_id: m.device_id.clone(), ms });
            }
        }

        if let Some(t) = self.tuner.as_mut() {
            let mut fresh = false;
            while let Ok(s) = t.samples.pop() {
                t.window.push(s);
                fresh = true;
            }
            let retain = t.spectrum.as_ref().map_or(TUNER_WINDOW, |s| s.size);
            if t.window.len() > retain * 4 {
                let drop = t.window.len() - retain;
                t.window.drain(..drop);
            }
            if fresh && t.window.len() >= TUNER_WINDOW && t.last_emit.elapsed() >= TUNER_EMIT_EVERY {
                let start = t.window.len() - TUNER_WINDOW;
                let frame = &t.window[start..];
                let level = rms(frame);
                let est = if level >= SILENCE_RMS { t.detector.detect(frame) } else { None };
                let reading = est.and_then(|e| note_from_frequency(e.frequency, t.a4));
                (self.emit)(EngineEvent::Pitch { reading, clarity: est.map(|e| e.clarity).unwrap_or(0.0), level });
                t.last_emit = Instant::now();
                if let Some(spectrum) = t.spectrum.as_mut() {
                    if t.window.len() >= spectrum.size && t.last_spectrum.elapsed() >= Duration::from_millis(120) {
                        let samples = &t.window[t.window.len() - spectrum.size..];
                        let level = rms(samples);
                        let powers = spectrum.analyze(samples);
                        (self.emit)(EngineEvent::Spectrum { powers, sample_rate: t.sample_rate, fft_size: spectrum.size, level, a4: t.a4 });
                        t.last_spectrum = Instant::now();
                    }
                }
                if t.window.len() > retain { t.window.drain(..t.window.len() - retain); }
            }
            let ms = f32::from_bits(t.latency_ms.load(Ordering::Relaxed));
            if ms > 0.0 && (ms - t.last_latency).abs() >= 1.0 {
                t.last_latency = ms;
                (self.emit)(EngineEvent::Latency { direction: Direction::Input, device_id: t.device_id.clone(), ms });
            }
        }

        while let Ok((direction, message)) = self.errors_rx.try_recv() {
            match direction {
                Direction::Output => {
                    let run_id = self.metronome.as_ref().map_or(0, |m| m.sequence_run);
                    self.metronome = None;
                    (self.emit)(EngineEvent::SequenceState { running: false, run_id });
                    (self.emit)(EngineEvent::MetronomeState { running: false, device_id: None });
                }
                Direction::Input => {
                    self.tuner = None;
                    (self.emit)(EngineEvent::TunerState { running: false, device_id: None });
                }
            }
            (self.emit)(EngineEvent::Error { code: ErrorCode::DeviceLost, message, direction: Some(direction) });
            self.known_devices.clear();
        }

        if self.last_poll.elapsed() >= DEVICE_POLL {
            self.last_poll = Instant::now();
            let devices = list_devices();
            let mut ids: Vec<String> = devices.iter().map(|d| format!("{}:{}:{}:{}:{}", d.id, d.is_default_input, d.is_default_output, d.input_channels, d.output_channels)).collect();
            ids.sort();
            if ids != self.known_devices {
                self.known_devices = ids;
                (self.emit)(EngineEvent::Devices { devices });
            }
        }
    }

    fn open_metronome(
        &self,
        device_id: Option<&str>,
        settings: MetronomeSettings,
        running: bool,
    ) -> Result<MetronomeStream, (ErrorCode, String)> {
        let device = find_device(false, device_id).filter(|d| device_id.is_none() || d.id().ok().is_some_and(|id| Some(id.to_string().as_str()) == device_id)).ok_or((ErrorCode::NoDevice, "Nenhuma saída de áudio".into()))?;
        let id = device.id().map(|i| i.to_string()).unwrap_or_default();
        let supported = device
            .default_output_config()
            .map_err(|e| (ErrorCode::StreamFailed, e.to_string()))?;
        let format = supported.sample_format();
        let config: cpal::StreamConfig = supported.config();
        let sample_rate = config.sample_rate;
        if !(8000..=192000).contains(&sample_rate) { return Err((ErrorCode::UnsupportedFormat, "Taxa de saída não suportada.".into())); }
        if config.channels == 0 || config.channels > 128 { return Err((ErrorCode::UnsupportedFormat, "Saída com número de canais não suportado.".into())); }
        let wanted = self.output_channels.get(&id).copied().unwrap_or(0);
        if wanted > config.channels { return Err((ErrorCode::StreamFailed, format!("A saída não tem canal {wanted}. Escolha outro canal em Ajustes."))); }
        let route = Arc::new(AtomicU16::new(wanted));

        let (cmd_tx, cmd_rx) = rtrb::RingBuffer::<AudioCmd>::new(64);
        let (tick_tx, tick_rx) = rtrb::RingBuffer::<(Tick, f32)>::new(256);
        let (sequence_tx, sequence_rx) = rtrb::RingBuffer::<(usize, u32, u32, f32)>::new(256);
        let (garbage_tx, garbage_rx) = rtrb::RingBuffer::<Box<ClickBank>>::new(16);
        let latency = Arc::new(AtomicU32::new(0));

        let mut metro = Metronome::new(sample_rate, settings);
        if running { metro.start(); }
        let ctx = OutputCtx {
            drums: DrumPlayer::new(sample_rate),
            sequence_preview: ChordPreview::new(sample_rate),
            sequence_gain: 0.5,
            sequence_target: 0.5,
            sequence: SequencePlayer::default(),
            sequence_beats: sequence_tx,
            click_gain: 1.0,
            click_target: 1.0,
            preview: ChordPreview::new(sample_rate),
            pending_bank: None,
            metro,
            cmd: cmd_rx,
            ticks: tick_tx,
            garbage: garbage_tx,
            scratch: vec![0.0; 16_384],
            latency: latency.clone(),
            route: route.clone(),
        };

        let errors = self.errors_tx.clone();
        let stream = match format {
            SampleFormat::F32 => build_output::<f32>(&device, &config, ctx, errors),
            SampleFormat::I16 => build_output::<i16>(&device, &config, ctx, errors),
            SampleFormat::I32 => build_output::<i32>(&device, &config, ctx, errors),
            SampleFormat::U16 => build_output::<u16>(&device, &config, ctx, errors),
            other => return Err((ErrorCode::UnsupportedFormat, format!("Formato {other} não suportado"))),
        }
        .map_err(|e| (ErrorCode::StreamFailed, e.to_string()))?;
        stream.play().map_err(|e| (ErrorCode::StreamFailed, e.to_string()))?;

        Ok(MetronomeStream {
            sequence_run: 0,
            drums_enabled: false,
            running,
            preview_until: None,
            _stream: stream,
            device_id: id,
            cmd: cmd_tx,
            ticks: tick_rx,
            sequence_beats: sequence_rx,
            garbage: garbage_rx,
            sample_rate,
            settings: settings.sanitized(),
            latency_ms: latency,
            last_latency: 0.0,
            channels: config.channels,
            route,
        })
    }

    fn open_tuner(&self, device_id: Option<&str>, channel: u16, a4: f32, buffer_frames: Option<u32>) -> Result<TunerStream, (ErrorCode, String)> {
        let device = find_device(true, device_id).filter(|d| device_id.is_none() || d.id().ok().is_some_and(|id| Some(id.to_string().as_str()) == device_id)).ok_or((ErrorCode::NoDevice, "Nenhuma entrada de áudio".into()))?;
        let id = device.id().map(|i| i.to_string()).unwrap_or_default();
        let supported = device
            .default_input_config()
            .map_err(|e| (ErrorCode::StreamFailed, e.to_string()))?;
        let format = supported.sample_format();
        let mut config: cpal::StreamConfig = supported.config();
        if let Some(frames) = buffer_frames {
            let valid = match supported.buffer_size() {
                cpal::SupportedBufferSize::Range { min, max } => frames >= *min && frames <= *max,
                _ => false,
            };
            if !valid { return Err((ErrorCode::StreamFailed, "Buffer não suportado. Escolha Automático.".into())); }
            config.buffer_size = cpal::BufferSize::Fixed(frames);
        }
        let channels = config.channels.max(1) as usize;
        if channel as usize >= channels { return Err((ErrorCode::StreamFailed, "Canal indisponível nesta entrada. Escolha outro canal.".into())); }
        let channel = channel as usize;
        let sample_rate = config.sample_rate;

        let (tx, rx) = rtrb::RingBuffer::<f32>::new(sample_rate as usize);
        let latency = Arc::new(AtomicU32::new(0));
        let ctx = InputCtx { samples: tx, channels, channel, latency: latency.clone() };
        let errors = self.errors_tx.clone();
        let stream = match format {
            SampleFormat::F32 => build_input::<f32>(&device, &config, ctx, errors),
            SampleFormat::I16 => build_input::<i16>(&device, &config, ctx, errors),
            SampleFormat::I32 => build_input::<i32>(&device, &config, ctx, errors),
            SampleFormat::U16 => build_input::<u16>(&device, &config, ctx, errors),
            other => return Err((ErrorCode::UnsupportedFormat, format!("Formato {other} não suportado"))),
        }
        .map_err(|e| (ErrorCode::StreamFailed, e.to_string()))?;
        stream.play().map_err(|e| (ErrorCode::StreamFailed, e.to_string()))?;

        Ok(TunerStream {
            channels: config.channels,
            sample_rate,
            _stream: stream,
            device_id: id,
            samples: rx,
            detector: PitchDetector::new(sample_rate, TUNER_WINDOW),
            spectrum: self.spectrum_enabled.then(|| SpectrumAnalyzer::new(sample_rate)),
            last_spectrum: Instant::now(),
            window: Vec::with_capacity(TUNER_WINDOW * 4),
            a4: a4.clamp(400.0, 480.0),
            last_emit: Instant::now(),
            latency_ms: latency,
            last_latency: 0.0,
        })
    }
}

struct OutputCtx {
    drums: DrumPlayer,
    sequence_preview: ChordPreview,
    sequence_gain: f32,
    sequence_target: f32,
    sequence: SequencePlayer,
    sequence_beats: rtrb::Producer<(usize, u32, u32, f32)>,
    click_gain: f32,
    click_target: f32,
    pending_bank: Option<Box<ClickBank>>,
    preview: ChordPreview,
    metro: Metronome,
    cmd: rtrb::Consumer<AudioCmd>,
    ticks: rtrb::Producer<(Tick, f32)>,
    garbage: rtrb::Producer<Box<ClickBank>>,
    scratch: Vec<f32>,
    latency: Arc<AtomicU32>,
    /// 0 = todos os canais; n = só o canal n (1-based). Lido sem lock na callback.
    route: Arc<AtomicU16>,
}

fn build_output<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mut ctx: OutputCtx,
    errors: Sender<(Direction, String)>,
) -> Result<cpal::Stream, cpal::Error>
where
    T: SizedSample + FromSample<f32>,
{
    let channels = config.channels as usize;
    let sample_rate = config.sample_rate as f32;
    device.build_output_stream(
        *config,
        move |data: &mut [T], info: &cpal::OutputCallbackInfo| {
            if ctx.pending_bank.is_some() && ctx.garbage.slots() > 0 {
                let bank = ctx.pending_bank.take().unwrap();
                let old = ctx.metro.swap_bank(bank);
                let _ = ctx.garbage.push(old);
            }
            for _ in 0..64 {
                if ctx.pending_bank.is_some() { break; }
                let Ok(cmd) = ctx.cmd.pop() else { break; };
                match cmd {
                    AudioCmd::Sequence(plan) => { ctx.preview.stop(); ctx.sequence_preview.stop(); ctx.drums.start(plan.drums); ctx.sequence_gain = plan.volume; ctx.sequence_target = plan.volume; ctx.click_gain = if plan.click { 1.0 } else { 0.0 }; ctx.sequence.start(plan); ctx.click_target = ctx.sequence.click_gain(); ctx.metro.start(); }
                    AudioCmd::Mixer(run_id, mixer) => { if ctx.sequence.is_running() && ctx.sequence.run_id() == run_id { ctx.drums.update(mixer.drums); ctx.sequence_target = mixer.volume; ctx.click_target = if mixer.click { 1.0 } else { 0.0 }; } }
                    AudioCmd::Start => { ctx.sequence.stop(); ctx.sequence_preview.stop(); ctx.drums.stop(); ctx.click_target = 1.0; ctx.metro.start(); }
                    AudioCmd::Stop => { if ctx.sequence.is_running() { ctx.sequence.stop(); ctx.sequence_preview.stop(); ctx.drums.stop(); } ctx.metro.stop(); }
                    AudioCmd::Preview(plan) => ctx.preview.play(plan),
                    AudioCmd::StopPreview => ctx.preview.stop(),
                    AudioCmd::Settings(s) => ctx.metro.set_settings(s),
                    AudioCmd::Bank(b) => {
                        if ctx.garbage.slots() == 0 { ctx.pending_bank = Some(b); break; }
                        let old = ctx.metro.swap_bank(b);
                        let _ = ctx.garbage.push(old);
                    }
                }
            }
            let ts = info.timestamp();
            let base_ms = ts
                .playback
                .checked_duration_since(ts.callback)
                .map(|d| d.as_secs_f32() * 1000.0)
                .unwrap_or(0.0);
            ctx.latency.store(base_ms.to_bits(), Ordering::Relaxed);

            // Blocos limitados à memória preparada. Não cresce a scratch na callback.
            let chunk_len = (ctx.scratch.len() / channels).max(1) * channels;
            let mut offset = 0;
            for chunk in data.chunks_mut(chunk_len) {
                let buf = &mut ctx.scratch[..chunk.len()];
                let ticks = &mut ctx.ticks;
                let mut attacks = [None; 128];
                let mut attack_count = 0;
                let sequence = &mut ctx.sequence;
                let sequence_beats = &mut ctx.sequence_beats;
                ctx.metro.render(buf, channels, |mut tick| {
                    let local_offset = tick.offset_in_block;
                    if tick.sub == 0 {
                        if let Some((step, left, attack)) = sequence.beat() {
                            let ms = base_ms + (offset + local_offset) as f32 / sample_rate * 1000.0;
                            let _ = sequence_beats.push((step, left, sequence.run_id(), ms));
                            if attack_count < attacks.len() { attacks[attack_count] = Some((local_offset, attack)); attack_count += 1; }
                        }
                    }
                    tick.offset_in_block += offset;
                    let ms = base_ms + tick.offset_in_block as f32 / sample_rate * 1000.0;
                    let _ = ticks.push((tick, ms));
                });
                let mut next_attack = 0;
                let bpm = ctx.metro.settings().bpm;
                let route = ctx.route.load(Ordering::Relaxed) as usize;
                for (frame_index, frame) in buf.chunks_exact_mut(channels).enumerate() {
                    if next_attack < attack_count {
                        if let Some((at, plan)) = attacks[next_attack] {
                            if at == frame_index { ctx.drums.sync_beat(bpm); if let Some(plan) = plan { ctx.sequence_preview.play(plan); } next_attack += 1; }
                        }
                    }
                    let preview = ctx.preview.sample();
                    ctx.sequence_gain += (ctx.sequence_target - ctx.sequence_gain).clamp(-1.0/(sample_rate*0.01), 1.0/(sample_rate*0.01));
                    let backing = ctx.sequence_preview.sample() * ctx.sequence_gain + ctx.drums.sample();
                    let target = ctx.click_target;
                    ctx.click_gain += (target - ctx.click_gain).clamp(-1.0 / (sample_rate * 0.01), 1.0 / (sample_rate * 0.01));
                    for (c, sample) in frame.iter_mut().enumerate() {
                        let mixed = (*sample * ctx.click_gain + preview + backing).clamp(-0.98, 0.98);
                        *sample = routed(route, c, mixed);
                    }
                }
                for (o, sample) in chunk.iter_mut().zip(buf.iter()) { *o = T::from_sample(*sample); }
                offset += chunk.len() / channels;
            }
        },
        move |err| {
            let _ = errors.send((Direction::Output, err.to_string()));
        },
        None,
    )
}

/// Saída roteada: com `route == 0` toca em todos os canais; com `route == n`, só no canal n (1-based).
#[inline]
fn routed(route: usize, channel: usize, sample: f32) -> f32 {
    if route == 0 || route == channel + 1 { sample } else { 0.0 }
}

#[cfg(test)]
mod routing_tests {
    use super::routed;
    #[test]
    fn todos_os_canais_por_padrao() {
        assert_eq!((0..4).map(|c| routed(0, c, 0.5)).collect::<Vec<_>>(), vec![0.5; 4]);
    }
    #[test]
    fn so_o_canal_escolhido() {
        assert_eq!((0..2).map(|c| routed(1, c, 0.5)).collect::<Vec<_>>(), vec![0.5, 0.0]);
        assert_eq!((0..2).map(|c| routed(2, c, 0.5)).collect::<Vec<_>>(), vec![0.0, 0.5]);
        assert_eq!((0..2).map(|c| routed(3, c, 0.5)).collect::<Vec<_>>(), vec![0.0, 0.0]);
    }
}

struct InputCtx {
    samples: rtrb::Producer<f32>,
    channels: usize,
    channel: usize,
    latency: Arc<AtomicU32>,
}

fn build_input<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mut ctx: InputCtx,
    errors: Sender<(Direction, String)>,
) -> Result<cpal::Stream, cpal::Error>
where
    T: SizedSample,
    f32: FromSample<T>,
{
    device.build_input_stream(
        *config,
        move |data: &[T], info: &cpal::InputCallbackInfo| {
            let ts = info.timestamp();
            let ms = ts
                .callback
                .checked_duration_since(ts.capture)
                .map(|d| d.as_secs_f32() * 1000.0)
                .unwrap_or(0.0);
            ctx.latency.store(ms.to_bits(), Ordering::Relaxed);
            for frame in data.chunks(ctx.channels) {
                if let Some(s) = frame.get(ctx.channel) {
                    // Se a fila encher (thread de análise atrasada), descarta.
                    let _ = ctx.samples.push(s.to_sample::<f32>());
                }
            }
        },
        move |err| {
            let _ = errors.send((Direction::Input, err.to_string()));
        },
        None,
    )
}
