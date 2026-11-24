//! Efeitos mono em tempo real para o Amp. Tudo é preparado antes do stream:
//! nenhuma alocação ou trava no callback. Os parâmetros chegam por atomics.
//!
//! Ordem da cadeia: gate, drive -> [amp] -> EQ, phaser, flanger, chorus, tremolo, delay, reverb.
//! O desenho dos parâmetros (índices) espelha `packages/core/src/amp-fx.ts`.

use std::f32::consts::PI;
use std::sync::atomic::{AtomicU32, Ordering};

pub const PARAM_COUNT: usize = 40;

pub mod idx {
    pub const GATE: usize = 0; // on, limiar dB, soltura ms
    pub const DRIVE: usize = 3; // on, drive, tom, nível dB
    pub const EQ: usize = 7; // on, graves dB, médios dB, agudos dB
    pub const PHASER: usize = 11; // on, velocidade Hz, profundidade, feedback, mix
    pub const FLANGER: usize = 16; // on, velocidade Hz, profundidade, feedback, mix
    pub const CHORUS: usize = 21; // on, velocidade Hz, profundidade, mix
    pub const TREMOLO: usize = 25; // on, velocidade Hz, profundidade
    pub const DELAY: usize = 28; // on, tipo, tempo ms, feedback, tom, mix
    pub const REVERB: usize = 34; // on, tipo, tamanho, abafamento, pré-delay ms, mix
}

/// Padrões: tudo desligado, com valores de partida sensatos.
pub const DEFAULTS: [f32; PARAM_COUNT] = [
    0.0, -60.0, 120.0, // gate
    0.0, 0.4, 0.5, 0.0, // drive
    0.0, 0.0, 0.0, 0.0, // eq
    0.0, 0.4, 0.6, 0.3, 0.5, // phaser
    0.0, 0.25, 0.6, 0.4, 0.5, // flanger
    0.0, 0.8, 0.5, 0.5, // chorus
    0.0, 4.0, 0.5, // tremolo
    0.0, 0.0, 380.0, 0.35, 0.7, 0.3, // delay
    0.0, 1.0, 0.5, 0.4, 20.0, 0.25, // reverb
];

pub struct FxParams {
    v: [AtomicU32; PARAM_COUNT],
}

impl Default for FxParams {
    fn default() -> Self {
        Self::new(&DEFAULTS)
    }
}

impl FxParams {
    pub fn new(values: &[f32; PARAM_COUNT]) -> Self {
        Self { v: std::array::from_fn(|i| AtomicU32::new(values[i].to_bits())) }
    }
    /// Aceita só o tamanho certo; valores que não são números mantêm o anterior.
    pub fn set_all(&self, values: &[f32]) -> bool {
        if values.len() != PARAM_COUNT {
            return false;
        }
        for (slot, &value) in self.v.iter().zip(values) {
            if value.is_finite() {
                slot.store(value.to_bits(), Ordering::Relaxed);
            }
        }
        true
    }
    pub fn load(&self) -> [f32; PARAM_COUNT] {
        std::array::from_fn(|i| f32::from_bits(self.v[i].load(Ordering::Relaxed)))
    }
}

fn db(v: f32) -> f32 {
    10f32.powf(v / 20.0)
}
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}
fn coef(seconds: f32, sr: f32) -> f32 {
    1.0 - (-1.0 / (seconds.max(1e-5) * sr)).exp()
}
fn lowpass_coef(freq: f32, sr: f32) -> f32 {
    1.0 - (-2.0 * PI * freq.clamp(20.0, sr * 0.45) / sr).exp()
}

/// Liga e desliga com rampa de ~10 ms, sem estalo.
#[derive(Default)]
struct Switch(f32);
impl Switch {
    fn step(&mut self, on: bool, c: f32) -> f32 {
        self.0 += ((on as u8 as f32) - self.0) * c;
        if !on && self.0 < 1e-4 {
            self.0 = 0.0;
        }
        self.0
    }
    fn idle(&self, on: bool) -> bool {
        !on && self.0 == 0.0
    }
}

#[derive(Default)]
struct Lfo(f32);
impl Lfo {
    fn tick(&mut self, hz: f32, sr: f32) -> f32 {
        self.0 += hz / sr;
        if self.0 >= 1.0 {
            self.0 -= 1.0;
        }
        (2.0 * PI * self.0).sin()
    }
    fn at(&self, offset: f32) -> f32 {
        (2.0 * PI * (self.0 + offset)).sin()
    }
}

