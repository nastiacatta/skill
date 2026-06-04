"""
Real-data experiments: day-ahead, 4h-ahead at 15min, and regime-shift analysis.
"""
from __future__ import annotations

import json
import os
import time

import numpy as np
import pandas as pd

from .forecasters import BaseForecaster, get_all_forecasters
from .runner import best_single_by_crps, causal_normalize, normalize_series


def min_warmup_for(forecasters: list[BaseForecaster]) -> int:
    """Return the minimum warmup required so every forecaster in
    ``forecasters`` has enough history to train (not fall back to
    persistence) by the end of the warmup window.

    See `XGBoostForecaster.fit` (requires ``max(n_lags, 50) + 20``
    history), `MLPForecaster.fit` (``max(n_lags, 50) + 10``), and the
    simpler forecasters (minimum 20 to pass the retrain gate in the
    runners).

    Bugfix clause 1.16 / 2.16.
    """
    # Import locally to avoid a circular import at module load time
    # (experiments → runner → forecasters).
    from .forecasters import MLPForecaster, XGBoostForecaster

    mins = []
    for fc in forecasters:
        if isinstance(fc, XGBoostForecaster):
            mins.append(max(fc.n_lags, 50) + 20)
        elif isinstance(fc, MLPForecaster):
            mins.append(max(fc.n_lags, 50) + 10)
        else:
            mins.append(20)
    return max(mins) if mins else 20


