#!/usr/bin/env python3
"""
FaceGuard Offline – Device Benchmark
=====================================

Connects to a running Metro/Hermes debugger via WebSocket, triggers 50
face-recognition attempts with test images, and records per-stage timing.

Outputs
-------
  benchmark_results.json   – { stage: { mean, min, max, p50, p95, p99 } }

Usage
-----
  # Android (via adb)
  python device_benchmark.py --platform android --host localhost --port 8081

  # iOS (via xcrun)
  python device_benchmark.py --platform ios --host localhost --port 8081
"""

from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import websocket  # websocket-client
except ImportError:
    sys.exit("Install websocket-client:  pip install websocket-client")


# ── Configuration ─────────────────────────────────────────────────────

NUM_ITERATIONS = 50

STAGES = [
    "blazeface_ms",
    "clahe_ms",
    "mobilefacenet_ms",
    "minifasnet_ms",
    "total_ms",
]

PERFORMANCE_TARGETS = {
    "blazeface_ms":    {"mean": 50},
    "clahe_ms":        {"mean": 30},
    "mobilefacenet_ms": {"mean": 200},
    "minifasnet_ms":   {"mean": 150},
    "total_ms":        {"p95": 900},
}

OUTPUT_FILE = "benchmark_results.json"


# ── Data model ────────────────────────────────────────────────────────

@dataclass
class StageStats:
    mean: float = 0.0
    min: float = 0.0
    max: float = 0.0
    p50: float = 0.0
    p95: float = 0.0
    p99: float = 0.0

    def to_dict(self) -> dict[str, float]:
        return {
            "mean": round(self.mean, 2),
            "min":  round(self.min, 2),
            "max":  round(self.max, 2),
            "p50":  round(self.p50, 2),
            "p95":  round(self.p95, 2),
            "p99":  round(self.p99, 2),
        }


@dataclass
class BenchmarkRun:
    """Accumulates raw timings per stage."""
    samples: dict[str, list[float]] = field(default_factory=lambda: {s: [] for s in STAGES})

    def add(self, stage: str, ms: float) -> None:
        if stage in self.samples:
            self.samples[stage].append(ms)

    def compute_stats(self) -> dict[str, StageStats]:
        out: dict[str, StageStats] = {}
        for stage, vals in self.samples.items():
            if not vals:
                continue
            s = sorted(vals)
            out[stage] = StageStats(
                mean=statistics.mean(s),
                min=s[0],
                max=s[-1],
                p50=_percentile(s, 50),
                p95=_percentile(s, 95),
                p99=_percentile(s, 99),
            )
        return out


# ── Helpers ───────────────────────────────────────────────────────────

def _percentile(sorted_data: list[float], pct: int) -> float:
    """Compute the pct-th percentile from a pre-sorted list."""
    if not sorted_data:
        return 0.0
    k = (len(sorted_data) - 1) * pct / 100.0
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    return sorted_data[f] * (c - k) + sorted_data[c] * (k - f)


def _ws_url(host: str, port: int) -> str:
    """Construct the Metro debugger WebSocket URL."""
    return f"ws://{host}:{port}/debugger-proxy?role=external&name=benchmark"


def _send_rpc(ws: websocket.WebSocket, method: str, params: dict[str, Any]) -> dict:
    """Send a JSON-RPC message and wait for the response."""
    msg_id = str(uuid.uuid4())
    payload = {
        "id": msg_id,
        "method": method,
        "params": params,
    }
    ws.send(json.dumps(payload))

    while True:
        raw = ws.recv()
        resp = json.loads(raw)
        if resp.get("id") == msg_id:
            return resp
        # Discard broadcast / other messages


def _forward_port_android(port: int) -> None:
    """Forward device port via adb for Android."""
    os.system(f"adb forward tcp:{port} tcp:{port}")
    print(f"[adb] Forwarded tcp:{port}")


# ── Main benchmark logic ─────────────────────────────────────────────

def run_benchmark(host: str, port: int, platform: str) -> dict:
    """Connect to the app, trigger recognition cycles, collect timings."""

    if platform == "android":
        _forward_port_android(port)

    url = _ws_url(host, port)
    print(f"Connecting to {url} ...")

    ws = websocket.create_connection(url, timeout=30)
    print("Connected to Metro debugger WebSocket.\n")

    bench = BenchmarkRun()

    for i in range(1, NUM_ITERATIONS + 1):
        print(f"  [{i:>2}/{NUM_ITERATIONS}] Running recognition cycle ...", end=" ")

        # Inject JS to trigger one full pipeline run and return timings
        resp = _send_rpc(ws, "executeJSCall", {
            "method": "__benchmarkRecognitionCycle",
            "arguments": [],
        })

        if "result" not in resp:
            print("SKIP (no result)")
            continue

        timings = resp["result"]
        for stage in STAGES:
            if stage in timings:
                bench.add(stage, float(timings[stage]))

        total = timings.get("total_ms", "?")
        print(f"total={total}ms")

        # Brief pause to avoid thermal throttling bias
        time.sleep(0.2)

    ws.close()

    stats = bench.compute_stats()
    return {stage: s.to_dict() for stage, s in stats.items()}


def validate_targets(results: dict) -> list[str]:
    """Check results against performance targets. Returns list of violations."""
    violations = []
    for stage, targets in PERFORMANCE_TARGETS.items():
        if stage not in results:
            violations.append(f"MISSING: {stage} – no data collected")
            continue
        for metric, limit in targets.items():
            actual = results[stage].get(metric, None)
            if actual is None:
                violations.append(f"MISSING: {stage}.{metric}")
            elif actual > limit:
                violations.append(
                    f"FAIL: {stage}.{metric} = {actual:.1f}ms (target ≤ {limit}ms)"
                )
    return violations


# ── CLI entry point ───────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="FaceGuard Offline – Device Benchmark",
    )
    parser.add_argument(
        "--platform",
        choices=["android", "ios"],
        default="android",
        help="Target platform (default: android)",
    )
    parser.add_argument("--host", default="localhost", help="Metro host")
    parser.add_argument("--port", type=int, default=8081, help="Metro port")
    parser.add_argument(
        "--output",
        default=OUTPUT_FILE,
        help=f"Output JSON path (default: {OUTPUT_FILE})",
    )
    args = parser.parse_args()

    results = run_benchmark(args.host, args.port, args.platform)

    # ── Write JSON ────────────────────────────────────────────────
    out_path = Path(args.output)
    report = {
        "meta": {
            "platform": args.platform,
            "iterations": NUM_ITERATIONS,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "stages": results,
        "targets": {s: t for s, t in PERFORMANCE_TARGETS.items()},
    }
    out_path.write_text(json.dumps(report, indent=2))
    print(f"\n✅ Results written to {out_path}")

    # ── Validate ──────────────────────────────────────────────────
    violations = validate_targets(results)
    if violations:
        print("\n⚠️  Performance target violations:")
        for v in violations:
            print(f"   • {v}")
        sys.exit(1)
    else:
        print("\n✅ All performance targets met!")


if __name__ == "__main__":
    main()
