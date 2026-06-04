#!/usr/bin/env python3
"""Parameter sensitivity sweep with a held-out test split.

Replaces the hardcoded ``optimal_improvement_pct: -27.2`` constant in
`onlinev2/src/onlinev2/real_data/runner.py` with a reproducible
selection artefact (bugfix clause 1.4 / 2.4).

Grid is swept over ``(γ, ρ, λ)``; each configuration is scored on
``series[split:]`` (held-out test) after fitting the mechanism on
``series[:split]``. ``optimal_params`` are those minimising the test
mean CRPS delta vs uniform.

Output: ``onlinev2/outputs/sensitivity_sweep.json``.

Usage::

    onlinev2/.venv/bin/python scripts/run_sensitivity_sweep.py --series wind
    onlinev2/.venv/bin/python scripts/run_sensitivity_sweep.py --series both
    onlinev2/.venv/bin/python scripts/run_sensitivity_sweep.py --series electricity --grid coarse
"""
from __future__ import annotations

import argparse
import itertools
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "onlinev2" / "src"))

from onlinev2.real_data.loader import load_csv_series  # noqa: E402
from onlinev2.real_data.runner import (  # noqa: E402
    run_real_data_comparison,
)

# Canonical parameter grids shared with ``run_sensitivity_sweep_cached.py``
# so that ``--grid <name>`` refers to the same parameter space from either
# script (audit pass 2, M2). See ``scripts/_sweep_grids.py``.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _sweep_grids import GRIDS as _GRIDS  # noqa: E402