def _run_horizon_comparison(
    series: np.ndarray,
    horizon: int,
    forecasters: list[BaseForecaster],
    warmup: int,
    taus: np.ndarray,
    label: str,
    seed: int = 42,
    strict_no_fallback: bool = False,
    normalize_mode: str = "static",
    *,
    gamma: float = 16.0,
    rho: float = 0.5,
    lam: float = 0.05,
) -> dict:
    """Run forecasters with a given forecast horizon.

    At each round t, models see data up to t-horizon and predict t.
    This ensures strictly causal forecasting at the given horizon.

    ``normalize_mode`` mirrors the same kwarg on
    :func:`onlinev2.real_data.runner.run_real_data_comparison`:
    ``"static"`` (default) freezes ``(lo, hi)`` to the warmup window and
    clips evaluation-window observations outside that range;
    ``"expanding"`` refits ``(lo_t, hi_t)`` over ``series[:t+1]``
    while preserving strict causality. See post-audit issue #1.

    Mechanism parameters
    --------------------
    ``gamma``, ``rho``, ``lam`` default to the real-data tuned values
    from the held-out sensitivity sweep
    (``onlinev2/outputs/sensitivity_sweep.json``) — previously these
    were omitted and fell back to the synthetic defaults
    (γ=4, ρ=0.1) via ``run_simulation``'s signature, which underweight
    the skill layer on real-data panels (audit fix M3).
    """
    if normalize_mode not in {"static", "expanding"}:
        raise ValueError(
            f"normalize_mode must be 'static' or 'expanding', got {normalize_mode!r}."
        )

    # Strictly-causal normalization (causal normalisation property 1.1 / 2.1
    # — prevents future-data leakage).
    if normalize_mode == "expanding":
        from .runner import causal_normalize_expanding
        norm, lo_traj, hi_traj = causal_normalize_expanding(
            series, warmup_len=warmup
        )
        s_min = float(lo_traj[-1])
        s_max = float(hi_traj[-1])
    else:
        norm, s_min, s_max = causal_normalize(series, warmup_len=warmup)
    T = len(norm)
    n = len(forecasters)

    # Propagate deterministic seed (MLP seed determinism property 1.8 / 2.8).
    for fc in forecasters:
        if hasattr(fc, "seed"):
            fc.seed = seed

    # Reset forecasters
    for fc in forecasters:
        fc._residuals = []
        fc._fitted = False

    q_reports = np.zeros((n, T, len(taus)))
    reports = np.zeros((n, T))

    # Rounds 0..horizon-1 are never predicted by the pending-queue logic
    # (the first enqueue targets u = 0 + horizon = horizon). Without this
    # initialisation they would be passed to `run_simulation` as all-zeros,
    # polluting sigma_hist / score_hist for the very first rounds before
    # scoring begins. Seed them with a neutral 0.5 flat fan so the
    # mechanism sees a well-formed but uninformative forecast.
    reports[:, :horizon] = 0.5
    q_reports[:, :horizon, :] = 0.5

    # Pending-prediction queue: each element is (u, ŷ_point_u, ŷ_q_u).
    # At round s we enqueue a prediction targeting u = s + horizon,
    # computed from norm[:s]; when round u is observable we drain it and
    # pair it with norm[u] to update each forecaster's residual buffer
    # with a well-defined h-step-ahead error (bugfix clause 1.5 / 2.5).
    from collections import deque
    pending: deque[tuple[int, np.ndarray, np.ndarray]] = deque()

    print(f"  Generating forecasts (horizon={horizon})...")
    t0 = time.time()
    for t in range(T):
        # Step 1: issue a prediction targeting round u = t + horizon
        # using the strictly-causal history norm[:t].
        u = t + horizon
        if u < T:
            history = norm[:t] if t > 0 else np.array([])
            pending_point = np.zeros(n)
            pending_q = np.zeros((n, len(taus)))
            for i, fc in enumerate(forecasters):
                if len(history) < 5:
                    point = 0.5
                else:
                    # Retrain policy: retrain only when we have enough history
                    # to fit meaningfully (> 20 points). The legacy ``t == 0``
                    # trigger wasted a call on an empty history and bumped
                    # fallback_counter on ML forecasters; see sibling fix in
                    # runner.py and tests/audit/test_theory_alignment.py.
                    if t % fc.retrain_every == 0 and len(history) > 20:
                        fc.fit(history)
                    raw_point = fc.predict()
                    # NaN guard: np.clip preserves NaN so a degenerate
                    # forecaster could poison reports[i, u] and cascade
                    # through the mechanism. Substitute the last-known
                    # history value and count the fallback.
                    if not np.isfinite(raw_point):
                        fc.fallback_counter += 1
                        raw_point = float(history[-1])
                    point = float(np.clip(raw_point, 0, 1))
                pending_point[i] = point
                pending_q[i] = (
                    np.clip(fc.predict_quantiles(taus), 0, 1)
                    if len(history) >= 5
                    else np.full(len(taus), point)
                )
            pending.append((u, pending_point, pending_q))

        # Step 2: drain any pending predictions whose target index is
        # now observable (u == t). Under the loop invariant at most one
        # element is drainable per round (queue is FIFO and enqueue
        # index is monotone).
        while pending and pending[0][0] <= t:
            u_drain, ŷ_point_u, ŷ_q_u = pending.popleft()
            assert u_drain == t, (
                f"pending queue drained out of order: u={u_drain}, t={t}"
            )
            reports[:, u_drain] = ŷ_point_u
            q_reports[:, u_drain, :] = ŷ_q_u
            for i, fc in enumerate(forecasters):
                # Residual pair (y_u, ŷ_u) — matching target index.
                fc.update_residuals(float(norm[u_drain]), float(ŷ_point_u[i]))
            # Advance forecaster caches to the observed point.
            for fc in forecasters:
                if hasattr(fc, '_history'):
                    fc._history = norm[:u_drain + 1]
                if hasattr(fc, '_last') and isinstance(fc._last, float):
                    fc._last = float(norm[u_drain])

    print(f"    Done in {time.time()-t0:.1f}s")

    # Run mechanism
    from onlinev2.core.aggregation import aggregate_forecast
    from onlinev2.core.scoring import crps_hat_from_quantiles
    from onlinev2.simulation import run_simulation

    res = run_simulation(
        T=T, n_forecasters=n, missing_prob=0.0, seed=42,
        scoring_mode="quantiles_crps", taus=taus,
        y_pre=norm, q_reports_pre=q_reports,
        forecaster_noise_pre=np.ones(n), store_history=True,
        deposit_mode="fixed", fixed_deposit=1.0,
        eta=2.0, lam=lam, gamma=gamma, rho=rho, omega_max=0.0,
    )

    eps = 1e-12
    rules = ["uniform", "skill", "mechanism", "best_single"]
    crps_per_rule = {r: [] for r in rules}
    per_round = []
    # Per-agent CRPS history for the shared best_single_by_crps helper
    # (bugfix clause 1.11 / 2.11). Matches the bookkeeping in
    # run_real_data_comparison so both runners use the same selector.
    agent_rolling_crps: list[list[float]] = [[] for _ in range(n)]

    for t in range(warmup, T):
        y_t = float(norm[t])
        q_t = q_reports[:, t, :]

        # Per-agent CRPS at round t (feeds best_single_by_crps below)
        agent_crps_t = crps_hat_from_quantiles(y_t, q_t, taus)
        for i in range(n):
            agent_rolling_crps[i].append(float(agent_crps_t[i]))
            if len(agent_rolling_crps[i]) > 500:
                agent_rolling_crps[i] = agent_rolling_crps[i][-500:]

        agg_u = np.mean(q_t, axis=0)
        c_u = float(crps_hat_from_quantiles(y_t, agg_u.reshape(1, -1), taus)[0])
        crps_per_rule["uniform"].append(c_u)

        sigma_t = res["sigma_hist"][:, t]
        w_skill = sigma_t.copy()
        if w_skill.sum() > eps:
            agg_s = aggregate_forecast(q_t, w_skill, eps=eps)
            c_s = float(crps_hat_from_quantiles(y_t, agg_s.reshape(1, -1), taus)[0])
        else:
            c_s = c_u
        crps_per_rule["skill"].append(c_s)

        r_mech = np.asarray(res["r_hat_hist"][t], dtype=np.float64)
        c_m = float(crps_hat_from_quantiles(y_t, r_mech.reshape(1, -1), taus)[0]) if r_mech.size == len(taus) else c_u
        crps_per_rule["mechanism"].append(c_m)

        # Best single: shared helper (bugfix clause 1.11 / 2.11). The
        # legacy variance-of-point-error selector is deleted.
        if t - warmup >= 20:
            best_idx = best_single_by_crps(agent_rolling_crps, lookback=100)
        else:
            best_idx = 0
        c_best = float(crps_hat_from_quantiles(y_t, q_t[best_idx:best_idx+1], taus)[0])
        crps_per_rule["best_single"].append(c_best)

        per_round.append({
            "t": t, "y": y_t,
            "crps_uniform": c_u, "crps_skill": c_s,
            "crps_mechanism": c_m, "crps_best_single": c_best,
        })

    mean_u = float(np.mean(crps_per_rule["uniform"]))
    rows = []
    for rule in rules:
        mc = float(np.mean(crps_per_rule[rule]))
        rows.append({
            "experiment": label, "method": rule, "seed": 0,
            "DGP": label, "preset": "fixed_deposits",
            "mean_crps": mc, "delta_crps_vs_equal": mc - mean_u,
        })

    # Skill ranking
    final_sigma = res["sigma_hist"][:, -1]
    avg_sigma = np.mean(res["sigma_hist"][:, -1000:], axis=1) if T > 1000 else final_sigma

    # Fallback summary (bugfix clause 1.9 / 2.9 / 2.16). Surfaces each
    # forecaster's end-of-run fallback_counter so silent ML-training
    # failures do not pass through unnoticed.
    fallback_summary = {fc.name: int(fc.fallback_counter) for fc in forecasters}
    if strict_no_fallback:
        offenders = {k: v for k, v in fallback_summary.items() if v > 0}
        if offenders:
            raise ValueError(
                f"strict_no_fallback=True: non-zero fallback counters: {offenders}"
            )

    return {
        "config": {
            "T": T, "n_forecasters": n, "warmup": warmup,
            "horizon": horizon, "label": label,
            "forecasters": [fc.name for fc in forecasters],
            "normalize_mode": normalize_mode,
        },
        "rows": rows,
        "per_round": per_round,
        "skill_ranking": [
            {"model": forecasters[i].name, "final_sigma": float(final_sigma[i]),
             "avg_sigma": float(avg_sigma[i])}
            for i in range(n)
        ],
        "fallback_summary": fallback_summary,
        # Bugfix clause 1.15 / 2.15: mark this block as a within-run
        # slice even when _run_horizon_comparison is invoked directly
        # (not only through run_all_real_experiments). A true
        # restart-per-season variant is flagged as a follow-up.
        "within_run_seasonal_slice": True,
        "todo": "restart per season (follow-up spec)",
    }


