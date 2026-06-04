"""Per-quantile coverage comparison: mechanism vs Vitali per-τ OGD.

Runs both on the same Elia wind slice and the same forecaster panel,
then plots empirical coverage at each τ level so we can see whether the
miscalibration lives in the tails (per-τ OGD wins big) or in the
centre (tail divergence small, empirical recalibration suffices).

Outputs:
  - onlinev2/outputs/audit_per_quantile/coverage.json  (numerical)
  - onlinev2/outputs/audit_per_quantile/coverage.png   (plot)

Run:
    cd onlinev2 && OMP_NUM_THREADS=1 KMP_DUPLICATE_LIB_OK=TRUE \
        python scripts/audit_per_quantile_coverage.py
"""
from __future__ import annotations

import json
import os
import time

import numpy as np
import pandas as pd

from onlinev2.core.aggregation import aggregate_forecast
from onlinev2.core.scoring import crps_hat_from_quantiles
from onlinev2.real_data.forecasters import get_all_forecasters
from onlinev2.real_data.runner import causal_normalize, causal_normalize_expanding
from onlinev2.simulation import run_simulation


def project_simplex(v: np.ndarray) -> np.ndarray:
    """Duchi et al. simplex projection."""
    v = np.asarray(v, dtype=np.float64).ravel()
    n = v.size
    u = np.sort(v)[::-1]
    cssv = np.cumsum(u) - 1.0
    k_arr = np.arange(1, n + 1, dtype=np.float64)
    mask = u > cssv / k_arr
    if not np.any(mask):
        return np.full(n, 1.0 / n)
    rho = int(np.where(mask)[0].max() + 1)
    tau = cssv[rho - 1] / rho
    return np.maximum(v - tau, 0.0)


def vitali_per_quantile(
    q_reports: np.ndarray,
    y_all: np.ndarray,
    taus: np.ndarray,
    warmup: int,
    lr: float = 0.05,
):
    """Per-τ OGD on the simplex. Returns (agg_q, crps_series)."""
    N, T, K = q_reports.shape
    W = np.full((K, N), 1.0 / N)
    agg_q = np.zeros((T - warmup, K))
    crps_series = []
    for t in range(T):
        q_t = q_reports[:, t, :]  # (N, K)
        y_t = float(y_all[t])
        y_hat = np.sum(W * q_t.T, axis=1)  # (K,)

        if t >= warmup:
            agg_q[t - warmup] = y_hat
            crps_series.append(
                float(crps_hat_from_quantiles(y_t, y_hat.reshape(1, -1), taus)[0])
            )
        # per-τ simplex OGD on pinball subgradient
        for k in range(K):
            s = -float(taus[k]) if y_t >= y_hat[k] else (1.0 - float(taus[k]))
            grad = s * q_t[:, k]
            W[k] = project_simplex(W[k] - lr * grad)
    return agg_q, np.asarray(crps_series)


def empirical_coverage(agg_q: np.ndarray, y: np.ndarray, taus: np.ndarray):
    """Fraction of realisations ≤ the τ-th aggregate quantile, per τ."""
    # agg_q: (T, K), y: (T,)
    y_expanded = y[:, None]
    under = (y_expanded <= agg_q).mean(axis=0)
    return under  # shape (K,)