struct Line {
    buf: Vec<f32>,
    pos: usize,
}
impl Line {
    fn new(len: usize) -> Self {
        Self { buf: vec![0.0; len.max(4)], pos: 0 }
    }
    fn clear(&mut self) {
        self.buf.fill(0.0);
    }
    fn write(&mut self, x: f32) {
        self.buf[self.pos] = x;
        self.pos = (self.pos + 1) % self.buf.len();
    }
    /// Amostra escrita há `delay` amostras (interpolação linear).
    fn read(&self, delay: f32) -> f32 {
        let n = self.buf.len();
        let d = delay.clamp(1.0, (n - 2) as f32);
        let mut rp = self.pos as f32 - d;
        if rp < 0.0 {
            rp += n as f32;
        }
        let i = rp as usize;
        let f = rp - i as f32;
        let (a, b) = (self.buf[i % n], self.buf[(i + 1) % n]);
        a + (b - a) * f
    }
}

#[derive(Clone, Copy, Default)]
struct Biquad {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}
impl Biquad {
    fn identity() -> Self {
        Self { b0: 1.0, ..Default::default() }
    }
    fn set(&mut self, b: [f32; 3], a: [f32; 3]) {
        self.b0 = b[0] / a[0];
        self.b1 = b[1] / a[0];
        self.b2 = b[2] / a[0];
        self.a1 = a[1] / a[0];
        self.a2 = a[2] / a[0];
    }
    fn shelf(&mut self, sr: f32, f: f32, gain_db: f32, high: bool) {
        let a = 10f32.powf(gain_db / 40.0);
        let w = 2.0 * PI * f / sr;
        let (c, s) = (w.cos(), w.sin());
        let alpha = s / 2.0 * 2f32.sqrt();
        let k = 2.0 * a.sqrt() * alpha;
        if high {
            self.set(
                [a * ((a + 1.0) + (a - 1.0) * c + k), -2.0 * a * ((a - 1.0) + (a + 1.0) * c), a * ((a + 1.0) + (a - 1.0) * c - k)],
                [(a + 1.0) - (a - 1.0) * c + k, 2.0 * ((a - 1.0) - (a + 1.0) * c), (a + 1.0) - (a - 1.0) * c - k],
            );
        } else {
            self.set(
                [a * ((a + 1.0) - (a - 1.0) * c + k), 2.0 * a * ((a - 1.0) - (a + 1.0) * c), a * ((a + 1.0) - (a - 1.0) * c - k)],
                [(a + 1.0) + (a - 1.0) * c + k, -2.0 * ((a - 1.0) + (a + 1.0) * c), (a + 1.0) + (a - 1.0) * c - k],
            );
        }
    }
    fn peak(&mut self, sr: f32, f: f32, q: f32, gain_db: f32) {
        let a = 10f32.powf(gain_db / 40.0);
        let w = 2.0 * PI * f / sr;
        let (c, alpha) = (w.cos(), w.sin() / (2.0 * q));
        self.set([1.0 + alpha * a, -2.0 * c, 1.0 - alpha * a], [1.0 + alpha / a, -2.0 * c, 1.0 - alpha / a]);
    }
    fn tick(&mut self, x: f32) -> f32 {
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }
}

// ---------------------------------------------------------------- Gate

struct Gate {
    sw: Switch,
    env: f32,
    gain: f32,
    open: bool,
}
impl Gate {
    fn block(&mut self, p: &[f32], sr: f32, data: &mut [f32]) {
        let q = &p[idx::GATE..];
        let on = q[0] >= 0.5;
        if self.sw.idle(on) {
            return;
        }
        let (thr, rel) = (db(q[1].clamp(-90.0, -20.0)), coef(q[2].clamp(10.0, 1000.0) / 1000.0, sr));
        let (att, env_rel, sc) = (coef(0.001, sr), coef(0.05, sr), coef(0.01, sr));
        for x in data {
            let a = x.abs();
            self.env = if a > self.env { a } else { self.env + (a - self.env) * env_rel };
            if self.env > thr {
                self.open = true;
            } else if self.env < thr * 0.6 {
                self.open = false;
            }
            let target = self.open as u8 as f32;
            self.gain += (target - self.gain) * if target > self.gain { att } else { rel };
            let en = self.sw.step(on, sc);
            *x = lerp(*x, *x * self.gain, en);
        }
    }
}

