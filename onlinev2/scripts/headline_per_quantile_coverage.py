"""Per-quantile coverage on the full-length Elia wind headline slice.

Mirror of ``audit_per_quantile_coverage.py`` but computed on the full
$T = 17{,}344$ evaluation rounds rather than the 3000-point audit
slice, so the calibration analysis in Chapter~7 of the thesis can
quote a number for the headline run rather than only the audit run.

Outputs:
  - onlinev2/outputs/audit_per_quantile/coverage_headline.json

Run:
    cd onlinev2 && OMP_NUM_THREADS=1 KMP_DUPLICATE_LIB_OK=TRUE \
        python scripts/headline_per_quantile_coverage.py
"""
from __future__ import annotations

import json
import os
import time

import numpy as np
import pandas as pd

from onlinev2.core.scoring import crps_hat_from_quantiles
from onlinev2.real_data.forecasters import get_all_forecasters
from onlinev2.real_data.runner import causal_normalize_expanding
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
    N, T, K = q_reports.shape
    W = np.full((K, N), 1.0 / N)
    agg_q = np.zeros((T - warmup, K))
    crps_series = []
    for t in range(T):
        q_t = q_reports[:, t, :]
        y_t = float(y_all[t])
        y_hat = np.sum(W * q_t.T, axis=1)
        if t >= warmup:
            agg_q[t - warmup] = y_hat
            crps_series.append(
                float(crps_hat_from_quantiles(y_t, y_hat.reshape(1, -1), taus)[0])
            )
        for k in range(K):
            s = -float(taus[k]) if y_t >= y_hat[k] else (1.0 - float(taus[k]))
            grad = s * q_t[:, k]
            W[k] = project_simplex(W[k] - lr * grad)
    return agg_q, np.asarray(crps_series)


def empirical_coverage(agg_q: np.ndarray, y: np.ndarray, taus: np.ndarray):
    y_expanded = y[:, None]
    return (y_expanded <= agg_q).mean(axis=0)


HEADLINE_T = 17544
WARMUP = 200


def main() -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    csv_path = os.path.join(
        repo_root, "data", "elia_offshore_wind_2024_2025.csv"
    )
    df = pd.read_csv(csv_path, usecols=["datetime", "measured"])
    series_raw = df["measured"].dropna().to_numpy(dtype=np.float64)
    series_raw = series_raw[:HEADLINE_T]

    print(f"Headline slice: {len(series_raw)} points")
    n_neg = int((series_raw < 0).sum())
    if n_neg:
        print(f"  Clipping {n_neg} negative values to 0")
        series_raw = np.clip(series_raw, 0, None)

    norm_series, _, _ = causal_normalize_expanding(series_raw, warmup_len=WARMUP)

    taus = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    forecasters = get_all_forecasters()
    N = len(forecasters)
    T = len(norm_series)

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
    mech_q = np.asarray(res["r_hat_hist"])[WARMUP:T]
    mech_crps = np.array(
        [
            float(
                crps_hat_from_quantiles(
                    float(y_all[WARMUP + i]),
                    mech_q[i].reshape(1, -1),
                    taus,
                )[0]
            )
            for i in range(T - WARMUP)
        ]
    )

    print("Step 3/3: Vitali per-τ OGD")
    vitali_q, vitali_crps = vitali_per_quantile(
        q_reports, y_all, taus, warmup=WARMUP, lr=0.05
    )

    y_eval = y_all[WARMUP:]
    mech_cov = empirical_coverage(mech_q, y_eval, taus)
    vitali_cov = empirical_coverage(vitali_q, y_eval, taus)
    nominal = taus.copy()

    tail_mask = (taus <= 0.2) | (taus >= 0.8)
    centre_mask = (taus >= 0.4) & (taus <= 0.6)
    mech_tail_dev = float(np.mean(np.abs(mech_cov[tail_mask] - nominal[tail_mask])))
    mech_centre_dev = float(
        np.mean(np.abs(mech_cov[centre_mask] - nominal[centre_mask]))
    )
    vitali_tail_dev = float(
        np.mean(np.abs(vitali_cov[tail_mask] - nominal[tail_mask]))
    )
    vitali_centre_dev = float(
        np.mean(np.abs(vitali_cov[centre_mask] - nominal[centre_mask]))
    )

    print()
    print("=" * 72)
    print(f"PER-QUANTILE EMPIRICAL COVERAGE (elia wind, {T - WARMUP} eval rounds)")
    print("=" * 72)
    print(
        f"{'τ':>5} {'nominal':>9} {'mech':>8} {'vitali':>8} "
        f"{'Δmech':>8} {'Δvitali':>9}"
    )
    for k, tau in enumerate(taus):
        dm = mech_cov[k] - nominal[k]
        dv = vitali_cov[k] - nominal[k]
        print(
            f"{tau:>5.2f} {nominal[k]:>9.3f} {mech_cov[k]:>8.3f} "
            f"{vitali_cov[k]:>8.3f} {dm:+8.3f} {dv:+9.3f}"
        )
    print()
    print(f"mechanism tail   (τ≤0.2 ∪ τ≥0.8): {mech_tail_dev:.4f}")
    print(f"mechanism centre (0.4 ≤ τ ≤ 0.6): {mech_centre_dev:.4f}")
    print(f"vitali    tail                    : {vitali_tail_dev:.4f}")
    print(f"vitali    centre                  : {vitali_centre_dev:.4f}")
    print(f"mechanism mean CRPS : {float(mech_crps.mean()):.5f}")
    print(f"vitali    mean CRPS : {float(vitali_crps.mean()):.5f}")

    out_dir = os.path.join(
        os.path.dirname(__file__), "..", "outputs", "audit_per_quantile"
    )
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "coverage_headline.json"), "w") as f:
        json.dump(
            {
                "slice_length": T - WARMUP,
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
    print(f"\nWrote {out_dir}/coverage_headline.json")


if __name__ == "__main__":
    main()
