//! Bateria original: bancos preparados no controle, vozes fixas na callback.
use serde::Deserialize;
/// Oito instrumentos, um por bit da máscara: bumbo, caixa, chimbal, chimbal aberto,
/// aro, caixa fantasma, prato de condução e sino.
pub const INSTRUMENTS: usize = 8;
#[derive(Clone, Copy, Deserialize)]
pub struct DrumConfig { pub enabled: bool, pub pattern: [u8; 16], pub volume: f32 }
impl Default for DrumConfig {
    fn default() -> Self { Self { enabled: false, pattern: [5,0,4,0,6,0,4,0,5,0,5,0,6,0,4,0], volume: 0.5 } }
}
impl DrumConfig {
    pub fn valid(&self) -> bool { self.volume.is_finite() && (0.0..=1.0).contains(&self.volume) }
}
const DURATIONS: [f64; INSTRUMENTS] = [0.3, 0.2, 0.07, 0.35, 0.06, 0.12, 0.55, 0.22];
fn metal(t: f64, freqs: &[f64]) -> f64 {
    freqs.iter().map(|f| (std::f64::consts::TAU * f * t).sin()).sum::<f64>() / freqs.len() as f64
}
/// Mesmas equações de `packages/core/src/drums.ts`.
pub fn synthesize(instrument: usize, sample_rate: u32) -> Vec<f32> {
    let duration = DURATIONS[instrument];
    let tau = std::f64::consts::TAU;
    let mut data = vec![0.0; (duration * sample_rate as f64).round() as usize];
    let mut seed = 0x12345678_u32; let mut previous = 0.0;
    for (i, sample) in data.iter_mut().enumerate() {
        seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
        let noise = seed as f64 / u32::MAX as f64 * 2.0 - 1.0;
        let bright = (noise - previous * 0.85) / 1.85; previous = noise;
        let t = i as f64 / sample_rate as f64;
        let value = match instrument {
            0 => 0.36 * (tau * (42.0*t + 110.0*0.018*(1.0-(-t/0.018).exp()))).sin() * (-9.0*t).exp() + 0.1 * bright * (-350.0*t).exp(),
            1 => 0.17 * (0.6*(tau*190.0*t).sin() + 0.4*(tau*330.0*t).sin()) * (-28.0*t).exp() + 0.2 * bright * (-16.0*t).exp(),
            2 => 0.1 * (0.55*metal(t, &[3520.0,4410.0,5280.0,6050.0,7210.0,8530.0]) + bright) * (-90.0*t).exp(),
            3 => 0.1 * (0.55*metal(t, &[3520.0,4410.0,5280.0,6050.0,7210.0,8530.0]) + bright) * (-9.0*t).exp(),
            4 => 0.2 * (0.6*(tau*1750.0*t).sin() + 0.4*(tau*520.0*t).sin()) * (-110.0*t).exp() + 0.08 * bright * (-400.0*t).exp(),
            5 => 0.06 * (0.6*(tau*190.0*t).sin() + 0.4*(tau*330.0*t).sin()) * (-40.0*t).exp() + 0.08 * bright * (-30.0*t).exp(),
            6 => 0.1 * (metal(t, &[3400.0,4100.0,5200.0,6700.0,8300.0]) + 0.3*bright*(-20.0*t).exp()) * (-5.0*t).exp(),
            _ => 0.14 * (((tau*540.0*t).sin() + 0.5*(tau*1620.0*t).sin() + (tau*800.0*t).sin() + 0.5*(tau*2400.0*t).sin()) / 3.0) * (-16.0*t).exp(),
        };
        *sample = (value * (t/0.001).min(1.0) * ((duration-t)/0.01).min(1.0)) as f32;
    }
    data
}
#[derive(Clone, Copy, Default)]
struct Voice { position: usize, active: bool, from: f32, last: f32, transition: u32 }
pub struct DrumPlayer {
    bank: [Vec<f32>; INSTRUMENTS], voices: [Voice; INSTRUMENTS], sample_rate: u32, config: DrumConfig,
    pattern: [u8; 16], running: bool, beat: u64, phase: usize, sub: usize,
    frame: u64, next: f64, per: f64, gain: f32, enabled_on_grid: bool,
}
impl DrumPlayer {
    pub fn new(sample_rate: u32) -> Self {
        let config = DrumConfig::default();
        Self { bank: std::array::from_fn(|i| synthesize(i, sample_rate)), voices: [Voice::default(); INSTRUMENTS], sample_rate, config, pattern: config.pattern, running: false, beat: 0, phase: 0, sub: 4, frame: 0, next: 0.0, per: 1.0, gain: 0.0, enabled_on_grid: false }
    }
    pub fn start(&mut self, config: DrumConfig) { self.config = config; self.pattern = config.pattern; self.running = true; self.beat = 0; self.sub = 4; self.gain = 0.0; self.enabled_on_grid = false; }
    pub fn update(&mut self, config: DrumConfig) { self.config = config; }
    pub fn stop(&mut self) { self.running = false; self.enabled_on_grid = false; }
    /// Sincroniza cada semínima, sem reiniciar a bateria a cada volta dos acordes.
    pub fn sync_beat(&mut self, bpm: f64) {
        if !self.running { return; }
        self.phase = (self.beat % 4) as usize * 4; self.beat += 1;
        self.sub = 0; self.next = self.frame as f64;
        self.per = self.sample_rate as f64 * 60.0 / bpm / 4.0;
    }
    pub fn sample(&mut self) -> f32 {
        if self.running && self.sub < 4 && self.frame as f64 >= self.next {
            let step = self.phase + self.sub;
            if step == 0 { self.pattern = self.config.pattern; }
            self.enabled_on_grid = self.config.enabled;
            let mask = self.pattern[step];
            for i in 0..INSTRUMENTS {
                if mask & (1 << i) != 0 {
                    let v = &mut self.voices[i]; v.from = v.last; v.position = 0; v.transition = 0; v.active = true;
                }
            }
            // O chimbal fechado corta o aberto.
            if mask & 4 != 0 { let v = &mut self.voices[3]; v.from = v.last; v.active = false; v.transition = 0; }
            self.sub += 1; self.next += self.per;
        }
        let target = if self.running && self.config.enabled && self.enabled_on_grid { self.config.volume } else { 0.0 };
        self.gain += (target - self.gain).clamp(-1.0/(self.sample_rate as f32*0.01), 1.0/(self.sample_rate as f32*0.01));
        let mut sum = 0.0;
        for (i, voice) in self.voices.iter_mut().enumerate() {
            let value = if voice.active { self.bank[i].get(voice.position).copied().unwrap_or(0.0) } else { 0.0 };
            let blend = (voice.transition as f32 / (self.sample_rate as f32 * 0.002)).min(1.0);
            voice.last = voice.from*(1.0-blend) + value*blend;
            voice.position = voice.position.saturating_add(1); voice.transition = voice.transition.saturating_add(1);
            sum += voice.last;
        }
        self.frame = self.frame.saturating_add(1);
        sum.clamp(-0.95, 0.95) * self.gain
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bancos_originais_finitos() { for sr in [8000,44100,48000] { for i in 0..INSTRUMENTS { let a = synthesize(i,sr); assert_eq!(a[0],0.0); assert!(a.iter().all(|v| v.is_finite() && v.abs()<=0.5)); assert!(a.iter().any(|v| v.abs()>0.005)); assert!(a.last().unwrap().abs()<0.001); } } }
    #[test]
    fn grade_compasso_mute_e_troca_pendente() {
        let mut p=DrumPlayer::new(48000); let mut config=DrumConfig { enabled:true, ..DrumConfig::default() }; p.start(config);
        for beat in 0..9 { p.sync_beat(120.0); for _ in 0..24000 { assert!(p.sample().abs()<=0.95); } if beat==0 { config.pattern=[1;16]; p.update(config); assert_ne!(p.pattern,config.pattern); }
            if beat==4 { assert_eq!(p.pattern,config.pattern); } }
        p.stop(); for _ in 0..1000 { p.sample(); } assert_eq!(p.sample(),0.0);
    }
    #[test]
    fn processamento_troca_e_mute_sem_alocar_ou_liberar() {
        let mut p=DrumPlayer::new(48000); let mut config=DrumConfig { enabled:true, ..DrumConfig::default() };
        let mut peak=0.0_f32;
        let operations=crate::realtime_test::count(|| {
            p.start(config);
            for beat in 0..16 { p.sync_beat(120.0); for _ in 0..24000 { peak=peak.max(p.sample().abs()); }
                config.enabled=beat%3!=0; config.volume=0.4; config.pattern=[255;16]; p.update(config);
            }
            p.stop(); for _ in 0..1000 { p.sample(); }
        });
        assert_eq!(operations,0); assert!(peak>0.005 && peak<=0.95);
    }
}