// ---------------------------------------------------------------- Drive

struct Drive {
    sw: Switch,
    lp_mid: f32,
    lp_tone: f32,
}
impl Drive {
    fn block(&mut self, p: &[f32], sr: f32, data: &mut [f32]) {
        let q = &p[idx::DRIVE..];
        let on = q[0] >= 0.5;
        if self.sw.idle(on) {
            return;
        }
        let gain = 1.0 + q[1].clamp(0.0, 1.0) * 40.0;
        let tone = lowpass_coef(lerp(800.0, 9000.0, q[2].clamp(0.0, 1.0)), sr);
        let level = db(q[3].clamp(-24.0, 12.0)) * 0.35;
        let (mid, sc) = (lowpass_coef(700.0, sr), coef(0.01, sr));
        for x in data {
            self.lp_mid += (*x - self.lp_mid) * mid;
            let pre = *x + 0.8 * (*x - self.lp_mid);
            let clipped = (pre * gain).tanh();
            self.lp_tone += (clipped - self.lp_tone) * tone;
            let en = self.sw.step(on, sc);
            *x = lerp(*x, self.lp_tone * level, en);
        }
    }
}

// ---------------------------------------------------------------- EQ

struct Eq {
    sw: Switch,
    low: Biquad,
    mid: Biquad,
    high: Biquad,
    last: [f32; 3],
}
impl Eq {
    fn block(&mut self, p: &[f32], sr: f32, data: &mut [f32]) {
        let q = &p[idx::EQ..];
        let on = q[0] >= 0.5;
        if self.sw.idle(on) {
            return;
        }
        let g = [q[1].clamp(-12.0, 12.0), q[2].clamp(-12.0, 12.0), q[3].clamp(-12.0, 12.0)];
        if g != self.last {
            self.low.shelf(sr, 120.0, g[0], false);
            self.mid.peak(sr, 800.0, 0.8, g[1]);
            self.high.shelf(sr, 4000.0, g[2], true);
            self.last = g;
        }
        let sc = coef(0.01, sr);
        for x in data {
            let y = self.high.tick(self.mid.tick(self.low.tick(*x)));
            let en = self.sw.step(on, sc);
            *x = lerp(*x, y, en);
        }
    }
}

// ---------------------------------------------------------------- Phaser

struct Phaser {
    sw: Switch,
    lfo: Lfo,
    z: [f32; 4],
    fb: f32,
}
impl Phaser {
    fn block(&mut self, p: &[f32], sr: f32, data: &mut [f32]) {
        let q = &p[idx::PHASER..];
        let on = q[0] >= 0.5;
        if self.sw.idle(on) {
            return;
        }
        let (rate, depth, fb, mix) = (q[1].clamp(0.02, 8.0), q[2].clamp(0.0, 1.0), q[3].clamp(0.0, 0.9), q[4].clamp(0.0, 1.0));
        let sc = coef(0.01, sr);
        for x in data {
            let l = self.lfo.tick(rate, sr) * 0.5 + 0.5;
            let f = 250.0 * 2f32.powf(l * depth * 3.5);
            let t = (PI * f.min(sr * 0.4) / sr).tan();
            let a = (t - 1.0) / (t + 1.0);
            let mut y = *x + self.fb * fb;
            for z in &mut self.z {
                let out = a * y + *z;
                *z = y - a * out;
                y = out;
            }
            self.fb = y;
            let wet = (1.0 - mix) * *x + mix * 0.5 * (*x + y);
            let en = self.sw.step(on, sc);
            *x = lerp(*x, wet, en);
        }
    }
}

// ---------------------------------------------------------------- Flanger e Chorus

struct Flanger {
    sw: Switch,
    lfo: Lfo,
    line: Line,
    fb: f32,
}
impl Flanger {
    fn block(&mut self, p: &[f32], sr: f32, data: &mut [f32]) {
        let q = &p[idx::FLANGER..];
        let on = q[0] >= 0.5;
        if self.sw.idle(on) {
            return;
        }
        let (rate, depth, fb, mix) = (q[1].clamp(0.02, 5.0), q[2].clamp(0.0, 1.0), q[3].clamp(0.0, 0.9), q[4].clamp(0.0, 1.0));
        let sc = coef(0.01, sr);
        for x in data {
            let l = self.lfo.tick(rate, sr) * 0.5 + 0.5;
            let d = (0.0006 + depth * 0.004 * l) * sr;
            let y = self.line.read(d);
            self.line.write(*x + self.fb * fb);
            self.fb = y;
            let wet = *x * (1.0 - mix * 0.5) + y * mix * 0.5;
            let en = self.sw.step(on, sc);
            *x = lerp(*x, wet, en);
        }
    }
}

