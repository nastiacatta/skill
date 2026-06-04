"""Fresh post-fix audit run on Elia wind + michael_ogd baseline.

Loads a representative slice of elia_offshore_wind_2024_2025.csv, runs
all 7 forecasters through `run_real_data_comparison`, and reports key
numbers: per-forecaster CRPS ranking, baseline-rule CRPS (uniform /
skill / mechanism / best_single / inverse_variance / trimmed_mean /
median / oracle / michael_ogd), and mechanism-vs-Michael and
mechanism-vs-XGBoost gaps.

Run:
    cd onlinev2 && python scripts/audit_fresh_run.py
"""
from __future__ import annotations

import os
import sys
import time

import numpy as np
import pandas as pd

from onlinev2.real_data.runner import run_real_data_comparison


def main() -> None:
    # Load the wind "measured" column — this is the observed output to
    # forecast. Trim to a 3000-point slice (~ 31 days of 15-min data)
    # for a stable estimate that still runs in a few minutes.
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    csv_path = os.path.join(repo_root, "data", "elia_offshore_wind_2024_2025.csv")
    df = pd.read_csv(csv_path, usecols=["datetime", "measured"])
    series = df["measured"].dropna().to_numpy(dtype=np.float64)

    # Slice: 3000 points (fast but statistically meaningful).
    slice_len = int(os.environ.get("ONLINEV2_AUDIT_SLICE", 3000))
    series = series[:slice_len]

    # Physical clipping: negative wind generation is impossible. Match
    # the preprocessing of run_real_data_with_skill.py / run_baseline_
    # comparison.py for comparability.
    n_neg = int((series < 0).sum())
    if n_neg > 0:
        print(f"  Clipping {n_neg} negative values to 0 (physical range)")
        series = np.clip(series, 0, None)

    print(f"Slice: {len(series)} points "
          f"(range {series.min():.1f} – {series.max():.1f} MW, "
          f"mean {series.mean():.1f})")
    t0 = time.time()

    res = run_real_data_comparison(
        series=series,
        warmup=200,
        series_name="elia_wind_audit_fresh",
        gamma=16.0,
        rho=0.5,
        lam=0.05,
        # Expanding normalisation: on the 3000-point audit slice the
        # warmup-window range (Jan wind) is systematically higher than
        # the eval range, so `static` clips ~46% of eval values to 0
        # and makes CRPS numbers on the audit slice incomparable with
        # the full-length run. `expanding` avoids clipping while
        # preserving strict causality (causal normalisation property 1.1 / 2.1).
        normalize_mode="expanding",
    )

    elapsed = time.time() - t0
    print(f"\nTotal run time: {elapsed:.1f}s\n")

    # --- Summary: rule-level CRPS ---
    print("=" * 70)
    print("RULE-LEVEL CRPS (elia_wind_fresh, post-fix code)")
    print("=" * 70)
    rows_sorted = sorted(res["rows"], key=lambda r: r["mean_crps"])
    for r in rows_sorted:
        print(f"  {r['method']:22s}  CRPS = {r['mean_crps']:.5f}  "
              f"Δvs_uniform = {r['delta_crps_vs_equal']:+.5f}")

    # --- Per-forecaster ranking from per_agent_crps ---
    print("\n" + "=" * 70)
    print("PER-FORECASTER MEAN CRPS")
    print("=" * 70)
    if "per_agent_crps" in res:
        per_agent = res["per_agent_crps"]
    elif "per_round" in res:
        # Some builds store agent CRPS differently; skip gracefully.
        per_agent = []
    else:
        per_agent = []

    names = res["config"]["forecasters"]
    if per_agent:
        mat = np.asarray(
            [[r[f"crps_{i}"] for i in range(len(names))] for r in per_agent],
            dtype=np.float64,
        )
        means = mat.mean(axis=0)
        ranked = sorted(zip(names, means, range(len(names))), key=lambda x: x[1])
        best_mean = ranked[0][1]
        for rank, (n, m, i) in enumerate(ranked, 1):
            delta = 100 * (m - best_mean) / best_mean if best_mean > 0 else 0.0
            marker = "*" if rank == 1 else " "
            print(f"  {marker} {rank}. {n:28s}  CRPS = {m:.5f}  "
                  f"(+{delta:.2f}% vs best)")

    # --- Key results ---
    print("\n" + "=" * 70)
    print("KEY RESULTS")
    print("=" * 70)
    row_map = {r["method"]: r["mean_crps"] for r in res["rows"]}

    def _report_gap(label, a_name, b_name):
        if a_name in row_map and b_name in row_map:
            a, b = row_map[a_name], row_map[b_name]
            ratio = a / b if b > 1e-12 else float("inf")
            delta = (a - b) / b * 100 if b > 1e-12 else float("inf")
            print(f"  {label}: {a_name}={a:.5f}  {b_name}={b:.5f}  "
                  f"ratio={ratio:.3f}×  Δ={delta:+.1f}%")

    _report_gap("Mechanism vs michael_ogd", "mechanism", "michael_ogd")
    _report_gap("Mechanism vs best_single", "mechanism", "best_single")
    _report_gap("Mechanism vs oracle     ", "mechanism", "oracle")
    _report_gap("Michael vs oracle       ", "michael_ogd", "oracle")
    _report_gap("XGBoost vs best_single  ", "mechanism", "best_single")


if __name__ == "__main__":
    main()