def run_all_real_experiments(
    data_path: str,
    outdir: str = "outputs",
    *,
    gamma: float = 16.0,
    rho: float = 0.5,
    lam: float = 0.05,
) -> dict:
    """Run day-ahead, 4h-ahead, and regime-shift experiments.

    Mechanism parameters (``gamma``, ``rho``, ``lam``) default to the
    real-data tuned values from the held-out sensitivity sweep. Prior
    to the audit M3 fix, the horizon sub-experiments dropped these
    parameters on the floor and inherited ``run_simulation``'s
    synthetic-tuned defaults (γ=4, ρ=0.1, λ=0.3), which underweight
    the skill layer on real-data panels and so understate the
    mechanism's horizon-experiment improvement.
    """

    df = pd.read_csv(data_path)
    df["datetime"] = pd.to_datetime(df["datetime"], utc=True)
    df = df.set_index("datetime")

    taus = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    results = {}

    # === 1. Day-ahead (daily resolution, horizon=1 day) ===
    print("=== Experiment 1: Day-ahead ===")
    daily = df["measured"].resample("1D").mean().dropna().values
    print(f"  Daily series: {len(daily)} points")
    forecasters_daily = get_all_forecasters()
    # Bugfix clause 1.16 / 2.16: raise the day-ahead warmup to at least
    # max_required_history + 20 across the forecaster set (≥ 70 for
    # the current tree/NN models), so XGBoost and MLP are not silently
    # reduced to persistence for the first ~40 scored rounds.
    day_ahead_warmup = max(30, min_warmup_for(forecasters_daily))
    print(f"  Using warmup={day_ahead_warmup} (min_warmup_for bumped from legacy 30)")
    results["day_ahead"] = _run_horizon_comparison(
        daily, horizon=1, forecasters=forecasters_daily,
        warmup=day_ahead_warmup, taus=taus, label="day_ahead",
        gamma=gamma, rho=rho, lam=lam,
    )

    # === 2. 4h-ahead at 15-min resolution ===
    print("\n=== Experiment 2: 4h-ahead (15-min resolution) ===")
    raw_15min = df["measured"].dropna().values
    # Subsample to keep it manageable (every 4th point = hourly-ish)
    # Actually use full 15-min but horizon=16 (4 hours)
    # Limit to first 20k points to keep runtime reasonable
    series_15min = raw_15min[:20000]
    print(f"  15-min series: {len(series_15min)} points (horizon=16 = 4 hours)")
    forecasters_15min = get_all_forecasters()
    results["4h_ahead"] = _run_horizon_comparison(
        series_15min, horizon=16, forecasters=forecasters_15min,
        warmup=200, taus=taus, label="4h_ahead_15min",
        gamma=gamma, rho=rho, lam=lam,
    )

    # === 3. Regime-shift test (seasonal) ===
    print("\n=== Experiment 3: Regime-shift (seasonal) ===")
    hourly = df["measured"].resample("1h").mean().dropna()
    hourly_df = hourly.to_frame("value")
    hourly_df["month"] = hourly_df.index.month

    # Split into seasons
    {
        "winter": hourly_df[hourly_df["month"].isin([12, 1, 2])]["value"].values,
        "spring": hourly_df[hourly_df["month"].isin([3, 4, 5])]["value"].values,
        "summer": hourly_df[hourly_df["month"].isin([6, 7, 8])]["value"].values,
        "autumn": hourly_df[hourly_df["month"].isin([9, 10, 11])]["value"].values,
    }

    # Run on full series but track per-season performance
    full_hourly = hourly.values
    # Causal normalization for per-season indexing only. The actual
    # normalization used by forecasters is re-applied inside
    # _run_horizon_comparison with warmup=200 (bugfix clause 1.1 / 2.1).
    norm_full, _, _ = causal_normalize(full_hourly, warmup_len=200)

    # Get month for each hourly point
    months = hourly.index.month.values

    forecasters_regime = get_all_forecasters()
    full_result = _run_horizon_comparison(
        full_hourly, horizon=1, forecasters=forecasters_regime,
        warmup=200, taus=taus, label="regime_shift",
        gamma=gamma, rho=rho, lam=lam,
    )

    # Compute per-season CRPS from per_round data
    season_map = {12: "winter", 1: "winter", 2: "winter",
                  3: "spring", 4: "spring", 5: "spring",
                  6: "summer", 7: "summer", 8: "summer",
                  9: "autumn", 10: "autumn", 11: "autumn"}

    season_crps = {s: {"uniform": [], "mechanism": [], "skill": []} for s in ["winter", "spring", "summer", "autumn"]}
    for pr in full_result["per_round"]:
        t = pr["t"]
        if t < len(months):
            season = season_map.get(int(months[t]), "unknown")
            if season in season_crps:
                season_crps[season]["uniform"].append(pr["crps_uniform"])
                season_crps[season]["mechanism"].append(pr["crps_mechanism"])
                season_crps[season]["skill"].append(pr["crps_skill"])

    regime_summary = {}
    for season, data in season_crps.items():
        if data["uniform"]:
            mu = np.mean(data["uniform"])
            mm = np.mean(data["mechanism"])
            ms = np.mean(data["skill"])
            regime_summary[season] = {
                "n_rounds": len(data["uniform"]),
                "uniform": float(mu),
                "mechanism": float(mm),
                "skill": float(ms),
                "delta_mechanism": float(mm - mu),
                "pct_mechanism": float(-(mm - mu) / mu * 100) if mu > 1e-12 else 0,
                "delta_skill": float(ms - mu),
                "pct_skill": float(-(ms - mu) / mu * 100) if mu > 1e-12 else 0,
            }

    results["regime_shift"] = {
        **full_result,
        "regime_summary": regime_summary,
        # Bugfix clause 1.15 / 2.15: this block is a per-month-bucketed
        # slice of a SINGLE online run. Seasons interleave across the
        # 2024-2025 window and the mechanism's skill state is not
        # reinitialised between them, so the per-season CRPS reflects
        # mid-run adaptation rather than regime-shift robustness. A
        # true restart-per-season evaluation is flagged as a follow-up.
        "within_run_seasonal_slice": True,
        "todo": "restart per season (follow-up spec)",
    }

    # Save all results
    out_path = os.path.join(outdir, "real_data", "elia_wind", "data")
    os.makedirs(out_path, exist_ok=True)

    for key, res in results.items():
        with open(os.path.join(out_path, f"{key}.json"), "w") as f:
            json.dump(res, f, indent=2)
        print(f"\n  Saved {key}.json")

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for key, res in results.items():
        print(f"\n{key}:")
        for r in res["rows"]:
            d = r["delta_crps_vs_equal"]
            mu = res["rows"][0]["mean_crps"]
            pct = -d / mu * 100 if mu > 1e-12 else 0
            print(f"  {r['method']:15s}: CRPS={r['mean_crps']:.6f} Δ={d:+.6f} ({pct:+.1f}%)")

    if "regime_shift" in results and "regime_summary" in results["regime_shift"]:
        print("\nRegime shift (per-season mechanism improvement):")
        for season, data in results["regime_shift"]["regime_summary"].items():
            print(f"  {season:8s}: {data['n_rounds']:5d} rounds, mechanism {data['pct_mechanism']:+.1f}%, skill {data['pct_skill']:+.1f}%")

    return results


