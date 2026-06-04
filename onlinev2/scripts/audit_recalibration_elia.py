"""Empirical validation of the rolling isotonic recalibration layer on Elia wind.

Runs the same 3000-point Elia offshore-wind slice used by
``audit_per_quantile_coverage.py``, but this time computes per-τ empirical
coverage, mean CRPS-hat and mean sharpness for both the mechanism
aggregate and the recalibrated aggregate produced by the new
``RollingRecalibrator`` (Kuleshov, Fenner & Ermon 2018, arXiv:1807.00263,
§3.1).

Outputs:
  - onlinev2/outputs/audit_per_quantile/coverage_recal.json  — numbers.

Assertions (printed pass/fail, non-fatal):
  6.2  mean_tail_dev_recal <= 0.5 * 0.0171   (Req 4.1)
  6.3  mean_crps_recal     <= mean_crps_mechanism + 2e-4   (Req 4.2)
  6.4  mean_sharpness_recal >= 0.9 * mean_sharpness_mechanism   (Req 4.3)

Run:
    cd onlinev2 && OMP_NUM_THREADS=1 KMP_DUPLICATE_LIB_OK=TRUE \
        python scripts/audit_recalibration_elia.py
"""
from __future__ import annotations

import json
import os
import time

import numpy as np
import pandas as pd

from onlinev2.core.recalibration import RollingRecalibrator
from onlinev2.core.scoring import crps_hat_from_quantiles
from onlinev2.real_data.forecasters import get_all_forecasters
from onlinev2.real_data.runner import causal_normalize, causal_normalize_expanding
from onlinev2.simulation import run_simulation


