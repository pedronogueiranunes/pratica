//! Monitor da bancada A0: mesma interface/taxa, filas limitadas e uma saída.
//! Não integra ainda o ciclo de vida do app; usar com metrônomo/afinador desligados.
use crate::amp::{BlockProcessor, OutputSafety, RealtimeScope};
use crate::engine::list_devices;
use crate::latency::Connection;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{BufferSize, SampleFormat, StreamConfig};
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

#[derive(Default)]
pub struct MonitorStats {
    pub input_overflows: AtomicU64,
    pub processed_frames: AtomicU64,
    pub output_underruns: AtomicU64,
    pub resynced_samples: AtomicU64,
    pub invalid_samples: AtomicU64,
    pub limited_samples: AtomicU64,
    pub input_clips: AtomicU64,
    pub error_flags: AtomicU32,
    pub timing_drops: AtomicU64,
    pub output_frames_min: AtomicU32,
    pub output_frames_max: AtomicU32,
}
#[derive(Clone, Copy)]
pub struct CallbackTiming {
    pub nanoseconds: u64,
    pub frames: usize,
}
pub struct MonitorConfig {
    pub device_id: String,
    pub input_channel: u16,
    pub output_channel: u16,
    pub sample_rate: u32,
    pub frames: u32,
    pub output_db: f32,
}
/// Streams são mantidos pelo controle. Preparação ocorre antes de play().
pub struct Monitor {
    input: cpal::Stream,
    output: cpal::Stream,
    stopping: Arc<AtomicBool>,
    pub stats: Arc<MonitorStats>,
    timings: rtrb::Consumer<CallbackTiming>,
}
impl Monitor {
    pub fn open<P: BlockProcessor>(config: MonitorConfig, mut model: P) -> Result<Self, String> {
        if ![64, 128].contains(&config.frames) {
            return Err("Use buffer de 64 ou 128 amostras na A0.".into());
        }
        if config.sample_rate < 8000 || config.sample_rate > 192000 || !config.output_db.is_finite()
        {
            return Err("Configuração de áudio inválida.".into());
        }
        let info = list_devices()
            .into_iter()
            .find(|d| d.id == config.device_id)
            .ok_or("A interface escolhida não está conectada.")?;
        if matches!(info.connection, Connection::Bluetooth | Connection::BuiltIn) {
            return Err(
                "A bancada exige uma interface externa com entrada e saída, sem Bluetooth.".into(),
            );
        }
        if !info.is_input || !info.is_output {
            return Err("Escolha a mesma interface para entrada e saída.".into());
        }
        let host = cpal::default_host();
        let id = cpal::DeviceId::from_str(&config.device_id).map_err(|e| e.to_string())?;
        let device = host.device_by_id(&id).ok_or("Dispositivo indisponível.")?;
        let supports = |range: &cpal::SupportedStreamConfigRange, channel: u16| {
            range.sample_format() == SampleFormat::F32
                && range.channels() > channel
                && range.min_sample_rate() <= config.sample_rate
                && config.sample_rate <= range.max_sample_rate()
                && matches!(range.buffer_size(), cpal::SupportedBufferSize::Range { min, max } if config.frames >= *min && config.frames <= *max)
        };
        let input = device
            .supported_input_configs()
            .map_err(|e| e.to_string())?
            .find(|c| supports(c, config.input_channel))
            .ok_or("Entrada não suporta F32, canal, taxa e buffer solicitados.")?;
        let output = device
            .supported_output_configs()
            .map_err(|e| e.to_string())?
            .find(|c| supports(c, config.output_channel))
            .ok_or("Saída não suporta F32, canal, taxa e buffer solicitados.")?;
        let in_config = StreamConfig {
            channels: input.channels(),
            sample_rate: config.sample_rate,
            buffer_size: BufferSize::Fixed(config.frames),
        };
        let out_config = StreamConfig {
            channels: output.channels(),
            sample_rate: config.sample_rate,
            buffer_size: BufferSize::Fixed(config.frames),
        };
        let channels_in = in_config.channels as usize;
        let channels_out = out_config.channels as usize;
        let channel_in = config.input_channel as usize;
        let channel_out = config.output_channel as usize;
        let block = config.frames as usize;
        let (mut tx, mut rx) = rtrb::RingBuffer::<f32>::new(block * 16);
        let (mut timing_tx, timing_rx) = rtrb::RingBuffer::<CallbackTiming>::new(8192);
        let stats = Arc::new(MonitorStats::default());
        stats.output_frames_min.store(u32::MAX, Ordering::Relaxed);
        let stopping = Arc::new(AtomicBool::new(false));
        let in_stats = stats.clone();
        let input_errors = stats.clone();
        let input_stream = device
            .build_input_stream(
                in_config,
                move |data: &[f32], _| {
                    let _rt = RealtimeScope::enter();
                    for frame in data.chunks_exact(channels_in) {
                        let mut value = frame[channel_in];
                        if !value.is_finite() {
                            value = 0.0;
                            in_stats.invalid_samples.fetch_add(1, Ordering::Relaxed);
                        }
                        if value.abs() >= 0.999 {
                            in_stats.input_clips.fetch_add(1, Ordering::Relaxed);
                        }
                        if tx.push(value).is_err() {
                            in_stats.input_overflows.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                },
                move |_| {
                    input_errors.error_flags.fetch_or(1, Ordering::Relaxed);
                },
                None,
            )
            .map_err(|e| e.to_string())?;
        let out_stats = stats.clone();
        let output_errors = stats.clone();
        let fade = stopping.clone();
        let mut safety = OutputSafety::new(config.sample_rate, config.output_db);
        let mut scratch = [0.0_f32; 128];
        let mut primed = false;
        let output_stream = device
            .build_output_stream(
                out_config,
                move |data: &mut [f32], _| {
                    let _rt = RealtimeScope::enter();
                    let begin = Instant::now();
                    data.fill(0.0);
                    let frames = data.len() / channels_out;
                    out_stats
                        .output_frames_min
                        .fetch_min(frames as u32, Ordering::Relaxed);
                    out_stats
                        .output_frames_max
                        .fetch_max(frames as u32, Ordering::Relaxed);
                    if !primed && rx.slots() >= frames + block {
                        primed = true;
                    }
                    if primed && out_stats.error_flags.load(Ordering::Relaxed) == 0 {
                        // Não acumula atraso sem limite depois de pausa ou atraso do SO.
                        let available = rx.slots();
                        if available > frames + block * 4 {
                            for _ in 0..available - frames - block {
                                let _ = rx.pop();
                            }
                            out_stats
                                .resynced_samples
                                .fetch_add((available - frames - block) as u64, Ordering::Relaxed);
                        }
                        if rx.slots() < frames {
                            out_stats.output_underruns.fetch_add(1, Ordering::Relaxed);
                        }
                        for chunk in data.chunks_mut(block * channels_out) {
                            let n = chunk.len() / channels_out;
                            for sample in &mut scratch[..n] {
                                *sample = rx.pop().unwrap_or(0.0);
                            }
                            model.process(&mut scratch[..n]);
                            out_stats
                                .processed_frames
                                .fetch_add(n as u64, Ordering::Relaxed);
                            for (frame, &sample) in
                                chunk.chunks_exact_mut(channels_out).zip(&scratch[..n])
                            {
                                let (value, invalid, limited) =
                                    safety.sample(sample, fade.load(Ordering::Relaxed));
                                frame[channel_out] = value;
                                if invalid {
                                    out_stats.invalid_samples.fetch_add(1, Ordering::Relaxed);
                                    out_stats.error_flags.fetch_or(4, Ordering::Relaxed);
                                }
                                if limited {
                                    out_stats.limited_samples.fetch_add(1, Ordering::Relaxed);
                                }
                            }
                        }
                    }
                    let timing = CallbackTiming {
                        nanoseconds: begin.elapsed().as_nanos() as u64,
                        frames,
                    };
                    if timing_tx.push(timing).is_err() {
                        out_stats.timing_drops.fetch_add(1, Ordering::Relaxed);
                    }
                },
                move |_| {
                    output_errors.error_flags.fetch_or(2, Ordering::Relaxed);
                },
                None,
            )
            .map_err(|e| e.to_string())?;
        input_stream.play().map_err(|e| e.to_string())?;
        output_stream.play().map_err(|e| e.to_string())?;
        Ok(Self {
            input: input_stream,
            output: output_stream,
            stopping,
            stats,
            timings: timing_rx,
        })
    }
    pub fn drain_timings(&mut self, into: &mut Vec<CallbackTiming>) {
        while let Ok(timing) = self.timings.pop() {
            into.push(timing);
        }
    }
    pub fn fade_out(&self) {
        self.stopping.store(true, Ordering::Relaxed);
    }
}
impl Drop for Monitor {
    fn drop(&mut self) {
        let _ = self.output.pause();
        let _ = self.input.pause();
    }
}
