#!/usr/bin/env python3
"""Cache-reusing parameter sensitivity sweep.

Reuses forecasts cached by ``scripts/run_baseline_comparison.py`` in
``onlinev2/outputs_cache/<series>_forecasts.npz``. For each (γ, ρ, λ)
cell, only the mechanism simulation and CRPS computation are re-run —
the expensive seven-forecaster loop is skipped. This drops wall-clock
per cell from ~25 min (full forecasting pass) to a few seconds.

The sweep protocol is still a held-out split: the mechanism is
initialised fresh on the ``[warmup, split)`` train window (its loss
state burns in there) and the test metric is the mean CRPS over
``[split, T)``. This matches the protocol of ``run_sensitivity_sweep.py``
but at a fraction of the runtime because forecasts do not depend on
(γ, ρ, λ) and can therefore be held constant across cells.

Output: ``onlinev2/outputs/sensitivity_sweep.json`` (same schema as
``run_sensitivity_sweep.py``; the ``evaluations`` per cell add a
``cache_reused: True`` flag and a ``train_mean_crps_holdout`` /
``test_mean_crps`` pair computed from the held-out test segment).

Usage::

    onlinev2/.venv/bin/python scripts/run_sensitivity_sweep_cached.py --series both
    onlinev2/.venv/bin/python scripts/run_sensitivity_sweep_cached.py --series wind --grid wide
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

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "onlinev2" / "src"))

from onlinev2.core.scoring import crps_hat_from_quantiles  # noqa: E402
from onlinev2.simulation import run_simulation  # noqa: E402

# Canonical parameter grids shared with ``run_sensitivity_sweep.py`` so that
# ``--grid <name>`` refers to the same parameter space from either script
# (audit pass 2, M2). See ``scripts/_sweep_grids.py``.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _sweep_grids import GRIDS as _GRIDS  # noqa: E402


def _load_cache(series_name: str) -> dict:
    cache_path = REPO_ROOT / "onlinev2" / "outputs_cache" / f"{series_name}_forecasts.npz"
    if not cache_path.is_file():
        raise FileNotFoundError(
            f"Cache missing: {cache_path}. Run "
            f"scripts/run_baseline_comparison.py --dataset both --force-cache "
            f"first to populate it."
        )
    data = np.load(cache_path, allow_pickle=True)
    return {
        "y_norm": np.asarray(data["y_norm"], dtype=np.float64),
        "q_reports": np.asarray(data["q_reports"], dtype=np.float64),
        "names": list(data["names"]),
        "taus": np.asarray(data["taus"], dtype=np.float64),
        "series_min": float(data["series_min"]),
        "series_max": float(data["series_max"]),
        "pipeline_version": str(data["pipeline_version"].item())
            if "pipeline_version" in data.files else "legacy",
        "normalize_mode": str(data["normalize_mode"].item())
            if "normalize_mode" in data.files else "legacy",
        "fallback_counts": (
            json.loads(str(data["fallback_counts"].item()))
            if "fallback_counts" in data.files
            else {}
        ),
    }


def _evaluate_cell(
    y_all: np.ndarray,
    q_reports: np.ndarray,
    taus: np.ndarray,
    *,
    warmup: int,
    split: int,
    gamma: float,
    rho: float,
    lam: float,
    seed: int,
) -> dict:
    """Run mechanism simulation on the full series, score train vs test.

    The simulation itself is strictly causal (it walks t = 0 .. T-1 and
    never sees y_{t+1} at round t), so we can score a held-out window
    after the simulation has finished without re-running it. The
    ``train`` window is ``[warmup, split)`` (the segment the skill state
    burns in on), ``test`` is ``[split, T)`` (held out from the
    selection metric).
    """
    n_forecasters, T, _K = q_reports.shape
    t0 = time.time()
    res = run_simulation(
        T=T,
        n_forecasters=n_forecasters,
        missing_prob=0.0,
        seed=seed,
        scoring_mode="quantiles_crps",
        taus=taus,
        y_pre=y_all,
        q_reports_pre=q_reports,
        forecaster_noise_pre=np.ones(n_forecasters),
        store_history=True,
        deposit_mode="fixed",
        fixed_deposit=1.0,
        eta=2.0,
        lam=lam,
        gamma=gamma,
        rho=rho,
        omega_max=0.0,
    )

    # Compute per-round uniform and mechanism CRPS, then split into
    # train and test windows for the held-out selection metric.
    crps_uniform = np.empty(T, dtype=np.float64)
    crps_mech = np.empty(T, dtype=np.float64)
    for t in range(warmup, T):
        y_t = float(y_all[t])
        q_t = q_reports[:, t, :]
        agg_u = np.mean(q_t, axis=0)
        crps_uniform[t] = float(
            crps_hat_from_quantiles(y_t, agg_u.reshape(1, -1), taus)[0]
        )
        r_mech = np.asarray(res["r_hat_hist"][t], dtype=np.float64)
        if r_mech.size == len(taus):
            crps_mech[t] = float(
                crps_hat_from_quantiles(y_t, r_mech.reshape(1, -1), taus)[0]
            )
        else:
            crps_mech[t] = crps_uniform[t]

    # Train window: [warmup, split). Test window: [split, T).
    train_mech = float(np.mean(crps_mech[warmup:split]))
    train_uni = float(np.mean(crps_uniform[warmup:split]))
    test_mech = float(np.mean(crps_mech[split:]))
    test_uni = float(np.mean(crps_uniform[split:]))
    train_delta = train_mech - train_uni
    test_delta = test_mech - test_uni
    train_pct = (train_delta / train_uni * 100) if train_uni > 0 else 0.0
    test_pct = (test_delta / test_uni * 100) if test_uni > 0 else 0.0
    return {
        "gamma": float(gamma),
        "rho": float(rho),
        "lam": float(lam),
        "train_mean_crps": train_mech,
        "train_mean_crps_uniform": train_uni,
        "train_pct_vs_uniform": round(train_pct, 3),
        "test_mean_crps": test_mech,
        "test_mean_crps_uniform": test_uni,
        "test_delta_vs_uniform": test_delta,
        "test_pct_vs_uniform": round(test_pct, 3),
        "runtime_s": round(time.time() - t0, 2),
        "cache_reused": True,
    }


def _sweep_one(
    series_name: str,
    *,
    warmup: int,
    split_frac: float,
    grid: dict[str, list[float]],
    seed: int,
) -> dict:
    cache = _load_cache(series_name)
    y_all = cache["y_norm"]
    q_reports = cache["q_reports"]
    taus = cache["taus"]
    T = int(y_all.shape[0])
    split = int(T * split_frac)
    if split <= warmup + 100:
        raise ValueError(
            f"split={split} too close to warmup={warmup}; need at least "
            f"100 train rounds in [warmup, split)."
        )
    if T - split < 500:
        raise ValueError(
            f"test window [{split}, {T}) smaller than 500; increase series "
            f"length or lower split_frac."
        )

    cells = list(itertools.product(grid["gamma"], grid["rho"], grid["lam"]))
    print(
        f"[{series_name}] T={T}, warmup={warmup}, split={split} "
        f"(train [warmup, split) = {split - warmup} rounds, "
        f"test [split, T) = {T - split} rounds)"
    )
    print(
        f"[{series_name}] sweeping {len(cells)} cells "
        f"(pipeline_version={cache['pipeline_version']}, "
        f"normalize_mode={cache['normalize_mode']})"
    )

    evaluations = []
    for gamma, rho, lam in cells:
        e = _evaluate_cell(
            y_all, q_reports, taus,
            warmup=warmup, split=split,
            gamma=gamma, rho=rho, lam=lam,
            seed=seed,
        )
        evaluations.append(e)
        print(
            f"  γ={gamma:5.2f} ρ={rho:4.2f} λ={lam:4.2f}  "
            f"train={e['train_mean_crps']:.6f} ({e['train_pct_vs_uniform']:+.2f}%)  "
            f"test={e['test_mean_crps']:.6f} ({e['test_pct_vs_uniform']:+.2f}%)  "
            f"{e['runtime_s']:.1f}s",
            flush=True,
        )

    # Forecast-cache fallback counts are a property of the cache itself
    # (warmup-only; see model-training-testing-audit follow-up). They are
    # identical across cells.
    fb = cache["fallback_counts"]
    # Pre-warmup fallbacks only affect rounds < warmup; they do not
    # touch [warmup, T) and so do not contaminate the selection metric.
    optimal = min(evaluations, key=lambda e: e["test_pct_vs_uniform"])
    return {
        "series_name": series_name,
        "series_length": T,
        "warmup": warmup,
        "split": split,
        "split_frac": split_frac,
        "seed": seed,
        "grid": grid,
        "pipeline_version": cache["pipeline_version"],
        "normalize_mode": cache["normalize_mode"],
        "forecast_cache_fallback_counts": fb,
        "forecast_cache_fallback_note": (
            "Counts come from the shared forecast cache and represent "
            "warmup-only short-history short-circuits (rounds < warmup); "
            "they do not enter the selection metric."
        ),
        "evaluations": evaluations,
        "optimal_params": {
            "gamma": optimal["gamma"],
            "rho": optimal["rho"],
            "lam": optimal["lam"],
        },
        "optimal_improvement_pct": optimal["test_pct_vs_uniform"],
        "optimal_train_improvement_pct": optimal["train_pct_vs_uniform"],
        "n_cells": len(evaluations),
        "selection_criterion": "min test_pct_vs_uniform (cache-reused)",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Cache-reusing sensitivity sweep")
    parser.add_argument(
        "--series", choices=["wind", "electricity", "both"], default="both"
    )
    parser.add_argument("--warmup", type=int, default=200)
    parser.add_argument("--split-frac", type=float, default=0.6,
                        help="Fraction of total series used for train window.")
    parser.add_argument("--grid", choices=list(_GRIDS.keys()), default="wide")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--out", type=str,
        default=str(
            REPO_ROOT / "onlinev2" / "outputs" / "sensitivity_sweep.json"
        ),
    )
    args = parser.parse_args()

    grid = _GRIDS[args.grid]
    results: dict[str, dict] = {}
    names: list[str] = []
    if args.series in ("wind", "both"):
        names.append("elia_wind")
    if args.series in ("electricity", "both"):
        names.append("elia_electricity")

    for name in names:
        results[name] = _sweep_one(
            series_name=name,
            warmup=args.warmup,
            split_frac=args.split_frac,
            grid=grid,
            seed=args.seed,
        )

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
