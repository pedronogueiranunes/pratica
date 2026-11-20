//! Metrônomo com precisão de amostra.
//!
//! O tempo de cada clique é calculado em frames (f64) a partir do início,
//! então não acumula erro como um timer comum. Esta parte não conhece
//! dispositivos: recebe um buffer e o preenche. Por isso dá para testar
//! em qualquer máquina e reaproveitar em iOS e Android.

use crate::click::{ClickBank, ClickKind, ClickSound};
use serde::{Deserialize, Serialize};

pub const MIN_BPM: f64 = 20.0;
pub const MAX_BPM: f64 = 400.0;
const MAX_VOICES: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetronomeSettings {
    pub bpm: f64,
    /// Tempos por compasso (1 a 16).
    pub beats_per_bar: u32,
    /// Cliques por tempo: 1 semínima, 2 colcheia, 3 tercina, 4 semicolcheia.
    pub subdivision: u32,
    pub accent_first_beat: bool,
    /// Volume de 0 a 1.
    pub volume: f32,
    pub sound: ClickSound,
}

impl Default for MetronomeSettings {
    fn default() -> Self {
        Self {
            bpm: 60.0,
            beats_per_bar: 4,
            subdivision: 1,
            accent_first_beat: true,
            volume: 0.8,
            sound: ClickSound::Madeira,
        }
    }
}

impl MetronomeSettings {
    pub fn sanitized(mut self) -> Self {
        if !self.bpm.is_finite() {
            self.bpm = 60.0;
        }
        self.bpm = self.bpm.clamp(MIN_BPM, MAX_BPM);
        self.beats_per_bar = self.beats_per_bar.clamp(1, 16);
        self.subdivision = self.subdivision.clamp(1, 4);
        self.volume = if self.volume.is_finite() { self.volume.clamp(0.0, 1.0) } else { 0.8 };
        self
    }

