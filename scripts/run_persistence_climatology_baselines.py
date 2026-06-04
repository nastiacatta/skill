#!/usr/bin/env python3
"""Compute persistence and climatology CRPS baselines for tab:weight-rule-fixed.

Runs the same latent-fixed DGP at T=20000, six forecasters, 20 seeds,
fixed deposits — matching the weight-rule comparison configuration.

Persistence forecast: y_{t-1} (a point mass at the previous outcome,
represented as a degenerate quantile forecast with all quantiles = y_{t-1}).

Climatology forecast: running mean of y_{1:t-1} (a degenerate quantile
forecast with all quantiles = cumulative mean up to t-1).

Both are evaluated with the same finite-grid CRPS approximation used by
the weight-rule comparison (five quantile levels: 0.1, 0.25, 0.5, 0.75, 0.9).

Output: onlinev2/outputs/core/experiments/weight_rules/persistence_climatology.json
"""
from __future__ import annotations

import json
import pathlib
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "onlinev2" / "src"))
from onlinev2.legacy_dgps.latent_fixed import generate_truth_and_quantile_reports_latent
from onlinev2.mechanism.scoring import crps_hat_from_quantiles

T = 20000
N_FORECASTERS = 6
N_SEEDS = 20
SEED_BASE = 42
TAU_I = np.array([0.15, 0.22, 0.32, 0.46, 0.68, 1.00])
TAUS = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
SIGMA_Z = 1.0
T0 = 300  # warmup cutoff matching weight_rule_comparison


def crps_degenerate(y_t: float, point_forecast: float, taus: np.ndarray) -> float:
    """CRPS of a degenerate (point-mass) forecast represented on a quantile grid.

    A point mass at x has CDF F(z) = 1{z >= x}, so the finite-grid CRPS
    is the mean pinball loss of a constant quantile vector q_k = x for all k.
    """
    q = np.full((1, len(taus)), point_forecast, dtype=np.float64)
    return float(crps_hat_from_quantiles(y_t, q, taus)[0])


def run_seed(seed: int) -> dict:
    y, _, _ = generate_truth_and_quantile_reports_latent(
        T=T, n=N_FORECASTERS, tau_i=TAU_I, taus=TAUS,
        seed=seed, sigma_z=SIGMA_Z,
    )

    persistence_crps = np.full(T, np.nan)
    climatology_crps = np.full(T, np.nan)

    for t in range(1, T):
        y_t = float(y[t])
        # persistence: y_{t-1}
        persistence_crps[t] = crps_degenerate(y_t, float(y[t - 1]), TAUS)
        # climatology: running mean of y_0 ... y_{t-1}
        clim = float(np.mean(y[:t]))
        climatology_crps[t] = crps_degenerate(y_t, clim, TAUS)

    # full-run mean (t=1 onwards, skipping NaN at t=0)
    mean_persistence_all = float(np.nanmean(persistence_crps))
    mean_climatology_all = float(np.nanmean(climatology_crps))
    # warm-start mean (t > T0)
    mean_persistence_ws = float(np.nanmean(persistence_crps[T0 + 1:]))
    mean_climatology_ws = float(np.nanmean(climatology_crps[T0 + 1:]))

    return {
        "persistence_all": mean_persistence_all,
        "climatology_all": mean_climatology_all,
        "persistence_ws": mean_persistence_ws,
        "climatology_ws": mean_climatology_ws,
    }


def main() -> None:
    seeds = [SEED_BASE + s for s in range(N_SEEDS)]

    per_seed = [run_seed(s) for s in seeds]

    def _agg(key: str) -> dict:
        vals = np.array([d[key] for d in per_seed])
        mean = float(np.mean(vals))
        se = float(np.std(vals, ddof=1) / np.sqrt(len(vals)))
        return {"mean": round(mean, 6), "se": round(se, 6), "n": len(vals)}

    result = {
        "experiment": "persistence_climatology_baselines",
        "config": {
            "T": T,
            "n_forecasters": N_FORECASTERS,
            "n_seeds": N_SEEDS,
            "seed_base": SEED_BASE,
            "deposit_policy": "fixed_unit",
            "scoring": "quantiles_crps",
            "taus": TAUS.tolist(),
            "T0_warmup": T0,
        },
        "rows": {
            "persistence": {
                "description": "Degenerate forecast at y_{t-1} (persistence baseline)",
                "mean_crps_all": _agg("persistence_all"),
                "mean_crps_warmstart": _agg("persistence_ws"),
            },
            "climatology": {
                "description": "Degenerate forecast at running mean of y_{1:t-1} (climatology baseline)",
                "mean_crps_all": _agg("climatology_all"),
                "mean_crps_warmstart": _agg("climatology_ws"),
            },
        },
    }

    out_dir = pathlib.Path(__file__).resolve().parents[1] / "onlinev2" / "outputs" / "core" / "experiments" / "weight_rules"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "persistence_climatology.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"Saved to {out_path}")

    print("\nResults:")
    for rule in ("persistence", "climatology"):
        row = result["rows"][rule]
        print(f"  {rule:15s}  CRPS(all)={row['mean_crps_all']['mean']:.5f} +/- {row['mean_crps_all']['se']:.5f}"
              f"  CRPS(ws)={row['mean_crps_warmstart']['mean']:.5f} +/- {row['mean_crps_warmstart']['se']:.5f}")


if __name__ == "__main__":
    main()