def _cli_main() -> None:
    """Thin CLI entrypoint for regenerating horizon experiments.

    Runs ``run_all_real_experiments`` on the Elia offshore wind dataset
    (the hard-coded series in ``run_all_real_experiments``) and writes
    the output JSONs under ``<outdir>/real_data/elia_wind/data/``.

    This is the missing command referenced by the
    ``model-training-testing-audit`` spec (Task 14.1). It exists so the
    day-ahead / 4h-ahead / regime-shift blocks get regenerated under the
    post-fix pipeline (causal normalization, horizon residual rewrite,
    warmup floor, rename of within-run slices).

    Usage::

        onlinev2/.venv/bin/python -m onlinev2.real_data.experiments
        onlinev2/.venv/bin/python -m onlinev2.real_data.experiments \
            --data data/elia_offshore_wind_2024_2025.csv \
            --outdir dashboard/public/data
    """
    import argparse

    parser = argparse.ArgumentParser(
        description=(
            "Run day-ahead / 4h-ahead / regime-shift horizon experiments "
            "on the Elia offshore wind series."
        )
    )
    parser.add_argument(
        "--data",
        type=str,
        default=os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "..",
            "data", "elia_offshore_wind_2024_2025.csv",
        ),
        help="Path to the Elia wind CSV.",
    )
    parser.add_argument(
        "--outdir",
        type=str,
        default=os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "..",
            "dashboard", "public", "data",
        ),
        help="Output root; JSONs land under <outdir>/real_data/elia_wind/data/.",
    )
    args = parser.parse_args()
    run_all_real_experiments(args.data, outdir=args.outdir)


