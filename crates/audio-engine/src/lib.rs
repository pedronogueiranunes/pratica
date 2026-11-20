//! Motor de áudio do app de prática de guitarra.
//!
//! - [`metronome`], [`click`], [`pitch`] e [`latency`] são DSP e lógica pura,
//!   sem dependência de sistema. Rodam em qualquer plataforma e têm testes.
//! - [`engine`] (feature `io`) liga isso aos dispositivos reais via cpal.

pub mod click;
pub mod latency;
pub mod metronome;
pub mod pitch;

#[cfg(feature = "io")]
pub mod engine;

pub use click::ClickSound;
pub use latency::{rank, should_suggest_switch, Connection, DeviceInfo, Purpose, Recommendation};
pub use metronome::{Metronome, MetronomeSettings, Tick};
pub use pitch::{note_from_frequency, NoteReading, PitchDetector};
