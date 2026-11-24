//! FFT Hann para diagnóstico espectral. Só na thread de controle, nunca na callback.
pub struct SpectrumAnalyzer {
    pub size: usize,
    re: Vec<f64>,
    im: Vec<f64>,
    sample_rate: u32,
}
impl SpectrumAnalyzer {
    pub fn new(sample_rate: u32) -> Self {
        let size = (sample_rate.div_ceil(3) as usize).next_power_of_two().clamp(4096, 65536);
        Self { size, re: vec![0.0; size], im: vec![0.0; size], sample_rate }
    }
    pub fn analyze(&mut self, samples: &[f32]) -> Vec<f32> {
        let n = self.size;
        assert_eq!(samples.len(), n);
        let mean = samples.iter().map(|&x| x as f64 / n as f64).sum::<f64>();
        for (i, &s) in samples.iter().enumerate() {
            self.re[i] = (s as f64 - mean) * (0.5 - 0.5 * (std::f64::consts::TAU * i as f64 / (n - 1) as f64).cos());
            self.im[i] = 0.0;
        }
        let mut j = 0;
        for i in 1..n {
            let mut bit = n >> 1;
            while j & bit != 0 { j ^= bit; bit >>= 1; }
            j ^= bit;
            if i < j { self.re.swap(i, j); self.im.swap(i, j); }
        }
        let mut size = 2;
        while size <= n {
            let angle = -std::f64::consts::TAU / size as f64;
            let (wr, wi) = (angle.cos(), angle.sin());
            for base in (0..n).step_by(size) {
                let (mut ar, mut ai) = (1.0, 0.0);
                for k in 0..size / 2 {
                    let a = base + k; let b = a + size / 2;
                    let br = ar * self.re[b] - ai * self.im[b];
                    let bi = ar * self.im[b] + ai * self.re[b];
                    self.re[b] = self.re[a] - br; self.im[b] = self.im[a] - bi;
                    self.re[a] += br; self.im[a] += bi;
                    (ar, ai) = (ar * wr - ai * wi, ar * wi + ai * wr);
                }
            }
            size *= 2;
        }
        let bins = ((1400.0 * n as f64 / self.sample_rate as f64).ceil() as usize + 2).min(n / 2 + 1);
        (0..bins).map(|i| ((self.re[i].powi(2) + self.im[i].powi(2)) / (n * n) as f64) as f32).collect()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn seno_conhecido_remove_dc_e_preserva_energia() {
        let mut fft = SpectrumAnalyzer::new(48000);
        let n = fft.size;
        let samples: Vec<f32> = (0..n).map(|i| (0.2 + (std::f64::consts::TAU * 32.0 * i as f64 / n as f64).sin()) as f32).collect();
        let powers = fft.analyze(&samples);
        assert!((powers[32] - 0.062492).abs() < 0.00001);
        assert!(powers[0] < 1e-8);
        assert_eq!(powers.iter().enumerate().max_by(|a,b| a.1.total_cmp(b.1)).unwrap().0, 32);
    }
    #[test]
    fn janelas_resolvem_graves_e_truncam_acima_da_faixa() {
        for sr in [44100,48000,96000,192000] {
            let mut fft = SpectrumAnalyzer::new(sr);
            assert!((sr as f64 / fft.size as f64) < 4.0);
            let powers = fft.analyze(&vec![0.0; fft.size]);
            assert!(powers.iter().all(|&p| p == 0.0));
            assert!(powers.len() < 700);
        }
    }
}
