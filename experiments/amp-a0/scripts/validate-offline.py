#!/usr/bin/env python3
"""Paridade C++ e benchmarks seriados. Não abre áudio nem aprova RTL."""
import argparse
import datetime
import hashlib
import json
import pathlib
import platform
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
SYNTHETIC = ["lstm", "a2", "wavenet", "lstm-h32-synthetic",
             "wavenet-c16-synthetic", "a2-gated-film", "a2-blended-film"]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def execute(command):
    result = subprocess.run([str(x) for x in command], cwd=ROOT,
                            capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError(f"Código {result.returncode}: {result.stderr[-2000:]}")
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle", type=pathlib.Path, required=True)
    parser.add_argument("--model", type=pathlib.Path)
    parser.add_argument("--input", type=pathlib.Path)
    parser.add_argument("--binary", type=pathlib.Path,
                        default=ROOT / "experiments/amp-a0/target/release/pratica-amp-a0")
    parser.add_argument("--repeats", type=int, choices=range(1, 6), default=3)
    parser.add_argument("--seconds", type=int, choices=range(1, 61), default=10)
    parser.add_argument("--output", type=pathlib.Path,
                        default=ROOT / "target/amp-a0/offline-report.json")
    args = parser.parse_args()
    oracle, binary = args.oracle.resolve(), args.binary.resolve()
    if not oracle.is_file() or not binary.is_file():
        parser.error("Compile o oráculo e a bancada antes de executar.")
    destination = args.output.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    execute([sys.executable, ROOT / "experiments/amp-a0/scripts/generate-fixtures.py"])
    synthetic = ROOT / "target/amp-a0/synthetic"
    input_path = args.input.resolve() if args.input else synthetic / "input.json"
    if not input_path.is_file() or (args.model and not args.model.is_file()):
        parser.error("Modelo ou sinal de entrada não encontrado.")
    models = [args.model.resolve()] if args.model else [synthetic / f"{x}.nam" for x in SYNTHETIC]
    report = {"started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "host": platform.platform(), "architecture": platform.machine(),
              "oracle_sha256": sha256(oracle), "binary_sha256": sha256(binary),
              "input_sha256": sha256(input_path),
              "synthetic_only": args.model is None, "rtl_measured": False,
              "candidate_approved": False, "parity": [], "benchmarks": [], "errors": []}
    for index, model in enumerate(models):
        for frames in (64, 128):
            print(f"Paridade: {model.name}, {frames} frames", flush=True)
            try:
                expected = destination.parent / f"oracle-output-{index}-{frames}.json"
                execute([oracle, model, input_path, expected, frames])
                comparison = json.loads(execute([binary, "compare", "--model", model,
                    "--input", input_path, "--expected", expected,
                    "--frames", frames, "--reference-kind", "NAMCore-0.6.0"]))
                if comparison.get("passed") is not True:
                    raise RuntimeError("Comparação não confirmou paridade.")
                report["parity"].append({"model": model.name, "model_sha256": sha256(model),
                                         **comparison})
            except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as error:
                report["errors"].append({"model": model.name, "frames": frames, "error": str(error)})
    # Não concorre com compilação nem paraleliza os benchmarks entre si.
    for model in models:
        for frames in (64, 128):
            for repetition in range(args.repeats):
                print(f"Benchmark: {model.name}, {frames} frames, rodada {repetition + 1}", flush=True)
                try:
                    result = json.loads(execute([binary, "bench", "--model", model,
                        "--frames", frames, "--seconds", args.seconds]))
                    report["benchmarks"].append({"model": model.name,
                        "model_sha256": sha256(model), "repetition": repetition + 1, **result})
                except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as error:
                    report["errors"].append({"model": model.name, "frames": frames, "error": str(error)})
    report["execution_checks_passed"] = not report["errors"]
    report["wall_deadline_checks_passed"] = bool(report["benchmarks"]) and all(
        x["processing"]["deadline_misses"] == 0 for x in report["benchmarks"])
    report["thread_cpu_deadline_checks_passed"] = bool(report["benchmarks"]) and all(
        x["thread_cpu_processing"]["deadline_misses"] == 0 for x in report["benchmarks"])
    destination.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Relatório: {destination}. RTL e candidato continuam sem aprovação.")
    if report["errors"]:
        return 1
    return 0 if report["wall_deadline_checks_passed"] and report["thread_cpu_deadline_checks_passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
