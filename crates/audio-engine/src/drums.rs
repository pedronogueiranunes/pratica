//! Bateria original: bancos preparados no controle, vozes fixas na callback.
use serde::Deserialize;
#[derive(Clone, Copy, Deserialize)]
pub struct DrumConfig { pub enabled: bool, pub pattern: [u8; 16], pub volume: f32 }
impl Default for DrumConfig {
    fn default() -> Self { Self { enabled: false, pattern: [5,0,4,0,6,0,5,0,5,0,4,0,6,0,4,0], volume: 0.5 } }
}
impl DrumConfig {
    pub fn valid(&self) -> bool { self.volume.is_finite() && (0.0..=1.0).contains(&self.volume) && self.pattern.iter().all(|n| *n <= 31) }
}
pub fn synthesize(instrument: usize, sample_rate: u32) -> Vec<f32> {
    let duration = [0.28, 0.18, 0.06, 0.22, 0.08][instrument];
    let mut data = vec![0.0; (duration * sample_rate as f64).round() as usize];
    let mut seed = 0x12345678_u32; let mut previous = 0.0;
    for (i, sample) in data.iter_mut().enumerate() {
        seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
        let noise = seed as f64 / u32::MAX as f64 * 2.0 - 1.0;
        let bright = (noise - previous * 0.85) / 1.85; previous = noise;
        let t = i as f64 / sample_rate as f64;
        let value = match instrument {
            0 => 0.4 * (std::f64::consts::TAU * (48.0*t + 52.0*0.028*(1.0-(-t/0.028).exp()))).sin() * (-18.0*t).exp(),
            1 => 0.22 * (0.75*bright + 0.25*(std::f64::consts::TAU*185.0*t).sin()) * (-22.0*t).exp(),
            4 => 0.15 * (0.8*(std::f64::consts::TAU*920.0*t).sin() + 0.2*bright) * (-65.0*t).exp(),
            _ => (if instrument == 2 { 0.08 } else { 0.1 }) * bright * (-(if instrument == 2 { 70.0 } else { 18.0 })*t).exp(),
        };
        *sample = (value * (t/0.001).min(1.0) * ((duration-t)/0.01).min(1.0)) as f32;
    }
    data
}
#[derive(Clone, Copy, Default)]
struct Voice { position: usize, active: bool, from: f32, last: f32, transition: u32 }
pub struct DrumPlayer {
    bank: [Vec<f32>; 5], voices: [Voice; 5], sample_rate: u32, config: DrumConfig,
    pattern: [u8; 16], running: bool, beat: u64, phase: usize, sub: usize,
    frame: u64, next: f64, per: f64, gain: f32, enabled_on_grid: bool,
}
impl DrumPlayer {
    pub fn new(sample_rate: u32) -> Self {
        let config = DrumConfig::default();
        Self { bank: std::array::from_fn(|i| synthesize(i, sample_rate)), voices: [Voice::default(); 5], sample_rate, config, pattern: config.pattern, running: false, beat: 0, phase: 0, sub: 4, frame: 0, next: 0.0, per: 1.0, gain: 0.0, enabled_on_grid: false }
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
            for i in 0..5 {
                if mask & (1 << i) != 0 {
                    let v = &mut self.voices[i]; v.from = v.last; v.position = 0; v.transition = 0; v.active = true;
                }
            }
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
        sum.clamp(-0.7, 0.7) * self.gain
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bancos_originais_finitos() { for sr in [8000,44100,48000] { for i in 0..5 { let a = synthesize(i,sr); assert_eq!(a[0],0.0); assert!(a.iter().all(|v| v.is_finite() && v.abs()<=0.4)); assert!(a.iter().any(|v| v.abs()>0.005)); assert!(a.last().unwrap().abs()<0.001); } } }
    #[test]
    fn grade_compasso_mute_e_troca_pendente() {
        let mut p=DrumPlayer::new(48000); let mut config=DrumConfig { enabled:true, ..DrumConfig::default() }; p.start(config);
        for beat in 0..9 { p.sync_beat(120.0); for _ in 0..24000 { assert!(p.sample().abs()<=0.7); } if beat==0 { config.pattern=[1;16]; p.update(config); assert_ne!(p.pattern,config.pattern); }
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
                config.enabled=beat%3!=0; config.volume=0.4; config.pattern=[31;16]; p.update(config);
            }
            p.stop(); for _ in 0..1000 { p.sample(); }
        });
        assert_eq!(operations,0); assert!(peak>0.005 && peak<=0.7);
    }
}