struct Chorus {
    sw: Switch,
    lfo: Lfo,
    line: Line,
}
impl Chorus {
    fn block(&mut self, p: &[f32], sr: f32, data: &mut [f32]) {
        let q = &p[idx::CHORUS..];
        let on = q[0] >= 0.5;
        if self.sw.idle(on) {
            return;
        }
        let (rate, depth, mix) = (q[1].clamp(0.05, 6.0), q[2].clamp(0.0, 1.0), q[3].clamp(0.0, 1.0));
        let sc = coef(0.01, sr);
        for x in data {
            self.lfo.tick(rate, sr);
            let (m1, m2) = (self.lfo.at(0.0), self.lfo.at(0.5));
            let (d1, d2) = ((0.011 + 0.005 * depth * m1) * sr, (0.014 + 0.005 * depth * m2) * sr);
            let wet_line = (self.line.read(d1) + self.line.read(d2)) * 0.5;
            self.line.write(*x);
            let wet = *x * (1.0 - mix * 0.5) + wet_line * mix * 0.5;
            let en = self.sw.step(on, sc);
            *x = lerp(*x, wet, en);
        }
    }
}

// ---------------------------------------------------------------- Tremolo

struct Tremolo {
    sw: Switch,
    lfo: Lfo,
}
impl Tremolo {
    fn block(&mut self, p: &[f32], sr: f32, data: &mut [f32]) {
        let q = &p[idx::TREMOLO..];
        let on = q[0] >= 0.5;
        if self.sw.idle(on) {
            return;
        }
        let (rate, depth) = (q[1].clamp(0.2, 16.0), q[2].clamp(0.0, 1.0));
        let sc = coef(0.01, sr);
        for x in data {
            let l = self.lfo.tick(rate, sr) * 0.5 + 0.5;
            let en = self.sw.step(on, sc);
            *x = lerp(*x, *x * (1.0 - depth * l), en);
        }
    }
}

// ---------------------------------------------------------------- Delay

struct Delay {
    sw: Switch,
    lfo: Lfo,
    line: Line,
    time: f32,
    lp: f32,
}
impl Delay {
    fn block(&mut self, p: &[f32], sr: f32, data: &mut [f32]) {
        let q = &p[idx::DELAY..];
        let on = q[0] >= 0.5;
        if self.sw.idle(on) {
            return;
        }
        let kind = q[1].round().clamp(0.0, 2.0) as u8; // 0 digital, 1 analógico, 2 slapback
        let (ms, mut fb) = (q[2].clamp(40.0, 1000.0), q[3].clamp(0.0, 0.92));
        let ms = if kind == 2 { ms.clamp(60.0, 180.0) } else { ms };
        if kind == 2 {
            fb = fb.min(0.12);
        }
        let tone = q[4].clamp(0.0, 1.0);
        let cutoff = lerp(900.0, 12000.0, tone) * if kind == 1 { 0.45 } else { 1.0 };
        let (lp, mix, sc, slew) = (lowpass_coef(cutoff, sr), q[5].clamp(0.0, 1.0), coef(0.01, sr), coef(0.15, sr));
        let target = ms * 0.001 * sr;
        for x in data {
            self.time += (target - self.time) * slew;
            let wobble = if kind == 1 { self.lfo.tick(0.6, sr) * 0.0004 * sr } else { 0.0 };
            let y = self.line.read(self.time + wobble);
            self.lp += (y - self.lp) * lp;
            self.line.write(*x + self.lp * fb);
            let en = self.sw.step(on, sc);
            *x += y * mix * en;
        }
    }
}

// ---------------------------------------------------------------- Reverb (Freeverb)

const COMBS: [usize; 8] = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS: [usize; 4] = [556, 441, 341, 225];
const REVERB_WET: f32 = 3.0;