    pub fn frames_per_tick(&self, sample_rate: u32) -> f64 {
        sample_rate as f64 * 60.0 / (self.bpm * self.subdivision as f64)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tick {
    /// Contador de cliques desde o início.
    pub index: u64,
    pub bar: u64,
    /// Tempo dentro do compasso, começando em 0.
    pub beat: u32,
    /// Subdivisão dentro do tempo, começando em 0.
    pub sub: u32,
    pub accent: bool,
    /// Frame absoluto em que o clique começa.
    pub frame: u64,
    /// Posição do clique dentro do bloco que está sendo renderizado.
    pub offset_in_block: usize,
}

#[derive(Clone, Copy)]
struct Voice {
    kind: ClickKind,
    pos: usize,
    /// Quantos frames esperar antes de começar (dentro do bloco atual).
    delay: usize,
}

pub struct Metronome {
    sample_rate: u32,
    settings: MetronomeSettings,
    bank: Box<ClickBank>,
    running: bool,
    frame: u64,
    next_tick: f64,
    last_tick: Option<f64>,
    tick_index: u64,
    voices: [Option<Voice>; MAX_VOICES],
    /// Volume suavizado, para mudanças sem estalo.
    gain: f32,
}

impl Metronome {
    pub fn new(sample_rate: u32, settings: MetronomeSettings) -> Self {
        let settings = settings.sanitized();
        Self {
            sample_rate,
            bank: Box::new(ClickBank::new(settings.sound, sample_rate)),
            gain: settings.volume,
            settings,
            running: false,
            frame: 0,
            next_tick: 0.0,
            last_tick: None,
            tick_index: 0,
            voices: [None; MAX_VOICES],
        }
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    pub fn settings(&self) -> MetronomeSettings {
        self.settings
    }

    pub fn is_running(&self) -> bool {
        self.running
    }

    /// Começa no próximo frame, a partir do tempo 1.
    pub fn start(&mut self) {
        self.running = true;
        self.tick_index = 0;
        self.last_tick = None;
        self.next_tick = self.frame as f64;
    }

    pub fn stop(&mut self) {
        self.running = false;
    }

    /// Troca as configurações. Uma mudança de BPM vale a partir do próximo
    /// clique, contado a partir do último que tocou, então a resposta é imediata.
    /// Se o som mudou, chame [`Metronome::swap_bank`] com o banco novo,
    /// criado fora da thread de áudio.
    pub fn set_settings(&mut self, settings: MetronomeSettings) {
        let settings = settings.sanitized();
        let tempo_changed = settings.bpm != self.settings.bpm
            || settings.subdivision != self.settings.subdivision;
        self.settings = settings;
        if tempo_changed && self.running {
            if let Some(last) = self.last_tick {
                let candidate = last + settings.frames_per_tick(self.sample_rate);
                self.next_tick = candidate.max(self.frame as f64);
            }
        }
    }

    /// Troca o banco de sons e devolve o antigo, para ser liberado fora da
    /// thread de áudio.
    pub fn swap_bank(&mut self, bank: Box<ClickBank>) -> Box<ClickBank> {
        std::mem::replace(&mut self.bank, bank)
    }

    fn tick_position(&self, index: u64) -> (u64, u32, u32) {
        let sub = self.settings.subdivision as u64;
        let beats = self.settings.beats_per_bar as u64;
        let beat_total = index / sub;
        (beat_total / beats, (beat_total % beats) as u32, (index % sub) as u32)
    }

    /// Preenche `out` (intercalado, `channels` canais) somando os cliques.
    /// O buffer é sobrescrito. `on_tick` é chamado para cada clique do bloco.
    pub fn render(&mut self, out: &mut [f32], channels: usize, mut on_tick: impl FnMut(Tick)) {
        let channels = channels.max(1);
        let frames = out.len() / channels;
        out.fill(0.0);

        if self.running {
            let block_end = self.frame + frames as u64;
            while self.next_tick < block_end as f64 {
                let at = self.next_tick.max(self.frame as f64);
                let offset = (at.floor() as u64).saturating_sub(self.frame) as usize;
                let (bar, beat, sub) = self.tick_position(self.tick_index);
                let accent = self.settings.accent_first_beat
                    && beat == 0
                    && sub == 0
                    && self.settings.beats_per_bar > 1;
                let kind = if sub > 0 {
                    ClickKind::Subdivision
                } else if accent {
                    ClickKind::Accent
                } else {
                    ClickKind::Beat
                };
                self.start_voice(kind, offset);
                on_tick(Tick {
                    index: self.tick_index,
                    bar,
                    beat,
                    sub,
                    accent,
                    frame: self.frame + offset as u64,
                    offset_in_block: offset,
                });
                self.last_tick = Some(self.next_tick);
                self.tick_index += 1;
                self.next_tick += self.settings.frames_per_tick(self.sample_rate);
            }
        }

        // Mistura das vozes ativas, com o volume rampeado ao longo do bloco.
        let target = self.settings.volume;
        let start_gain = self.gain;
        let step = if frames > 0 { (target - start_gain) / frames as f32 } else { 0.0 };
        for slot in self.voices.iter_mut() {
            let Some(voice) = slot else { continue };
            let sample = self.bank.get(voice.kind);
            let mut g = start_gain;
            for f in 0..frames {
                g += step;
                if f < voice.delay {
                    continue;
                }
                if voice.pos >= sample.len() {
                    break;
                }
                let s = sample[voice.pos] * g;
                voice.pos += 1;
                let base = f * channels;
                for c in 0..channels {
                    out[base + c] += s;
                }
            }
            voice.delay = voice.delay.saturating_sub(frames);
            if voice.pos >= sample.len() {
                *slot = None;
            }
        }
        self.gain = target;
        for s in out.iter_mut() {
            *s = s.clamp(-1.0, 1.0);
        }
        self.frame += frames as u64;
    }

    fn start_voice(&mut self, kind: ClickKind, delay: usize) {
        let voice = Voice { kind, pos: 0, delay };
        if let Some(slot) = self.voices.iter_mut().find(|v| v.is_none()) {
            *slot = Some(voice);
        } else {
            // Sem espaço: substitui a voz mais adiantada (a que está quase no fim).
            let oldest = self
                .voices
                .iter()
                .enumerate()
                .max_by_key(|(_, v)| v.map(|v| v.pos).unwrap_or(0))
                .map(|(i, _)| i)
                .unwrap_or(0);
            self.voices[oldest] = Some(voice);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(m: &mut Metronome, total_frames: usize, block: usize) -> Vec<Tick> {
        let mut ticks = Vec::new();
        let mut buf = vec![0.0f32; block * 2];
        let mut done = 0;
        while done < total_frames {
            m.render(&mut buf, 2, |t| ticks.push(t));
            done += block;
        }
        // O último bloco pode passar do total; descarta o que ficou além.
        ticks.retain(|t| (t.frame as usize) < total_frames);
        ticks
    }

    #[test]
    fn cliques_caem_no_frame_exato_sem_deriva() {
        let sr = 48_000;
        let mut m = Metronome::new(sr, MetronomeSettings { bpm: 120.0, ..Default::default() });
        m.start();
        // 10 minutos em blocos de tamanho irregular (como o sistema faz às vezes).
        let ticks = run(&mut m, sr as usize * 600, 511);
        assert_eq!(ticks.len(), 1200);
        for (i, t) in ticks.iter().enumerate() {
            let expected = (i as f64 * 24_000.0) as u64;
            assert_eq!(t.frame, expected, "clique {i}");
        }
    }

    #[test]
    fn bpm_fracionado_nao_acumula_erro() {
        let sr = 44_100;
        let bpm = 97.3;
        let mut m = Metronome::new(sr, MetronomeSettings { bpm, ..Default::default() });
        m.start();
        let ticks = run(&mut m, sr as usize * 300, 256);
        let per = sr as f64 * 60.0 / bpm;
        let last = ticks.last().unwrap();
        let expected = (last.index as f64 * per).floor() as u64;
        assert!(last.frame.abs_diff(expected) <= 1);
    }

    #[test]
    fn acento_no_primeiro_tempo_e_subdivisoes() {
        let mut m = Metronome::new(
            48_000,
            MetronomeSettings { bpm: 60.0, beats_per_bar: 3, subdivision: 2, ..Default::default() },
        );
        m.start();
        let ticks = run(&mut m, 48_000 * 3, 480);
        let pattern: Vec<(u32, u32, bool)> = ticks.iter().map(|t| (t.beat, t.sub, t.accent)).collect();
        assert_eq!(
            pattern,
            vec![(0, 0, true), (0, 1, false), (1, 0, false), (1, 1, false), (2, 0, false), (2, 1, false)]
        );
    }

    #[test]
    fn mudanca_de_bpm_vale_a_partir_do_ultimo_clique() {
        let sr = 48_000;
        let mut m = Metronome::new(sr, MetronomeSettings { bpm: 30.0, ..Default::default() });
        m.start();
        let mut ticks = run(&mut m, 4_800, 480); // 0,1 s: só o primeiro clique
        assert_eq!(ticks.len(), 1);
        m.set_settings(MetronomeSettings { bpm: 240.0, ..Default::default() });
        ticks.extend(run(&mut m, 48_000, 480));
        // A 240 bpm o segundo clique vem 0,25 s depois do primeiro, e não 2 s.
        assert_eq!(ticks[1].frame, 12_000);
    }

    #[test]
    fn parado_gera_silencio() {
        let mut m = Metronome::new(48_000, MetronomeSettings::default());
        let mut buf = vec![1.0f32; 1024];
        m.render(&mut buf, 2, |_| panic!("não deveria clicar"));
        assert!(buf.iter().all(|s| *s == 0.0));
    }

    #[test]
    fn volume_zero_silencia_e_valores_invalidos_sao_corrigidos() {
        let s = MetronomeSettings { bpm: 9999.0, volume: f32::NAN, subdivision: 9, ..Default::default() }
            .sanitized();
        assert_eq!(s.bpm, MAX_BPM);
        assert_eq!(s.subdivision, 4);
        assert_eq!(s.volume, 0.8);

        let mut m = Metronome::new(48_000, MetronomeSettings { volume: 0.0, ..Default::default() });
        m.start();
        let mut buf = vec![0.0f32; 4_800];
        m.render(&mut buf, 1, |_| {});
        m.render(&mut buf, 1, |_| {});
        assert!(buf.iter().all(|s| s.abs() < 1e-6));
    }
}