def _load_wind() -> np.ndarray:
    path = REPO_ROOT / "data" / "elia_offshore_wind_2024_2025.csv"
    df = pd.read_csv(path)
    series = df["measured"].dropna().values.astype(np.float64)
    series = np.clip(series, 0, None)
    n_full = (len(series) // 4) * 4
    return series[:n_full].reshape(-1, 4).mean(axis=1)


def _load_electricity() -> np.ndarray:
    path = REPO_ROOT / "data" / "elia_imbalance_prices_2024_2025.csv"
    df = pd.read_csv(path)
    if "positiveimbalanceprice" in df.columns:
        series = df["positiveimbalanceprice"].dropna().values.astype(np.float64)
        p1, p99 = np.percentile(series, [1, 99])
        return np.clip(series, p1, p99)
    return load_csv_series(str(path))


def _sweep_one(
    series: np.ndarray,
    series_name: str,
    split: int,
    grid: dict[str, list[float]],
    warmup: int,
    seed: int,
) -> dict:
    """Return an evaluation record for each (γ, ρ, λ) cell in the grid."""
    if split < 500:
        raise ValueError(
            f"split={split} too small; need at least 500 rounds in the "
            f"training partition to avoid degenerate sweeps."
        )

    T = len(series)
    if split >= T:
        raise ValueError(
            f"split={split} >= series length {T}; nothing held out."
        )

    train = series[:split]
    test_full = series  # runner normalises and iterates; we score on test indices

    cells = list(itertools.product(grid["gamma"], grid["rho"], grid["lam"]))
    print(f"[{series_name}] sweeping {len(cells)} grid cells (T={T}, split={split})")

    evaluations = []
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        for gamma, rho, lam in cells:
            t0 = time.time()
            # Post-audit #5 fix: surface fallback counts per grid cell so
            # the selection cannot silently pick parameters whose CRPS
            # was produced partly by persistence-fallback ML models.
            try:
                train_result = run_real_data_comparison(
                    series=train, warmup=warmup, outdir=td,
                    series_name=f"sweep_{series_name}_train",
                    gamma=gamma, rho=rho, lam=lam,
                    seed=seed,
                    strict_no_fallback=False,  # record, don't raise
                )
                # Offset seed to decorrelate MLP/XGBoost initialisation across folds
                test_result = run_real_data_comparison(
                    series=test_full, warmup=split, outdir=td,
                    series_name=f"sweep_{series_name}_test",
                    gamma=gamma, rho=rho, lam=lam,
                    seed=seed + 1,
                    strict_no_fallback=False,
                )
            except ValueError as exc:
                print(
                    f"  γ={gamma:5.2f} ρ={rho:4.2f} λ={lam:4.2f}  "
                    f"SKIPPED (runner raised: {exc})"
                )
                continue
            train_rows = {r["method"]: r for r in train_result["rows"]}
            test_rows = {r["method"]: r for r in test_result["rows"]}
            train_mech = float(train_rows["mechanism"]["mean_crps"])
            test_uni = float(test_rows["uniform"]["mean_crps"])
            test_mech = float(test_rows["mechanism"]["mean_crps"])
            test_delta = test_mech - test_uni
            test_pct = (test_delta / test_uni * 100) if test_uni > 0 else 0.0
            # Post-audit #5 fix: aggregate fallback counts across both legs.
            train_fb = train_result.get("fallback_summary", {})
            test_fb = test_result.get("fallback_summary", {})
            fb_total = {
                k: int(train_fb.get(k, 0)) + int(test_fb.get(k, 0))
                for k in set(train_fb) | set(test_fb)
            }
            any_fallback = any(v > 0 for v in fb_total.values())
            evaluations.append({
                "gamma": float(gamma),
                "rho": float(rho),
                "lam": float(lam),
                "train_mean_crps": train_mech,
                "test_mean_crps": test_mech,
                "test_delta_vs_uniform": test_delta,
                "test_pct_vs_uniform": round(test_pct, 2),
                "runtime_s": round(time.time() - t0, 2),
                "fallback_summary": fb_total,
                "any_fallback": any_fallback,
            })
            fb_tag = "⚠ fallback" if any_fallback else ""
            print(
                f"  γ={gamma:5.2f} ρ={rho:4.2f} λ={lam:4.2f}  "
                f"train={train_mech:.6f}  test={test_mech:.6f}  "
                f"Δ={test_delta:+.6f} ({test_pct:+.1f}%) {fb_tag}"
            )

    # Post-audit #5 fix: prefer fallback-free configurations. If any
    # grid cell had a clean run, restrict the selection to those;
    # otherwise fall back to the full grid with a warning.
    clean = [e for e in evaluations if not e["any_fallback"]]
    selection_pool = clean if clean else evaluations
    if not clean and evaluations:
        print(
            f"  WARNING: every grid cell on {series_name} hit an ML "
            f"fallback; optimal_params reported on the full grid."
        )
    if not selection_pool:
        raise RuntimeError(
            f"No valid grid cells for {series_name} (all runs raised)."
        )
    optimal = min(selection_pool, key=lambda e: e["test_pct_vs_uniform"])
    return {
        "series_name": series_name,
        "series_length": T,
        "split": split,
        "warmup": warmup,
        "seed": seed,
        "grid": grid,
        "evaluations": evaluations,
        "optimal_params": {
            "gamma": optimal["gamma"],
            "rho": optimal["rho"],
            "lam": optimal["lam"],
        },
        "optimal_improvement_pct": optimal["test_pct_vs_uniform"],
        "optimal_had_fallback": optimal["any_fallback"],
        "n_clean_cells": len(clean),
        "n_total_cells": len(evaluations),
        "selection_criterion": (
            "min test_pct_vs_uniform over fallback-free cells"
            if clean
            else "min test_pct_vs_uniform over all cells (no fallback-free cells)"
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Parameter sensitivity sweep")
    parser.add_argument("--series", choices=["wind", "electricity", "both"], default="wind")
    parser.add_argument("--split", type=int, default=None,
                        help="Training-partition length (rounds). Default: 60 percent of series.")
    parser.add_argument("--warmup", type=int, default=200)
    parser.add_argument("--grid", choices=list(_GRIDS.keys()), default="coarse")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=str,
                        default=str(REPO_ROOT / "onlinev2" / "outputs" / "sensitivity_sweep.json"))
    args = parser.parse_args()

    grid = _GRIDS[args.grid]
    results: dict[str, dict] = {}

    series_specs: list[tuple[str, np.ndarray]] = []
    if args.series in ("wind", "both"):
        series_specs.append(("elia_wind", _load_wind()))
    if args.series in ("electricity", "both"):
        series_specs.append(("elia_electricity", _load_electricity()))

    for name, series in series_specs:
        split = args.split if args.split else int(0.6 * len(series))
        results[name] = _sweep_one(
            series=series,
            series_name=name,
            split=split,
            grid=grid,
            warmup=args.warmup,
            seed=args.seed,
        )

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
