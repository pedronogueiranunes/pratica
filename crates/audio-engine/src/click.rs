//! Sons do metrônomo, sintetizados na hora (sem arquivos de áudio).
//!
//! Cada som tem três variações: acento (primeiro tempo), tempo e subdivisão.

use serde::{Deserialize, Serialize};
use std::f32::consts::TAU;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum ClickSound {
    /// Bloco de madeira: ataque seco, curto.
    #[default]
    Madeira,
    /// Bip senoidal, o clássico de metrônomo digital.
    Bip,
    /// Baqueta no aro: ruído filtrado com corpo.
    Aro,
    /// Cowbell: duas ondas quadradas desafinadas entre si.
    Cowbell,
    /// Suave: seno grave com ataque lento, para não cansar o ouvido.
    Suave,
}

impl ClickSound {
    pub const ALL: [ClickSound; 5] = [
        ClickSound::Madeira,
        ClickSound::Bip,
        ClickSound::Aro,
        ClickSound::Cowbell,
        ClickSound::Suave,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClickKind {
    Accent,
    Beat,
    Subdivision,
}

/// Os três samples prontos de um som.
#[derive(Debug, Clone)]
pub struct ClickBank {
    pub sound: ClickSound,
    pub accent: Vec<f32>,
    pub beat: Vec<f32>,
    pub subdivision: Vec<f32>,
}

impl ClickBank {
    pub fn new(sound: ClickSound, sample_rate: u32) -> Self {
        Self {
            sound,
            accent: synthesize(sound, ClickKind::Accent, sample_rate),
            beat: synthesize(sound, ClickKind::Beat, sample_rate),
            subdivision: synthesize(sound, ClickKind::Subdivision, sample_rate),
        }
    }

    pub fn get(&self, kind: ClickKind) -> &[f32] {
        match kind {
            ClickKind::Accent => &self.accent,
            ClickKind::Beat => &self.beat,
            ClickKind::Subdivision => &self.subdivision,
        }
    }
}

/// Gerador de ruído determinístico (xorshift), para os sons serem sempre iguais.
struct Noise(u32);
impl Noise {
    fn next(&mut self) -> f32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x as f32 / u32::MAX as f32) * 2.0 - 1.0
    }
}

pub fn synthesize(sound: ClickSound, kind: ClickKind, sample_rate: u32) -> Vec<f32> {
    let sr = sample_rate as f32;
    // Altura relativa: acento mais agudo, subdivisão mais grave e baixa.
    let (pitch_mul, gain) = match kind {
        ClickKind::Accent => (1.5, 1.0),
        ClickKind::Beat => (1.0, 0.8),
        ClickKind::Subdivision => (0.8, 0.45),
    };
    let dur_s = match sound {
        ClickSound::Suave => 0.12,
        ClickSound::Cowbell => 0.09,
        _ => 0.05,
    };
    let len = (dur_s * sr) as usize;
    let mut noise = Noise(0x9E37_79B9);
    let mut lp = 0.0f32;
    let mut out = Vec::with_capacity(len);

    for i in 0..len {
        let t = i as f32 / sr;
        let s = match sound {
            ClickSound::Madeira => {
                let f = 1800.0 * pitch_mul;
                let env = (-t * 90.0).exp();
                let body = (TAU * f * t).sin() * 0.7 + (TAU * f * 2.7 * t).sin() * 0.3;
                let click = noise.next() * (-t * 900.0).exp() * 0.6;
                (body + click) * env
            }
            ClickSound::Bip => {
                let f = 1000.0 * pitch_mul;
                let attack = (t / 0.002).min(1.0);
                let env = attack * (1.0 - t / dur_s).max(0.0);
                (TAU * f * t).sin() * env
            }
            ClickSound::Aro => {
                // Ruído passa-baixa simples com um tom de corpo.
                let n = noise.next();
                lp += 0.35 * (n - lp);
                let env = (-t * 70.0).exp();
                let body = (TAU * 330.0 * pitch_mul * t).sin() * (-t * 40.0).exp();
                (lp * 0.9 + body * 0.5) * env
            }
            ClickSound::Cowbell => {
                let f1 = 540.0 * pitch_mul;
                let f2 = 800.0 * pitch_mul;
                let sq = |f: f32| if (f * t).fract() < 0.5 { 1.0 } else { -1.0 };
                let raw = (sq(f1) + sq(f2)) * 0.5;
                lp += 0.25 * (raw - lp);
                lp * (-t * 35.0).exp()
            }
            ClickSound::Suave => {
                let f = 440.0 * pitch_mul;
                let attack = (t / 0.008).min(1.0);
                let env = attack * (-t * 28.0).exp();
                (TAU * f * t).sin() * env
            }
        };
        out.push(s);
    }

    // Normaliza o pico e aplica o ganho da variação.
    let peak = out.iter().fold(0.0f32, |m, s| m.max(s.abs())).max(1e-6);
    let norm = gain * 0.9 / peak;
    for s in &mut out {
        *s *= norm;
    }
    // Rampa curta no fim para não estalar.
    let fade = (0.003 * sr) as usize;
    let n = out.len();
    for i in 0..fade.min(n) {
        out[n - 1 - i] *= i as f32 / fade as f32;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn todos_os_sons_tem_pico_limitado_e_terminam_em_silencio() {
        for sound in ClickSound::ALL {
            let bank = ClickBank::new(sound, 48_000);
            for kind in [ClickKind::Accent, ClickKind::Beat, ClickKind::Subdivision] {
                let s = bank.get(kind);
                assert!(!s.is_empty());
                let peak = s.iter().fold(0.0f32, |m, x| m.max(x.abs()));
                assert!(peak <= 0.91, "{sound:?} {kind:?} pico {peak}");
                assert!(s.last().unwrap().abs() < 1e-3);
            }
        }
    }

    #[test]
    fn acento_e_mais_forte_que_subdivisao() {
        let bank = ClickBank::new(ClickSound::Madeira, 44_100);
        let peak = |v: &[f32]| v.iter().fold(0.0f32, |m, x| m.max(x.abs()));
        assert!(peak(&bank.accent) > peak(&bank.subdivision) * 1.5);
    }
}