if __name__ == "__main__":
    _cli_main()


# ---------------------------------------------------------------------------
# Restart-per-season regime-shift evaluation (follow-up for task 11.8).
# ---------------------------------------------------------------------------
#
# The regime_shift block produced by run_all_real_experiments is a
# single online pass over the 2024-2025 hourly series with per-month
# bucketing (the `within_run_seasonal_slice: true` flag makes this
# explicit). A stronger test reinitialises forecaster state and
# mechanism state at each seasonal boundary so each evaluation is a
# true out-of-regime test.
#
# This function is the scaffolding for that evaluation. It is not
# wired into run_all_real_experiments because the full-series run
# takes O(hours) per dataset; to activate it, call directly:
#
#   onlinev2/.venv/bin/python -c "
#   from onlinev2.real_data.experiments import run_regime_shift_restart_per_season
#   import pandas as pd, numpy as np
#   df = pd.read_csv('data/elia_offshore_wind_2024_2025.csv')
#   df['datetime'] = pd.to_datetime(df['datetime'], utc=True)
#   df = df.set_index('datetime')
#   hourly = df['measured'].resample('1h').mean().dropna()
#   out = run_regime_shift_restart_per_season(hourly)
#   "
# or replace the results['regime_shift'] assembly inside
# run_all_real_experiments with a call to this function.


