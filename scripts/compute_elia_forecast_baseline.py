#!/usr/bin/env python3
"""Benchmark our trained forecasters against Elia's own published
operational forecasts.

Elia publishes three forecasts in the wind CSV (`mostrecentforecast`,
`dayaheadforecast`, `weekaheadforecast`) with 10/90 confidence bounds.
Our mechanism currently discards all of them and trains seven fresh
forecasters on the observed `measured` column alone. This script
quantifies how much of Elia's operational forecast our simple
forecasters recover, which is a much more honest benchmark than
comparing CRPS numbers in normalized units.

Metrics:
  - MAE / RMSE of Elia's three forecasts vs measured
  - Empirical quantile coverage at τ=0.1 / 0.9 (Elia's confidence bounds)
  - Approximate CRPS of Elia's mostrecentforecast as a degenerate 3-quantile
    fan {c10, fc, c90} at τ=0.1, 0.5, 0.9
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "onlinev2" / "src"))

from onlinev2.core.scoring import crps_hat_from_quantiles  # noqa: E402


def _load_wind_df() -> pd.DataFrame:
    path = REPO_ROOT / "data" / "elia_offshore_wind_2024_2025.csv"
    df = pd.read_csv(path)
    df["datetime"] = pd.to_datetime(df["datetime"], utc=True)
    return df


def _report_forecast(
    df: pd.DataFrame,
    point_col: str,
    lo_col: str,
    hi_col: str,
) -> dict:
    """Compute point-forecast error metrics + CRPS using Elia's tri-quantile fan.

    Grid-matching note
    ------------------
    Elia publishes three quantile bounds (10/50/90). Our mechanism's output
    is scored on a 9-level equidistant grid (``TAUS_FINE = [0.1, ..., 0.9]``).
    Earlier versions of this script scored Elia on its native 3-level grid
    and read the mechanism CRPS from ``comparison.json`` unchanged, which
    compared two different Riemann approximations of the same integral:
    the pinball integrand is piecewise-linear in τ and concave across
    forecaster disagreement, so the 3-point trapezoidal rule systematically
    under-integrates relative to the 9-point rule. The effect favours
    whichever forecaster is scored on the sparser grid.

    To make the comparison apples-to-apples this function now (a) scores
    Elia's fan on both the native 3-level and the 9-level equidistant grid
    and (b) returns both, so the reader can verify the ranking is stable
    to grid choice. The 9-level re-score extends Elia's fan to 9 levels by
    linear interpolation between (c10, fc, c90) and enforces monotonicity
    via cumulative maximum — it does not invent information Elia did not
    publish, only resamples the published fan onto the matched grid.
    """
    mask = (
        df["measured"].notna()
        & df[point_col].notna()
        & df[lo_col].notna()
        & df[hi_col].notna()
    )
    m = df.loc[mask, "measured"].values
    p = df.loc[mask, point_col].values
    lo = df.loc[mask, lo_col].values
    hi = df.loc[mask, hi_col].values
    n = len(m)

    err = p - m
    mae = float(np.mean(np.abs(err)))
    rmse = float(np.sqrt(np.mean(err ** 2)))
    bias = float(np.mean(err))

    # Empirical coverage (PIT) at 0.1 / 0.5 / 0.9
    cov10 = float(np.mean(m <= lo))
    cov50 = float(np.mean(m <= p))
    cov90 = float(np.mean(m <= hi))

    # Approximate CRPS via 3-quantile pinball surrogate (Elia's native grid)
    # Clip measured and quantile levels to reasonable ranges, normalize
    # to [0,1] using the observed min/max of `measured` over the clean rows
    m_min = float(m.min())
    m_max = float(m.max())
    rng = max(m_max - m_min, 1e-6)
    m_n = (m - m_min) / rng
    # Fan (p10, median, p90) per round — enforce monotonicity by sorting
    fan = np.column_stack([lo, p, hi])
    fan_sorted = np.sort(fan, axis=1)
    fan_n = (fan_sorted - m_min) / rng
    fan_n = np.clip(fan_n, 0.0, 1.0)
    m_n = np.clip(m_n, 0.0, 1.0)
    taus_3 = np.array([0.1, 0.5, 0.9])
    crps_per_3 = np.array([
        float(crps_hat_from_quantiles(float(m_n[i]), fan_n[i:i + 1, :], taus_3)[0])
        for i in range(n)
    ])
    crps_mean_norm_3 = float(crps_per_3.mean())
    crps_mean_mw_3 = crps_mean_norm_3 * rng

    # Grid-matched 9-level CRPS: linearly interpolate Elia's 3-level fan
    # onto the equidistant TAUS_FINE grid used by the mechanism, enforce
    # monotonicity, and rescore. This is the apples-to-apples comparison
    # against `comparison.json` rows which are 9-level scored.
    taus_9 = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    fan_9 = np.empty((n, taus_9.size), dtype=np.float64)
    for i in range(n):
        fan_9[i, :] = np.interp(taus_9, taus_3, fan_n[i, :])
    # np.interp with increasing xp already yields monotone output, but
    # float rounding can introduce microscopic crossings; a cumulative max
    # is a safe idempotent pass.
    fan_9 = np.maximum.accumulate(fan_9, axis=1)
    fan_9 = np.clip(fan_9, 0.0, 1.0)
    crps_per_9 = np.array([
        float(crps_hat_from_quantiles(float(m_n[i]), fan_9[i:i + 1, :], taus_9)[0])
        for i in range(n)
    ])
    crps_mean_norm_9 = float(crps_per_9.mean())
    crps_mean_mw_9 = crps_mean_norm_9 * rng

    return {
        "n": n,
        "mae_mw": round(mae, 2),
        "rmse_mw": round(rmse, 2),
        "bias_mw": round(bias, 2),
        "coverage_p10_nominal_0.10": round(cov10, 4),
        "coverage_p50_nominal_0.50": round(cov50, 4),
        "coverage_p90_nominal_0.90": round(cov90, 4),
        # Native 3-level grid (back-compat with earlier claim numbers).
        "crps_normalized_grid3": round(crps_mean_norm_3, 6),
        "crps_mw_equivalent_grid3": round(crps_mean_mw_3, 2),
        # Grid-matched 9-level re-score (apples-to-apples vs the mechanism).
        "crps_normalized_grid9": round(crps_mean_norm_9, 6),
        "crps_mw_equivalent_grid9": round(crps_mean_mw_9, 2),
        # Legacy keys (alias of grid3 — kept for callers reading old output).
        "crps_normalized": round(crps_mean_norm_3, 6),
        "crps_mw_equivalent": round(crps_mean_mw_3, 2),
        "mean_measured_mw": round(float(m.mean()), 2),
    }


def main() -> None:
    df = _load_wind_df()
    print(f"Loaded {len(df)} rows of Elia wind data.\n")

    out: dict = {}
    for name, (p, lo, hi) in [
        ("mostrecentforecast", ("mostrecentforecast", "mostrecentconfidence10", "mostrecentconfidence90")),
        ("dayahead11hforecast", ("dayahead11hforecast", "dayahead11hconfidence10", "dayahead11hconfidence90")),
        ("dayaheadforecast", ("dayaheadforecast", "dayaheadconfidence10", "dayaheadconfidence90")),
        ("weekaheadforecast", ("weekaheadforecast", "weekaheadconfidence10", "weekaheadconfidence90")),
    ]:
        print(f"=== {name} ===")
        metrics = _report_forecast(df, p, lo, hi)
        for k, v in metrics.items():
            print(f"  {k}: {v}")
        out[name] = metrics
        print()

    # Also report our mechanism post-fix CRPS-in-MW for comparison
    comp_path = REPO_ROOT / "dashboard" / "public" / "data" / "real_data" / "elia_wind" / "data" / "comparison.json"
    if comp_path.exists():
        with open(comp_path) as f:
            cmp = json.load(f)
        cfg = cmp["config"]
        scale = cfg["series_max"] - cfg["series_min"]
        print("=== Our mechanism (post-fix) — CRPS in MW equivalents ===")
        our = {}
        for row in cmp["rows"]:
            mw = row["mean_crps"] * scale
            print(f"  {row['method']:40s} {row['mean_crps']:.6f} (norm) → {mw:.2f} MW")
            our[row["method"]] = {
                "crps_normalized": row["mean_crps"],
                "crps_mw_equivalent": round(mw, 2),
            }
        out["our_mechanism_post_fix"] = {
            "T": cfg["T"],
            "series_min_mw": cfg["series_min"],
            "series_max_mw": cfg["series_max"],
            "rows": our,
        }

    out_path = REPO_ROOT / "onlinev2" / "outputs" / "elia_forecast_baseline.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