struct Comb {
    buf: Vec<f32>,
    len: usize,
    i: usize,
    store: f32,
}
impl Comb {
    fn tick(&mut self, input: f32, fb: f32, damp: f32) -> f32 {
        let out = self.buf[self.i];
        self.store = out * (1.0 - damp) + self.store * damp;
        self.buf[self.i] = input + self.store * fb;
        self.i += 1;
        if self.i >= self.len {
            self.i = 0;
        }
        out
    }
}
struct AllPass {
    buf: Vec<f32>,
    len: usize,
    i: usize,
}
impl AllPass {
    fn tick(&mut self, input: f32) -> f32 {
        let held = self.buf[self.i];
        self.buf[self.i] = input + held * 0.5;
        self.i += 1;
        if self.i >= self.len {
            self.i = 0;
        }
        held - input
    }
}

struct Reverb {
    sw: Switch,
    combs: Vec<Comb>,
    allpass: Vec<AllPass>,
    pre: Line,
    kind: u8,
    scale: f32,
}
impl Reverb {
    fn new(sr: f32) -> Self {
        let scale = sr / 44100.0;
        let mk = |n: usize| ((n as f32) * scale * 1.5) as usize + 2;
        Self {
            sw: Switch::default(),
            combs: COMBS.iter().map(|&n| Comb { buf: vec![0.0; mk(n)], len: mk(n), i: 0, store: 0.0 }).collect(),
            allpass: ALLPASS.iter().map(|&n| AllPass { buf: vec![0.0; mk(n)], len: mk(n), i: 0 }).collect(),
            pre: Line::new((sr * 0.12) as usize),
            kind: 255,
            scale,
        }
    }
    fn set_kind(&mut self, kind: u8) {
        if kind == self.kind {
            return;
        }
        let factor = [0.7, 1.4, 1.0][kind as usize];
        for (c, &n) in self.combs.iter_mut().zip(&COMBS) {
            c.len = (((n as f32) * self.scale * factor) as usize).clamp(2, c.buf.len());
            c.buf.fill(0.0);
            c.i = 0;
            c.store = 0.0;
        }
        for (a, &n) in self.allpass.iter_mut().zip(&ALLPASS) {
            a.len = (((n as f32) * self.scale * factor.sqrt()) as usize).clamp(2, a.buf.len());
            a.buf.fill(0.0);
            a.i = 0;
        }
        self.kind = kind;
    }
    fn block(&mut self, p: &[f32], sr: f32, data: &mut [f32]) {
        let q = &p[idx::REVERB..];
        let on = q[0] >= 0.5;
        if self.sw.idle(on) {
            return;
        }
        let kind = q[1].round().clamp(0.0, 2.0) as u8; // 0 sala, 1 hall, 2 plate
        self.set_kind(kind);
        let size = q[2].clamp(0.0, 1.0);
        let fb = match kind {
            0 => 0.70 + 0.22 * size,
            1 => 0.80 + 0.18 * size,
            _ => 0.76 + 0.2 * size,
        };
        let damp = q[3].clamp(0.0, 1.0) * 0.6;
        let pre = q[4].clamp(0.0, 100.0) * 0.001 * sr;
        let (mix, sc) = (q[5].clamp(0.0, 1.0), coef(0.01, sr));
        for x in data {
            self.pre.write(*x);
            let input = self.pre.read(pre.max(1.0)) * 0.015;
            let mut wet = 0.0;
            for c in &mut self.combs {
                wet += c.tick(input, fb, damp);
            }
            for a in &mut self.allpass {
                wet = a.tick(wet);
            }
            let en = self.sw.step(on, sc);
            *x += wet * REVERB_WET * mix * en;
        }
    }
}

// ---------------------------------------------------------------- Cadeia

pub struct FxChain {
    sr: f32,
    gate: Gate,
    drive: Drive,
    eq: Eq,
    phaser: Phaser,
    flanger: Flanger,
    chorus: Chorus,
    tremolo: Tremolo,
    delay: Delay,
    reverb: Reverb,
}