def run_regime_shift_restart_per_season(
    hourly: "pd.Series",
    horizon: int = 1,
    warmup: int = 200,
    taus: np.ndarray | None = None,
    seed: int = 42,
    strict_no_fallback: bool = False,
    normalize_mode: str = "static",
    min_season_len: int = 400,
    *,
    gamma: float = 16.0,
    rho: float = 0.5,
    lam: float = 0.05,
) -> dict:
    """Run per-season horizon comparisons with fresh forecaster / mechanism
    state at each seasonal boundary.

    Each season (winter / spring / summer / autumn) is extracted as a
    contiguous slice of the hourly series, then ``_run_horizon_comparison``
    is invoked on that slice with a fresh ``get_all_forecasters()`` panel
    so no forecaster carries residual bootstrap history across seasons.

    Parameters
    ----------
    hourly : pd.Series
        DatetimeIndex'd hourly wind series (``measured`` column from
        Elia). Must be monotonically increasing in time.
    horizon : int
        Forecast horizon in rounds, forwarded to
        ``_run_horizon_comparison``. Default 1 (1-hour-ahead).
    warmup : int
        Warmup length per season, forwarded to
        ``_run_horizon_comparison``. Must be strictly less than
        ``min_season_len``.
    taus : np.ndarray, optional
        Quantile grid. Defaults to 9-level equidistant.
    seed, strict_no_fallback, normalize_mode :
        Forwarded to ``_run_horizon_comparison``.
    min_season_len : int
        Skip any season slice shorter than this. Default 400 rounds.

    Returns
    -------
    dict with the shape::

        {
            "restart_per_season": True,
            "horizon": <int>,
            "warmup": <int>,
            "per_season": {
                "winter": {<_run_horizon_comparison result>},
                "spring": {...},
                "summer": {...},
                "autumn": {...},
            },
            "season_summary": {
                "winter": {"n_rounds": ..., "uniform": ...,
                           "mechanism": ..., "skill": ...,
                           "pct_mechanism": ..., "pct_skill": ...},
                ...
            },
        }

    Missing or too-short seasons are listed under ``"skipped_seasons"``.

    Examples
    --------
    On a synthetic panel the scaffolding runs end-to-end in seconds;
    see ``onlinev2/tests/test_regime_shift_restart_per_season.py``.
    The full Elia wind series (T ≈ 17000) with 4 seasons takes roughly
    an hour on a laptop; the existing ``within_run_seasonal_slice``
    block is retained as the default in ``run_all_real_experiments``.
    """
    if taus is None:
        taus = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    if warmup >= min_season_len:
        raise ValueError(
            f"warmup={warmup} must be strictly less than "
            f"min_season_len={min_season_len}."
        )

    months = hourly.index.month
    season_map = {
        12: "winter", 1: "winter", 2: "winter",
        3: "spring", 4: "spring", 5: "spring",
        6: "summer", 7: "summer", 8: "summer",
        9: "autumn", 10: "autumn", 11: "autumn",
    }
    season_order = ["winter", "spring", "summer", "autumn"]

    # Build a per-season boolean mask.
    seasons: dict[str, np.ndarray] = {
        s: np.array([season_map.get(int(m), None) == s for m in months], dtype=bool)
        for s in season_order
    }

    per_season: dict[str, dict] = {}
    season_summary: dict[str, dict] = {}
    skipped: list[dict] = []

    values = hourly.values.astype(np.float64)

    for season in season_order:
        mask = seasons[season]
        n_rounds = int(mask.sum())
        if n_rounds < min_season_len:
            skipped.append(
                {"season": season, "n_rounds": n_rounds,
                 "reason": f"fewer than min_season_len={min_season_len} rounds"}
            )
            continue
        series_s = values[mask]
        forecasters_s = get_all_forecasters()
        print(f"  [restart_per_season] {season}: {n_rounds} rounds")
        result_s = _run_horizon_comparison(
            series_s,
            horizon=horizon,
            forecasters=forecasters_s,
            warmup=warmup,
            taus=taus,
            label=f"regime_shift_restart_{season}",
            seed=seed,
            strict_no_fallback=strict_no_fallback,
            normalize_mode=normalize_mode,
            gamma=gamma,
            rho=rho,
            lam=lam,
        )
        per_season[season] = result_s

        rows = {r["method"]: r["mean_crps"] for r in result_s.get("rows", [])}
        mu = rows.get("uniform", float("nan"))
        mm = rows.get("mechanism", float("nan"))
        ms = rows.get("skill", float("nan"))
        pct_mech = (
            float(-(mm - mu) / mu * 100) if mu and mu > 1e-12 else 0.0
        )
        pct_skill = (
            float(-(ms - mu) / mu * 100) if mu and mu > 1e-12 else 0.0
        )
        season_summary[season] = {
            "n_rounds": n_rounds,
            "uniform": float(mu),
            "mechanism": float(mm),
            "skill": float(ms),
            "delta_mechanism": float(mm - mu),
            "pct_mechanism": pct_mech,
            "delta_skill": float(ms - mu),
            "pct_skill": pct_skill,
        }

    return {
        "restart_per_season": True,
        "horizon": int(horizon),
        "warmup": int(warmup),
        "min_season_len": int(min_season_len),
        "per_season": per_season,
        "season_summary": season_summary,
        "skipped_seasons": skipped,
    }
