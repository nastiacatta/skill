#!/usr/bin/env python3
"""Patch `sensitivity` block in existing comparison.json files with the
values from `onlinev2/outputs/sensitivity_sweep.json`.

This avoids re-running the full forecaster sweep (~30 min each) just
to pick up the new `optimal_params` artefact — the CRPS numbers in the
rows / per_round blocks don't change, only the meta-data in
`sensitivity` does.

Usage:
    onlinev2/.venv/bin/python scripts/patch_comparison_sensitivity.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SWEEP_PATH = REPO_ROOT / "onlinev2" / "outputs" / "sensitivity_sweep.json"
COMPARISON_PATHS = [
    REPO_ROOT / "dashboard" / "public" / "data" / "real_data" / "elia_wind" / "data" / "comparison.json",
    REPO_ROOT / "dashboard" / "public" / "data" / "real_data" / "elia_electricity" / "data" / "comparison.json",
]


def main() -> int:
    if not SWEEP_PATH.exists():
        print(f"ERROR: sweep artefact missing at {SWEEP_PATH}")
        return 1
    with open(SWEEP_PATH) as f:
        sweep = json.load(f)

    for comparison_path in COMPARISON_PATHS:
        if not comparison_path.exists():
            print(f"SKIP: {comparison_path} (not found)")
            continue
        with open(comparison_path) as f:
            d = json.load(f)
        series_name = d.get("config", {}).get("series_name")
        block = sweep.get(series_name)
        if not isinstance(block, dict) or "optimal_params" not in block:
            print(f"SKIP: no sweep block for series_name={series_name!r}")
            continue
        # Preserve default_params / default_improvement_pct if present.
        existing = d.get("sensitivity", {}) or {}
        new_sensitivity = {
            "default_params": existing.get(
                "default_params",
                {"gamma": 4, "rho": 0.1, "lam": 0.05, "eta": 2.0},
            ),
            "default_improvement_pct": existing.get("default_improvement_pct"),
            "source": str(SWEEP_PATH.relative_to(REPO_ROOT)),
            "optimal_params": block["optimal_params"],
            "optimal_improvement_pct": block["optimal_improvement_pct"],
            "note": (
                "Recomputed on a held-out split; see "
                "scripts/run_sensitivity_sweep.py."
            ),
        }
        d["sensitivity"] = new_sensitivity
        with open(comparison_path, "w") as f:
            json.dump(d, f, indent=2)
        print(
            f"OK:  {comparison_path.name} — "
            f"optimal_params={block['optimal_params']}, "
            f"optimal_improvement_pct={block['optimal_improvement_pct']}%"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