def main():
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

    # --- 1. Run all 7 forecasters to produce the quantile panel ---
    print("Step 1/3: forecaster sweep (~150s)")
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

    # --- 2. Mechanism aggregate ---
    print("Step 2/3: mechanism aggregate")
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
    mech_crps = np.array(
        [
            float(
                crps_hat_from_quantiles(
                    float(y_all[warmup + i]),
                    mech_q[i].reshape(1, -1),
                    taus,
                )[0]
            )
            for i in range(T - warmup)
        ]
    )

    # --- 3. Vitali per-τ OGD on the same panel ---
    print("Step 3/3: Vitali per-τ OGD")
    vitali_q, vitali_crps = vitali_per_quantile(
        q_reports, y_all, taus, warmup=warmup, lr=0.05
    )

    # --- Coverage ---
    y_eval = y_all[warmup:]
    mech_cov = empirical_coverage(mech_q, y_eval, taus)
    vitali_cov = empirical_coverage(vitali_q, y_eval, taus)
    nominal = taus.copy()

    # --- Report ---
    print()
    print("=" * 72)
    print("PER-QUANTILE EMPIRICAL COVERAGE (elia wind, 3000 pts)")
    print("=" * 72)
    print(f"{'τ':>5} {'nominal':>9} {'mech':>8} {'vitali':>8} "
          f"{'Δmech':>8} {'Δvitali':>9} {'|mech|>|v|?':>12}")
    for k, tau in enumerate(taus):
        dm = mech_cov[k] - nominal[k]
        dv = vitali_cov[k] - nominal[k]
        flag = "yes" if abs(dm) > abs(dv) + 0.01 else "no "
        print(
            f"{tau:>5.2f} {nominal[k]:>9.3f} {mech_cov[k]:>8.3f} "
            f"{vitali_cov[k]:>8.3f} {dm:+8.3f} {dv:+9.3f} {flag:>12}"
        )

    # Tail vs centre aggregates
    tail_mask = (taus <= 0.2) | (taus >= 0.8)
    centre_mask = (taus >= 0.4) & (taus <= 0.6)
    mech_tail_dev = float(np.mean(np.abs(mech_cov[tail_mask] - nominal[tail_mask])))
    mech_centre_dev = float(np.mean(np.abs(mech_cov[centre_mask] - nominal[centre_mask])))
    vitali_tail_dev = float(np.mean(np.abs(vitali_cov[tail_mask] - nominal[tail_mask])))
    vitali_centre_dev = float(np.mean(np.abs(vitali_cov[centre_mask] - nominal[centre_mask])))

    print()
    print("AGGREGATE MISCALIBRATION (mean |emp - nominal|)")
    print(f"  mechanism tail   (τ≤0.2 ∪ τ≥0.8): {mech_tail_dev:.3f}")
    print(f"  mechanism centre (0.4 ≤ τ ≤ 0.6): {mech_centre_dev:.3f}")
    print(f"  vitali   tail                    : {vitali_tail_dev:.3f}")
    print(f"  vitali   centre                  : {vitali_centre_dev:.3f}")

    print()
    print("CRPS (for context)")
    print(f"  mechanism mean CRPS: {float(mech_crps.mean()):.5f}")
    print(f"  vitali    mean CRPS: {float(vitali_crps.mean()):.5f}")
    print(f"  ratio mech / vitali: {float(mech_crps.mean() / vitali_crps.mean()):.3f}")

    # --- Decision rule ---
    print()
    print("=" * 72)
    print("DECISION")
    print("=" * 72)
    tail_gap = mech_tail_dev - vitali_tail_dev
    centre_gap = mech_centre_dev - vitali_centre_dev
    print(f"  tail deviation gap (mech - vitali):   {tail_gap:+.3f}")
    print(f"  centre deviation gap (mech - vitali): {centre_gap:+.3f}")
    print()
    if tail_gap >= 0.02:
        print("  Tail divergence is LARGE (≥0.02).")
        print("  → Recommendation: invest in 2.1/2.2 (per-τ OGD aggregator)")
        print("    OR 2.3 (empirical recalibration) — both close tail gap.")
        print("    2.2 (wager-regularised per-τ OGD) is the best thesis option.")
    else:
        print("  Tail divergence is SMALL (<0.02).")
        print("  → Recommendation: 2.3 (empirical recalibration) is sufficient.")
        print("    Per-τ OGD is overkill for the observed miscalibration.")

    out_dir = os.path.join(
        os.path.dirname(__file__), "..", "outputs", "audit_per_quantile"
    )
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "coverage.json"), "w") as f:
        json.dump(
            {
                "taus": taus.tolist(),
                "nominal": nominal.tolist(),
                "mech_coverage": mech_cov.tolist(),
                "vitali_coverage": vitali_cov.tolist(),
                "mech_tail_dev": mech_tail_dev,
                "mech_centre_dev": mech_centre_dev,
                "vitali_tail_dev": vitali_tail_dev,
                "vitali_centre_dev": vitali_centre_dev,
                "mech_crps": float(mech_crps.mean()),
                "vitali_crps": float(vitali_crps.mean()),
            },
            f,
            indent=2,
        )
    print(f"\nWrote {out_dir}/coverage.json")


if __name__ == "__main__":
    main()
