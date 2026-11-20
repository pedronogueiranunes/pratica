//! Detecção de altura com o algoritmo YIN (de Cheveigné e Kawahara, 2002),
//! e conversão de frequência em nota e desvio em cents.

use serde::Serialize;

/// Faixa útil para guitarra e violão, com folga para afinações mais graves
/// (B de 7 cordas, cerca de 61,7 Hz) e harmônicos agudos.
pub const MIN_FREQ: f32 = 55.0;
pub const MAX_FREQ: f32 = 1_400.0;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchEstimate {
    pub frequency: f32,
    /// Confiança de 0 a 1 (1 menos o valor da diferença normalizada).
    pub clarity: f32,
}

pub struct PitchDetector {
    sample_rate: f32,
    threshold: f32,
    diff: Vec<f32>,
    min_tau: usize,
    max_tau: usize,
}

impl PitchDetector {
    /// `window` é o tamanho do bloco analisado. Para 55 Hz a 48 kHz, o mínimo
    /// é cerca de 1.750 amostras; 4.096 dá folga e boa estabilidade.
    pub fn new(sample_rate: u32, window: usize) -> Self {
        let sr = sample_rate as f32;
        let max_tau = ((sr / MIN_FREQ).ceil() as usize).min(window / 2);
        let min_tau = ((sr / MAX_FREQ).floor() as usize).max(2);
        Self { sample_rate: sr, threshold: 0.12, diff: vec![0.0; max_tau + 1], min_tau, max_tau }
    }

    pub fn window_needed(&self) -> usize {
        self.max_tau * 2
    }

    /// Analisa `samples` (mono). Devolve `None` se não houver nota clara.
    pub fn detect(&mut self, samples: &[f32]) -> Option<PitchEstimate> {
        let w = samples.len() / 2;
        let max_tau = self.max_tau.min(w);
        if max_tau <= self.min_tau + 2 {
            return None;
        }

        // Passo 2: função diferença.
        for tau in 0..=max_tau {
            let mut sum = 0.0f32;
            for i in 0..w {
                let d = samples[i] - samples[i + tau];
                sum += d * d;
            }
            self.diff[tau] = sum;
        }

        // Passo 3: diferença normalizada pela média acumulada.
        self.diff[0] = 1.0;
        let mut running = 0.0f32;
        for tau in 1..=max_tau {
            running += self.diff[tau];
            self.diff[tau] = if running > 0.0 { self.diff[tau] * tau as f32 / running } else { 1.0 };
        }

        // Passo 4: primeiro mínimo abaixo do limiar.
        let mut tau = self.min_tau;
        let mut found = None;
        while tau < max_tau {
            if self.diff[tau] < self.threshold {
                while tau + 1 < max_tau && self.diff[tau + 1] < self.diff[tau] {
                    tau += 1;
                }
                found = Some(tau);
                break;
            }
            tau += 1;
        }
        let tau = found?;

        // Passo 5: interpolação parabólica para precisão abaixo de uma amostra.
        let better = if tau > 0 && tau < max_tau {
            let (a, b, c) = (self.diff[tau - 1], self.diff[tau], self.diff[tau + 1]);
            let denom = a + c - 2.0 * b;
            if denom.abs() > f32::EPSILON { tau as f32 + 0.5 * (a - c) / denom } else { tau as f32 }
        } else {
            tau as f32
        };

        let frequency = self.sample_rate / better;
        if !(MIN_FREQ..=MAX_FREQ).contains(&frequency) {
            return None;
        }
        Some(PitchEstimate { frequency, clarity: (1.0 - self.diff[tau]).clamp(0.0, 1.0) })
    }
}

pub fn rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt()
}

const NOTE_NAMES: [&str; 12] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteReading {
    /// Nome da nota em notação americana (o app traduz para Dó, Ré... se quiser).
    pub name: &'static str,
    pub octave: i32,
    pub midi: i32,
    /// Desvio em cents em relação à nota mais próxima (-50 a +50).
    pub cents: f32,
    pub frequency: f32,
    /// Frequência exata da nota-alvo.
    pub target_frequency: f32,
}

/// Converte uma frequência em nota, com `a4` como referência (normalmente 440 Hz).
pub fn note_from_frequency(frequency: f32, a4: f32) -> Option<NoteReading> {
    if !(frequency.is_finite() && frequency > 0.0 && a4 > 0.0) {
        return None;
    }
    let semis_from_a4 = 12.0 * (frequency / a4).log2();
    let nearest = semis_from_a4.round();
    let cents = (semis_from_a4 - nearest) * 100.0;
    let midi = 69 + nearest as i32;
    let name = NOTE_NAMES[midi.rem_euclid(12) as usize];
    let octave = midi.div_euclid(12) - 1;
    let target_frequency = a4 * 2f32.powf(nearest / 12.0);
    Some(NoteReading { name, octave, midi, cents, frequency, target_frequency })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::TAU;

    /// Sinal parecido com corda pluck: fundamental + harmônicos decrescentes.
    fn string_like(freq: f32, sr: u32, len: usize) -> Vec<f32> {
        (0..len)
            .map(|i| {
                let t = i as f32 / sr as f32;
                (1..=6).map(|h| (TAU * freq * h as f32 * t).sin() / h as f32).sum::<f32>() * 0.3
            })
            .collect()
    }

    #[test]
    fn detecta_as_seis_cordas_da_guitarra_com_menos_de_2_cents() {
        let sr = 48_000;
        let mut det = PitchDetector::new(sr, 4096);
        for f in [82.41, 110.0, 146.83, 196.0, 246.94, 329.63] {
            let sig = string_like(f, sr, 4096);
            let est = det.detect(&sig).expect("deveria detectar");
            let cents = 1200.0 * (est.frequency / f).log2();
            assert!(cents.abs() < 2.0, "{f} Hz detectado como {} ({cents} cents)", est.frequency);
            assert!(est.clarity > 0.85);
        }
    }

    #[test]
    fn detecta_drop_d_e_b_grave() {
        let sr = 44_100;
        let mut det = PitchDetector::new(sr, 4096);
        for f in [73.42, 61.74] {
            let est = det.detect(&string_like(f, sr, 4096)).unwrap();
            assert!((1200.0 * (est.frequency / f).log2()).abs() < 3.0);
        }
    }

    #[test]
    fn ruido_nao_vira_nota() {
        let mut det = PitchDetector::new(48_000, 4096);
        let mut x: u32 = 12345;
        let noise: Vec<f32> = (0..4096)
            .map(|_| {
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                (x as f32 / u32::MAX as f32) * 2.0 - 1.0
            })
            .collect();
        assert!(det.detect(&noise).is_none());
        assert!(det.detect(&vec![0.0; 4096]).is_none());
    }

    #[test]
    fn nota_e_cents() {
        let r = note_from_frequency(440.0, 440.0).unwrap();
        assert_eq!((r.name, r.octave, r.midi), ("A", 4, 69));
        assert!(r.cents.abs() < 1e-3);

        let e2 = note_from_frequency(82.41, 440.0).unwrap();
        assert_eq!((e2.name, e2.octave), ("E", 2));

        // 10 cents acima de A4.
        let sharp = note_from_frequency(440.0 * 2f32.powf(10.0 / 1200.0), 440.0).unwrap();
        assert!((sharp.cents - 10.0).abs() < 0.01);

        // Com A4 = 432, 432 Hz é Lá certinho.
        let alt = note_from_frequency(432.0, 432.0).unwrap();
        assert_eq!(alt.name, "A");
        assert!(alt.cents.abs() < 1e-3);
        assert!(note_from_frequency(0.0, 440.0).is_none());
    }
}
