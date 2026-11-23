//! Bancada local. Nenhum comando cria arquivo NAM ou publica dados sem caminho explícito.
mod wav;
use audio_engine::amp::{correlation_delay, probe_signal, BlockProcessor, RealtimeScope};
use audio_engine::amp_io::{Monitor, MonitorConfig};
use nam_rs::{Model, NamModel};
use serde_json::{json, Value};
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

struct CountAlloc;
static ALLOCS: AtomicU64 = AtomicU64::new(0);
static FREES: AtomicU64 = AtomicU64::new(0);
unsafe impl GlobalAlloc for CountAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if audio_engine::amp::in_audio_callback() {
            ALLOCS.fetch_add(1, Ordering::Relaxed);
        }
        System.alloc(layout)
    }
    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        if audio_engine::amp::in_audio_callback() {
            ALLOCS.fetch_add(1, Ordering::Relaxed);
        }
        System.alloc_zeroed(layout)
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        if audio_engine::amp::in_audio_callback() {
            ALLOCS.fetch_add(1, Ordering::Relaxed);
        }
        System.realloc(ptr, layout, size)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        if audio_engine::amp::in_audio_callback() {
            FREES.fetch_add(1, Ordering::Relaxed);
        }
        System.dealloc(ptr, layout)
    }
}
#[global_allocator]
static ALLOCATOR: CountAlloc = CountAlloc;
struct NamProcessor(Model);
impl BlockProcessor for NamProcessor {
    fn process(&mut self, data: &mut [f32]) {
        self.0.process_buffer(data);
    }
}
struct Bypass;
impl BlockProcessor for Bypass {
    fn process(&mut self, _: &mut [f32]) {}
}

