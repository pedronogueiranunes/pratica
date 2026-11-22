//! Prova rápida do motor no Mac, sem interface:
//!   cargo run -p audio-engine --example smoke
//! Lista os dispositivos, toca o metrônomo a 120 bpm por 4 s e escuta o afinador por 10 s.

use audio_engine::engine::{start_engine, list_devices, EngineEvent};
use audio_engine::{rank, MetronomeSettings, Purpose};
use std::time::Duration;

fn main() {
    let devices = list_devices();
    println!("Dispositivos:");
    for d in &devices {
        println!(
            "  {} [{:?}] entrada:{} saída:{} {}Hz buffer {:?}-{:?}",
            d.name, d.connection, d.input_channels, d.output_channels,
            d.sample_rate.unwrap_or(0), d.buffer_min, d.buffer_max
        );
    }
    if let Some(best) = rank(&devices, Purpose::Instrument).first() {
        println!("Melhor entrada para instrumento: {} ({:?}, ~{:.1} ms)", best.device_id, best.reason, best.estimated_ms);
    }

    let engine = start_engine(|ev| match ev {
        EngineEvent::Tick { tick, audible_in_ms } => {
            println!("clique {} (tempo {}) soa em {:.1} ms", tick.index, tick.beat + 1, audible_in_ms)
        }
        EngineEvent::Pitch { reading: Some(r), clarity, .. } if clarity > 0.8 => {
            println!("{}{}  {:+.1} cents  ({:.2} Hz)", r.name, r.octave, r.cents, r.frequency)
        }
        EngineEvent::Latency { direction, ms, .. } => println!("latência {direction:?}: {ms:.1} ms"),
        EngineEvent::Error { code, message, .. } => eprintln!("erro {code:?}: {message}"),
        _ => {}
    });

    engine.start_metronome(std::env::var("OUT_DEVICE").ok(), MetronomeSettings { bpm: 120.0, ..Default::default() });
    std::thread::sleep(Duration::from_secs(4));
    engine.stop_metronome();

    println!("\nToque uma corda solta (10 s)...");
    engine.start_tuner(std::env::var("IN_DEVICE").ok(), 0, 440.0);
    std::thread::sleep(Duration::from_secs(10));
    engine.stop_tuner();
}
