//! Peças da prova Amp A0. Sem arquivos, modelos embutidos ou dependência NAM.
use std::cell::Cell;

thread_local! { static REALTIME: Cell<bool> = const { Cell::new(false) }; }
/// Permite que a bancada conte alocações apenas no thread de processamento.
pub fn in_audio_callback() -> bool {
    REALTIME.with(Cell::get)
}
/// Marca a região de áudio; não aloca. Não usar para mascarar trabalho de preparação.
pub struct RealtimeScope(bool);
impl RealtimeScope {
    pub fn enter() -> Self {
        Self(REALTIME.with(|flag| flag.replace(true)))
    }
}
impl Drop for RealtimeScope {
    fn drop(&mut self) {
        REALTIME.with(|flag| flag.set(self.0));
    }
}

/// Modelo já carregado e aquecido. O implementador deve processar sem alocar ou travar.
pub trait BlockProcessor: Send + 'static {
    fn process(&mut self, samples: &mut [f32]);
}

/// Proteção de bancada, não normalização de loudness nem calibração dBu.
pub struct OutputSafety {
    gain: f32,
    target: f32,
    step: f32,
    ceiling: f32,
}
impl OutputSafety {
    pub fn new(sample_rate: u32, output_db: f32) -> Self {
        let target = 10.0_f32.powf(output_db.clamp(-60.0, -12.0) / 20.0);
        Self {
            gain: 0.0,
            target,
            step: target / (sample_rate as f32 * 0.02).max(1.0),
            ceiling: 10.0_f32.powf(-3.0 / 20.0),
        }
    }
    /// Retorna (valor, amostra inválida, amostra limitada).
    pub fn sample(&mut self, input: f32, stopping: bool) -> (f32, bool, bool) {
        self.gain = if stopping {
            (self.gain - self.step).max(0.0)
        } else {
            (self.gain + self.step).min(self.target)
        };
        if !input.is_finite() {
            return (0.0, true, false);
        }
        let value = input * self.gain;
        (
            value.clamp(-self.ceiling, self.ceiling),
            false,
            value.abs() > self.ceiling,
        )
    }
}

/// Sinal determinístico de teste gerado pelo projeto, sem áudio de terceiros.
pub fn probe_signal(out: &mut [f32], seed: &mut u32) {
    for sample in out {
        *seed ^= *seed << 13;
        *seed ^= *seed >> 17;
        *seed ^= *seed << 5;
        *sample = ((*seed as f64 / u32::MAX as f64) * 2.0 - 1.0) as f32 * 0.1;
    }
}

/// Alinhamento de canais gravados no MESMO relógio. Não transforma timestamps em RTL.
/// A correlação é feita offline; nenhum custo de busca passa pela callback.
pub fn correlation_delay(
    reference: &[f32],
    returned: &[f32],
    max_lag: usize,
) -> Option<(usize, f64)> {
    let len = reference.len().min(returned.len());
    let window = len.checked_sub(max_lag)?;
    if window < 256 || reference.iter().chain(returned).any(|x| !x.is_finite()) {
        return None;
    }
    // Usa uma janela com energia, evitando selecionar só o silêncio inicial.
    let window = window.min(8192);
    let limit = len - max_lag - window;
    let start = (0..=limit).step_by(window.max(1)).max_by(|&a, &b| {
        let energy = |i| {
            reference[i..i + window]
                .iter()
                .map(|&x| (x as f64).powi(2))
                .sum::<f64>()
        };
        energy(a).total_cmp(&energy(b))
    })?;
    let x = &reference[start..start + window];
    let x_mean = x.iter().map(|&v| v as f64).sum::<f64>() / window as f64;
    let x_energy = x.iter().map(|&v| (v as f64 - x_mean).powi(2)).sum::<f64>();
    if x_energy < 1e-12 {
        return None;
    }
    let mut best = (0, 0.0_f64);
    let mut scores = vec![0.0; max_lag + 1];
    for (lag, slot) in scores.iter_mut().enumerate() {
        let y = &returned[start + lag..start + lag + window];
        let mean = y.iter().map(|&v| v as f64).sum::<f64>() / window as f64;
        let energy = y.iter().map(|&v| (v as f64 - mean).powi(2)).sum::<f64>();
        if energy < 1e-12 {
            continue;
        }
        let dot = x
            .iter()
            .zip(y)
            .map(|(&a, &b)| (a as f64 - x_mean) * (b as f64 - mean))
            .sum::<f64>();
        let score = (dot / (x_energy * energy).sqrt()).abs().min(1.0);
        *slot = score;
        if score > best.1 {
            best = (lag, score);
        }
    }
    let second = scores
        .iter()
        .enumerate()
        .filter(|(lag, _)| lag.abs_diff(best.0) > 8)
        .map(|(_, &score)| score)
        .fold(0.0, f64::max);
    (best.1 >= 0.8 && best.1 - second >= 0.05).then_some(best)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn saida_comeca_baixa_limita_picos_e_recusa_nan() {
        let mut safe = OutputSafety::new(48000, 0.0);
        let first = safe.sample(1.0, false).0;
        assert!(first > 0.0 && first < 0.001);
        for _ in 0..1000 {
            safe.sample(0.0, false);
        }
        assert!(safe.sample(1.0, false).0 < 0.26);
        assert!(safe.sample(100.0, false).2);
        assert_eq!(safe.sample(f32::NAN, false), (0.0, true, false));
        for _ in 0..2000 {
            safe.sample(1.0, true);
        }
        assert_eq!(safe.sample(1.0, true).0, 0.0);
    }
    #[test]
    fn mede_atraso_de_captura_sintetica_com_polaridade_invertida() {
        let mut input = vec![0.0; 6000];
        probe_signal(&mut input, &mut 17);
        let mut output = vec![0.0; 6000];
        for i in 321..6000 {
            output[i] = -input[i - 321] * 0.3;
        }
        let (lag, confidence) = correlation_delay(&input, &output, 1000).unwrap();
        assert_eq!(lag, 321);
        assert!(confidence > 0.999);
        assert!(correlation_delay(&vec![0.0; 6000], &output, 1000).is_none());
        assert!(correlation_delay(&input[..20], &output, 1000).is_none());
        let periodic = (0..6000)
            .map(|i| (i as f32 * std::f32::consts::TAU / 100.0).sin())
            .collect::<Vec<_>>();
        assert!(
            correlation_delay(&periodic, &periodic, 1000).is_none(),
            "Não aprova picos periódicos ambíguos"
        );
    }
}
