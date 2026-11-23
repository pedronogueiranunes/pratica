//! Transporte de acordes dirigido pelos tempos do metrônomo. Memória fixa.
use crate::preview::PreviewPlan;
use crate::drums::DrumConfig;
use serde::Deserialize;

pub const MAX_STEPS: usize = 16;
#[derive(Clone, Copy, Deserialize)]
pub struct SequenceMixer { pub volume: f32, pub click: bool, pub drums: DrumConfig }
impl SequenceMixer { pub fn valid(&self) -> bool { self.volume.is_finite() && (0.0..=1.0).contains(&self.volume) && self.drums.valid() } }
#[derive(Deserialize)]
pub struct SequenceStep { pub frequencies: Vec<f32>, pub beats: u32 }
#[derive(Clone, Copy)]
pub struct SequencePlan {
    steps: [Option<PreviewPlan>; MAX_STEPS],
    beats: [u32; MAX_STEPS],
    len: usize,
    pub click: bool,
    pub run_id: u32,
    pub volume: f32,
    pub drums: DrumConfig,
}
impl SequencePlan {
    pub fn new(steps: &[SequenceStep], volume: f32, click: bool) -> Option<Self> {
        Self::with_drums(steps, volume, click, DrumConfig::default())
    }
    pub fn with_drums(steps: &[SequenceStep], volume: f32, click: bool, drums: DrumConfig) -> Option<Self> {
        if (!drums.enabled && steps.is_empty()) || !drums.valid() || steps.len() > MAX_STEPS || !volume.is_finite() || !(0.0..=1.0).contains(&volume) { return None; }
        let mut plan = Self { steps: [None; MAX_STEPS], beats: [0; MAX_STEPS], len: steps.len(), click, run_id: 0, volume, drums };
        for (i, step) in steps.iter().enumerate() {
            if ![1, 2, 4, 8].contains(&step.beats) { return None; }
            plan.steps[i] = Some(PreviewPlan::new(&step.frequencies, 1.0)?);
            plan.beats[i] = step.beats;
        }
        Some(plan)
    }
}
#[derive(Default)]
pub struct SequencePlayer { plan: Option<SequencePlan>, step: usize, elapsed: u32 }
impl SequencePlayer {
    pub fn start(&mut self, plan: SequencePlan) { self.plan = Some(plan); self.step = 0; self.elapsed = 0; }
    pub fn stop(&mut self) { self.plan = None; }
    pub fn is_running(&self) -> bool { self.plan.is_some() }
    pub fn run_id(&self) -> u32 { self.plan.as_ref().map_or(0, |p| p.run_id) }
    pub fn click_gain(&self) -> f32 { if self.plan.as_ref().is_some_and(|p| !p.click) { 0.0 } else { 1.0 } }
    pub fn beat(&mut self) -> Option<(usize, u32, Option<PreviewPlan>)> {
        let plan = self.plan.as_ref()?;
        if plan.len == 0 { return Some((0, 4, None)); }
        let result = (self.step, plan.beats[self.step] - self.elapsed, if self.elapsed == 0 { plan.steps[self.step] } else { None });
        self.elapsed += 1;
        if self.elapsed == plan.beats[self.step] { self.step = (self.step + 1) % plan.len; self.elapsed = 0; }
        Some(result)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fronteiras_e_voltas_sem_alocar() {
        let plan = SequencePlan::new(&[SequenceStep { frequencies: vec![440.0], beats: 1 }, SequenceStep { frequencies: vec![220.0], beats: 2 }], 0.5, false).unwrap();
        let mut player = SequencePlayer::default(); player.start(plan);
        assert_eq!(player.click_gain(), 0.0);
        for beat in 0..100_000 { let (step, left, attack) = player.beat().unwrap(); let pos = beat % 3;
            assert_eq!(step, if pos == 0 { 0 } else { 1 });
            assert_eq!(left, if pos == 1 { 2 } else { 1 });
            assert_eq!(attack.is_some(), pos != 2);
        }
        player.stop(); assert!(player.beat().is_none()); assert_eq!(player.click_gain(), 1.0);
    }
    #[test]
    fn recusa_plano_invalido() {
        assert!(SequencePlan::new(&[], 0.5, true).is_none());
        assert!(SequencePlan::new(&[SequenceStep { frequencies: vec![440.0], beats: 3 }], 0.5, true).is_none());
        assert!(SequencePlan::new(&[SequenceStep { frequencies: vec![f32::NAN], beats: 4 }], 0.5, true).is_none());
    }
}