fn load(path: &str, warm: bool) -> Result<Model, String> {
    if std::fs::metadata(path).map_err(|e| e.to_string())?.len() > 32_000_000 {
        return Err("Modelo maior que o limite da bancada (32 MB).".into());
    }
    let file = NamModel::from_file(path).map_err(|e| e.to_string())?;
    let mut model = Model::from_nam(&file).map_err(|e| e.to_string())?;
    let sr = model.expected_sample_rate();
    if !sr.is_finite() || sr.fract() != 0.0 || !(8000.0..=192000.0).contains(&sr) {
        return Err("Taxa do modelo fora da faixa da bancada.".into());
    }
    let count = model.receptive_field();
    if count > 2_000_000 {
        return Err("Warmup do modelo excede o limite da bancada.".into());
    }
    if warm {
        let mut silence = vec![0.0; count];
        model.process_buffer(&mut silence);
    }
    Ok(model)
}
fn option<'a>(args: &'a [String], key: &str) -> Option<&'a str> {
    args.windows(2).find(|v| v[0] == key).map(|v| v[1].as_str())
}
fn required<'a>(args: &'a [String], key: &str) -> Result<&'a str, String> {
    option(args, key).ok_or_else(|| format!("Falta {key}. Use --help."))
}
fn number(args: &[String], key: &str, default: u32) -> Result<u32, String> {
    option(args, key)
        .map(str::parse)
        .transpose()
        .map_err(|_| format!("Valor inválido para {key}"))
        .map(|v| v.unwrap_or(default))
}
fn cpu_seconds() -> f64 {
    let mut usage = std::mem::MaybeUninit::<libc::rusage>::uninit();
    // Fora da callback: medição do processo inteiro, não leitura de timestamp do dispositivo.
    if unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) } != 0 {
        return f64::NAN;
    }
    let usage = unsafe { usage.assume_init() };
    (usage.ru_utime.tv_sec + usage.ru_stime.tv_sec) as f64
        + (usage.ru_utime.tv_usec + usage.ru_stime.tv_usec) as f64 / 1e6
}
// Somente no benchmark offline: a chamada de relógio não entra na callback.
fn thread_cpu_seconds() -> Result<f64, String> {
    let mut time = std::mem::MaybeUninit::<libc::timespec>::uninit();
    if unsafe { libc::clock_gettime(libc::CLOCK_THREAD_CPUTIME_ID, time.as_mut_ptr()) } != 0 {
        return Err("Relógio de CPU da thread indisponível.".into());
    }
    let time = unsafe { time.assume_init() };
    Ok(time.tv_sec as f64 + time.tv_nsec as f64 / 1e9)
}
fn summarize(mut times: Vec<f64>, deadline_us: f64) -> Value {
    times.sort_by(f64::total_cmp);
    let p = |q: f64| {
        times
            .get(((times.len().saturating_sub(1)) as f64 * q).round() as usize)
            .copied()
            .unwrap_or(0.0)
    };
    json!({"count":times.len(),"deadline_misses":times.iter().filter(|&&us| us >= deadline_us).count(),"p50_us":p(0.5),"p95_us":p(0.95),"p99_us":p(0.99),"max_us":p(1.0),"requested_block_deadline_us":deadline_us,"p99_deadline_percent":p(0.99)/deadline_us*100.0})
}
fn bench(args: &[String]) -> Result<Value, String> {
    let mut model = load(required(args, "--model")?, true)?;
    let sr = model.expected_sample_rate();
    let frames = number(args, "--frames", 128)? as usize;
    let seconds = number(args, "--seconds", 5)?;
    if ![64, 128].contains(&frames) || !(1..=60).contains(&seconds) {
        return Err("Use frames 64/128 e duração 1–60 s de sinal.".into());
    }
    let blocks = (sr * seconds as f64 / frames as f64).ceil() as usize;
    let mut data = [0.0; 128];
    let mut times = Vec::with_capacity(blocks);
    let mut thread_times = Vec::with_capacity(blocks);
    let (a0, f0) = (
        ALLOCS.load(Ordering::Relaxed),
        FREES.load(Ordering::Relaxed),
    );
    let mut seed = 17;
    let start = Instant::now();
    let cpu = cpu_seconds();
    for _ in 0..blocks {
        probe_signal(&mut data[..frames], &mut seed);
        let thread_begin = thread_cpu_seconds()?;
        let begin = Instant::now();
        {
            let _rt = RealtimeScope::enter();
            model.process_buffer(&mut data[..frames]);
        }
        let us = begin.elapsed().as_secs_f64() * 1e6;
        thread_times.push((thread_cpu_seconds()? - thread_begin) * 1e6);
        if data[..frames].iter().any(|x| !x.is_finite()) {
            return Err("O modelo produziu NaN/Inf.".into());
        }
        times.push(us);
    }
    let elapsed = start.elapsed().as_secs_f64();
    let allocations = ALLOCS.load(Ordering::Relaxed) - a0;
    let deallocations = FREES.load(Ordering::Relaxed) - f0;
    Ok(
        json!({"dsp_checks_passed":allocations == 0 && deallocations == 0,"kind":"offline_benchmark","nam_rs":"0.4.0","host_arch":std::env::consts::ARCH,"sample_rate":sr,"frames":frames,"processed_samples":blocks*frames,"signal_duration_seconds":blocks as f64*frames as f64/sr,"wall_seconds":elapsed,"cpu_seconds":cpu_seconds()-cpu,"realtime_factor":(blocks as f64*frames as f64/sr)/elapsed,"allocations_in_dsp":allocations,"deallocations_in_dsp":deallocations,"processing":summarize(times,frames as f64/sr*1e6),"thread_cpu_processing":summarize(thread_times,frames as f64/sr*1e6),"thread_clock_includes_measurement_overhead":true,"rtl_measured":false,"candidate_approved":false}),
    )
}
fn compare(args: &[String]) -> Result<Value, String> {
    let mut model = load(required(args, "--model")?, false)?;
    let mut signal: Vec<f32> = serde_json::from_slice(
        &std::fs::read(required(args, "--input")?).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let expected: Vec<f32> = serde_json::from_slice(
        &std::fs::read(required(args, "--expected")?).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if signal.len() != expected.len() || signal.len() > 2_000_000 {
        return Err("Sinais de referência com tamanho inválido.".into());
    }
    let frames = number(args, "--frames", 128)? as usize;
    if ![64, 128].contains(&frames) {
        return Err("Use frames 64/128.".into());
    }
    let skip = model.receptive_field();
    if signal.len() <= skip {
        return Err("Sinal menor que o warmup.".into());
    }
    for block in signal.chunks_mut(frames) {
        model.process_buffer(block);
    }
    let errors: Vec<f64> = signal[skip..]
        .iter()
        .zip(&expected[skip..])
        .map(|(&a, &b)| (a as f64 - b as f64).abs())
        .collect();
    if errors.iter().any(|e| !e.is_finite()) {
        return Err("Referência ou modelo com NaN/Inf.".into());
    }
    let max = errors.iter().copied().fold(0.0, f64::max);
    Ok(
        json!({"frames":frames,"kind":"parity_comparison","max_absolute_error":max,"rms_error":(errors.iter().map(|e| e*e).sum::<f64>()/errors.len() as f64).sqrt(),"tolerance":1e-5,"passed":max<=1e-5,"skip_warmup_samples":skip,"reference_origin":option(args,"--reference-kind").unwrap_or("unverified_external_output")}),
    )
}
fn render(args: &[String]) -> Result<Value, String> {
    let mut model = load(required(args, "--model")?, false)?;
    let mut data: Vec<f32> = serde_json::from_slice(
        &std::fs::read(required(args, "--input")?).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if data.len() > 2_000_000 || data.iter().any(|v| !v.is_finite()) {
        return Err("Sinal inválido.".into());
    }
    for chunk in data.chunks_mut(128) {
        model.process_buffer(chunk);
    }
    std::fs::write(
        required(args, "--output")?,
        serde_json::to_vec(&data).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(json!({"rendered_samples":data.len(),"rtl_measured":false}))
}
fn monitor<P: BlockProcessor>(
    args: &[String],
    model: P,
    sr: u32,
    bypass: bool,
) -> Result<Value, String> {
    let frames = number(args, "--frames", 128)?;
    let seconds = number(args, "--seconds", 60)?;
    if !(1..=600).contains(&seconds) {
        return Err("Duração deve ser 1–600 s.".into());
    }
    let input = number(args, "--input-channel", 1)?;
    let output = number(args, "--output-channel", 1)?;
    if !(1..=256).contains(&input) || !(1..=256).contains(&output) {
        return Err("Canal começa em 1 e termina em 256.".into());
    }
    let device = required(args, "--device")?.to_string();
    let (a0, f0) = (
        ALLOCS.load(Ordering::Relaxed),
        FREES.load(Ordering::Relaxed),
    );
    let mut io = Monitor::open(
        MonitorConfig {
            device_id: device.clone(),
            input_channel: (input - 1) as u16,
            output_channel: (output - 1) as u16,
            sample_rate: sr,
            frames,
            output_db: -24.0,
        },
        model,
    )?;
    eprintln!("Monitor A0: saída -24 dB, canal {output}. Não use monitoramento direto. Encerra em {seconds} s.");
    let start = Instant::now();
    let cpu = cpu_seconds();
    let mut timings = Vec::new();
    while start.elapsed().as_secs_f64() < seconds as f64
        && io.stats.error_flags.load(Ordering::Relaxed) == 0
    {
        io.drain_timings(&mut timings);
        std::thread::sleep(Duration::from_millis(10));
    }
    io.fade_out();
    std::thread::sleep(Duration::from_millis(50));
    io.drain_timings(&mut timings);
    let stats = io.stats.clone();
    drop(io);
    let cpu = cpu_seconds() - cpu;
    let mut load = timings
        .iter()
        .map(|t| t.nanoseconds as f64 / (t.frames as f64 / sr as f64 * 1e9) * 100.0)
        .collect::<Vec<_>>();
    load.sort_by(f64::total_cmp);
    let load_p99 = load
        .get((load.len().saturating_sub(1) as f64 * 0.99).round() as usize)
        .copied()
        .unwrap_or(0.0);
    let deadline = frames as f64 / sr as f64 * 1e6;
    let processing = summarize(
        timings
            .iter()
            .map(|t| t.nanoseconds as f64 / 1000.0)
            .collect(),
        deadline,
    );
    let actual_frames_min = stats.output_frames_min.load(Ordering::Relaxed);
    let allocations = ALLOCS.load(Ordering::Relaxed) - a0;
    let deallocations = FREES.load(Ordering::Relaxed) - f0;
    let processed = stats.processed_frames.load(Ordering::Relaxed);
    let stream_checks_passed = processed > 0
        && allocations == 0
        && deallocations == 0
        && stats.error_flags.load(Ordering::Relaxed) == 0
        && stats.input_overflows.load(Ordering::Relaxed) == 0
        && stats.output_underruns.load(Ordering::Relaxed) == 0
        && stats.resynced_samples.load(Ordering::Relaxed) == 0
        && stats.invalid_samples.load(Ordering::Relaxed) == 0
        && stats.timing_drops.load(Ordering::Relaxed) == 0
        && load.last().is_some_and(|max| *max < 100.0);
    let report = json!({"processed_frames":processed,"stream_checks_passed":stream_checks_passed,"kind":"live_monitor","device_id":device,"sample_rate":sr,"requested_frames":frames,"actual_output_frames_min":if actual_frames_min==u32::MAX {0}else{actual_frames_min},"actual_output_frames_max":stats.output_frames_max.load(Ordering::Relaxed),"bypass":bypass,"seconds":start.elapsed().as_secs_f64(),"cpu_percent_one_core":cpu/start.elapsed().as_secs_f64()*100.0,"processing":processing,"deadline_load_percent":{"p99":load_p99,"max":load.last().copied().unwrap_or(0.0)},"input_overflow_samples":stats.input_overflows.load(Ordering::Relaxed),"output_underrun_callbacks":stats.output_underruns.load(Ordering::Relaxed),"queue_resynced_samples":stats.resynced_samples.load(Ordering::Relaxed),"invalid_samples":stats.invalid_samples.load(Ordering::Relaxed),"limited_samples":stats.limited_samples.load(Ordering::Relaxed),"input_clipped_samples":stats.input_clips.load(Ordering::Relaxed),"stream_error_flags":stats.error_flags.load(Ordering::Relaxed),"dropped_timing_records":stats.timing_drops.load(Ordering::Relaxed),"allocations_in_callbacks":ALLOCS.load(Ordering::Relaxed)-a0,"deallocations_in_callbacks":FREES.load(Ordering::Relaxed)-f0,"rtl_measured":false,"candidate_approved":false});
    Ok(report)
}
fn run(args: &[String]) -> Result<Value, String> {
    match args.first().map(String::as_str) {
        Some("list")=>Ok(json!(audio_engine::engine::list_devices())),
        Some("bench")=>bench(args), Some("compare")=>compare(args), Some("render")=>render(args),
        Some("monitor")=>{ let model=load(required(args,"--model")?,true)?; let sr=model.expected_sample_rate() as u32; monitor(args,NamProcessor(model),sr,false) },
        Some("bypass")=>monitor(args,Bypass,number(args,"--sample-rate",48000)?,true),
        Some("analyze-rtl")=>{
            let (sr,reference,returned)=wav::read_stereo(required(args,"--capture")?)?;
            let (lag,score)=correlation_delay(&reference,&returned,(sr/5) as usize).ok_or("Correlação inconclusiva. Confira a referência simultânea, nível e distorção; nenhum RTL foi aprovado.")?;
            Ok(json!({"kind":"simultaneous_reference_capture","sample_rate":sr,"lag_samples":lag,"delay_ms":lag as f64/sr as f64*1000.0,"correlation":score,"capture_topology_verified":false,"candidate_approved":false,"note":"Só representa RTL se o WAV segue a montagem de referência simultânea do README. Não usar gravações de relógios separados."}))
        },
        _=>Err("Uso: list | bench --model ARQUIVO --frames 64 --seconds 5 | monitor --device ID --model ARQUIVO --input-channel 1 --output-channel 1 --frames 64 --seconds 60 | bypass --device ID --sample-rate 48000 --frames 64 | render --model ARQUIVO --input SINAL.json --output SAIDA.json | compare --model ARQUIVO --input SINAL.json --expected ORACULO.json | analyze-rtl --capture REFERENCIA_E_RETORNO.wav".into())
    }
}
fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    match run(&args) {
        Ok(value) => {
            println!("{}", serde_json::to_string_pretty(&value).unwrap());
            if ["passed", "dsp_checks_passed", "stream_checks_passed"]
                .iter()
                .any(|key| value.get(key) == Some(&Value::Bool(false)))
            {
                std::process::exit(1)
            }
        }
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    static TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    fn synthetic() -> Model {
        let file = NamModel::from_json_str(r#"{"version":"0.5.4","architecture":"LSTM","sample_rate":48000,"config":{"input_size":1,"hidden_size":1,"num_layers":1},"weights":[0,0,0,0,0.5,0,0,0,0,0,0,0,0,0,0.8,0]}"#).unwrap();
        Model::from_nam(&file).unwrap()
    }
    #[test]
    fn lstm_confere_com_equacao_independente_e_blocos_diferentes() {
        let _lock = TEST_LOCK.lock().unwrap();
        let mut input = vec![0.0; 4096];
        probe_signal(&mut input, &mut 71);
        let mut expected = Vec::new();
        let mut cell = 0.0_f64;
        for &sample in &input {
            cell = 0.5 * cell + 0.5 * (0.5 * sample as f64).tanh();
            expected.push((0.4 * cell.tanh()) as f32);
        }
        for frames in [1, 64, 128, 511, 4096] {
            let mut model = synthetic();
            let mut actual = input.clone();
            for block in actual.chunks_mut(frames) {
                model.process_buffer(block);
            }
            let error = actual
                .iter()
                .zip(&expected)
                .map(|(&a, &b)| (a - b).abs())
                .fold(0.0, f32::max);
            assert!(error < 1e-6, "frames={frames}, erro={error}");
        }
    }
    #[test]
    fn lstm_processa_sem_alocar_ou_liberar_heap() {
        let _lock = TEST_LOCK.lock().unwrap();
        let mut model = synthetic();
        let mut block = [0.01; 128];
        model.process_buffer(&mut block);
        let (allocs, frees) = (
            ALLOCS.load(Ordering::Relaxed),
            FREES.load(Ordering::Relaxed),
        );
        {
            let _rt = RealtimeScope::enter();
            for _ in 0..1000 {
                model.process_buffer(&mut block);
            }
        }
        assert_eq!(ALLOCS.load(Ordering::Relaxed), allocs);
        assert_eq!(FREES.load(Ordering::Relaxed), frees);
    }
    #[test]
    fn relatorio_conta_picos_acima_do_prazo() {
        let stats = summarize(vec![10.0, 11.0, 100.0, 101.0], 100.0);
        assert_eq!(stats["deadline_misses"], 2);
        assert_eq!(stats["max_us"], 101.0);
        assert_eq!(stats["p50_us"], 100.0);
    }
    #[test]
    fn relogio_de_cpu_da_thread_e_monotonico() {
        let start = thread_cpu_seconds().unwrap();
        let mut state = 71_u32;
        let mut buffer = [0.0; 128];
        for _ in 0..1000 {
            probe_signal(std::hint::black_box(&mut buffer), &mut state);
        }
        let end = thread_cpu_seconds().unwrap();
        assert!(start.is_finite() && end > start);
    }
    #[test]
    fn contador_detecta_alocacao_e_liberacao_dentro_da_regiao() {
        let _lock = TEST_LOCK.lock().unwrap();
        let (allocs, frees) = (
            ALLOCS.load(Ordering::Relaxed),
            FREES.load(Ordering::Relaxed),
        );
        {
            let _rt = RealtimeScope::enter();
            let buffer = std::hint::black_box(vec![0_u8; 1024]);
            std::hint::black_box(&buffer);
            drop(buffer);
        }
        assert!(ALLOCS.load(Ordering::Relaxed) > allocs);
        assert!(FREES.load(Ordering::Relaxed) > frees);
    }
}