impl FxChain {
    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;
        let line = |s: f32| Line::new((sr * s) as usize + 8);
        Self {
            sr,
            gate: Gate { sw: Switch::default(), env: 0.0, gain: 0.0, open: false },
            drive: Drive { sw: Switch::default(), lp_mid: 0.0, lp_tone: 0.0 },
            eq: Eq { sw: Switch::default(), low: Biquad::identity(), mid: Biquad::identity(), high: Biquad::identity(), last: [f32::NAN; 3] },
            phaser: Phaser { sw: Switch::default(), lfo: Lfo::default(), z: [0.0; 4], fb: 0.0 },
            flanger: Flanger { sw: Switch::default(), lfo: Lfo::default(), line: line(0.02), fb: 0.0 },
            chorus: Chorus { sw: Switch::default(), lfo: Lfo::default(), line: line(0.04) },
            tremolo: Tremolo { sw: Switch::default(), lfo: Lfo::default() },
            delay: Delay { sw: Switch::default(), lfo: Lfo::default(), line: line(1.1), time: 0.0, lp: 0.0 },
            reverb: Reverb::new(sr),
        }
    }

    /// Antes do amp: gate e drive.
    pub fn pre(&mut self, p: &[f32; PARAM_COUNT], data: &mut [f32]) {
        self.gate.block(p, self.sr, data);
        self.drive.block(p, self.sr, data);
    }

    /// Depois do amp: EQ, modulação, delay e reverb.
    pub fn post(&mut self, p: &[f32; PARAM_COUNT], data: &mut [f32]) {
        self.eq.block(p, self.sr, data);
        self.phaser.block(p, self.sr, data);
        self.flanger.block(p, self.sr, data);
        self.chorus.block(p, self.sr, data);
        self.tremolo.block(p, self.sr, data);
        self.delay.block(p, self.sr, data);
        self.reverb.block(p, self.sr, data);
        for x in data.iter_mut() {
            if !x.is_finite() {
                *x = 0.0;
            }
        }
    }

    /// Limpa as caudas (troca de modelo, por exemplo).
    pub fn clear(&mut self) {
        self.flanger.line.clear();
        self.chorus.line.clear();
        self.delay.line.clear();
        self.reverb.pre.clear();
        self.reverb.kind = 255;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: u32 = 48_000;

    fn noise(n: usize, level: f32) -> Vec<f32> {
        let mut s = 12345u32;
        (0..n)
            .map(|_| {
                s = s.wrapping_mul(1664525).wrapping_add(1013904223);
                ((s >> 8) as f32 / (1u32 << 24) as f32 * 2.0 - 1.0) * level
            })
            .collect()
    }
    fn rms(x: &[f32]) -> f32 {
        (x.iter().map(|v| v * v).sum::<f32>() / x.len() as f32).sqrt()
    }
    fn run(chain: &mut FxChain, p: &[f32; PARAM_COUNT], input: &[f32]) -> Vec<f32> {
        let mut out = input.to_vec();
        for block in out.chunks_mut(64) {
            chain.pre(p, block);
            chain.post(p, block);
        }
        out
    }
    fn with(on: usize, extra: &[(usize, f32)]) -> [f32; PARAM_COUNT] {
        let mut p = DEFAULTS;
        p[on] = 1.0;
        for &(i, v) in extra {
            p[i] = v;
        }
        p
    }

    #[test]
    fn contagem_de_parametros() {
        assert_eq!(PARAM_COUNT, 40);
        assert_eq!(DEFAULTS.len(), 40);
        assert_eq!(idx::REVERB + 6, PARAM_COUNT);
    }

    #[test]
    fn tudo_desligado_nao_altera_o_sinal() {
        let mut c = FxChain::new(SR);
        let x = noise(4800, 0.3);
        assert_eq!(run(&mut c, &DEFAULTS, &x), x);
    }

    #[test]
    fn set_all_valida_tamanho_e_numeros() {
        let p = FxParams::default();
        assert!(!p.set_all(&[0.0; 3]));
        let mut v = DEFAULTS.to_vec();
        v[1] = f32::NAN;
        v[2] = 200.0;
        assert!(p.set_all(&v));
        assert_eq!(p.load()[1], DEFAULTS[1]);
        assert_eq!(p.load()[2], 200.0);
    }

    #[test]
    fn cada_efeito_ligado_fica_finito_e_limitado() {
        let x = noise(48_000, 0.5);
        for on in [idx::GATE, idx::DRIVE, idx::EQ, idx::PHASER, idx::FLANGER, idx::CHORUS, idx::TREMOLO, idx::DELAY, idx::REVERB] {
            let mut c = FxChain::new(SR);
            let mut p = with(on, &[]);
            if on == idx::EQ {
                p[idx::EQ + 1] = 12.0;
                p[idx::EQ + 3] = 12.0;
            }
            let y = run(&mut c, &p, &x);
            assert!(y.iter().all(|v| v.is_finite() && v.abs() < 4.0), "efeito {on}");
            assert!(rms(&y) > 0.0, "efeito {on}");
        }
    }

    #[test]
    fn extremos_dos_parametros_nao_explodem() {
        let x = noise(48_000, 0.5);
        for hi in [false, true] {
            let mut p = [0.0f32; PARAM_COUNT];
            for (i, v) in p.iter_mut().enumerate() {
                *v = if hi { 1.0e6 } else { -1.0e6 };
                if [idx::GATE, idx::DRIVE, idx::EQ, idx::PHASER, idx::FLANGER, idx::CHORUS, idx::TREMOLO, idx::DELAY, idx::REVERB].contains(&i) {
                    *v = 1.0;
                }
            }
            let mut c = FxChain::new(SR);
            let y = run(&mut c, &p, &x);
            assert!(y.iter().all(|v| v.is_finite() && v.abs() < 50.0));
        }
    }

    #[test]
    fn delay_repete_no_tempo_certo() {
        let mut c = FxChain::new(SR);
        let p = with(idx::DELAY, &[(idx::DELAY + 1, 0.0), (idx::DELAY + 2, 250.0), (idx::DELAY + 3, 0.0), (idx::DELAY + 5, 1.0)]);
        let mut x = vec![0.0f32; 48_000];
        x[0] = 1.0;
        // Aquece o interruptor e o tempo: manda o impulso depois de 0.5 s de silêncio.
        let mut warm = vec![0.0f32; 24_000];
        warm.extend_from_slice(&x);
        let y = run(&mut c, &p, &warm);
        let tail = &y[24_000 + 100..];
        let (at, peak) = tail.iter().enumerate().fold((0, 0.0), |a, (i, &v)| if v.abs() > a.1 { (i + 100, v.abs()) } else { a });
        assert!(peak > 0.5, "pico {peak}");
        let ms = at as f32 / SR as f32 * 1000.0;
        assert!((ms - 250.0).abs() < 3.0, "eco em {ms} ms");
    }

    #[test]
    fn reverb_tem_cauda_e_nivel_razoavel() {
        let x = noise(96_000, 0.1);
        for kind in [0.0, 1.0, 2.0] {
            let mut c = FxChain::new(SR);
            let p = with(idx::REVERB, &[(idx::REVERB + 1, kind), (idx::REVERB + 5, 1.0)]);
            let y = run(&mut c, &p, &x);
            let wet: Vec<f32> = y.iter().zip(&x).map(|(a, b)| a - b).collect();
            let ratio = rms(&wet[48_000..]) / rms(&x[48_000..]);
            assert!((0.15..2.5).contains(&ratio), "tipo {kind}: razão {ratio}");
        }
        // Cauda: um impulso ainda soa depois de 300 ms.
        let mut c = FxChain::new(SR);
        let p = with(idx::REVERB, &[(idx::REVERB + 5, 1.0)]);
        let mut x = vec![0.0f32; 48_000];
        x[24_000] = 1.0;
        let y = run(&mut c, &p, &x);
        assert!(rms(&y[24_000 + 14_400..24_000 + 19_200]) > 1e-4);
    }

    #[test]
    fn gate_fecha_com_ruido_baixo_e_abre_com_sinal() {
        let mut c = FxChain::new(SR);
        let p = with(idx::GATE, &[(idx::GATE + 1, -40.0), (idx::GATE + 2, 50.0)]);
        let hiss = noise(48_000, 0.001);
        let y = run(&mut c, &p, &hiss);
        assert!(rms(&y[24_000..]) < rms(&hiss) * 0.2);
        let loud = noise(24_000, 0.3);
        let z = run(&mut c, &p, &loud);
        assert!(rms(&z[12_000..]) > rms(&loud) * 0.8);
    }

    #[test]
    fn eq_de_agudos_realca_ruido_branco() {
        let x = noise(48_000, 0.2);
        let mut c = FxChain::new(SR);
        let p = with(idx::EQ, &[(idx::EQ + 3, 12.0)]);
        let y = run(&mut c, &p, &x);
        assert!(rms(&y[4_800..]) > rms(&x[4_800..]) * 1.5);
    }

    #[test]
    fn desligar_volta_ao_sinal_original() {
        let mut c = FxChain::new(SR);
        let on = with(idx::PHASER, &[]);
        let x = noise(9_600, 0.3);
        run(&mut c, &on, &x);
        let y = run(&mut c, &DEFAULTS, &noise(9_600, 0.3));
        assert_eq!(y[6_000..], noise(9_600, 0.3)[6_000..]);
    }
}
