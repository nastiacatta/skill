#!/usr/bin/env python3
"""Quick Michael Vitali OGD vs your mechanism comparison on a 2000-round slice.

Runs 7 forecasters once, then scores ALL methods on the same quantile
forecasts so that the comparison is apples-to-apples.
"""
import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "onlinev2", "src"))

from onlinev2.real_data.forecasters import get_all_forecasters
from onlinev2.core.scoring import crps_hat_from_quantiles, TAUS_FINE
from onlinev2.simulation import run_simulation


def project_simplex(v: np.ndarray) -> np.ndarray:
    """Euclidean projection onto the probability simplex (Duchi et al. 2008)."""
    v = np.asarray(v, dtype=np.float64)
    n = v.size
    u = np.sort(v)[::-1]
    cssv = np.cumsum(u) - 1
    ind = np.arange(1, n + 1)
    cond = u - cssv / ind > 0
    rho = int(np.where(cond)[0][-1]) + 1
    theta = cssv[rho - 1] / rho
    return np.maximum(v - theta, 0)


def load_wind_hourly() -> np.ndarray:
    csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "elia_offshore_wind_2024_2025.csv")
    df = pd.read_csv(csv_path)
    s = df["measured"].dropna().values.astype(np.float64)
    s = np.clip(s, 0, None)
    n = (len(s) // 4) * 4
    return s[:n].reshape(-1, 4).mean(axis=1)


def main():
    T_FULL = 2000
    WARMUP = 200
    taus = TAUS_FINE
    K = len(taus)

    series = load_wind_hourly()[:T_FULL]
    lo, hi = series.min(), series.max()
    norm = (series - lo) / (hi - lo)

    print(f"Running 7 forecasters on {T_FULL} rounds...")
    forecasters = get_all_forecasters()
    n = len(forecasters)

    q_reports = np.zeros((n, T_FULL, K))
    y_all = np.zeros(T_FULL)
    for t in range(T_FULL):
        history = norm[:t]
        y_t = norm[t]
        y_all[t] = y_t
        for i, fc in enumerate(forecasters):
            if t % fc.retrain_every == 0 and len(history) > 20:
                fc.fit(history)
            q_reports[i, t, :] = fc.predict_quantiles(taus)
            fc.update_residuals(y_t, fc.predict())
            if hasattr(fc, '_history'):
                fc._history = norm[:t + 1]
            if hasattr(fc, '_last') and isinstance(fc._last, float):
                fc._last = y_t
        if t % 400 == 0 and t > 0:
            print(f"  t={t}/{T_FULL}")

    # ── Uniform ──
    crps_uniform = []
    for t in range(WARMUP, T_FULL):
        q = np.mean(q_reports[:, t, :], axis=0)
        crps_uniform.append(float(crps_hat_from_quantiles(y_all[t], q.reshape(1, -1), taus)[0]))

    # ── Michael Vitali per-quantile OGD ──
    lr = 0.05
    W = np.full((K, n), 1.0 / n)
    crps_vitali = []
    for t in range(T_FULL):
        q_t = q_reports[:, t, :]
        y_hat = np.sum(W * q_t.T, axis=1)
        if t >= WARMUP:
            crps_vitali.append(float(crps_hat_from_quantiles(y_all[t], y_hat.reshape(1, -1), taus)[0]))
        for k, tau in enumerate(taus):
            s = -float(tau) if y_all[t] >= y_hat[k] else (1.0 - float(tau))
            grad = s * q_t[:, k]
            W[k] = project_simplex(W[k] - lr * grad)

    # ── Best single (adaptive per-round choice based on recent CRPS) ──
    crps_best = []
    agent_rec = [[] for _ in range(n)]
    for t in range(WARMUP, T_FULL):
        if t - WARMUP >= 20:
            recent = [np.mean(agent_rec[i][-100:]) for i in range(n)]
            best = int(np.argmin(recent))
        else:
            best = 0
        crps_best.append(float(crps_hat_from_quantiles(y_all[t], q_reports[best:best+1, t, :], taus)[0]))
        for i in range(n):
            ci = float(crps_hat_from_quantiles(y_all[t], q_reports[i:i+1, t, :], taus)[0])
            agent_rec[i].append(ci)

    # ── Oracle ──
    crps_oracle = []
    for t in range(WARMUP, T_FULL):
        per_agent = crps_hat_from_quantiles(y_all[t], q_reports[:, t, :], taus)
        inv = np.where(per_agent > 1e-12, 1.0 / per_agent, 0.0)
        if inv.sum() > 1e-12:
            w = inv / inv.sum()
            agg = np.sum(w[:, None] * q_reports[:, t, :], axis=0)
        else:
            agg = np.mean(q_reports[:, t, :], axis=0)
        crps_oracle.append(float(crps_hat_from_quantiles(y_all[t], agg.reshape(1, -1), taus)[0]))

    # ── Your mechanism ──
    print("Running mechanism simulation (γ=16, ρ=0.5, λ=0.05, η=2)...")
    res = run_simulation(
        T=T_FULL, n_forecasters=n, missing_prob=0.0, seed=42,
        scoring_mode="quantiles_crps", taus=taus, y_pre=y_all,
        q_reports_pre=q_reports, forecaster_noise_pre=np.ones(n),
        store_history=True, deposit_mode="fixed", fixed_deposit=1.0,
        eta=2.0, lam=0.05, gamma=16.0, rho=0.5, omega_max=0.0,
    )
    crps_mech = []
    for t in range(WARMUP, T_FULL):
        r_mech = np.asarray(res["r_hat_hist"][t], dtype=np.float64)
        if r_mech.size == len(taus):
            crps_mech.append(float(crps_hat_from_quantiles(float(y_all[t]), r_mech.reshape(1, -1), taus)[0]))

    # ── Print ──
    m_u = float(np.mean(crps_uniform))
    print(f"\n  Method                         mean CRPS   Δ vs uniform")
    print(f"  " + "-" * 60)
    for name, arr in [
        ("uniform", crps_uniform),
        ("michael_vitali_per_quantile_OGD", crps_vitali),
        ("mechanism (yours)", crps_mech),
        ("best_single (adaptive)", crps_best),
        ("oracle (hindsight)", crps_oracle),
    ]:
        m = float(np.mean(arr))
        pct = (m - m_u) / m_u * 100
        print(f"  {name:32s}  {m:8.6f}     {pct:+6.1f}%")


if __name__ == "__main__":
    main()