def empirical_coverage(agg_q: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Fraction of realisations ≤ the τ-th aggregate quantile, per τ."""
    return (y[:, None] <= agg_q).mean(axis=0)


def main() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    csv_path = os.path.join(
        repo_root, "data", "elia_offshore_wind_2024_2025.csv"
    )
    df = pd.read_csv(csv_path, usecols=["datetime", "measured"])
    series_raw = df["measured"].dropna().to_numpy(dtype=np.float64)
    slice_len = int(os.environ.get("ONLINEV2_AUDIT_SLICE", 3000))
    series_raw = series_raw[:slice_len]

    print(f"Slice: {len(series_raw)} points")
    # Physical clipping: negative wind generation is impossible. Match
    # the preprocessing of run_real_data_with_skill.py / run_baseline_
    # comparison.py for comparability.
    n_neg = (series_raw < 0).sum()
    if n_neg > 0:
        print(f"  Clipping {n_neg} negative values to 0")
        series_raw = np.clip(series_raw, 0, None)
    # Strictly-causal normalisation with an EXPANDING (lo_t, hi_t) window.
    # On the 3000-point audit slice the warmup range (Jan winter wind)
    # is systematically higher than the eval range, so `static` mode
    # clips ~46% of eval values to 0 and makes per-quantile coverage
    # uninterpretable. `expanding` avoids clipping while staying strictly
    # causal (causal normalisation property 1.1 / 2.1).
    warmup = 200
    norm_series, _, _ = causal_normalize_expanding(series_raw, warmup_len=warmup)

    taus = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    forecasters = get_all_forecasters()
    N = len(forecasters)
    T = len(norm_series)

    # --- 1. Forecaster sweep -----------------------------------------------
    print("Step 1/3: forecaster sweep")
    q_reports = np.zeros((N, T, len(taus)))
    y_all = norm_series.copy()

    t0 = time.time()
    for t in range(T):
        y_t = float(y_all[t])
        history = y_all[:t]
        for i, fc in enumerate(forecasters):
            if t % fc.retrain_every == 0 and len(history) > 20:
                fc.fit(history)
            pt = float(np.clip(fc.predict(), 0, 1))
            q_reports[i, t] = fc.predict_quantiles(taus)
            fc.update_residuals(y_t, pt)
            if hasattr(fc, "_history"):
                fc._history = y_all[: t + 1]
            if hasattr(fc, "_last") and isinstance(fc._last, float):
                fc._last = y_t
    print(f"  forecasters done in {time.time() - t0:.0f}s")

    # --- 2. Mechanism aggregate --------------------------------------------
    print("Step 2/3: mechanism aggregate (γ=16, ρ=0.5)")
    # These γ/ρ values match ``audit_per_quantile_coverage.py``'s tuned run.
    res = run_simulation(
        T=T,
        n_forecasters=N,
        missing_prob=0.0,
        seed=42,
        scoring_mode="quantiles_crps",
        taus=taus,
        y_pre=y_all,
        q_reports_pre=q_reports,
        forecaster_noise_pre=np.ones(N),
        store_history=True,
        deposit_mode="fixed",
        fixed_deposit=1.0,
        eta=2.0,
        lam=0.05,
        gamma=16.0,
        rho=0.5,
    )
    mech_q = np.asarray(res["r_hat_hist"])[warmup:T]  # (T-warmup, K)
    y_eval = y_all[warmup:T]
    mech_crps = np.array(
        [
            float(
                crps_hat_from_quantiles(
                    float(y_eval[i]), mech_q[i].reshape(1, -1), taus
                )[0]
            )
            for i in range(T - warmup)
        ]
    )

    # --- 3. Apply rolling recalibration ------------------------------------
    print("Step 3/3: rolling isotonic recalibration")
    rc = RollingRecalibrator(
        taus, window_size=500, min_pits=100, refit_every=50
    )
    recal_q = np.zeros_like(mech_q)
    recal_crps = np.zeros(T - warmup, dtype=np.float64)
    for i in range(T - warmup):
        y_t = float(y_eval[i])
        r_mech_t = mech_q[i]
        rc.update(r_mech_t, y_t)
        if i % rc.refit_every == 0 and rc.n_pits >= rc.min_pits:
            try:
                rc.fit()
            except Exception as e:  # pragma: no cover — guardrail
                print(f"  fit failed at t={warmup + i}: {e}")
        r_recal_t = rc.transform(r_mech_t)
        recal_q[i] = r_recal_t
        recal_crps[i] = float(
            crps_hat_from_quantiles(y_t, r_recal_t.reshape(1, -1), taus)[0]
        )

    # --- Coverage ---
    mech_cov = empirical_coverage(mech_q, y_eval)
    recal_cov = empirical_coverage(recal_q, y_eval)
    nominal = taus.copy()

    # --- Report -----------------------------------------------------------
    print()
    print("=" * 72)
    print("PER-QUANTILE EMPIRICAL COVERAGE (elia wind, 3000 pts)")
    print("=" * 72)
    print(
        f"{'τ':>5} {'nominal':>9} {'mech':>8} {'recal':>8} "
        f"{'Δmech':>8} {'Δrecal':>9}"
    )
    for k, tau in enumerate(taus):
        dm = mech_cov[k] - nominal[k]
        dr = recal_cov[k] - nominal[k]
        print(
            f"{tau:>5.2f} {nominal[k]:>9.3f} {mech_cov[k]:>8.3f} "
            f"{recal_cov[k]:>8.3f} {dm:+8.3f} {dr:+9.3f}"
        )

    tail_mask = (taus <= 0.2) | (taus >= 0.8)
    centre_mask = (taus >= 0.4) & (taus <= 0.6)
    mech_tail_dev = float(np.mean(np.abs(mech_cov[tail_mask] - nominal[tail_mask])))
    mech_centre_dev = float(np.mean(np.abs(mech_cov[centre_mask] - nominal[centre_mask])))
    recal_tail_dev = float(np.mean(np.abs(recal_cov[tail_mask] - nominal[tail_mask])))
    recal_centre_dev = float(np.mean(np.abs(recal_cov[centre_mask] - nominal[centre_mask])))

    print()
    print("AGGREGATE MISCALIBRATION (mean |emp - nominal|)")
    print(f"  mechanism tail   (τ≤0.2 ∪ τ≥0.8): {mech_tail_dev:.4f}")
    print(f"  mechanism centre (0.4 ≤ τ ≤ 0.6): {mech_centre_dev:.4f}")
    print(f"  recal     tail                    : {recal_tail_dev:.4f}")
    print(f"  recal     centre                  : {recal_centre_dev:.4f}")

    # Sharpness: mean q(0.9) − q(0.1) on post-warmup rounds.
    idx_lo = int(np.argmin(np.abs(taus - 0.1)))
    idx_hi = int(np.argmin(np.abs(taus - 0.9)))
    mech_sharpness = float(np.mean(mech_q[:, idx_hi] - mech_q[:, idx_lo]))
    recal_sharpness = float(np.mean(recal_q[:, idx_hi] - recal_q[:, idx_lo]))

    print()
    print("CRPS (mean over scored rounds)")
    print(f"  mechanism: {float(mech_crps.mean()):.6f}")
    print(f"  recal    : {float(recal_crps.mean()):.6f}")
    print("SHARPNESS (mean q(0.9) − q(0.1))")
    print(f"  mechanism: {mech_sharpness:.4f}")
    print(f"  recal    : {recal_sharpness:.4f}")

    # --- Assertions -------------------------------------------------------
    print()
    print("=" * 72)
    print("ASSERTIONS (printed pass/fail)")
    print("=" * 72)
    tail_pass = recal_tail_dev <= 0.5 * 0.0171
    crps_pass = float(recal_crps.mean()) <= float(mech_crps.mean()) + 2e-4
    sharp_pass = recal_sharpness >= 0.9 * mech_sharpness

    def _status(ok: bool) -> str:
        return "PASS" if ok else "FAIL"

    print(
        f"  6.2 tail dev ≤ 0.00855: "
        f"recal_tail_dev = {recal_tail_dev:.5f}  [{_status(tail_pass)}]"
    )
    print(
        f"  6.3 CRPS ≤ mech + 2e-4: "
        f"Δ = {float(recal_crps.mean() - mech_crps.mean()):+.6f}  "
        f"[{_status(crps_pass)}]"
    )
    print(
        f"  6.4 sharpness ≥ 0.9 × mech: "
        f"ratio = {recal_sharpness / mech_sharpness if mech_sharpness > 1e-12 else float('nan'):.3f}  "
        f"[{_status(sharp_pass)}]"
    )
    all_pass = tail_pass and crps_pass and sharp_pass
    print(f"  ALL: {_status(all_pass)}")

    # --- Dump -------------------------------------------------------------
    out_dir = os.path.join(
        os.path.dirname(__file__), "..", "outputs", "audit_per_quantile"
    )
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "coverage_recal.json")
    with open(out_path, "w") as f:
        json.dump(
            {
                "taus": taus.tolist(),
                "nominal": nominal.tolist(),
                "mech_coverage": mech_cov.tolist(),
                "recal_coverage": recal_cov.tolist(),
                "mech_tail_dev": mech_tail_dev,
                "mech_centre_dev": mech_centre_dev,
                "recal_tail_dev": recal_tail_dev,
                "recal_centre_dev": recal_centre_dev,
                "mech_mean_crps": float(mech_crps.mean()),
                "recal_mean_crps": float(recal_crps.mean()),
                "mech_mean_sharpness": mech_sharpness,
                "recal_mean_sharpness": recal_sharpness,
                "assertions": {
                    "6_2_tail_dev_pass": bool(tail_pass),
                    "6_3_crps_pass": bool(crps_pass),
                    "6_4_sharpness_pass": bool(sharp_pass),
                    "all_pass": bool(all_pass),
                },
            },
            f,
            indent=2,
        )
    print(f"\nWrote {out_path}")
    return 0 if all_pass else 3


if __name__ == "__main__":
    raise SystemExit(main())
