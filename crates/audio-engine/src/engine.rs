//! Ligação com os dispositivos reais (cpal).
//!
//! Uma thread própria é dona dos streams de áudio e recebe comandos por canal.
//! As callbacks de áudio não alocam nem travam: conversam com o resto por
//! ring buffers sem lock (rtrb).

use crate::click::ClickBank;
use crate::latency::{Connection, DeviceInfo};
use crate::metronome::{Metronome, MetronomeSettings, Tick};
use crate::pitch::{note_from_frequency, rms, NoteReading, PitchDetector};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, InterfaceType, SampleFormat, SizedSample};
use serde::Serialize;
use std::str::FromStr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

const DEVICE_POLL: Duration = Duration::from_secs(3);
const TUNER_WINDOW: usize = 4096;
const TUNER_EMIT_EVERY: Duration = Duration::from_millis(30);
const SILENCE_RMS: f32 = 0.004;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EngineEvent {
    #[serde(rename_all = "camelCase")]
    Tick { tick: Tick, audible_in_ms: f32 },
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

enum Command {
    StartMetronome { device_id: Option<String>, settings: MetronomeSettings },
    UpdateMetronome(MetronomeSettings),
    StopMetronome,
    StartTuner { device_id: Option<String>, channel: u16, a4: f32, buffer_frames: Option<u32> },
    SetA4(f32),
    StopTuner,
    RefreshDevices,
    Shutdown,
}

enum AudioCmd {
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
    _stream: cpal::Stream,
    device_id: String,
    cmd: rtrb::Producer<AudioCmd>,
    ticks: rtrb::Consumer<(Tick, f32)>,
    garbage: rtrb::Consumer<Box<ClickBank>>,
    sample_rate: u32,
    settings: MetronomeSettings,
    latency_ms: Arc<AtomicU32>,
    last_latency: f32,
}

struct TunerStream {
    channels: u16,
    sample_rate: u32,
    _stream: cpal::Stream,
    device_id: String,
    samples: rtrb::Consumer<f32>,
    detector: PitchDetector,
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
    errors_tx: Sender<(Direction, String)>,
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
            errors_tx,
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
            Command::StartMetronome { device_id, settings } => {
                self.metronome = None;
                match self.open_metronome(device_id.as_deref(), settings) {
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
                self.metronome = None;
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
            Command::SetA4(a4) => {
                if let Some(t) = self.tuner.as_mut() {
                    t.a4 = a4.clamp(400.0, 480.0);
                }
            }
            Command::StopTuner => {
                self.tuner = None;
                (self.emit)(EngineEvent::TunerState { running: false, device_id: None });
            }
            Command::RefreshDevices => {
                self.known_devices.clear();
                self.last_poll = Instant::now() - DEVICE_POLL;
            }
            Command::Shutdown => {}
        }
    }

    /// Trabalho periódico: repassa cliques, analisa o afinador, vigia dispositivos.
    fn pump(&mut self) {
        if let Some(m) = self.metronome.as_mut() {
            while let Ok((tick, audible_in_ms)) = m.ticks.pop() {
                (self.emit)(EngineEvent::Tick { tick, audible_in_ms });
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
            if t.window.len() > TUNER_WINDOW * 4 {
                let drop = t.window.len() - TUNER_WINDOW;
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
                t.window.drain(..start);
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
                    self.metronome = None;
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
    ) -> Result<MetronomeStream, (ErrorCode, String)> {
        let device = find_device(false, device_id).ok_or((ErrorCode::NoDevice, "Nenhuma saída de áudio".into()))?;
        let id = device.id().map(|i| i.to_string()).unwrap_or_default();
        let supported = device
            .default_output_config()
            .map_err(|e| (ErrorCode::StreamFailed, e.to_string()))?;
        let format = supported.sample_format();
        let config: cpal::StreamConfig = supported.config();
        let sample_rate = config.sample_rate;

        let (cmd_tx, cmd_rx) = rtrb::RingBuffer::<AudioCmd>::new(64);
        let (tick_tx, tick_rx) = rtrb::RingBuffer::<(Tick, f32)>::new(256);
        let (garbage_tx, garbage_rx) = rtrb::RingBuffer::<Box<ClickBank>>::new(16);
        let latency = Arc::new(AtomicU32::new(0));

        let mut metro = Metronome::new(sample_rate, settings);
        metro.start();
        let ctx = OutputCtx {
            metro,
            cmd: cmd_rx,
            ticks: tick_tx,
            garbage: garbage_tx,
            scratch: vec![0.0; 16_384],
            latency: latency.clone(),
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
            _stream: stream,
            device_id: id,
            cmd: cmd_tx,
            ticks: tick_rx,
            garbage: garbage_rx,
            sample_rate,
            settings: settings.sanitized(),
            latency_ms: latency,
            last_latency: 0.0,
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
            window: Vec::with_capacity(TUNER_WINDOW * 4),
            a4: a4.clamp(400.0, 480.0),
            last_emit: Instant::now(),
            latency_ms: latency,
            last_latency: 0.0,
        })
    }
}

struct OutputCtx {
    metro: Metronome,
    cmd: rtrb::Consumer<AudioCmd>,
    ticks: rtrb::Producer<(Tick, f32)>,
    garbage: rtrb::Producer<Box<ClickBank>>,
    scratch: Vec<f32>,
    latency: Arc<AtomicU32>,
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
            while let Ok(cmd) = ctx.cmd.pop() {
                match cmd {
                    AudioCmd::Settings(s) => ctx.metro.set_settings(s),
                    AudioCmd::Bank(b) => {
                        let old = ctx.metro.swap_bank(b);
                        // Se a fila de descarte estiver cheia, o banco antigo é
                        // liberado aqui mesmo (raro, e só quando o som muda).
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

            if ctx.scratch.len() < data.len() {
                ctx.scratch.resize(data.len(), 0.0);
            }
            let buf = &mut ctx.scratch[..data.len()];
            let ticks = &mut ctx.ticks;
            ctx.metro.render(buf, channels, |tick| {
                let ms = base_ms + tick.offset_in_block as f32 / sample_rate * 1000.0;
                let _ = ticks.push((tick, ms));
            });
            for (o, s) in data.iter_mut().zip(buf.iter()) {
                *o = T::from_sample(*s);
            }
        },
        move |err| {
            let _ = errors.send((Direction::Output, err.to_string()));
        },
        None,
    )
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
