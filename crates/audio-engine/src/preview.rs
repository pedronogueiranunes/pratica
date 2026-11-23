//! Prévia polifônica original. Estado fixo, sem alocação ou arquivo na callback.
#[derive(Clone, Copy)]
pub struct PreviewPlan {
    frequencies: [f32; 6],
    count: usize,
    gain: f64,
}
impl PreviewPlan {
    pub fn new(frequencies: &[f32], volume: f32) -> Option<Self> {
        if frequencies.is_empty()
            || frequencies.len() > 6
            || !volume.is_finite()
            || frequencies
                .iter()
                .any(|f| !f.is_finite() || *f < 30.0 || *f > 3000.0)
        {
            return None;
        }
        let mut fixed = [0.0; 6];
        fixed[..frequencies.len()].copy_from_slice(frequencies);
        Some(Self {
            frequencies: fixed,
            count: frequencies.len(),
            gain: 0.18 * volume.clamp(0.0, 1.0) as f64 / frequencies.len() as f64,
        })
    }
}
pub struct ChordPreview {
    sample_rate: f64,
    plan: Option<PreviewPlan>,
    frame: u64,
    transition: u64,
    from: f32,
    last: f32,
}
impl ChordPreview {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            sample_rate: sample_rate.max(8000) as f64,
            plan: None,
            frame: 0,
            transition: 0,
            from: 0.0,
            last: 0.0,
        }
    }
    pub fn play(&mut self, plan: PreviewPlan) {
        self.from = self.last;
        self.transition = 0;
        self.frame = 0;
        self.plan = Some(plan);
    }
    pub fn stop(&mut self) {
        self.from = self.last;
        self.transition = 0;
        self.plan = None;
    }
    pub fn sample(&mut self) -> f32 {
        let t = self.frame as f64 / self.sample_rate;
        let mut value = 0.0;
        if let Some(plan) = self.plan {
            if t < 1.4 {
                let envelope =
                    (t / 0.008).min(1.0) * ((1.4 - t) / 0.12).min(1.0) * (-t * 2.0).exp();
                for f in &plan.frequencies[..plan.count] {
                    let phase = std::f64::consts::TAU * *f as f64 * t;
                    value += (phase.sin()
                        + (if *f as f64 * 2.0 < self.sample_rate / 2.0 {
                            0.35 * (phase * 2.0).sin()
                        } else {
                            0.0
                        })
                        + (if *f as f64 * 3.0 < self.sample_rate / 2.0 {
                            0.15 * (phase * 3.0).sin()
                        } else {
                            0.0
                        }))
                        / 1.5;
                }
                value *= plan.gain * envelope;
            } else {
                self.plan = None;
            }
        }
        // Nova prévia parte do último valor da saída. Mesmo cliques muito rápidos
        // não acumulam vozes e mantêm continuidade; transição de 10 ms.
        let blend = (self.transition as f64 / (self.sample_rate * 0.01)).min(1.0);
        self.last = (self.from as f64 * (1.0 - blend) + value * blend).clamp(-0.18, 0.18) as f32;
        self.frame = self.frame.saturating_add(1);
        self.transition = self.transition.saturating_add(1);
        self.last
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validacao_e_limites_da_polifonia() {
        assert!(PreviewPlan::new(&[], 1.0).is_none());
        assert!(PreviewPlan::new(&[440.0; 7], 1.0).is_none());
        assert!(PreviewPlan::new(&[f32::NAN], 1.0).is_none());
        let mut p = ChordPreview::new(48000);
        p.play(PreviewPlan::new(&[110.0, 220.0, 330.0, 440.0, 550.0, 660.0], 1.0).unwrap());
        assert_eq!(p.sample(), 0.0);
        let mut peak = 0.0_f32;
        for _ in 0..70000 {
            let x = p.sample();
            assert!(x.is_finite() && x.abs() <= 0.18);
            peak = peak.max(x.abs());
        }
        assert!(peak > 0.01);
        assert_eq!(p.sample(), 0.0);
    }
    #[test]
    fn repeticoes_e_parada_mantem_continuidade_sem_acumular() {
        let plan = PreviewPlan::new(&[440.0], 1.0).unwrap();
        let mut p = ChordPreview::new(48000);
        p.play(plan);
        for _ in 0..1000 {
            for _ in 0..80 {
                p.sample();
            }
            let previous = p.last;
            p.play(plan);
            assert_eq!(p.sample(), previous);
        }
        let last = p.last;
        p.stop();
        assert_eq!(p.sample(), last);
        for _ in 0..1000 {
            p.sample();
        }
        assert_eq!(p.sample(), 0.0);
    }
}
