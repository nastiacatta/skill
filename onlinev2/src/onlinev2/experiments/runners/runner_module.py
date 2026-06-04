"""
Experiments for the online wagering mechanism.

NO DOTTED LINES: solid/dashed only; dotted patterns render as pixel noise at print scale.

Each experiment runs simulations, saves data/plots under outputs/<block>/experiments/<name>/.
Run from this directory with package installed: python experiments.py --exp <name>
or: run-onlinev2-experiments --exp <name>
"""
import json

import numpy as np
from scipy import stats as scipy_stats

from onlinev2.experiments.benchmark_config import get_experiment_config
from onlinev2.experiments.helpers import (
    cummean as _cummean,
)
from onlinev2.experiments.helpers import (
    ewma_smooth as _ewma_smooth,
)
from onlinev2.experiments.helpers import (
    exp_paths as _exp_paths,
)
from onlinev2.experiments.helpers import (
    rolling_mean as _rolling_mean,
)
from onlinev2.experiments.helpers import (
    se as _se,
)
from onlinev2.experiments.helpers import (
    write_csv as _write_csv,
)
from onlinev2.legacy_dgps import (
    generate_truth_and_quantile_reports_latent,
    generate_truth_and_reports_latent,
)
from onlinev2.mechanism.aggregation import aggregate_forecast
from onlinev2.mechanism.metrics import compute_gini, compute_hhi, compute_n_eff
from onlinev2.mechanism.scoring import crps_hat_from_quantiles
from onlinev2.mechanism.settlement import profit, raja_competitive_payout
from onlinev2.plotting.style import (
    COLORS,
    agent_color,
    apply_style,
    new_figure,
    save_fig,
)
from onlinev2.simulation import run_all_tests, run_simulation

# Set headless backend once at import time
apply_style()

# Lazy imports for optional integrations — used at call sites via try/except
# from onlinev2.plotting.four_panel import plot_four_panel
# from onlinev2.experiments.summarise import write_experiment_summary
# from onlinev2.experiments.helpers import write_standardised_output


def _mean_se_ci(values) -> dict:
    """Compute mean, SE, 95% CI for a 1D array (returns zeros on empty input).

    Used by multi-seed adversary experiments to summarise point estimates
    across independent runs. SE uses ddof=1; CI uses the 1.96 * SE Normal
    approximation, which is appropriate when n_seeds >= 20 (the project
    convention).
    """
    arr = np.asarray(values, dtype=float).ravel()
    if arr.size == 0:
        return {"mean": 0.0, "se": 0.0, "ci_low": 0.0, "ci_high": 0.0, "n": 0}
    mean = float(np.mean(arr))
    if arr.size > 1:
        se = float(np.std(arr, ddof=1) / np.sqrt(arr.size))
    else:
        se = 0.0
    return {
        "mean": mean,
        "se": se,
        "ci_low": mean - 1.96 * se,
        "ci_high": mean + 1.96 * se,
        "n": int(arr.size),
    }


# ===================================================================
# A) Settlement sanity
# ===================================================================

def run_settlement_sanity(n_rounds=1000, n_agents=20, seed=42, outdir="outputs",
                          block="core", n_equal_scores_rounds=50, tol=1e-9, seeds=None):
    """Random wagers and scores — verify budget balance, non-negativity, equal-score zero profit."""
    cfg = get_experiment_config("settlement_sanity")
    if seeds is None:
        seeds = cfg.seeds
    n_rounds = max(n_rounds, cfg.T)
    ep = _exp_paths(outdir, "settlement_sanity", block)
    rng = np.random.default_rng(seed)

    profits_all, roi_all, budget_gaps, min_payouts = [], [], [], []

    for _ in range(n_rounds):
        n = int(rng.integers(3, n_agents + 1))
        m = rng.uniform(0.0, 10.0, size=n).astype(np.float64)
        s = rng.uniform(0.0, 1.0, size=n).astype(np.float64)
        alpha = rng.integers(0, 2, size=n).astype(np.int32)
        m[alpha == 1] = 0.0
        s[alpha == 1] = 0.0

        pay = raja_competitive_payout(s, m, alpha=alpha)
        prof = profit(pay, m)
        M = float(np.sum(m))

        if M > 1e-12:
            budget_gaps.append(float(np.sum(pay) - M))
            active = (alpha == 0) & (m > 1e-12)
            if np.any(active):
                roi_all.extend((prof[active] / m[active]).tolist())
                profits_all.extend(prof[alpha == 0].tolist())
                min_payouts.append(float(np.min(pay[active])))
            else:
                profits_all.extend(prof[alpha == 0].tolist())
                min_payouts.append(np.nan)

    # Equal-scores sub-test
    eq_max = 0.0
    for _ in range(n_equal_scores_rounds):
        n = int(rng.integers(3, n_agents + 1))
        m = rng.uniform(0.0, 10.0, size=n).astype(np.float64)
        alpha = rng.integers(0, 2, size=n).astype(np.int32)
        m[alpha == 1] = 0.0
        s = np.full(n, 0.5); s[alpha == 1] = 0.0
        pay = raja_competitive_payout(s, m, alpha=alpha)
        prof = profit(pay, m)
        active = (alpha == 0) & (m > 1e-12)
        if np.any(active):
            eq_max = max(eq_max, float(np.max(np.abs(prof[active]))))
    eq_ok = eq_max < tol

    profits_all = np.asarray(profits_all) if profits_all else np.zeros(1)
    roi_all = np.asarray(roi_all) if roi_all else np.zeros(1)
    budget_gaps = np.asarray(budget_gaps) if budget_gaps else np.zeros(1)
    min_payouts = np.asarray(min_payouts) if min_payouts else np.zeros(1)

    # --- Data ---
    with open(ep.data("series.csv"), "w") as f:
        f.write("round,budget_gap,min_payout_active\n")
        for t in range(len(budget_gaps)):
            mp = min_payouts[t] if t < len(min_payouts) else np.nan
            f.write(f"{t},{float(budget_gaps[t])},{'' if not np.isfinite(mp) else float(mp)}\n")

    with open(ep.data("hist.csv"), "w") as f:
        f.write("series,value\n")
        for v in profits_all: f.write(f"profit,{float(v)}\n")
        for v in roi_all: f.write(f"roi,{float(v)}\n")
        for v in budget_gaps: f.write(f"budget_gap,{float(v)}\n")

    with open(ep.data("summary.csv"), "w") as f:
        f.write("metric,value\n")
        f.write(f"n_rounds,{n_rounds}\n")
        f.write(f"mean_profit,{float(np.mean(profits_all))}\n")
        f.write(f"std_profit,{float(np.std(profits_all))}\n")
        f.write(f"mean_roi,{float(np.mean(roi_all))}\n")
        f.write(f"max_abs_budget_gap,{float(np.max(np.abs(budget_gaps)))}\n")
        f.write(f"equal_scores_ok,{int(eq_ok)}\n")

    # --- Plot ---
    try:
        pass
    except Exception:
        return

    max_bg = float(np.max(np.abs(budget_gaps)))
    min_mp = float(np.nanmin(min_payouts)) if np.any(np.isfinite(min_payouts)) else 0.0

    fig, axes = new_figure(2, 2, figsize=(13, 9))

    # Profit histogram
    ax = axes[0, 0]
    ax.hist(profits_all, bins=50, color=COLORS["blue"], alpha=0.75, edgecolor="white", linewidth=0.3)
    ax.axvline(0, color=COLORS["truth"], ls="-", lw=0.8)
    ax.set(xlabel="Profit", ylabel="Count",
           title=f"Profit distribution (mean = {float(np.mean(profits_all)):.4f})")

    # ROI histogram
    ax = axes[0, 1]
    ax.hist(roi_all, bins=50, color=COLORS["orange"], alpha=0.75, edgecolor="white", linewidth=0.3)
    ax.axvline(0, color=COLORS["truth"], ls="-", lw=0.8)
    ax.set(xlabel="ROI (profit / wager)", ylabel="Count",
           title=f"ROI distribution (mean = {float(np.mean(roi_all)):.4f})")

    # Min payout (rolling smoothed)
    ax = axes[1, 0]
    valid_idx = np.where(np.isfinite(min_payouts))[0]
    if valid_idx.size > 20:
        w = max(10, len(valid_idx) // 20)
        mp_smooth = np.convolve(min_payouts[valid_idx], np.ones(w) / w, mode="valid")
        ax.plot(valid_idx[:len(mp_smooth)], mp_smooth, color=COLORS["green"], linewidth=1.2)
        ax.fill_between(valid_idx[:len(mp_smooth)], 0, mp_smooth,
                         alpha=0.15, color=COLORS["green"])
    elif valid_idx.size:
        ax.plot(valid_idx, min_payouts[valid_idx], color=COLORS["green"], linewidth=0.8)
    ax.axhline(0, color=COLORS["reference"], ls="-", lw=0.8)
    ax.set(xlabel="Round", ylabel="Min payout (active agents)",
           title=f"Min active payout (smoothed) — all $\\geq 0$: {min_mp >= -1e-10}")

    # Summary panel
    ax = axes[1, 1]
    ax.axis("off")
    checks = [
        ("Budget balance", f"max |gap| = {max_bg:.1e}", max_bg < 1e-8),
        ("Non-negativity", f"min payout = {min_mp:.4f}", min_mp >= -1e-10),
        ("Equal-score → 0 profit", f"max |profit| = {eq_max:.1e}", eq_ok),
        ("Skill-pool ROI in [-1, 1]", f"range = [{float(np.min(roi_all)):.3f}, {float(np.max(roi_all)):.3f}]",
         float(np.min(roi_all)) >= -1.01 and float(np.max(roi_all)) <= 1.01),
    ]
    y_pos = 0.85
    for label, detail, ok in checks:
        color = COLORS["green"] if ok else COLORS["red"]
        ax.text(0.05, y_pos, f"{'●' if ok else '✗'}  {label}", transform=ax.transAxes,
                fontsize=12, fontweight="bold", color=color)
        ax.text(0.08, y_pos - 0.07, detail, transform=ax.transAxes,
                fontsize=9, color=COLORS["slate"])
        y_pos -= 0.22
    ax.set_title(f"Invariant checks ({n_rounds} rounds)", fontsize=12)

    fig.suptitle("Settlement Sanity Checks", fontsize=15, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("settlement_sanity.png"))


# ===================================================================
# B) Skill-to-wager under intermittency
# ===================================================================

def run_skill_wager_intermittency(T=200, n_forecasters=6, missing_prob=0.3, seed=17,
                                  outdir="outputs", block="core", scoring_mode="quantiles_crps",
                                  gamma=10.0, rho=0.2, seeds=None):
    """How skill and wager evolve with intermittent participation."""
    cfg = get_experiment_config("skill_wager")
    if seeds is None:
        seeds = cfg.seeds
    T = max(T, cfg.T)
    ep = _exp_paths(outdir, "skill_wager", block)
    res = run_simulation(T=T, n_forecasters=n_forecasters, missing_prob=missing_prob,
                         seed=seed, scoring_mode=scoring_mode, gamma=gamma, rho=rho,
                         store_history=True)
    res["params"]["lam"]
    sigma_min = res["params"]["sigma_min"]
    n_show = min(3, n_forecasters)

    # --- Data ---
    with open(ep.data("timeseries.csv"), "w") as f:
        f.write("agent,t,wager,sigma,m_over_b,profit,cum_profit,missing\n")
        for i in range(n_show):
            b = res["deposits_hist"][i]
            m = res["wager_hist"][i]
            safe_b = np.where(b > 1e-12, b, 1.0)
            mob = np.where(b > 1e-12, m / safe_b, np.nan)
            pi = res["profit_hist"][i]
            cum_pi = np.nancumsum(pi)
            for t in range(T):
                f.write(f"{i},{t},{float(m[t])},{float(res['sigma_hist'][i, t])},"
                        f"{float(mob[t]) if np.isfinite(mob[t]) else ''},"
                        f"{float(pi[t])},{float(cum_pi[t])},{int(res['alpha_hist'][i, t])}\n")

    with open(ep.data("summary.csv"), "w") as f:
        f.write("agent,mean_sigma,mean_wager,total_profit\n")
        for i in range(n_forecasters):
            f.write(f"{i},{float(np.mean(res['sigma_hist'][i]))},"
                    f"{float(np.mean(res['wager_hist'][i]))},"
                    f"{float(res['profit_total'][i])}\n")

    # --- Plot: one combined figure ---
    try:
        pass
    except Exception:
        return res

    fig, axes = new_figure(n_show, 3, figsize=(16, 3.5 * n_show + 1))
    if n_show == 1:
        axes = axes[np.newaxis, :]

    for row, i in enumerate(range(n_show)):
        color = agent_color(i)
        sigma = res["sigma_hist"][i]
        wager = res["wager_hist"][i]
        miss = res["alpha_hist"][i] == 1

        # Mark missing rounds with subtle tick marks at top
        miss_idx = np.where(miss)[0]

        # Sigma
        ax = axes[row, 0]
        ax.plot(sigma, color=color, linewidth=1.2)
        for mi in miss_idx:
            ax.axvline(mi, color="#E2E8F0", linewidth=0.3, zorder=0)
        ax.set(ylabel=f"Skill $\\sigma_{{{i}}}$", ylim=(sigma_min - 0.05, 1.05))
        if row == 0: ax.set_title("Learned skill $\\sigma_i(t)$")
        if row == n_show - 1: ax.set_xlabel("Round $t$")

        # Effective wager (smoothed)
        ax = axes[row, 1]
        ax.fill_between(range(T), 0, wager, alpha=0.15, color=color)
        ax.plot(_ewma_smooth(wager), color=color, linewidth=1.2, label="smoothed")
        ax.set(ylabel=f"Wager $m_{{{i}}}$")
        if row == 0: ax.set_title("Effective wager $m_i(t)$ (EWMA smoothed)")
        if row == n_show - 1: ax.set_xlabel("Round $t$")

        # Cumulative profit
        ax = axes[row, 2]
        cum_pi = np.cumsum(res["profit_hist"][i])
        ax.plot(cum_pi, color=color, linewidth=1.2)
        ax.axhline(0, color=COLORS["reference"], ls="-", lw=0.5)
        if row == 0:
            ax.set_title("Cumulative profit")
            # Add a tiny legend for missing markers
            ax.plot([], [], color="#E2E8F0", linewidth=3, label="missing round")
            ax.legend(fontsize=7, loc="upper left")
        ax.set(ylabel=f"Cum. profit F{i}")
        if row == n_show - 1: ax.set_xlabel("Round $t$")

    fig.suptitle(f"Skill & Wager Under Intermittency (missing prob = {missing_prob})",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("skill_wager.png"))
    return res


# ===================================================================
# C) Forecast aggregation performance
# ===================================================================

def run_forecast_aggregation(T=20000, n_forecasters=10, missing_prob=0.2, seed=7,
                             outdir="outputs", block="core", rolling_window=30,
                             seeds=None, dgp_name="latent_fixed", warm_start=200):
    """Headline experiment: compare five weighting methods under latent-fixed DGP.

    Uses heterogeneous tau_i from get_experiment_config("forecast_aggregation").
    Runs ≥20 seeds. Reports paired Δ CRPS, Δ Gini, Δ HHI, Δ N_eff vs equal weights.
    Writes crps_summary.csv and summary.json.
    """
    cfg = get_experiment_config("forecast_aggregation")
    if seeds is None:
        seeds = cfg.seeds
    T = max(T, cfg.T)
    n_forecasters = cfg.n_forecasters

    ep = _exp_paths(outdir, "forecast_aggregation", block)

    tau_i = cfg.tau_i()
    taus = cfg.taus()

    methods = {
        "equal": dict(deposit_mode="fixed", fixed_deposit=1.0, lam=0.3),
        "stake_only": dict(deposit_mode="bankroll", eta=2.0, W0=10.0, lam=1.0,
                           f_stake=0.3, b_max=10.0, beta_c=1.0, c_min=0.8, c_max=1.3, omega_max=0.25),
        "skill_only": dict(deposit_mode="fixed", fixed_deposit=1.0, lam=0.0),
        "blended": dict(deposit_mode="fixed", fixed_deposit=1.0, lam=0.3),
        "bankroll": dict(deposit_mode="bankroll", eta=2.0, W0=10.0, lam=0.05,
                         f_stake=0.3, b_max=10.0, beta_c=1.0, c_min=0.8, c_max=1.3, omega_max=0.25),
    }

    all_rows = []
    for s in seeds:
        y, q_reports_pre, _ = generate_truth_and_quantile_reports_latent(
            T, n_forecasters, tau_i, taus, seed=s, sigma_z=cfg.sigma_z,
        )

        seed_crps = {}
        seed_metrics = {}
        for method_name, method_kw in methods.items():
            res = run_simulation(
                T=T, n_forecasters=n_forecasters, missing_prob=missing_prob,
                seed=s, scoring_mode="quantiles_crps", taus=taus,
                y_pre=y, q_reports_pre=q_reports_pre, forecaster_noise_pre=tau_i,
                store_history=True, **method_kw,
            )
            crps = _crps_for_weight_rules(y, q_reports_pre, taus, res, tau_i)
            metrics = _headline_metrics_from_run(res, crps, warm_start=warm_start)
            seed_crps[method_name] = metrics.get("mean_crps_mechanism", np.nan)
            seed_metrics[method_name] = metrics

        equal_crps = seed_crps.get("equal", np.nan)
        equal_gini = seed_metrics.get("equal", {}).get("final_gini", np.nan)
        equal_hhi = seed_metrics.get("equal", {}).get("mean_HHI", np.nan)
        equal_n_eff = seed_metrics.get("equal", {}).get("mean_N_eff", np.nan)

        for method_name in methods:
            m = seed_metrics[method_name]
            all_rows.append({
                "method": method_name,
                "seed": s,
                "mean_crps": seed_crps[method_name],
                "delta_crps_vs_equal": seed_crps[method_name] - equal_crps,
                "delta_gini_vs_equal": (m.get("final_gini", np.nan) or np.nan) - (equal_gini or np.nan),
                "delta_hhi_vs_equal": (m.get("mean_HHI", np.nan) or np.nan) - (equal_hhi or np.nan),
                "delta_n_eff_vs_equal": (m.get("mean_N_eff", np.nan) or np.nan) - (equal_n_eff or np.nan),
                "mean_HHI": m.get("mean_HHI", np.nan),
                "mean_N_eff": m.get("mean_N_eff", np.nan),
                "final_gini": m.get("final_gini", np.nan),
            })

    # --- Write crps_summary.csv ---
    cols = ["method", "seed", "mean_crps", "delta_crps_vs_equal",
            "delta_gini_vs_equal", "delta_hhi_vs_equal", "delta_n_eff_vs_equal",
            "mean_HHI", "mean_N_eff", "final_gini"]
    _write_csv(ep.data("crps_summary.csv"), cols, all_rows)

    # --- Aggregate across seeds for summary.json ---
    summary = {"experiment_name": "forecast_aggregation",
               "config": {"T": T, "n_forecasters": n_forecasters, "n_seeds": len(seeds),
                           "dgp_name": dgp_name, "warm_start": warm_start},
               "methods": {}}
    for method_name in methods:
        method_rows = [r for r in all_rows if r["method"] == method_name]
        deltas = np.array([r["delta_crps_vs_equal"] for r in method_rows])
        deltas = deltas[np.isfinite(deltas)]
        crps_vals = np.array([r["mean_crps"] for r in method_rows])
        crps_vals = crps_vals[np.isfinite(crps_vals)]
        if deltas.size > 0:
            mean_d = float(np.mean(deltas))
            se_d = float(np.std(deltas, ddof=1) / np.sqrt(deltas.size)) if deltas.size > 1 else 0.0
            summary["methods"][method_name] = {
                "mean_crps": float(np.mean(crps_vals)) if crps_vals.size else None,
                "delta_crps_mean": mean_d,
                "delta_crps_se": se_d,
                "delta_crps_ci_low": mean_d - 1.96 * se_d,
                "delta_crps_ci_high": mean_d + 1.96 * se_d,
                "n_seeds": int(deltas.size),
            }

    with open(ep.data("summary.json"), "w") as f:
        json.dump(summary, f, indent=2, default=str)

    print("\nForecast Aggregation (latent-fixed DGP, multi-seed)")
    print("=" * 60)
    for method_name, info in summary.get("methods", {}).items():
        print(f"  {method_name:14s}: CRPS={info.get('mean_crps', 'N/A'):.5f}, "
              f"Δ={info.get('delta_crps_mean', 0):.5f} "
              f"[{info.get('delta_crps_ci_low', 0):.5f}, {info.get('delta_crps_ci_high', 0):.5f}]")

    # --- Plot ---
    try:
        pass
    except Exception:
        return

    fig, ax = new_figure(1, 1, figsize=(10, 6))
    method_names = list(summary.get("methods", {}).keys())
    means = [summary["methods"][m]["delta_crps_mean"] for m in method_names]
    ci_lows = [summary["methods"][m]["delta_crps_ci_low"] for m in method_names]
    ci_highs = [summary["methods"][m]["delta_crps_ci_high"] for m in method_names]
    yerr_low = [m - cl for m, cl in zip(means, ci_lows)]
    yerr_high = [ch - m for m, ch in zip(means, ci_highs)]

    colors = [COLORS.get(c, COLORS["blue"]) for c in ["blue", "green", "orange", "pink", "purple"]]
    x_pos = np.arange(len(method_names))
    ax.bar(x_pos, means, color=colors[:len(method_names)], alpha=0.8, edgecolor="white")
    ax.errorbar(x_pos, means, yerr=[yerr_low, yerr_high], fmt="none",
                color=COLORS["truth"], capsize=5)
    ax.axhline(0, color=COLORS["reference"], ls="-", lw=0.8)
    ax.set_xticks(x_pos)
    ax.set_xticklabels(method_names, rotation=15)
    ax.set(xlabel="Weighting method", ylabel="Δ CRPS vs equal (negative = better)",
           title=f"Paired Δ CRPS ({len(seeds)} seeds, T={T})")
    fig.tight_layout()
    save_fig(fig, ep.plot("forecast_aggregation.png"))

    # --- Standardised output (Task 20.2) ---
    try:
        from onlinev2.experiments.helpers import write_standardised_output
        write_standardised_output(ep, all_rows, {
            "experiment_name": "forecast_aggregation",
            "T": T, "n_forecasters": n_forecasters, "n_seeds": len(seeds),
            "dgp_name": dgp_name, "warm_start": warm_start,
        })
    except Exception:
        pass  # standardised output is optional

    # --- Experiment summary (Task 19.2) ---
    try:
        from onlinev2.experiments.summarise import write_experiment_summary
        write_experiment_summary(ep, {
            "experiment_name": "forecast_aggregation",
            "dgp_name": dgp_name, "T": T, "n_forecasters": n_forecasters,
            "n_seeds": len(seeds), "scoring_mode": "quantiles_crps",
        }, {k: v for k, v in summary.get("methods", {}).get("blended", {}).items()
           if isinstance(v, (int, float))})
    except Exception:
        pass  # summary is optional

    # --- Four-panel diagnostic plot (Task 17.2) ---
    try:
        from onlinev2.plotting.four_panel import plot_four_panel
        four_panel_results = {
            "experiment_name": "forecast_aggregation",
            "methods": {m: {
                "delta_crps_mean": info.get("delta_crps_mean", 0.0),
                "delta_crps_se": info.get("delta_crps_se", 0.0),
            } for m, info in summary.get("methods", {}).items()},
            "failure_notes": [],
        }
        plot_four_panel(four_panel_results, ep.plot("four_panel.png"))
    except Exception:
        pass  # plotting is optional


# ===================================================================
# D) Calibration diagnostics
# ===================================================================

def run_calibration_diagnostics(T=20000, n_forecasters=10, missing_prob=0.2, seed=7,
                                outdir="outputs", block="core", seeds=None):
    """Quantile reliability curve: empirical coverage p_hat(tau) vs nominal tau.

    Uses latent-fixed DGP with multi-seed support (≥20 seeds).
    Computes mean, SE, and 95% CI for each coverage estimate across seeds.
    """
    cfg = get_experiment_config("calibration")
    if seeds is None:
        seeds = cfg.seeds
    T = max(T, cfg.T)
    n_forecasters = cfg.n_forecasters

    ep = _exp_paths(outdir, "calibration", block)
    tau_i = cfg.tau_i()
    taus = cfg.taus()

    # Per-seed coverage computation
    all_p_hat = []  # list of dicts, one per seed
    for s in seeds:
        y, q_reports_pre, _ = generate_truth_and_quantile_reports_latent(
            T, n_forecasters, tau_i, taus, seed=s, sigma_z=cfg.sigma_z,
        )
        res = run_simulation(
            T=T, n_forecasters=n_forecasters, missing_prob=missing_prob,
            seed=s, scoring_mode="quantiles_crps", taus=taus,
            y_pre=y, q_reports_pre=q_reports_pre, forecaster_noise_pre=tau_i,
            store_history=True,
        )
        y_sim = res["y"]
        valid = np.sum(res["wager_hist"], axis=0) > 1e-12

        seed_p_hat = {}
        for k, tau in enumerate(taus):
            q_hat = np.array([float(np.asarray(res["r_hat_hist"][t])[k])
                              for t in range(len(y_sim)) if valid[t]])
            seed_p_hat[float(tau)] = float(np.mean(y_sim[valid] <= q_hat)) if q_hat.size else float("nan")
        all_p_hat.append(seed_p_hat)

    # Aggregate across seeds: mean, SE, 95% CI
    n_seeds = len(seeds)
    rows = []
    for tau in taus:
        tau_f = float(tau)
        vals = np.array([sp[tau_f] for sp in all_p_hat])
        vals = vals[np.isfinite(vals)]
        if vals.size > 0:
            mean_p = float(np.mean(vals))
            se_p = float(np.std(vals, ddof=1) / np.sqrt(vals.size)) if vals.size > 1 else 0.0
            ci_low = mean_p - 1.96 * se_p
            ci_high = mean_p + 1.96 * se_p
        else:
            mean_p, se_p, ci_low, ci_high = np.nan, np.nan, np.nan, np.nan
        rows.append({
            "tau": tau_f, "p_hat_mean": mean_p, "p_hat_se": se_p,
            "p_hat_ci_low": ci_low, "p_hat_ci_high": ci_high, "n_seeds": n_seeds,
        })

    # --- Data ---
    with open(ep.data("reliability.csv"), "w") as f:
        f.write("tau,p_hat_mean,p_hat_se,p_hat_ci_low,p_hat_ci_high,n_seeds\n")
        for r in rows:
            f.write(f"{r['tau']},{r['p_hat_mean']},{r['p_hat_se']},"
                    f"{r['p_hat_ci_low']},{r['p_hat_ci_high']},{r['n_seeds']}\n")

    # --- Plot ---
    try:
        pass
    except Exception:
        return

    fig, ax = new_figure(1, 1, figsize=(6, 6))
    tau_arr = np.array([r["tau"] for r in rows])
    p_arr = np.array([r["p_hat_mean"] for r in rows])
    se_arr = np.array([r["p_hat_se"] for r in rows])

    ax.plot([0, 1], [0, 1], ls="-", color=COLORS["reference"], lw=1, label="Perfect calibration")
    ax.errorbar(tau_arr, p_arr, yerr=1.96 * se_arr, fmt="o", color=COLORS["pink"],
                markersize=8, capsize=4, zorder=5, label="Mean ± 95% CI")
    ax.plot(tau_arr, p_arr, color=COLORS["pink"], linewidth=1.5, alpha=0.7)

    for t_val, p_val in zip(tau_arr, p_arr):
        ax.annotate(f"  {p_val:.3f}", (t_val, p_val), fontsize=8, color=COLORS["slate"])

    ax.set(xlabel="Nominal quantile level $\\tau$",
           ylabel="Empirical coverage $\\hat{p}(\\tau)$",
           title=f"Calibration Reliability (latent-fixed DGP, {n_seeds} seeds, T={T})")
    ax.set_xlim(-0.02, 1.02); ax.set_ylim(-0.02, 1.02)
    ax.set_aspect("equal")
    ax.legend(fontsize=9)
    fig.tight_layout()
    save_fig(fig, ep.plot("calibration_reliability.png"))

    # --- Experiment summary (Task 19.2) ---
    try:
        from onlinev2.experiments.summarise import write_experiment_summary
        cal_logs = {}
        for r in rows:
            tau_key = f"coverage_tau_{r['tau']:.2f}"
            cal_logs[tau_key] = r["p_hat_mean"]
        write_experiment_summary(ep, {
            "experiment_name": "calibration",
            "dgp_name": "latent_fixed", "T": T, "n_forecasters": n_forecasters,
            "n_seeds": n_seeds, "scoring_mode": "quantiles_crps",
        }, cal_logs)
    except Exception:
        pass  # summary is optional


# ===================================================================
# E) Parameter sweep (lambda, sigma_min)
# ===================================================================

def _gini(x):
    x = np.sort(np.asarray(x, dtype=np.float64).ravel())
    x = x[x >= 0]
    if x.size < 2: return 0.0
    n = len(x)
    return float(2 * np.sum(np.arange(1, n + 1) * x) / (n * np.sum(x)) - (n + 1) / n)


def run_parameter_sweep(T=200, n_forecasters=8, lam_vals=None, sigma_min_vals=None,
                        seed=7, outdir="outputs", block="core", seeds=None):
    """Grid over lambda and sigma_min.  Heatmaps of CRPS, Gini, market fraction.

    Uses latent-fixed DGP with heterogeneous tau_i so parameters actually matter.
    Multi-seed support (≥20 seeds) via ``seeds`` parameter, T ≥ 1000 rounds.
    """
    cfg = get_experiment_config("parameter_sweep")
    if seeds is None:
        seeds = cfg.seeds
    T = max(T, cfg.T)
    n_forecasters = cfg.n_forecasters

    ep = _exp_paths(outdir, "parameter_sweep", block)
    lam_vals = lam_vals or [0.0, 0.25, 0.5, 0.75, 1.0]
    sigma_min_vals = sigma_min_vals or [0.05, 0.1, 0.2, 0.3, 0.5]

    tau_i = cfg.tau_i()
    taus = cfg.taus()

    # Collect per-seed results for each (lam, sigma_min) cell
    cell_results = {}  # (lam, sm) -> list of per-seed dicts
    for lam in lam_vals:
        for sm in sigma_min_vals:
            cell_results[(lam, sm)] = []

    for s in seeds:
        y, q_reports_pre, _ = generate_truth_and_quantile_reports_latent(
            T, n_forecasters, tau_i, taus, seed=s, sigma_z=cfg.sigma_z,
        )
        for lam in lam_vals:
            for sm in sigma_min_vals:
                res = run_simulation(
                    T=T, n_forecasters=n_forecasters, seed=s,
                    scoring_mode="quantiles_crps", store_history=True,
                    lam=float(lam), sigma_min=float(sm),
                    taus=taus, y_pre=y, q_reports_pre=q_reports_pre,
                    forecaster_noise_pre=tau_i,
                )
                y_sim = res["y"]
                crps_sum, cnt = 0.0, 0
                for t in range(len(y_sim)):
                    rh = np.asarray(res["r_hat_hist"][t], dtype=np.float64)
                    if rh.size == len(taus):
                        crps_sum += float(crps_hat_from_quantiles(float(y_sim[t]), rh.reshape(1, -1), taus)[0])
                        cnt += 1
                ps = res["profit_total"] - np.min(res["profit_total"])
                sm_arr = np.sum(res["wager_hist"], axis=0)
                cell_results[(lam, sm)].append({
                    "mean_crps": crps_sum / cnt if cnt else np.nan,
                    "gini": _gini(ps),
                    "frac_meaningful": float(np.mean(sm_arr > 1e-9)),
                })

    # Aggregate across seeds
    rows = []
    for lam in lam_vals:
        for sm in sigma_min_vals:
            cell = cell_results[(lam, sm)]
            crps_vals = np.array([c["mean_crps"] for c in cell])
            gini_vals = np.array([c["gini"] for c in cell])
            frac_vals = np.array([c["frac_meaningful"] for c in cell])
            crps_finite = crps_vals[np.isfinite(crps_vals)]
            gini_finite = gini_vals[np.isfinite(gini_vals)]
            frac_finite = frac_vals[np.isfinite(frac_vals)]
            mean_crps = float(np.mean(crps_finite)) if crps_finite.size else np.nan
            mean_gini = float(np.mean(gini_finite)) if gini_finite.size else np.nan
            mean_frac = float(np.mean(frac_finite)) if frac_finite.size else np.nan
            se_crps = float(np.std(crps_finite, ddof=1) / np.sqrt(crps_finite.size)) if crps_finite.size > 1 else 0.0
            rows.append({
                "lam": lam, "sigma_min": sm,
                "mean_crps": mean_crps, "se_crps": se_crps,
                "gini": mean_gini,
                "frac_meaningful": mean_frac,
                "n_seeds": len(cell),
            })

    # --- Data ---
    cols = ["lam", "sigma_min", "mean_crps", "se_crps", "gini", "frac_meaningful", "n_seeds"]
    _write_csv(ep.data("sweep.csv"), cols, rows)

    # --- Summary JSON ---
    crps_all = [r["mean_crps"] for r in rows if np.isfinite(r["mean_crps"])]
    crps_range_pct = ((max(crps_all) - min(crps_all)) / min(crps_all) * 100) if crps_all and min(crps_all) > 0 else 0.0
    summary = {
        "experiment_name": "parameter_sweep",
        "config": {"T": T, "n_forecasters": n_forecasters, "n_seeds": len(seeds),
                   "dgp_name": cfg.dgp_name, "lam_vals": lam_vals, "sigma_min_vals": sigma_min_vals},
        "crps_range_pct": crps_range_pct,
        "crps_min": min(crps_all) if crps_all else None,
        "crps_max": max(crps_all) if crps_all else None,
    }
    with open(ep.data("summary.json"), "w") as f:
        json.dump(summary, f, indent=2, default=str)

    print(f"\nParameter Sweep (latent-fixed DGP, {len(seeds)} seeds, T={T})")
    print("=" * 60)
    print(f"  CRPS range: {crps_range_pct:.1f}% across grid")

    # --- Plot: three heatmaps ---
    try:
        pass
    except Exception:
        return

    nl, ns = len(lam_vals), len(sigma_min_vals)

    # Only show heatmaps that vary; skip "fraction rounds" if all values are ~1
    frac_vals_plot = [r["frac_meaningful"] for r in rows]
    frac_is_trivial = all(abs(v - 1.0) < 0.01 for v in frac_vals_plot if np.isfinite(v))

    metrics = [("mean_crps", "Mean CRPS (lower = better)", "RdYlGn_r"),
               ("gini", "Gini coefficient (0 = equal)", "OrRd")]
    if not frac_is_trivial:
        metrics.append(("frac_meaningful", "Fraction rounds with market", "GnBu"))

    ncols = len(metrics)
    fig, axes = new_figure(1, ncols, figsize=(7 * ncols, 5.5))
    if ncols == 1:
        axes = [axes]

    for idx, (key, title, cmap) in enumerate(metrics):
        grid = np.full((nl, ns), np.nan)
        for r in rows:
            i = lam_vals.index(r["lam"])
            j = sigma_min_vals.index(r["sigma_min"])
            grid[i, j] = r[key]
        ax = axes[idx]
        im = ax.imshow(grid, aspect="auto", cmap=cmap, origin="lower")
        ax.set_xticks(range(ns)); ax.set_xticklabels([f"{v:.2f}" for v in sigma_min_vals])
        ax.set_yticks(range(nl)); ax.set_yticklabels([f"{v:.2f}" for v in lam_vals])
        ax.set(xlabel="$\\sigma_{\\min}$", ylabel="$\\lambda$", title=title)
        for i in range(nl):
            for j in range(ns):
                ax.text(j, i, f"{grid[i, j]:.3f}", ha="center", va="center", fontsize=9,
                        color="white" if grid[i, j] > np.nanmedian(grid) else "black")
        fig.colorbar(im, ax=ax, shrink=0.8)

    fig.suptitle(f"Parameter Sweep: $\\lambda$ vs $\\sigma_{{\\min}}$ ({len(seeds)} seeds)",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("parameter_sweep.png"))

    # --- Experiment summary (Task 19.2) ---
    try:
        from onlinev2.experiments.summarise import write_experiment_summary
        write_experiment_summary(ep, {
            "experiment_name": "parameter_sweep",
            "dgp_name": cfg.dgp_name, "T": T, "n_forecasters": n_forecasters,
            "n_seeds": len(seeds), "scoring_mode": "quantiles_crps",
            "lam_vals": lam_vals, "sigma_min_vals": sigma_min_vals,
        }, {
            "mean_crps": [r["mean_crps"] for r in rows if np.isfinite(r["mean_crps"])],
            "crps_range_pct": crps_range_pct,
        })
    except Exception:
        pass  # summary is optional


# ===================================================================
# F) Sybil / identity split
# ===================================================================

def run_sybil_experiment(n_trials=20, k_max=8, seed=31, outdir="outputs", block="core",
                         ci_alpha=0.05, seeds=None):
    """Split one agent into k identities — verify Sybil resistance (profit unchanged).

    Three scenarios tested:
      identical:  k copies with same report, wager split equally (existing invariant)
      diversified: each sybil identity reports q_j(τ) = q_original(τ) + ε_j,
                   ε_j ~ N(0, σ_diversify=0.02), total wager conserved
      strategic_deposit: total deposit conserved but split unevenly (e.g. 60/40 for k=2)

    Multi-seed support (≥20 seeds) via ``seeds`` parameter, T ≥ 1000 rounds.
    """
    cfg = get_experiment_config("sybil")
    if seeds is None:
        seeds = cfg.seeds

    ep = _exp_paths(outdir, "sybil", block)
    k_vals = list(range(2, k_max + 1))
    sigma_diversify = 0.02

    all_rows = []

    for s in seeds:
        rng = np.random.default_rng(s)
        for k in k_vals:
            deltas_by_scenario = {"identical": [], "diversified": [], "strategic_deposit": []}
            ratios_by_scenario = {"identical": [], "diversified": [], "strategic_deposit": []}

            for _ in range(n_trials):
                m0 = float(rng.uniform(1.0, 5.0))
                s0 = float(rng.uniform(0.2, 0.8))
                m_others = rng.uniform(0.5, 3.0, size=3).astype(np.float64)
                s_others = rng.uniform(0.2, 0.8, size=3).astype(np.float64)

                m_s = np.concatenate([[m0], m_others])
                s_s = np.concatenate([[s0], s_others])
                prof_single = float(profit(raja_competitive_payout(s_s, m_s), m_s)[0])

                # --- Scenario A: Identical reports, equal wager split ---
                m_sp = np.concatenate([np.full(k, m0 / k), m_others])
                s_sp = np.concatenate([np.full(k, s0), s_others])
                prof_split = float(np.sum(profit(raja_competitive_payout(s_sp, m_sp), m_sp)[:k]))
                deltas_by_scenario["identical"].append(prof_split - prof_single)
                ratios_by_scenario["identical"].append(
                    prof_split / prof_single if abs(prof_single) > 1e-12 else 1.0
                )

                # --- Scenario B: Diversified reports ---
                # Each sybil identity gets a slightly perturbed score
                s_diversified = np.clip(
                    s0 + rng.normal(0.0, sigma_diversify, size=k), 0.01, 0.99
                ).astype(np.float64)
                m_div = np.concatenate([np.full(k, m0 / k), m_others])
                s_div = np.concatenate([s_diversified, s_others])
                prof_div = float(np.sum(profit(raja_competitive_payout(s_div, m_div), m_div)[:k]))
                deltas_by_scenario["diversified"].append(prof_div - prof_single)
                ratios_by_scenario["diversified"].append(
                    prof_div / prof_single if abs(prof_single) > 1e-12 else 1.0
                )

                # --- Scenario C: Strategic deposit splitting ---
                # Total deposit conserved but split unevenly
                # Generate random uneven split that sums to m0
                raw_shares = rng.dirichlet(np.ones(k) * 0.5)  # concentrated Dirichlet
                m_strategic = np.concatenate([(raw_shares * m0).astype(np.float64), m_others])
                s_strat = np.concatenate([np.full(k, s0), s_others])
                prof_strat = float(np.sum(
                    profit(raja_competitive_payout(s_strat, m_strategic), m_strategic)[:k]
                ))
                deltas_by_scenario["strategic_deposit"].append(prof_strat - prof_single)
                ratios_by_scenario["strategic_deposit"].append(
                    prof_strat / prof_single if abs(prof_single) > 1e-12 else 1.0
                )

            # Aggregate per (seed, k, scenario)
            for scenario in ["identical", "diversified", "strategic_deposit"]:
                d_arr = np.array(deltas_by_scenario[scenario])
                r_arr = np.array(ratios_by_scenario[scenario])
                m_d = float(np.mean(d_arr))
                m_r = float(np.mean(r_arr))
                if len(d_arr) >= 2:
                    se_val = float(np.std(d_arr, ddof=1)) / len(d_arr) ** 0.5
                    tv = float(scipy_stats.t.ppf(1 - ci_alpha / 2, len(d_arr) - 1))
                    cl = m_d - tv * se_val
                    ch = m_d + tv * se_val
                else:
                    cl, ch = m_d, m_d
                all_rows.append({
                    "k": k, "scenario": scenario, "seed": s,
                    "mean_ratio": m_r, "mean_delta": m_d,
                    "ci_low": cl, "ci_high": ch,
                })

    # --- Aggregate across seeds per (k, scenario) ---
    agg_rows = []
    for k in k_vals:
        for scenario in ["identical", "diversified", "strategic_deposit"]:
            subset = [r for r in all_rows if r["k"] == k and r["scenario"] == scenario]
            ratios = np.array([r["mean_ratio"] for r in subset])
            deltas = np.array([r["mean_delta"] for r in subset])
            m_r = float(np.mean(ratios))
            m_d = float(np.mean(deltas))
            if deltas.size >= 2:
                se_val = float(np.std(deltas, ddof=1) / np.sqrt(deltas.size))
                cl = m_d - 1.96 * se_val
                ch = m_d + 1.96 * se_val
            else:
                cl, ch = m_d, m_d
            agg_rows.append({
                "k": k, "scenario": scenario,
                "mean_ratio": m_r, "mean_delta": m_d,
                "ci_low": cl, "ci_high": ch,
            })

    # --- Verify identical-report invariant ---
    identical_rows = [r for r in agg_rows if r["scenario"] == "identical"]
    for r in identical_rows:
        if abs(r["mean_ratio"] - 1.0) > 1e-10:
            print(f"WARNING: Identical-report sybil invariant violated at k={r['k']}: "
                  f"ratio={r['mean_ratio']:.12f}")

    # --- Data ---
    cols = ["k", "scenario", "mean_ratio", "mean_delta", "ci_low", "ci_high"]
    _write_csv(ep.data("sybil.csv"), cols, agg_rows)

    # --- Summary JSON ---
    summary = {
        "experiment_name": "sybil",
        "config": {"k_max": k_max, "n_trials": n_trials, "n_seeds": len(seeds),
                   "sigma_diversify": sigma_diversify},
        "scenarios": {}
    }
    for scenario in ["identical", "diversified", "strategic_deposit"]:
        sc_rows = [r for r in agg_rows if r["scenario"] == scenario]
        ratios = [r["mean_ratio"] for r in sc_rows]
        summary["scenarios"][scenario] = {
            "mean_ratio": float(np.mean(ratios)),
            "max_abs_delta": float(max(abs(r["mean_delta"]) for r in sc_rows)),
            "n_k_values": len(sc_rows),
        }
    with open(ep.data("summary.json"), "w") as f:
        json.dump(summary, f, indent=2, default=str)

    print("\nSybil Resistance Test (multi-seed, three scenarios)")
    print("=" * 60)
    for scenario in ["identical", "diversified", "strategic_deposit"]:
        sc_rows = [r for r in agg_rows if r["scenario"] == scenario]
        ratios = [r["mean_ratio"] for r in sc_rows]
        print(f"  {scenario:20s}: mean_ratio={np.mean(ratios):.6f}, "
              f"max|delta|={max(abs(r['mean_delta']) for r in sc_rows):.2e}")

    # --- Plot ---
    try:
        pass
    except Exception:
        return

    fig, axes = new_figure(1, 3, figsize=(18, 5.5))
    scenario_labels = {"identical": "Identical Reports",
                       "diversified": "Diversified Reports",
                       "strategic_deposit": "Strategic Deposit"}
    scenario_colors = {"identical": COLORS["blue"],
                       "diversified": COLORS["orange"],
                       "strategic_deposit": COLORS["pink"]}

    for idx, scenario in enumerate(["identical", "diversified", "strategic_deposit"]):
        ax = axes[idx]
        sc_rows = [r for r in agg_rows if r["scenario"] == scenario]
        ks = [r["k"] for r in sc_rows]
        ratios = [r["mean_ratio"] for r in sc_rows]
        ax.plot(ks, ratios, "o-", color=scenario_colors[scenario], markersize=8, linewidth=1.5)
        ax.axhline(1.0, color=COLORS["reference"], ls="-", lw=1)
        ax.fill_between(ks, 0.99, 1.01, alpha=0.08, color=scenario_colors[scenario])
        ax.set(xlabel="Number of identities $k$", ylabel="Profit ratio (split / single)",
               title=scenario_labels[scenario])
        ratio_range = max(abs(r - 1.0) for r in ratios) if ratios else 0.01
        if ratio_range < 0.01:
            ax.set_ylim(0.95, 1.05)

    fig.suptitle("Sybil Resistance Test (Three Scenarios)", fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("sybil.png"))

    # --- Experiment summary (Task 19.2) ---
    try:
        from onlinev2.experiments.summarise import write_experiment_summary
        sybil_logs = {}
        for scenario in ["identical", "diversified", "strategic_deposit"]:
            sc_info = summary.get("scenarios", {}).get(scenario, {})
            sybil_logs[f"{scenario}_mean_ratio"] = sc_info.get("mean_ratio")
            sybil_logs[f"{scenario}_max_abs_delta"] = sc_info.get("max_abs_delta")
        write_experiment_summary(ep, {
            "experiment_name": "sybil",
            "T": "N/A", "n_seeds": len(seeds),
            "k_max": k_max, "n_trials": n_trials,
        }, sybil_logs)
    except Exception:
        pass  # summary is optional


# ===================================================================
# G) Scoring path validation (point/MAE vs quantiles/CRPS)
# ===================================================================

def run_scoring_validation(seed=11, outdir="outputs", block="core"):
    """Compare point/MAE and quantiles/CRPS scoring paths side by side."""
    ep = _exp_paths(outdir, "scoring_validation", block)

    res_mae = run_simulation(T=100, n_forecasters=8, seed=seed, scoring_mode="point_mae", store_history=True)
    res_crps = run_simulation(T=100, n_forecasters=8, seed=seed, scoring_mode="quantiles_crps", store_history=True)
    tests_mae = run_all_tests(res_mae, lam=0.3, seed=seed)
    tests_crps = run_all_tests(res_crps, lam=0.3, seed=seed)

    # --- Data ---
    with open(ep.data("test_results.csv"), "w") as f:
        f.write("mode,metric,value\n")
        for k, v in tests_mae.items(): f.write(f"point_mae,{k},{v}\n")
        for k, v in tests_crps.items(): f.write(f"quantiles_crps,{k},{v}\n")

    # --- Plot ---
    try:
        pass
    except Exception:
        return

    fig, axes = new_figure(2, 2, figsize=(14, 10))

    # Test results summary (replaces noisy 1e-15 budget gap plot)
    ax = axes[0, 0]
    ax.axis("off")
    key_tests = ["max_abs_budget_gap", "wager_scaling_test", "identity_split_local",
                 "two_player_closed_form", "equal_score_zero_profit", "permutation_invariance",
                 "roi_bounds", "score_bounds", "budget_identity_with_utility"]
    y_pos = 0.95
    ax.text(0.0, y_pos, "Test", fontsize=10, fontweight="bold", transform=ax.transAxes)
    ax.text(0.55, y_pos, "MAE", fontsize=10, fontweight="bold", transform=ax.transAxes)
    ax.text(0.75, y_pos, "CRPS", fontsize=10, fontweight="bold", transform=ax.transAxes)
    y_pos -= 0.08
    for k in key_tests:
        vm = tests_mae.get(k, "")
        vc = tests_crps.get(k, "")
        vm_str = f"{vm:.1e}" if isinstance(vm, float) else ("PASS" if vm else "FAIL")
        vc_str = f"{vc:.1e}" if isinstance(vc, float) else ("PASS" if vc else "FAIL")
        vm_color = COLORS["green"] if (isinstance(vm, bool) and vm) or (isinstance(vm, float) and abs(vm) < 1e-6) else COLORS["slate"]
        vc_color = COLORS["green"] if (isinstance(vc, bool) and vc) or (isinstance(vc, float) and abs(vc) < 1e-6) else COLORS["slate"]
        short_k = k.replace("_", " ")
        ax.text(0.0, y_pos, short_k, fontsize=8, transform=ax.transAxes, color=COLORS["truth"])
        ax.text(0.55, y_pos, vm_str, fontsize=8, transform=ax.transAxes, color=vm_color, fontfamily="monospace")
        ax.text(0.75, y_pos, vc_str, fontsize=8, transform=ax.transAxes, color=vc_color, fontfamily="monospace")
        y_pos -= 0.08
    ax.set_title("Invariant test results", fontsize=12)

    # Cumulative profit per forecaster — MAE
    ax = axes[0, 1]
    n_show = min(4, res_mae["profit_hist"].shape[0])
    for i in range(n_show):
        ax.plot(np.cumsum(res_mae["profit_hist"][i]), color=agent_color(i), linewidth=1, label=f"F{i}")
    ax.axhline(0, color=COLORS["reference"], ls="-", lw=0.5)
    ax.set(xlabel="Round $t$", ylabel="Cumulative profit", title="Cumulative profit (point / MAE)")
    ax.legend(fontsize=8)

    # Sigma evolution — MAE
    ax = axes[1, 0]
    for i in range(n_show):
        ax.plot(res_mae["sigma_hist"][i], color=agent_color(i), linewidth=1, label=f"F{i}")
    ax.set(xlabel="Round $t$", ylabel="Learned skill $\\sigma_i$", title="Skill evolution (point / MAE)")
    ax.legend(fontsize=8)

    # Sigma evolution — CRPS
    ax = axes[1, 1]
    for i in range(min(4, res_crps["sigma_hist"].shape[0])):
        ax.plot(res_crps["sigma_hist"][i], color=agent_color(i), linewidth=1, label=f"F{i}")
    ax.set(xlabel="Round $t$", ylabel="Learned skill $\\sigma_i$", title="Skill evolution (quantiles / CRPS)")
    ax.legend(fontsize=8)

    fig.suptitle("Scoring Path Validation: Point/MAE vs Quantiles/CRPS", fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("scoring_validation.png"))

    return {"tests_mae": tests_mae, "tests_crps": tests_crps}


# ===================================================================
# H) Fixed deposit: isolate skill effect
# ===================================================================

def run_fixed_deposit_skill_effect(T=200, n_forecasters=6, seed=17, outdir="outputs",
                                   block="core", scoring_mode="quantiles_crps", gamma=10.0, rho=0.2,
                                   seeds=None):
    """Fixed deposits (no random stakes) — only skill drives wagers and profits."""
    cfg = get_experiment_config("fixed_deposit")
    if seeds is None:
        seeds = cfg.seeds
    T = max(T, cfg.T)
    ep = _exp_paths(outdir, "fixed_deposit", block)
    res = run_simulation(T=T, n_forecasters=n_forecasters, missing_prob=0.0,
                         seed=seed, scoring_mode=scoring_mode, gamma=gamma, rho=rho,
                         store_history=True, deposit_mode="fixed", fixed_deposit=1.0)
    lam = res["params"]["lam"]
    n_show = min(4, n_forecasters)

    # --- Data ---
    with open(ep.data("timeseries.csv"), "w") as f:
        f.write("agent,t,sigma,wager,m_over_b\n")
        for i in range(n_show):
            b = res["deposits_hist"][i]; m = res["wager_hist"][i]
            safe_b = np.where(b > 1e-12, b, 1.0)
            mob = np.where(b > 1e-12, m / safe_b, np.nan)
            for t in range(T):
                f.write(f"{i},{t},{float(res['sigma_hist'][i, t])},{float(m[t])},"
                        f"{float(mob[t]) if np.isfinite(mob[t]) else ''}\n")

    # --- Plot ---
    try:
        pass
    except Exception:
        return res

    fig, axes = new_figure(2, 2, figsize=(13, 9))

    # Sigma evolution (smoothed)
    ax = axes[0, 0]
    for i in range(n_show):
        raw = res["sigma_hist"][i]
        ax.fill_between(range(T), raw, alpha=0.08, color=agent_color(i))
        ax.plot(_ewma_smooth(raw, span=15), color=agent_color(i), label=f"F{i}", linewidth=1.3)
    ax.set(xlabel="Round $t$", ylabel="$\\sigma_i$",
           title="Skill evolution (EWMA smoothed)")
    ax.legend(fontsize=8)

    # Wager evolution (smoothed)
    ax = axes[0, 1]
    for i in range(n_show):
        raw = res["wager_hist"][i]
        ax.fill_between(range(T), raw, alpha=0.08, color=agent_color(i))
        ax.plot(_ewma_smooth(raw, span=15), color=agent_color(i), label=f"F{i}", linewidth=1.3)
    ax.set(xlabel="Round $t$", ylabel="$m_i$",
           title="Effective wager (EWMA smoothed)")
    ax.legend(fontsize=8)

    # Cumulative profit
    ax = axes[1, 0]
    for i in range(n_show):
        ax.plot(np.cumsum(res["profit_hist"][i]), color=agent_color(i),
                label=f"F{i}", linewidth=1.3)
    ax.axhline(0, color=COLORS["reference"], ls="-", lw=0.5)
    ax.set(xlabel="Round $t$", ylabel="Cumulative profit",
           title="Cumulative profit (only skill matters)")
    ax.legend(fontsize=8)

    # Wager formula breakdown: m_i = b_i * (lambda + (1-lambda)*sigma_i)
    ax = axes[1, 1]
    tail = slice(max(0, T - 50), T)
    sigma_tail = np.array([np.mean(res["sigma_hist"][i, tail]) for i in range(n_show)])
    wager_tail = np.array([np.mean(res["wager_hist"][i, tail]) for i in range(n_show)])
    x_pos = np.arange(n_show)
    ax.bar(x_pos - 0.15, sigma_tail, width=0.3,
           color=[agent_color(i) for i in range(n_show)], alpha=0.7, label="Tail $\\sigma_i$")
    ax.bar(x_pos + 0.15, wager_tail, width=0.3,
           color=[agent_color(i) for i in range(n_show)], alpha=0.4,
           edgecolor=[agent_color(i) for i in range(n_show)], linewidth=1.5,
           label="Tail $m_i$")
    ax.set_xticks(x_pos)
    ax.set_xticklabels([f"F{i}" for i in range(n_show)])
    ax.set(xlabel="Forecaster", ylabel="Value",
           title=f"Tail averages (last 50 rounds, $\\lambda$={lam:.2f})")
    ax.legend(fontsize=8)

    fig.suptitle("Fixed Deposit Experiment: Isolating Skill Effect",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("fixed_deposit.png"))
    return res


# ===================================================================
# I) Skill recovery benchmark (latent Bayes-consistent generator)
# ===================================================================

SKILL_RECOVERY_TAU = np.array([0.15, 0.22, 0.32, 0.46, 0.68, 1.0], dtype=np.float64)
SKILL_RECOVERY_N_SEEDS = 20


def _pit_single_forecaster(y, q_tk, taus):
    T, K = y.size, len(taus)
    pit = np.zeros(T)
    for t in range(T):
        yt, qt = float(y[t]), q_tk[t, :]
        if yt <= qt[0]:
            pit[t] = taus[0] * (yt / qt[0]) if qt[0] > 1e-12 else 0.5
        elif yt >= qt[-1]:
            pit[t] = taus[-1] + (1.0 - taus[-1]) * (yt - qt[-1]) / (1.0 - qt[-1] + 1e-12)
        else:
            idx = max(0, min(np.searchsorted(qt, yt) - 1, K - 2))
            dq = qt[idx + 1] - qt[idx]
            pit[t] = taus[idx] + (taus[idx + 1] - taus[idx]) * (yt - qt[idx]) / dq if dq > 1e-12 else 0.5 * (taus[idx] + taus[idx + 1])
    return np.clip(pit, 1e-12, 1 - 1e-12)


def _coverage_table(y, q_reports, taus):
    n, T, K = q_reports.shape
    return np.array([[np.mean(y <= q_reports[i, :, k]) for k in range(K)] for i in range(n)])


def run_skill_recovery_benchmark_latent(T=20000, T0=5000, tau_i=None, seed=42,
                                        outdir="outputs", block="core", gamma=4.0, rho=0.1,
                                        sigma_min=0.1, sigma_z=1.0,
                                        taus_quantiles=None, n_seeds=SKILL_RECOVERY_N_SEEDS,
                                        seeds=None):
    """Latent truth + Bayes-consistent forecasters — verify skill is recovered correctly.

    Uses get_experiment_config("skill_recovery") for T=2000, T0=500, ≥20 seeds.
    Reports Spearman rank correlation with mean, SE, and 95% CI across seeds.
    Ensures verdict file parameters exactly match actual run configuration.
    """
    cfg = get_experiment_config("skill_recovery")
    if seeds is None:
        seeds = cfg.seeds
    T = max(T, cfg.T)  # cfg.T = 2000
    T0 = 500  # warm-start period
    n_seeds = len(seeds)

    ep = _exp_paths(outdir, "skill_recovery", block)
    tau_true = SKILL_RECOVERY_TAU.copy() if tau_i is None else np.asarray(tau_i).ravel()
    n = tau_true.size
    if taus_quantiles is None:
        taus_quantiles = cfg.taus()
    S = n_seeds
    tail = slice(T0, T)
    results = {}

    try:
        _has_plt = True
    except Exception:
        _has_plt = False

    for mode in ("point_mae", "quantiles_crps"):
        corr_loss, corr_sigma = [], []
        last_data = {}

        for s in seeds:
            if mode == "point_mae":
                y, reports, _ = generate_truth_and_reports_latent(T=T, n=n, tau_i=tau_true, seed=s, sigma_z=sigma_z)
                res = run_simulation(scoring_mode="point_mae", y_pre=y, reports_pre=reports,
                                     missing_prob=0.0, U=0.0, deposit_mode="fixed", fixed_deposit=1.0,
                                     store_history=True, gamma=gamma, rho=rho, sigma_min=sigma_min, seed=s)
            else:
                y, q_reports, _ = generate_truth_and_quantile_reports_latent(
                    T=T, n=n, tau_i=tau_true, taus=taus_quantiles, seed=s, sigma_z=sigma_z)
                res = run_simulation(scoring_mode="quantiles_crps", taus=taus_quantiles,
                                     y_pre=y, q_reports_pre=q_reports,
                                     missing_prob=0.0, U=0.0, deposit_mode="fixed", fixed_deposit=1.0,
                                     store_history=True, gamma=gamma, rho=rho, sigma_min=sigma_min, seed=s)

            ml = np.mean(res["loss_hist"][:, tail], axis=1)
            ms = np.mean(res["sigma_hist"][:, tail], axis=1)
            corr_loss.append(float(scipy_stats.spearmanr(-tau_true, -ml).correlation))
            corr_sigma.append(float(scipy_stats.spearmanr(-tau_true, ms).correlation))
            last_data = {"res": res, "y": y, "ml": ml, "ms": ms,
                         "q_reports": res.get("q_reports", q_reports if mode == "quantiles_crps" else None)}

        mc_l, mc_s = float(np.nanmean(corr_loss)), float(np.nanmean(corr_sigma))
        sd_l, sd_s = (float(np.nanstd(corr_loss, ddof=1)), float(np.nanstd(corr_sigma, ddof=1))) if S > 1 else (0, 0)
        se_l = sd_l / np.sqrt(S) if S > 1 else 0.0
        se_s = sd_s / np.sqrt(S) if S > 1 else 0.0
        ci_low_l = mc_l - 1.96 * se_l
        ci_high_l = mc_l + 1.96 * se_l
        ci_low_s = mc_s - 1.96 * se_s
        ci_high_s = mc_s + 1.96 * se_s
        passes = np.isfinite(mc_s) and mc_s >= 0.8 and (S == 1 or sd_s <= 0.15)

        results[mode] = {"mc_loss": mc_l, "sd_loss": sd_l, "se_loss": se_l,
                         "ci_low_loss": ci_low_l, "ci_high_loss": ci_high_l,
                         "mc_sigma": mc_s, "sd_sigma": sd_s, "se_sigma": se_s,
                         "ci_low_sigma": ci_low_s, "ci_high_sigma": ci_high_s,
                         "passes": passes, **last_data}

        # --- Data ---
        with open(ep.data(f"{mode}_summary.csv"), "w") as f:
            f.write("forecaster,tau_true,mean_loss_tail,mean_sigma_tail\n")
            for i in range(n):
                f.write(f"{i},{float(tau_true[i])},{float(last_data['ml'][i])},{float(last_data['ms'][i])}\n")

        with open(ep.data(f"{mode}_seeds.csv"), "w") as f:
            f.write("seed,corr_loss,corr_sigma\n")
            for si, s in enumerate(seeds):
                f.write(f"{s},{corr_loss[si]:.6f},{corr_sigma[si]:.6f}\n")

        # --- Plots ---
        if not _has_plt:
            continue

        res_last = last_data["res"]
        ml, ms = last_data["ml"], last_data["ms"]

        # Combined 2x2 figure per mode
        fig, axes = new_figure(2, 2, figsize=(14, 10))

        # tau vs loss
        ax = axes[0, 0]
        ax.scatter(tau_true, ml, c=[agent_color(i) for i in range(n)],
                   s=100, zorder=5, edgecolors="white", linewidths=2)
        for i in range(n): ax.annotate(f"  F{i}", (tau_true[i], ml[i]), fontsize=9, color=COLORS["slate"])
        ax.set(xlabel="True noise $\\tau_i$", ylabel="Mean tail loss",
               title=f"$\\tau$ vs loss (Spearman = {mc_l:.3f} [{ci_low_l:.3f}, {ci_high_l:.3f}])")

        # tau vs sigma
        ax = axes[0, 1]
        ax.scatter(tau_true, ms, c=[agent_color(i) for i in range(n)],
                   s=100, zorder=5, edgecolors="white", linewidths=2)
        for i in range(n): ax.annotate(f"  F{i}", (tau_true[i], ms[i]), fontsize=9, color=COLORS["slate"])
        verdict_color = COLORS["green"] if passes else COLORS["red"]
        ax.set(xlabel="True noise $\\tau_i$", ylabel="Mean tail $\\sigma$",
               title=f"$\\tau$ vs learned performance score (Spearman = {mc_s:.3f} [{ci_low_s:.3f}, {ci_high_s:.3f}])")
        ax.text(0.02, 0.05, "PASS" if passes else "FAIL", transform=ax.transAxes,
                fontsize=12, fontweight="bold", color=verdict_color)

        # Sigma timeseries — smoothed (rolling mean)
        ax = axes[1, 0]
        w = max(30, T // 40)
        for i in range(n):
            raw = res_last["sigma_hist"][i]
            sm = _rolling_mean(raw, w=w)
            ax.plot(sm, color=agent_color(i), linewidth=1.2,
                    label=f"F{i} ($\\tau$={tau_true[i]:.2f})")
        ax.axvline(T0, color=COLORS["reference"], ls="-", lw=0.8, label=f"T0={T0}")
        ax.set(xlabel="Round $t$", ylabel="$\\sigma_i(t)$",
               title=f"Skill evolution (rolling avg, w={w})")
        ax.legend(fontsize=7, ncol=2)

        # Loss timeseries — smoothed
        ax = axes[1, 1]
        for i in range(n):
            raw = res_last["loss_hist"][i]
            sm = _rolling_mean(raw, w=w)
            ax.plot(sm, color=agent_color(i), linewidth=1.2,
                    label=f"F{i} ($\\tau$={tau_true[i]:.2f})")
        ax.axvline(T0, color=COLORS["reference"], ls="-", lw=0.8)
        ax.set(xlabel="Round $t$", ylabel="Loss$_i(t)$",
               title=f"Loss evolution (rolling avg, w={w})")
        ax.legend(fontsize=7, ncol=2)

        fig.suptitle(f"Skill Recovery — {mode}", fontsize=14, fontweight="bold")
        fig.tight_layout()
        save_fig(fig, ep.plot(f"{mode}_recovery.png"))

        # Quantiles: PIT + coverage
        if mode == "quantiles_crps" and last_data.get("q_reports") is not None:
            qr = last_data["q_reports"]
            y_last = last_data["y"]
            cov = _coverage_table(y_last, qr, taus_quantiles)

            with open(ep.data("crps_coverage.csv"), "w") as f:
                f.write("forecaster," + ",".join(f"alpha_{k}" for k in range(len(taus_quantiles))) + "\n")
                for i in range(n):
                    f.write(f"{i}," + ",".join(f"{cov[i, k]:.4f}" for k in range(len(taus_quantiles))) + "\n")

            fig, axes = new_figure(1, 2, figsize=(12, 5))

            # PIT aggregate
            q_agg = np.mean(qr, axis=0)
            pit_agg = _pit_single_forecaster(y_last, q_agg, taus_quantiles)
            axes[0].hist(pit_agg, bins=15, color=COLORS["blue"], alpha=0.7, edgecolor="white", density=True)
            axes[0].axhline(1.0, color=COLORS["reference"], ls="-", label="Uniform")
            axes[0].set(xlabel="PIT value", ylabel="Density", title="PIT histogram (aggregate forecast)")
            axes[0].legend()

            # Coverage plot
            for i in range(n):
                axes[1].plot(taus_quantiles, cov[i], "o-", color=agent_color(i),
                             markersize=4, label=f"F{i}")
            axes[1].plot([0, 1], [0, 1], ls="-", color=COLORS["reference"], label="Perfect")
            axes[1].set(xlabel="Nominal $\\tau$", ylabel="Empirical coverage",
                        title="Calibration (Bayes-consistent $\\to$ diagonal)")
            axes[1].legend(fontsize=7, ncol=2)

            fig.suptitle("Quantile Calibration Diagnostics", fontsize=14, fontweight="bold")
            fig.tight_layout()
            save_fig(fig, ep.plot("crps_calibration.png"))

    # --- Summary text (verdict file matches actual run configuration) ---
    lines = ["Skill Recovery Benchmark",
             f"T={T}, T0={T0}, n={n}, seeds={S}",
             f"gamma={gamma}, rho={rho}, sigma_min={sigma_min}, sigma_z={sigma_z}",
             ""]
    for mode in ("point_mae", "quantiles_crps"):
        r = results[mode]
        lines.append(f"[{mode}]")
        lines.append(f"  Spearman(tau, loss):  mean={r['mc_loss']:.4f}, se={r['se_loss']:.4f}, "
                     f"95% CI=[{r['ci_low_loss']:.4f}, {r['ci_high_loss']:.4f}]")
        lines.append(f"  Spearman(tau, sigma): mean={r['mc_sigma']:.4f}, se={r['se_sigma']:.4f}, "
                     f"95% CI=[{r['ci_low_sigma']:.4f}, {r['ci_high_sigma']:.4f}]")
        lines.append(f"  Pass: {r['passes']}")
        lines.append("")
    with open(ep.data("verdict.txt"), "w") as f:
        f.write("\n".join(lines))
    print("\n".join(lines))

    # --- Experiment summary (Task 19.2) ---
    try:
        from onlinev2.experiments.summarise import write_experiment_summary
        sr_logs = {}
        for mode in ("point_mae", "quantiles_crps"):
            r = results[mode]
            sr_logs[f"{mode}_spearman_sigma"] = r["mc_sigma"]
            sr_logs[f"{mode}_spearman_loss"] = r["mc_loss"]
        write_experiment_summary(ep, {
            "experiment_name": "skill_recovery",
            "dgp_name": "latent_fixed", "T": T, "n_forecasters": n,
            "n_seeds": S, "scoring_mode": "both",
            "T0": T0, "gamma": gamma, "rho": rho, "sigma_min": sigma_min,
        }, sr_logs)
    except Exception:
        pass  # summary is optional

    return results


# ===================================================================
# J) Baseline DGP diagnostic
# ===================================================================

def run_baseline_dgp_diagnostic(T=500, n_forecasters=6, seed=42, outdir="outputs", block="core",
                                seeds=None):
    """Visualise the baseline DGP: truth vs reports, noise levels, error distributions."""
    from onlinev2.dgps import get_dgp
    cfg = get_experiment_config("baseline_dgp")
    if seeds is None:
        seeds = cfg.seeds
    T = max(T, cfg.T)
    ep = _exp_paths(outdir, "baseline_dgp", block)
    out = get_dgp("baseline").generate(seed=seed, T=T, n_forecasters=n_forecasters)
    y, reports, noise = out.y, out.reports, out.tau_true
    mae = np.mean(np.abs(reports - y[None, :]), axis=1)
    corr = float(np.corrcoef(noise, mae)[0, 1]) if n_forecasters >= 2 else float("nan")

    # --- Data ---
    with open(ep.data("diagnostics.csv"), "w") as f:
        f.write("forecaster,noise,mae,mean_error,std_error\n")
        for i in range(n_forecasters):
            err = reports[i] - y
            f.write(f"{i},{float(noise[i])},{float(mae[i])},{float(np.mean(err))},{float(np.std(err))}\n")

    # --- Plot ---
    try:
        pass
    except Exception:
        return {"noise": noise, "mae": mae, "corr": corr}

    from scipy.stats import gaussian_kde

    n_show = min(4, n_forecasters)
    fig, axes = new_figure(2, 2, figsize=(14, 10))

    # Truth vs reports — short window, bold truth, thin reports
    ax = axes[0, 0]
    t_show = min(40, T)
    ax.plot(range(t_show), y[:t_show], color=COLORS["truth"], linewidth=2.5,
            label="truth $y_t$", zorder=10)
    for i in range(n_show):
        ax.plot(range(t_show), reports[i, :t_show], alpha=0.5, linewidth=0.7,
                color=agent_color(i), label=f"F{i} ($\\sigma$={noise[i]:.3f})")
    ax.set(xlabel="Round $t$", ylabel="Value", title=f"Truth vs reports (rounds 0–{t_show})")
    leg = ax.legend(fontsize=6, loc="lower left", framealpha=1.0,
                    facecolor="white", edgecolor="#cccccc", borderpad=0.6)
    leg.set_zorder(100)
    for lh in getattr(leg, 'legend_handles', getattr(leg, 'legendHandles', [])):
        lh.set_alpha(1.0)

    # Noise levels
    ax = axes[0, 1]
    order = np.argsort(noise)
    ax.barh(range(n_forecasters), noise[order],
            color=[agent_color(i) for i in order], alpha=0.85, edgecolor="white", linewidth=0.5)
    ax.set_yticks(range(n_forecasters))
    ax.set_yticklabels([f"F{i}" for i in order])
    for j, idx in enumerate(order):
        ax.text(noise[idx] + noise.max() * 0.02, j, f"{noise[idx]:.4f}",
                va="center", fontsize=8, color=COLORS["slate"])
    ax.set(xlabel="Noise $\\sigma_i$", title="Forecaster noise levels (sorted)")

    # Error distributions — KDE curves instead of overlapping histograms
    ax = axes[1, 0]
    x_grid = np.linspace(-0.4, 0.4, 300)
    for i in range(n_show):
        errors = reports[i] - y
        kde = gaussian_kde(errors, bw_method=0.15)
        ax.plot(x_grid, kde(x_grid), color=agent_color(i), linewidth=1.5, label=f"F{i}")
        ax.fill_between(x_grid, kde(x_grid), alpha=0.08, color=agent_color(i))
    ax.axvline(0, color=COLORS["truth"], ls="-", lw=0.8, label="zero (unbiased)")
    ax.set(xlabel="Report $-$ truth", ylabel="Density",
           title="Error distributions (narrower = better)")
    ax.legend(fontsize=8)

    # Noise vs MAE scatter
    ax = axes[1, 1]
    ax.scatter(noise, mae, c=[agent_color(i) for i in range(n_forecasters)],
               s=100, zorder=5, edgecolors="white", linewidths=2)
    for i in range(n_forecasters):
        ax.annotate(f"  F{i}", (noise[i], mae[i]), fontsize=9, color=COLORS["slate"])
    if n_forecasters >= 2:
        c = np.polyfit(noise, mae, 1)
        x_line = np.linspace(noise.min() * 0.9, noise.max() * 1.1, 50)
        ax.plot(x_line, np.polyval(c, x_line), ls="-", color=COLORS["reference"],
                lw=1.2, label="linear fit")
    ax.set(xlabel="True noise $\\sigma_i$", ylabel="Realised MAE",
           title=f"Noise vs MAE (Pearson $r$ = {corr:.3f})")
    ax.legend(fontsize=9)

    fig.suptitle("Baseline DGP Diagnostic ($y \\sim U(0,1)$)", fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("baseline_dgp.png"))
    return {"noise": noise, "mae": mae, "corr": corr}


# ===================================================================
# K) Latent-fixed DGP diagnostic
# ===================================================================

def run_latent_fixed_dgp_diagnostic(T=1000, n_forecasters=6, seed=42, outdir="outputs",
                                    block="core", sigma_z=1.0):
    """Visualise the latent-fixed DGP: posterior shrinkage, calibration, fan charts."""
    from onlinev2.dgps import get_dgp
    ep = _exp_paths(outdir, "latent_fixed_dgp", block)
    tau_true = np.array([0.15, 0.22, 0.32, 0.46, 0.68, 1.0])[:n_forecasters]
    taus_q = np.array([0.1, 0.25, 0.5, 0.75, 0.9])

    out = get_dgp("latent_fixed").generate(seed=seed, T=T, n=n_forecasters, tau_i=tau_true,
                                           sigma_z=sigma_z, quantiles=taus_q)
    y, reports, q_reports = out.y, out.reports, out.q_reports
    mae = np.mean(np.abs(reports - y[None, :]), axis=1)

    # --- Data ---
    with open(ep.data("diagnostics.csv"), "w") as f:
        f.write("forecaster,tau_true,mae,mean_error,std_error\n")
        for i in range(n_forecasters):
            err = reports[i] - y
            f.write(f"{i},{float(tau_true[i])},{float(mae[i])},{float(np.mean(err))},{float(np.std(err))}\n")

    # --- Plot ---
    try:
        pass
    except Exception:
        return {"tau_true": tau_true, "mae": mae}

    fig, axes = new_figure(2, 3, figsize=(18, 10))
    n_show = min(4, n_forecasters)
    best_i, worst_i = 0, n_forecasters - 1

    # Truth vs reports — short window, bold truth
    ax = axes[0, 0]
    t_show = min(40, T)
    ax.plot(range(t_show), y[:t_show], color=COLORS["truth"], linewidth=2.5,
            label="truth", zorder=10)
    for i in range(n_show):
        ax.plot(range(t_show), reports[i, :t_show], alpha=0.45, linewidth=0.8,
                color=agent_color(i), label=f"$\\tau$={tau_true[i]:.2f}")
    ax.set(xlabel="Round $t$", ylabel="Value",
           title=f"Truth vs point reports (rounds 0–{t_show})")
    ax.legend(fontsize=8)

    # Posterior shrinkage scatter
    ax = axes[0, 1]
    sub = np.random.default_rng(seed).choice(T, size=min(300, T), replace=False)
    ax.scatter(y[sub], reports[best_i, sub], alpha=0.3, s=12, color=agent_color(0),
               label=f"best ($\\tau$={tau_true[best_i]:.2f})")
    ax.scatter(y[sub], reports[worst_i, sub], alpha=0.25, s=12, color=agent_color(5),
               label=f"worst ($\\tau$={tau_true[worst_i]:.2f})")
    ax.plot([0, 1], [0, 1], ls="-", color=COLORS["reference"], label="perfect")
    ax.set(xlabel="Truth $y_t$", ylabel="Report $r_{i,t}$", title="Posterior shrinkage")
    ax.legend(fontsize=8)

    # MAE by tau
    ax = axes[0, 2]
    ax.bar(range(n_forecasters), mae, color=[agent_color(i) for i in range(n_forecasters)],
           alpha=0.85, edgecolor="white", linewidth=0.5)
    ax.set_xticks(range(n_forecasters))
    ax.set_xticklabels([f"$\\tau$={t:.2f}" for t in tau_true], fontsize=8)
    for i, v in enumerate(mae):
        ax.text(i, v + mae.max() * 0.02, f"{v:.3f}", ha="center", fontsize=7, color=COLORS["slate"])
    ax.set(xlabel="Forecaster", ylabel="MAE", title="MAE increases with $\\tau$ (as expected)")

    # Fan chart — best (short window for readability)
    ax = axes[1, 0]
    t_fan = min(40, T); ts = np.arange(t_fan)
    ax.plot(ts, y[:t_fan], color=COLORS["truth"], linewidth=2.5, label="truth", zorder=10)
    if q_reports is not None:
        qb = q_reports[best_i, :t_fan, :]
        ax.fill_between(ts, qb[:, 0], qb[:, -1], alpha=0.12, color=agent_color(0), label="10%–90%")
        ax.fill_between(ts, qb[:, 1], qb[:, -2], alpha=0.25, color=agent_color(0), label="25%–75%")
        ax.plot(ts, qb[:, 2], color=agent_color(0), linewidth=1.2, ls="-", label="median")
    ax.set(xlabel="Round $t$", ylabel="Value",
           title=f"Quantile fan — best ($\\tau$={tau_true[best_i]:.2f})")
    ax.legend(fontsize=7)

    # Fan chart — worst (short window)
    ax = axes[1, 1]
    ax.plot(ts, y[:t_fan], color=COLORS["truth"], linewidth=2.5, label="truth", zorder=10)
    if q_reports is not None:
        qw = q_reports[worst_i, :t_fan, :]
        ax.fill_between(ts, qw[:, 0], qw[:, -1], alpha=0.12, color=agent_color(5), label="10%–90%")
        ax.fill_between(ts, qw[:, 1], qw[:, -2], alpha=0.25, color=agent_color(5), label="25%–75%")
        ax.plot(ts, qw[:, 2], color=agent_color(5), linewidth=1.2, ls="-", label="median")
    ax.set(xlabel="Round $t$", ylabel="Value",
           title=f"Quantile fan — worst ($\\tau$={tau_true[worst_i]:.2f})")
    ax.legend(fontsize=7)

    # Calibration
    ax = axes[1, 2]
    if q_reports is not None:
        for i in range(n_forecasters):
            cov = [float(np.mean(y <= q_reports[i, :, k])) for k in range(len(taus_q))]
            ax.plot(taus_q, cov, "o-", color=agent_color(i), markersize=5, linewidth=1.2,
                    label=f"$\\tau$={tau_true[i]:.2f}")
        ax.plot([0, 1], [0, 1], ls="-", color=COLORS["reference"], lw=1, label="perfect")
    ax.set(xlabel="Nominal $\\tau$", ylabel="Empirical coverage",
           title="Calibration (Bayes $\\to$ diagonal)")
    ax.legend(fontsize=7, ncol=2)

    fig.suptitle("Latent-Fixed DGP Diagnostic (exogenous $y = \\Phi(Z_t)$)",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("latent_fixed_dgp.png"))
    return {"tau_true": tau_true, "mae": mae}


# ===================================================================
# L) Aggregation DGP diagnostics + all-DGP comparison
# ===================================================================

def run_aggregation_dgp_diagnostic(T=1000, n_forecasters=3, seed=42, outdir="outputs", block="core"):
    """Diagnostic plots for aggregation DGPs (endogenous truth methods 1 & 3)."""
    from onlinev2.dgps import get_dgp
    ep = _exp_paths(outdir, "aggregation_dgp", block)

    w = np.array([0.8, 0.1, 0.5])[:n_forecasters]
    sigmas = np.array([0.3, 0.6, 1.0])[:n_forecasters]

    methods = [
        ("method1", "aggregation_method1", "Method 1: $y = w^\\top x + \\varepsilon$"),
        ("method3", "aggregation_method3", "Method 3: adds per-agent mean shocks $\\eta_i$"),
    ]

    try:
        pass
    except Exception:
        return

    fig, axes = new_figure(len(methods), 3, figsize=(16, 5 * len(methods) + 1))
    if len(methods) == 1:
        axes = axes[np.newaxis, :]

    for row, (key, dgp_name, title) in enumerate(methods):
        out = get_dgp(dgp_name).generate(
            seed=seed, T=T, n_forecasters=n_forecasters,
            w=w, sigmas=sigmas, normalise_w=False,
        )
        y, reports = out.y, out.reports
        mae = np.mean(np.abs(reports - y[None, :]), axis=1)

        # Save data
        with open(ep.data(f"{key}_diagnostics.csv"), "w") as f:
            f.write("forecaster,w,sigma,mae,mean_error,std_error,corr_with_truth\n")
            for i in range(n_forecasters):
                err = reports[i] - y
                corr_i = float(np.corrcoef(reports[i], y)[0, 1])
                f.write(f"{i},{float(w[i])},{float(sigmas[i])},{float(mae[i])},"
                        f"{float(np.mean(err))},{float(np.std(err))},{corr_i:.4f}\n")

        t_show = min(60, T)

        # Truth vs reports
        ax = axes[row, 0]
        ax.plot(range(t_show), y[:t_show], color=COLORS["truth"], linewidth=2.5,
                label="truth $y_t$", zorder=10)
        for i in range(n_forecasters):
            ax.plot(range(t_show), reports[i, :t_show], alpha=0.45, linewidth=0.8,
                    color=agent_color(i),
                    label=f"F{i} (w={w[i]:.1f}, $\\sigma$={sigmas[i]:.1f})")
        ax.set(xlabel="Round $t$", ylabel="Value",
               title=f"{title}")
        ax.legend(fontsize=6, loc="lower left", framealpha=0.8)

        # Report vs truth scatter
        ax = axes[row, 1]
        sub = np.random.default_rng(seed).choice(T, size=min(300, T), replace=False)
        for i in range(n_forecasters):
            ax.scatter(y[sub], reports[i, sub], alpha=0.2, s=8, color=agent_color(i),
                       label=f"F{i} (r={float(np.corrcoef(reports[i], y)[0, 1]):.2f})")
        ax.plot([0, 1], [0, 1], ls="-", color=COLORS["reference"])
        ax.set(xlabel="Truth $y_t$", ylabel="Report $r_{i,t}$",
               title="Report vs truth")
        ax.legend(fontsize=7)

        # MAE bar chart
        ax = axes[row, 2]
        ax.bar(range(n_forecasters), mae,
                      color=[agent_color(i) for i in range(n_forecasters)],
                      alpha=0.85, edgecolor="white")
        ax.set_xticks(range(n_forecasters))
        ax.set_xticklabels([f"F{i}\n$w$={w[i]:.1f}, $\\sigma$={sigmas[i]:.1f}"
                            for i in range(n_forecasters)], fontsize=8)
        for i, v in enumerate(mae):
            ax.text(i, v + mae.max() * 0.02, f"{v:.3f}", ha="center",
                    fontsize=8, color=COLORS["slate"])
        ax.set(ylabel="MAE", title="MAE per forecaster")

    fig.suptitle("Aggregation DGPs: Endogenous Truth ($y$ depends on reports)",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("aggregation_dgp.png"))


def run_dgp_comparison(T=1000, seed=42, outdir="outputs", block="core"):
    """Side-by-side comparison of all distinct DGPs."""
    from onlinev2.dgps import get_dgp
    cfg = get_experiment_config("dgp_comparison")
    T = max(T, cfg.T)
    ep = _exp_paths(outdir, "dgp_comparison", block)

    dgps = [
        ("baseline", dict(T=T, n_forecasters=4, seed=seed)),
        ("latent_fixed", dict(T=T, n=4, seed=seed, sigma_z=1.0,
                              tau_i=np.array([0.15, 0.32, 0.68, 1.0]),
                              quantiles=np.array([0.1, 0.25, 0.5, 0.75, 0.9]))),
        ("aggregation_method1", dict(T=T, n_forecasters=3, seed=seed,
                                     w=np.array([0.8, 0.1, 0.5]),
                                     sigmas=np.array([0.3, 0.6, 1.0]),
                                     normalise_w=False)),
        ("aggregation_method3", dict(T=T, n_forecasters=3, seed=seed,
                                     w=np.array([0.8, 0.1, 0.5]),
                                     sigmas=np.array([0.3, 0.6, 1.0]),
                                     normalise_w=False)),
    ]

    labels = {
        "baseline": "Baseline\n$y \\sim U(0,1)$, exogenous",
        "latent_fixed": "Latent-Fixed\n$y = \\Phi(Z_t)$, exogenous",
        "aggregation_method1": "Aggregation M1\n$y = w^\\top x + \\varepsilon$, endogenous",
        "aggregation_method3": "Aggregation M3\nM1 + per-agent shocks $\\eta_i$",
    }

    try:
        from scipy.stats import gaussian_kde
    except Exception:
        return

    n_dgps = len(dgps)
    fig, axes = new_figure(n_dgps, 3, figsize=(16, 4 * n_dgps + 1))

    for row, (name, kwargs) in enumerate(dgps):
        out = get_dgp(name).generate(**kwargs)
        y, reports = out.y, out.reports
        n = reports.shape[0]
        mae = np.mean(np.abs(reports - y[None, :]), axis=1)

        # Save data
        with open(ep.data(f"{name}_summary.csv"), "w") as f:
            f.write("forecaster,mae,corr_with_truth,mean_error\n")
            for i in range(n):
                corr_i = float(np.corrcoef(reports[i], y)[0, 1])
                f.write(f"{i},{float(mae[i])},{corr_i:.4f},{float(np.mean(reports[i] - y)):.6f}\n")

        t_show = min(50, T)

        # Col 1: Truth vs reports
        ax = axes[row, 0]
        ax.plot(range(t_show), y[:t_show], color=COLORS["truth"], linewidth=2.5,
                label="truth", zorder=10)
        for i in range(min(3, n)):
            ax.plot(range(t_show), reports[i, :t_show], alpha=0.4, linewidth=0.7,
                    color=agent_color(i), label=f"F{i}")
        ax.set(xlabel="Round $t$", ylabel="Value")
        ax.set_title(labels[name], fontsize=10, fontweight="bold")
        ax.legend(fontsize=6, loc="lower left", framealpha=0.8)

        # Col 2: Truth distribution
        ax = axes[row, 1]
        ax.hist(y, bins=40, color=COLORS["truth"], alpha=0.6, density=True,
                edgecolor="white", linewidth=0.3, label="truth $y$")
        x_grid = np.linspace(float(y.min()) - 0.05, float(y.max()) + 0.05, 200)
        for i in range(min(3, n)):
            kde = gaussian_kde(reports[i], bw_method=0.15)
            ax.plot(x_grid, kde(x_grid), color=agent_color(i), linewidth=1.2,
                    label=f"F{i} reports")
        ax.set(xlabel="Value", ylabel="Density", title="Distributions")
        ax.legend(fontsize=7)

        # Col 3: Report vs truth scatter
        ax = axes[row, 2]
        sub = np.random.default_rng(seed).choice(T, size=min(250, T), replace=False)
        for i in range(min(3, n)):
            corr_i = float(np.corrcoef(reports[i], y)[0, 1])
            ax.scatter(y[sub], reports[i, sub], alpha=0.2, s=8, color=agent_color(i),
                       label=f"F{i} ($r$={corr_i:.2f})")
        ax.plot([0, 1], [0, 1], ls="-", color=COLORS["reference"], lw=0.8)
        ax.set(xlabel="Truth", ylabel="Report", title="Report accuracy")
        ax.legend(fontsize=7)

    fig.suptitle("DGP Comparison: All Data Generating Processes",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("dgp_comparison.png"))


# ===================================================================
# M) Weight rules and deposit policies — two orthogonal experiments
# ===================================================================
#
# Naming convention:
#   Deposit policy — how b_{i,t} is set:
#     IID-Exp, Fixed-Unit, Oracle-Precision, Bankroll-Confidence
#   Weight rule — what weights the aggregator uses:
#     Uniform, Deposit, Skill, Mechanism, Best-single
#   Labels: "WeightRule | DepositPolicy"
# ===================================================================

def _crps_mean(crps_arr):
    v = crps_arr[np.isfinite(crps_arr)]
    return float(np.mean(v)) if v.size else np.nan


def _crps_for_weight_rules(y, q_reports, taus, res, tau_i):
    """Compute per-round CRPS under each weight rule for a single simulation.

    Weight rules:
      Uniform:     w_i = 1/n_active
      Deposit:     w_i proportional to b_i
      Skill:       w_i proportional to sigma_i
      Mechanism:   w_i proportional to m_i  (the simulation's own aggregate)
      Best-single: all weight on lowest-tau agent
    """
    T = len(y)
    eps = 1e-12
    rules = ["uniform", "deposit", "skill", "mechanism", "best_single"]
    crps = {k: np.full(T, np.nan) for k in rules}

    for t in range(T):
        y_t = float(y[t])
        alpha_t = res["alpha_hist"][:, t]
        b_t = res["deposits_hist"][:, t]
        sigma_t = res["sigma_hist"][:, t]
        q_t = q_reports[:, t, :]
        active = (alpha_t == 0)
        if not np.any(active):
            continue

        def _eval(r):
            if np.all(np.isfinite(r)):
                return float(crps_hat_from_quantiles(y_t, r.reshape(1, -1), taus)[0])
            return np.nan

        crps["uniform"][t] = _eval(np.mean(q_t[active], axis=0))

        if float(np.sum(b_t)) > eps:
            crps["deposit"][t] = _eval(aggregate_forecast(q_t, b_t, alpha=alpha_t, eps=eps))

        w_skill = sigma_t.copy()
        w_skill[~active] = 0.0
        if float(np.sum(w_skill)) > eps:
            crps["skill"][t] = _eval(aggregate_forecast(q_t, w_skill, alpha=alpha_t, eps=eps))

        r_mech = np.asarray(res["r_hat_hist"][t], dtype=np.float64)
        if r_mech.size == len(taus):
            crps["mechanism"][t] = _eval(r_mech)

        best = np.argmin(tau_i)
        if active[best]:
            crps["best_single"][t] = _eval(q_t[best])

    return crps


# ===================================================================
# M1) Weight Rule Comparison
#     Question: "Does blending skill and deposit help vs deposit-only,
#     skill-only, or uniform?"
#     Method: fix the deposit policy, vary the weight rule.
# ===================================================================

def run_weight_rule_comparison(T=1000, n_forecasters=6, seed=42, outdir="outputs",
                               block="core", n_seeds=20):
    """Compare five weight rules under two deposit policies.

    Deposit policies tested:
      Fixed-Unit:          b_i = 1 (no deposit signal — isolates skill)
      Bankroll-Confidence: b_i from wealth × confidence proxy (realistic)

    Weight rules (applied to same quantile reports):
      Uniform:     w proportional to 1
      Deposit:     w proportional to b_i
      Skill:       w proportional to sigma_i
      Mechanism:   w proportional to m_i = b_i * g(sigma_i)
      Best-single: all weight on lowest-tau forecaster (oracle)

    Uses latent-fixed DGP with heterogeneous tau_i in [0.15, 1.0].
    """
    from onlinev2.legacy_dgps import generate_truth_and_quantile_reports_latent

    ep = _exp_paths(outdir, "weight_rule_comparison", block)

    tau_i = np.array([0.15, 0.22, 0.32, 0.46, 0.68, 1.00])[:n_forecasters]
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    T0 = 300
    S = max(1, int(n_seeds))
    seeds = [seed + s for s in range(S)]

    deposit_policies = {
        "fixed_unit": {
            "label": "Fixed-Unit ($b_i \\equiv 1$)",
            "sim_kw": dict(deposit_mode="fixed", fixed_deposit=1.0, lam=0.3),
        },
        "bankroll_conf": {
            "label": "Bankroll-Confidence",
            "sim_kw": dict(deposit_mode="bankroll", eta=2.0, W0=10.0, lam=0.05,
                           f_stake=0.3, b_max=10.0, beta_c=1.0,
                           c_min=0.8, c_max=1.3, omega_max=0.25),
        },
    }

    weight_rules = ["uniform", "deposit", "skill", "mechanism", "best_single"]
    rule_labels = {
        "uniform": "Uniform", "deposit": "Deposit",
        "skill": "Skill", "mechanism": "Mechanism",
        "best_single": "Best-single",
    }
    rule_colors = {
        "uniform": COLORS["blue"], "deposit": COLORS["green"],
        "skill": COLORS["orange"], "mechanism": COLORS["pink"],
        "best_single": COLORS["purple"],
    }

    seed_crps_ws = {dp: {wr: [] for wr in weight_rules} for dp in deposit_policies}
    seed_crps_all = {dp: {wr: [] for wr in weight_rules} for dp in deposit_policies}
    last_results = {}

    for s in seeds:
        y, q_reports, _ = generate_truth_and_quantile_reports_latent(
            T, n_forecasters, tau_i, taus, seed=s, sigma_z=1.0,
        )

        for dp_key, dp_cfg in deposit_policies.items():
            res = run_simulation(
                T=T, n_forecasters=n_forecasters, seed=s,
                scoring_mode="quantiles_crps", taus=taus,
                y_pre=y, q_reports_pre=q_reports, forecaster_noise_pre=tau_i,
                missing_prob=0.1, store_history=True, **dp_cfg["sim_kw"],
            )

            crps = _crps_for_weight_rules(y, q_reports, taus, res, tau_i)

            for wr in weight_rules:
                seed_crps_all[dp_key][wr].append(_crps_mean(crps[wr]))
                seed_crps_ws[dp_key][wr].append(_crps_mean(crps[wr][T0:]))

            if s == seeds[-1]:
                last_results[dp_key] = {"crps": crps, "label": dp_cfg["label"]}

    # --- CSV ---
    with open(ep.data("weight_rule_comparison.csv"), "w") as f:
        f.write("deposit_policy,weight_rule,mean_crps_all,se_all,mean_crps_warmstart,se_ws\n")
        for dp in deposit_policies:
            for wr in weight_rules:
                va, vw = np.array(seed_crps_all[dp][wr]), np.array(seed_crps_ws[dp][wr])
                f.write(f"{dp},{wr},{np.mean(va):.6f},{_se(va,S):.6f},"
                        f"{np.mean(vw):.6f},{_se(vw,S):.6f}\n")

    # --- Print ---
    print(f"\nWeight Rule Comparison — {S} seeds, warm-start t > {T0}")
    print("=" * 70)
    for dp_key, dp_cfg in deposit_policies.items():
        print(f"\n  Deposit policy: {dp_key}")
        for wr in weight_rules:
            v = np.array(seed_crps_ws[dp_key][wr])
            label = f"{rule_labels[wr]:14s} | {dp_key}"
            print(f"    {label:40s}  CRPS = {np.mean(v):.5f} +/- {_se(v,S):.5f}")

    # --- Plot ---
    try:
        pass
    except Exception:
        return

    n_dp = len(deposit_policies)
    fig, axes = new_figure(2, n_dp, figsize=(7 * n_dp, 10))

    for col, dp_key in enumerate(deposit_policies):
        rd = last_results[dp_key]

        ax = axes[0, col]
        for wr in weight_rules:
            cum = _cummean(rd["crps"][wr])
            ax.plot(cum, color=rule_colors[wr],
                    label=f"{rule_labels[wr]}", linewidth=1.4)
        ax.axvline(T0, color=COLORS["slate"], ls="-", lw=0.8, alpha=0.5)
        ax.set(xlabel="Round $t$", ylabel="Cumulative mean CRPS")
        ax.set_title(rd["label"], fontsize=11, fontweight="bold")
        ax.legend(fontsize=8)

        ax = axes[1, col]
        x_pos = np.arange(len(weight_rules))
        vals = [float(np.mean(seed_crps_ws[dp_key][wr])) for wr in weight_rules]
        ses = [_se(seed_crps_ws[dp_key][wr], S) for wr in weight_rules]
        ax.bar(x_pos, vals,
                      color=[rule_colors[wr] for wr in weight_rules],
                      edgecolor="white", alpha=0.85)
        ax.errorbar(x_pos, vals, yerr=ses, fmt="none",
                    ecolor=COLORS["truth"], capsize=4, linewidth=1.2)
        for i, wr in enumerate(weight_rules):
            ax.text(i, vals[i] + ses[i] + 0.0003, f"{vals[i]:.4f}",
                    ha="center", fontsize=7, color=COLORS["slate"])
        ax.set_xticks(x_pos)
        ax.set_xticklabels([rule_labels[wr] for wr in weight_rules],
                           fontsize=8, rotation=15, ha="right")
        ax.set(ylabel=f"Mean CRPS (warm-start $t > {T0}$)")

    fig.suptitle("Which weight rule is best?\n"
                 f"(Latent-Fixed DGP, $\\tau_i \\in [0.15, 1.0]$, {S} seeds)",
                 fontsize=13, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("weight_rule_comparison.png"))


# ===================================================================
# M2) Deposit Policy Comparison
#     Question: "Which deposit generation method produces the best
#     aggregate forecast?"
#     Method: fix the weight rule (Mechanism), vary the deposit policy.
# ===================================================================

def run_deposit_policy_comparison(T=1000, n_forecasters=6, seed=42, outdir="outputs",
                                  block="core", n_seeds=20):
    """Compare four deposit policies under the Mechanism weight rule.

    Deposit policies:
      IID-Exp:             b ~ Exp(1), independent of quality (noise baseline)
      Fixed-Unit:          b = 1 for all active agents
      Oracle-Precision:    b proportional to 1/tau_i^2 (knows true noise — upper bound)
      Bankroll-Confidence: b from wealth × quantile-width confidence proxy

    Weight rule: always Mechanism (w proportional to m_i).

    Uses latent-fixed DGP with heterogeneous tau_i in [0.15, 1.0].
    """
    from onlinev2.legacy_dgps import generate_truth_and_quantile_reports_latent

    ep = _exp_paths(outdir, "deposit_policy_comparison", block)

    tau_i = np.array([0.15, 0.22, 0.32, 0.46, 0.68, 1.00])[:n_forecasters]
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    T0 = 300
    S = max(1, int(n_seeds))
    seeds = [seed + s for s in range(S)]

    deposit_policies = {
        "iid_exp": {
            "label": "IID-Exp ($b \\sim \\mathrm{Exp}(1)$)",
            "sim_kw": dict(deposit_mode="exponential", lam=0.3),
        },
        "fixed_unit": {
            "label": "Fixed-Unit ($b \\equiv 1$)",
            "sim_kw": dict(deposit_mode="fixed", fixed_deposit=1.0, lam=0.3),
        },
        "oracle_precision": {
            "label": "Oracle-Precision ($b \\propto 1/\\tau^2$)",
            "oracle": True,
        },
        "bankroll_conf": {
            "label": "Bankroll-Confidence",
            "sim_kw": dict(deposit_mode="bankroll", eta=2.0, W0=10.0, lam=0.05,
                           f_stake=0.3, b_max=10.0, beta_c=1.0,
                           c_min=0.8, c_max=1.3, omega_max=0.25),
        },
    }

    dp_colors = {
        "iid_exp": COLORS["blue"], "fixed_unit": COLORS["orange"],
        "oracle_precision": COLORS["green"], "bankroll_conf": COLORS["pink"],
    }

    seed_crps_all = {dp: [] for dp in deposit_policies}
    seed_crps_ws = {dp: [] for dp in deposit_policies}
    last_crps = {}

    for s in seeds:
        y, q_reports, _ = generate_truth_and_quantile_reports_latent(
            T, n_forecasters, tau_i, taus, seed=s, sigma_z=1.0,
        )

        for dp_key, dp_cfg in deposit_policies.items():
            if dp_cfg.get("oracle"):
                res = run_simulation(
                    T=T, n_forecasters=n_forecasters, seed=s,
                    scoring_mode="quantiles_crps", taus=taus,
                    y_pre=y, q_reports_pre=q_reports, forecaster_noise_pre=tau_i,
                    missing_prob=0.1, lam=0.3, store_history=True,
                    deposit_mode="fixed", fixed_deposit=1.0,
                )
                inv_var = 1.0 / tau_i**2
                scale = inv_var / np.mean(inv_var)
                for t in range(T):
                    alpha_t = res["alpha_hist"][:, t]
                    active = (alpha_t == 0)
                    if not np.any(active):
                        continue
                    b_corr = np.where(active, scale, 0.0)
                    sigma_t = res["sigma_hist"][:, t]
                    m_corr = b_corr * (0.3 + 0.7 * sigma_t)
                    m_corr[~active] = 0.0
                    res["deposits_hist"][:, t] = b_corr
                    res["wager_hist"][:, t] = m_corr
                    q_t = q_reports[:, t, :]
                    M = float(np.sum(m_corr))
                    if M > 1e-12:
                        res["r_hat_hist"][t] = np.sum((m_corr / M)[:, None] * q_t, axis=0)
            else:
                res = run_simulation(
                    T=T, n_forecasters=n_forecasters, seed=s,
                    scoring_mode="quantiles_crps", taus=taus,
                    y_pre=y, q_reports_pre=q_reports, forecaster_noise_pre=tau_i,
                    missing_prob=0.1, store_history=True, **dp_cfg["sim_kw"],
                )

            mech_crps = np.full(T, np.nan)
            for t in range(T):
                r_hat = np.asarray(res["r_hat_hist"][t], dtype=np.float64)
                if r_hat.size == len(taus) and np.all(np.isfinite(r_hat)):
                    mech_crps[t] = float(crps_hat_from_quantiles(
                        float(y[t]), r_hat.reshape(1, -1), taus)[0])

            seed_crps_all[dp_key].append(_crps_mean(mech_crps))
            seed_crps_ws[dp_key].append(_crps_mean(mech_crps[T0:]))

            if s == seeds[-1]:
                last_crps[dp_key] = mech_crps

    # --- CSV ---
    with open(ep.data("deposit_policy_comparison.csv"), "w") as f:
        f.write("deposit_policy,mean_crps_all,se_all,mean_crps_warmstart,se_ws\n")
        for dp in deposit_policies:
            va, vw = np.array(seed_crps_all[dp]), np.array(seed_crps_ws[dp])
            f.write(f"{dp},{np.mean(va):.6f},{_se(va,S):.6f},"
                    f"{np.mean(vw):.6f},{_se(vw,S):.6f}\n")

    # --- Print ---
    print(f"\nDeposit Policy Comparison (Mechanism weight rule) — {S} seeds, t > {T0}")
    print("=" * 65)
    for dp_key, dp_cfg in deposit_policies.items():
        v = np.array(seed_crps_ws[dp_key])
        label = f"Mechanism | {dp_key}"
        print(f"  {label:40s}  CRPS = {np.mean(v):.5f} +/- {_se(v,S):.5f}")

    # --- Plot ---
    try:
        pass
    except Exception:
        return

    fig, axes = new_figure(1, 2, figsize=(14, 6))

    ax = axes[0]
    for dp_key in deposit_policies:
        cum = _cummean(last_crps[dp_key])
        ax.plot(cum, color=dp_colors[dp_key],
                label=f"Mechanism | {dp_key}", linewidth=1.5)
    ax.axvline(T0, color=COLORS["slate"], ls="-", lw=0.8, alpha=0.5)
    ax.set(xlabel="Round $t$", ylabel="Cumulative mean CRPS",
           title="Mechanism weight rule under different deposit policies")
    ax.legend(fontsize=8)

    ax = axes[1]
    dp_keys = list(deposit_policies.keys())
    x_pos = np.arange(len(dp_keys))
    vals = [float(np.mean(seed_crps_ws[dp])) for dp in dp_keys]
    ses = [_se(seed_crps_ws[dp], S) for dp in dp_keys]
    ax.bar(x_pos, vals, color=[dp_colors[dp] for dp in dp_keys],
           edgecolor="white", alpha=0.85)
    ax.errorbar(x_pos, vals, yerr=ses, fmt="none",
                ecolor=COLORS["truth"], capsize=4, linewidth=1.2)
    for i, dp in enumerate(dp_keys):
        ax.text(i, vals[i] + ses[i] + 0.0003, f"{vals[i]:.4f}",
                ha="center", fontsize=8, color=COLORS["slate"])
    ax.set_xticks(x_pos)
    ax.set_xticklabels([dp.replace("_", "-") for dp in dp_keys],
                       fontsize=8, rotation=15, ha="right")
    ax.set(ylabel=f"Mean CRPS (warm-start $t > {T0}$)",
           title="Bar comparison (lower = better)")

    fig.suptitle("Which deposit policy is best? (Mechanism weight rule)\n"
                 f"(Latent-Fixed DGP, $\\tau_i \\in [0.15, 1.0]$, {S} seeds)",
                 fontsize=13, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("deposit_policy_comparison.png"))


def run_selective_participation(T=1000, n_forecasters=6, seed=42, outdir="outputs", block="core",
                                seeds=None):
    """Does strategic timing of absence pay off vs random absence?

    For each kappa, we run three matched conditions at the SAME 50%
    absence rate for the target agent (F5, worst, tau=1.0):
      1) Random absence  — F5 misses 50% of rounds, chosen randomly.
      2) Strategic absence — F5 misses the 50% of rounds where their
         raw loss would be highest (oracle hindsight selection).

    The key metric is Delta_profit = profit(strategic) - profit(random).
    If kappa reduces this gap, the mechanism discourages strategic timing.

    Decision rule for strategic absence:
      absent(t) = 1 if loss_i(t) > median(loss_i), else 0
    This represents perfect foresight — the strongest possible
    manipulation — so any gap we find is an upper bound on real
    strategic advantage.
    """
    from onlinev2.legacy_dgps import generate_truth_and_quantile_reports_latent

    cfg = get_experiment_config("selective_participation")
    if seeds is None:
        seeds = cfg.seeds
    ep = _exp_paths(outdir, "selective_participation", block)

    tau_i = np.array([0.15, 0.22, 0.32, 0.46, 0.68, 1.00])[:n_forecasters]
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])

    y, q_reports, _ = generate_truth_and_quantile_reports_latent(
        T, n_forecasters, tau_i, taus, seed=seed, sigma_z=1.0,
    )

    # Per-round CRPS for each forecaster (to define strategic absence)
    per_round_loss = np.zeros((n_forecasters, T))
    for t in range(T):
        for i in range(n_forecasters):
            per_round_loss[i, t] = float(crps_hat_from_quantiles(
                float(y[t]), q_reports[i, t:t+1, :], taus)[0])

    strategic_idx = n_forecasters - 1
    loss_i = per_round_loss[strategic_idx]
    median_loss = float(np.median(loss_i))
    miss_rate = 0.5

    kappa_values = [0.0, 0.05, 0.2]
    results = {}
    rng = np.random.default_rng(seed + 100)

    for kappa in kappa_values:
        # --- Build alpha matrices (all other agents: 5% random miss) ---
        # Random baseline for other agents (same across conditions)
        alpha_others = (rng.random((n_forecasters, T)) < 0.05).astype(np.int32)
        alpha_others[strategic_idx, :] = 0  # will be overridden below

        # Condition 1: Random absence at 50%
        alpha_random = alpha_others.copy()
        random_miss = rng.random(T) < miss_rate
        alpha_random[strategic_idx, :] = random_miss.astype(np.int32)
        # Ensure at least one agent present each round
        for t in range(T):
            if int(alpha_random[:, t].sum()) == n_forecasters:
                j = int(rng.integers(0, n_forecasters - 1))
                alpha_random[j, t] = 0

        # Condition 2: Strategic absence — skip worst 50% by loss
        alpha_strategic = alpha_others.copy()
        strategic_miss = (loss_i > median_loss).astype(np.int32)
        alpha_strategic[strategic_idx, :] = strategic_miss
        for t in range(T):
            if int(alpha_strategic[:, t].sum()) == n_forecasters:
                j = int(rng.integers(0, n_forecasters - 1))
                alpha_strategic[j, t] = 0

        # Run simulations with custom alpha arrays
        res_random = run_simulation(
            T=T, n_forecasters=n_forecasters, seed=seed,
            scoring_mode="quantiles_crps", taus=taus,
            y_pre=y, q_reports_pre=q_reports, forecaster_noise_pre=tau_i,
            alpha_pre=alpha_random,
            missing_prob=0.0, lam=0.3, kappa=kappa, L0=0.5,
            store_history=True, deposit_mode="fixed", fixed_deposit=1.0,
        )
        res_strategic = run_simulation(
            T=T, n_forecasters=n_forecasters, seed=seed,
            scoring_mode="quantiles_crps", taus=taus,
            y_pre=y, q_reports_pre=q_reports, forecaster_noise_pre=tau_i,
            alpha_pre=alpha_strategic,
            missing_prob=0.0, lam=0.3, kappa=kappa, L0=0.5,
            store_history=True, deposit_mode="fixed", fixed_deposit=1.0,
        )

        r_prof = float(np.sum(res_random["profit_hist"][strategic_idx]))
        s_prof = float(np.sum(res_strategic["profit_hist"][strategic_idx]))
        delta_prof = s_prof - r_prof

        results[kappa] = {
            "random_sigma": res_random["sigma_hist"],
            "random_profit": res_random["profit_hist"],
            "strategic_sigma": res_strategic["sigma_hist"],
            "strategic_profit": res_strategic["profit_hist"],
            "delta_profit": delta_prof,
            "random_cum_profit": r_prof,
            "strategic_cum_profit": s_prof,
        }

    # --- Save data ---
    with open(ep.data("selective_participation.csv"), "w") as f:
        f.write("kappa,agent,random_mean_sigma,strategic_mean_sigma,"
                "random_cum_profit,strategic_cum_profit,delta_profit\n")
        for kappa in kappa_values:
            rd = results[kappa]
            for i in range(n_forecasters):
                r_sig = float(np.mean(rd["random_sigma"][i]))
                s_sig = float(np.mean(rd["strategic_sigma"][i]))
                r_p = float(np.sum(rd["random_profit"][i]))
                s_p = float(np.sum(rd["strategic_profit"][i]))
                f.write(f"{kappa},{i},{r_sig:.6f},{s_sig:.6f},"
                        f"{r_p:.6f},{s_p:.6f},{s_p - r_p:.6f}\n")

    # --- Print ---
    print("\nSelective Participation: Strategic vs Random Absence (matched 50%)")
    print("=" * 75)
    print(f"  {'kappa':>6s}  {'Random profit':>14s}  {'Strategic profit':>16s}  {'Delta':>10s}")
    for kappa in kappa_values:
        rd = results[kappa]
        print(f"  {kappa:6.2f}  {rd['random_cum_profit']:14.3f}"
              f"  {rd['strategic_cum_profit']:16.3f}"
              f"  {rd['delta_profit']:+10.3f}")

    # --- Plot ---
    try:
        pass
    except Exception:
        return

    fig, axes = new_figure(len(kappa_values), 3, figsize=(18, 4 * len(kappa_values)))

    for row, kappa in enumerate(kappa_values):
        rd = results[kappa]
        smooth_w = 80

        # Col 0: skill trajectories (random vs strategic)
        ax = axes[row, 0]
        for label_str, sigma_data, ls, color in [
            ("Random 50%", rd["random_sigma"], "-", COLORS["blue"]),
            ("Strategic 50%", rd["strategic_sigma"], "--", COLORS["orange"]),
        ]:
            raw = sigma_data[strategic_idx]
            smoothed = np.convolve(raw, np.ones(smooth_w)/smooth_w, mode="valid")
            ax.plot(np.arange(smooth_w-1, T), smoothed, ls=ls, linewidth=1.5,
                    color=color, label=f"F{strategic_idx} {label_str}")
        ax.axhline(float(np.mean(rd["random_sigma"][0, -200:])),
                    color=COLORS["slate"], ls="-", lw=0.7, alpha=0.5)
        ax.text(T * 0.7, float(np.mean(rd["random_sigma"][0, -200:])) + 0.01,
                "F0 (best)", fontsize=7, color=COLORS["slate"])
        ax.set(xlabel="Round $t$", ylabel="Learned skill $\\sigma$")
        ax.set_title(f"$\\kappa = {kappa}$" +
                     (" (freeze)" if kappa == 0 else " (decay toward $L_0$)"),
                     fontsize=10, fontweight="bold")
        ax.legend(fontsize=8)

        # Col 1: cumulative profit (random vs strategic)
        ax = axes[row, 1]
        for label_str, prof_data, ls, color in [
            ("Random 50%", rd["random_profit"], "-", COLORS["blue"]),
            ("Strategic 50%", rd["strategic_profit"], "--", COLORS["orange"]),
        ]:
            cum = np.cumsum(prof_data[strategic_idx])
            ax.plot(cum, ls=ls, linewidth=1.5, color=color,
                    label=f"F{strategic_idx} {label_str}")
        ax.axhline(0, color=COLORS["reference"], ls="-", lw=0.5)
        ax.set(xlabel="Round $t$", ylabel="Cumulative profit")
        ax.set_title(f"Profit: random vs strategic ($\\kappa={kappa}$)", fontsize=10)
        ax.legend(fontsize=8)

        # Col 2: delta profit (strategic advantage over time)
        ax = axes[row, 2]
        cum_r = np.cumsum(rd["random_profit"][strategic_idx])
        cum_s = np.cumsum(rd["strategic_profit"][strategic_idx])
        delta_t = cum_s - cum_r
        ax.plot(delta_t, color=COLORS["red"], linewidth=1.5)
        ax.axhline(0, color=COLORS["reference"], ls="-", lw=0.8)
        ax.fill_between(range(T), 0, delta_t,
                         where=delta_t > 0, alpha=0.15, color=COLORS["green"],
                         label="Strategic advantage")
        ax.fill_between(range(T), 0, delta_t,
                         where=delta_t < 0, alpha=0.15, color=COLORS["red"],
                         label="Strategic disadvantage")
        final_delta = rd["delta_profit"]
        ax.text(T * 0.5, ax.get_ylim()[1] * 0.8 if ax.get_ylim()[1] > 0 else 0.5,
                f"$\\Delta$profit = {final_delta:+.2f}",
                fontsize=10, fontweight="bold",
                color=COLORS["green"] if final_delta > 0 else COLORS["red"],
                ha="center")
        ax.set(xlabel="Round $t$",
               ylabel="$\\Delta$ profit (strategic $-$ random)")
        ax.set_title(f"Strategic advantage ($\\kappa={kappa}$)", fontsize=10)
        ax.legend(fontsize=7, loc="lower left")

    fig.suptitle("Selective Participation: Strategic vs Random Absence\n"
                 f"(F{strategic_idx}, $\\tau$={tau_i[strategic_idx]:.1f}, "
                 f"matched {int(miss_rate*100)}% absence rate)",
                 fontsize=13, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("selective_participation.png"))


# ===================================================================
# M3) Master comparison: all methods on same panel, paired deltas
# ===================================================================

def _headline_metrics_from_run(res, crps_by_rule, warm_start=0):
    """Compute mean CRPS per rule and concentration from run. Returns dict."""
    T = res["wager_hist"].shape[1]
    t_slice = slice(warm_start, T)
    out = {}
    for rule, arr in crps_by_rule.items():
        v = arr[t_slice][np.isfinite(arr[t_slice])]
        out[f"mean_crps_{rule}"] = float(np.mean(v)) if v.size else np.nan
    w = res["wager_hist"][:, t_slice]
    wealth = res.get("wealth_hist")
    hhi_list, n_eff_list = [], []
    for t in range(w.shape[1]):
        m_t = w[:, t]
        M = float(np.sum(m_t))
        if M > 1e-12:
            shares = m_t / M
            hhi_list.append(compute_hhi(shares))
            n_eff_list.append(compute_n_eff(shares))
    out["mean_HHI"] = float(np.mean(hhi_list)) if hhi_list else np.nan
    out["mean_N_eff"] = float(np.mean(n_eff_list)) if n_eff_list else np.nan
    if wealth is not None and wealth.shape[1] > t_slice.stop - 1:
        out["final_gini"] = float(compute_gini(wealth[:, t_slice.stop - 1]))
    else:
        out["final_gini"] = np.nan
    return out


def run_master_comparison(
    T=500,
    n_forecasters=10,
    missing_prob=0.2,
    seeds=None,
    outdir="outputs",
    block="core",
    warm_start=100,
    deposit_mode="exponential",
    stake_scale=1.0,
    omega_max=0.0,
):
    """Run all weighting methods on the same panel using exogenous deposits.

    Four core methods:
      - uniform
      - deposit
      - skill
      - mechanism

    Key design:
      - same y path per seed
      - same reports per seed
      - same missingness per seed
      - same exogenous deposit draws per seed
    """
    from onlinev2.experiments.benchmark_config import get_canonical_config

    # Keep canonical seed panel when no explicit override is provided.
    cfg = get_canonical_config(seeds=seeds, T=T, n_forecasters=n_forecasters)
    ep = _exp_paths(outdir, "master_comparison", block)
    taus = cfg.taus()
    tau_i = cfg.tau_i()

    rows = []
    for seed in cfg.seeds:
        y, q_reports_pre, _ = generate_truth_and_quantile_reports_latent(
            cfg.T, cfg.n_forecasters, tau_i, taus, seed=seed, sigma_z=1.0,
        )
        res = run_simulation(
            T=cfg.T, n_forecasters=cfg.n_forecasters, missing_prob=missing_prob,
            seed=seed, scoring_mode="quantiles_crps", taus=taus,
            y_pre=y, q_reports_pre=q_reports_pre, forecaster_noise_pre=tau_i,
            store_history=True,
            deposit_mode=deposit_mode,
            stake_scale=stake_scale,
            eta=2.0,
            lam=0.05,
            omega_max=omega_max,
        )
        crps = _crps_for_weight_rules(y, q_reports_pre, taus, res, tau_i)
        metrics = _headline_metrics_from_run(res, crps, warm_start=warm_start)
        crps_equal = metrics.get("mean_crps_uniform") or np.nan
        for method in ["uniform", "deposit", "skill", "mechanism", "best_single"]:
            mean_crps = metrics.get(f"mean_crps_{method}") or np.nan
            rows.append({
                "experiment": "master_comparison",
                "method": method,
                "seed": seed,
                "DGP": cfg.dgp_name,
                "preset": f"{deposit_mode}_deposits",
                "mean_crps": mean_crps,
                "delta_crps_vs_equal": mean_crps - crps_equal if np.isfinite(crps_equal) else np.nan,
                "mean_HHI": metrics.get("mean_HHI"),
                "mean_N_eff": metrics.get("mean_N_eff"),
                "final_gini": metrics.get("final_gini"),
            })

    _write_csv(
        ep.data("master_comparison.csv"),
        ["experiment", "method", "seed", "DGP", "preset", "mean_crps", "delta_crps_vs_equal",
         "mean_HHI", "mean_N_eff", "final_gini"],
        rows,
    )
    master = {
        "config": {
            "T": cfg.T,
            "n_forecasters": cfg.n_forecasters,
            "seeds": cfg.seeds,
            "warm_start": warm_start,
            "deposit_mode": deposit_mode,
            "stake_scale": stake_scale,
            "omega_max": omega_max,
        },
        "rows": rows,
    }
    with open(ep.data("master_comparison.json"), "w") as f:
        import json
        json.dump(master, f, indent=2)
    print("Master comparison written to", ep.data("master_comparison.json"))

    # --- Standardised output (Task 20.2) ---
    try:
        from onlinev2.experiments.helpers import write_standardised_output
        write_standardised_output(ep, rows, {
            "experiment_name": "master_comparison",
            "T": cfg.T, "n_forecasters": cfg.n_forecasters, "n_seeds": len(cfg.seeds),
            "dgp_name": cfg.dgp_name, "warm_start": warm_start,
            "deposit_mode": deposit_mode, "stake_scale": stake_scale,
            "omega_max": omega_max,
        }, baseline_method="uniform")
    except Exception:
        pass  # standardised output is optional

    # --- Four-panel diagnostic plot (Task 17.2) ---
    try:
        from onlinev2.plotting.four_panel import plot_four_panel
        # Aggregate per method across seeds for four-panel
        method_agg = {}
        for method in ["uniform", "deposit", "skill", "mechanism"]:
            method_rows = [r for r in rows if r["method"] == method]
            deltas = np.array([r["delta_crps_vs_equal"] for r in method_rows])
            deltas = deltas[np.isfinite(deltas)]
            if deltas.size > 0:
                _hhi_vals = [r.get("mean_HHI") for r in method_rows if r.get("mean_HHI") is not None]
                _neff_vals = [r.get("mean_N_eff") for r in method_rows if r.get("mean_N_eff") is not None]
                _gini_vals = [r.get("final_gini") for r in method_rows if r.get("final_gini") is not None]
                method_agg[method] = {
                    "delta_crps_mean": float(np.mean(deltas)),
                    "delta_crps_se": float(np.std(deltas, ddof=1) / np.sqrt(deltas.size)) if deltas.size > 1 else 0.0,
                    "mean_hhi": float(np.mean(_hhi_vals)) if _hhi_vals else 0.0,
                    "mean_n_eff": float(np.mean(_neff_vals)) if _neff_vals else 0.0,
                    "final_gini": float(np.mean(_gini_vals)) if _gini_vals else 0.0,
                }
        four_panel_results = {
            "experiment_name": "master_comparison",
            "methods": method_agg,
            "failure_notes": [],
        }
        plot_four_panel(four_panel_results, ep.plot("four_panel.png"))
    except Exception:
        pass  # plotting is optional


# ===================================================================
# M4) Bankroll ablation: Full vs A-, B-, C-, D-, E-
# ===================================================================

def run_bankroll_ablation(T=400, n_forecasters=6, seed=42, outdir="outputs", block="core",
                          warm_start=80, seeds=None):
    """Five-step bankroll ablation plus C- variant: remove one step at a time.

    Full = A→B→C→D→E. A-=no confidence (c=1), B-=fixed deposit, C-=no skill gate (λ=1),
    D-=no cap (ω_max=1), E-=freeze wealth.

    Multi-seed support (≥20 seeds). Reports paired Δ CRPS for C- vs Full.
    """
    cfg = get_experiment_config("bankroll_ablation")
    if seeds is None:
        seeds = cfg.seeds
    T = max(T, cfg.T)
    n_forecasters = cfg.n_forecasters

    ep = _exp_paths(outdir, "bankroll_ablation", block)
    taus = cfg.taus()
    tau_i = cfg.tau_i()

    variants = [
        ("Full", dict(deposit_mode="bankroll", eta=2.0, W0=10.0, lam=0.05,
                     f_stake=0.3, b_max=10.0, beta_c=1.0, c_min=0.8, c_max=1.3, omega_max=0.25)),
        ("A-", dict(deposit_mode="bankroll", eta=2.0, W0=10.0, lam=0.05,
                    f_stake=0.3, b_max=10.0, use_constant_confidence=True, omega_max=0.25)),
        ("B-", dict(deposit_mode="fixed", fixed_deposit=1.0, lam=0.3)),
        ("C-", dict(deposit_mode="bankroll", eta=2.0, W0=10.0, lam=1.0,
                    f_stake=0.3, b_max=10.0, beta_c=1.0, c_min=0.8, c_max=1.3, omega_max=0.25)),
        ("D-", dict(deposit_mode="bankroll", eta=2.0, W0=10.0, lam=0.05,
                    f_stake=0.3, b_max=10.0, beta_c=1.0, c_min=0.8, c_max=1.3, omega_max=1.0)),
        ("E-", dict(deposit_mode="bankroll", eta=2.0, W0=10.0, lam=0.05,
                    f_stake=0.3, b_max=10.0, beta_c=1.0, c_min=0.8, c_max=1.3, omega_max=0.25, freeze_wealth=True)),
    ]

    all_rows = []
    for s in seeds:
        y, q_reports_pre, _ = generate_truth_and_quantile_reports_latent(
            T, n_forecasters, tau_i, taus, seed=s, sigma_z=cfg.sigma_z,
        )

        common = dict(
            T=T, n_forecasters=n_forecasters, missing_prob=0.2, seed=s,
            scoring_mode="quantiles_crps", taus=taus,
            y_pre=y, q_reports_pre=q_reports_pre, forecaster_noise_pre=tau_i,
            store_history=True,
        )

        seed_results = {}
        for label, kw in variants:
            res = run_simulation(**common, **kw)
            crps = _crps_for_weight_rules(y, q_reports_pre, taus, res, tau_i)
            metrics = _headline_metrics_from_run(res, crps, warm_start=warm_start)
            mean_crps = metrics.get("mean_crps_mechanism") or np.nan
            seed_results[label] = {"mean_crps": mean_crps, "metrics": metrics}

        full_crps = seed_results["Full"]["mean_crps"]
        for label, _ in variants:
            m = seed_results[label]["metrics"]
            all_rows.append({
                "variant": label,
                "seed": s,
                "mean_crps": seed_results[label]["mean_crps"],
                "delta_crps_vs_full": seed_results[label]["mean_crps"] - full_crps,
                "mean_HHI": m.get("mean_HHI"),
                "mean_N_eff": m.get("mean_N_eff"),
                "final_gini": m.get("final_gini"),
            })

    # --- Write CSV ---
    _write_csv(
        ep.data("bankroll_ablation.csv"),
        ["variant", "seed", "mean_crps", "delta_crps_vs_full", "mean_HHI", "mean_N_eff", "final_gini"],
        all_rows,
    )

    # --- Aggregate across seeds for summary.json ---
    summary = {"experiment_name": "bankroll_ablation",
               "config": {"T": T, "n_forecasters": n_forecasters, "n_seeds": len(seeds),
                           "warm_start": warm_start},
               "variants": {}}
    for label, _ in variants:
        variant_rows = [r for r in all_rows if r["variant"] == label]
        deltas = np.array([r["delta_crps_vs_full"] for r in variant_rows])
        deltas = deltas[np.isfinite(deltas)]
        if deltas.size > 0:
            mean_d = float(np.mean(deltas))
            se_d = float(np.std(deltas, ddof=1) / np.sqrt(deltas.size)) if deltas.size > 1 else 0.0
            summary["variants"][label] = {
                "delta_crps_mean": mean_d,
                "delta_crps_se": se_d,
                "delta_crps_ci_low": mean_d - 1.96 * se_d,
                "delta_crps_ci_high": mean_d + 1.96 * se_d,
                "n_seeds": int(deltas.size),
            }

    with open(ep.data("summary.json"), "w") as f:
        json.dump(summary, f, indent=2, default=str)
    print("Bankroll ablation written to", ep.data("bankroll_ablation.csv"))

    # --- Standardised output (Task 20.2) ---
    try:
        from onlinev2.experiments.helpers import write_standardised_output
        # Remap 'variant' to 'method' for standardised output compatibility
        std_rows = []
        for r in all_rows:
            std_rows.append({
                "method": r["variant"],
                "seed": r["seed"],
                "mean_crps": r["mean_crps"],
                "delta_crps_vs_equal": r.get("delta_crps_vs_full", np.nan),
                "mean_HHI": r.get("mean_HHI"),
                "mean_N_eff": r.get("mean_N_eff"),
                "final_gini": r.get("final_gini"),
            })
        write_standardised_output(ep, std_rows, {
            "experiment_name": "bankroll_ablation",
            "T": T, "n_forecasters": n_forecasters, "n_seeds": len(seeds),
            "dgp_name": cfg.dgp_name, "warm_start": warm_start,
        }, baseline_method="Full")
    except Exception:
        pass  # standardised output is optional

    # --- Four-panel diagnostic plot (Task 17.2) ---
    try:
        from onlinev2.plotting.four_panel import plot_four_panel
        four_panel_methods = {}
        for label, _ in variants:
            info = summary.get("variants", {}).get(label, {})
            four_panel_methods[label] = {
                "delta_crps_mean": info.get("delta_crps_mean", 0.0),
                "delta_crps_se": info.get("delta_crps_se", 0.0),
            }
        four_panel_results = {
            "experiment_name": "bankroll_ablation",
            "methods": four_panel_methods,
            "failure_notes": [],
        }
        plot_four_panel(four_panel_results, ep.plot("four_panel.png"))
    except Exception:
        pass  # plotting is optional


# ===================================================================
# N) Weight learning: exogenous vs endogenous DGPs
# ===================================================================

def run_weight_learning_comparison(T=15000, seed=42, outdir="outputs", block="core"):
    """Compare weight learning across exogenous and endogenous DGPs.

    Weights are NOT constrained to sum to 1.  Each forecaster's weight is
    independent, matching the wagering mechanism where m_i = b_i*(λ+(1-λ)σ_i)
    is set per-agent.

    For endogenous DGPs (aggregation), truth = w^T x + eps, so the LMS
    should recover the raw structural weights.

    For exogenous DGPs (baseline, latent_fixed), truth is independent of
    reports.  The LMS converges to weights proportional to inverse-variance,
    but the absolute scale is unconstrained.
    """
    from onlinev2.dgps import get_dgp
    from onlinev2.experiments.runners.weight_learning import (
        _link_inv,
        online_weight_learning,
    )

    ep = _exp_paths(outdir, "weight_learning_comparison", block)
    n = 3

    # --- Define DGP scenarios ---
    scenarios = []

    # 1) Baseline (exogenous): y ~ U(0,1), reports = y + noise
    out_base = get_dgp("baseline").generate(
        seed=seed, T=T, n_forecasters=n,
    )
    noise_sigmas = out_base.tau_true
    # Optimal weights are proportional to 1/σ² (inverse-variance).
    # Without simplex constraint the LMS finds its own scale, so we
    # record the unnormalised direction for reference.
    inv_var = 1.0 / noise_sigmas**2
    scenarios.append({
        "name": "Baseline (exogenous)",
        "y": out_base.y, "reports": out_base.reports,
        "link": "identity",
        "w_target_direction": inv_var / inv_var.sum(),
        "target_label": "Optimal direction (inv-var)",
        "noise_info": [f"$\\sigma$={s:.3f}" for s in noise_sigmas],
    })

    # 2) Latent-fixed (exogenous): y = Phi(Z), reports = Phi(posterior mean)
    tau_i = np.array([0.3, 0.7, 1.5])
    out_latent = get_dgp("latent_fixed").generate(
        seed=seed, T=T, n=n, tau_i=tau_i, sigma_z=1.0,
    )
    sigma_z = 1.0
    post_var = (sigma_z**2 * tau_i**2) / (sigma_z**2 + tau_i**2)
    inv_post_var = 1.0 / post_var
    scenarios.append({
        "name": "Latent-Fixed (exogenous)",
        "y": out_latent.y, "reports": out_latent.reports,
        "link": "probit",
        "w_target_direction": inv_post_var / inv_post_var.sum(),
        "target_label": "Optimal direction (inv-post-var)",
        "noise_info": [f"$\\tau$={t:.1f}" for t in tau_i],
    })

    # 3) Aggregation M1 (endogenous): y = w^T x + eps
    #    The raw weights ARE the target — no normalisation.
    true_w = np.array([0.8, 0.1, 0.5])
    out_agg = get_dgp("aggregation_method1").generate(
        seed=seed, T=T, n_forecasters=n,
        w=true_w, normalise_w=False,
    )
    scenarios.append({
        "name": "Aggregation M1 (endogenous)",
        "y": out_agg.y, "reports": out_agg.reports,
        "link": "probit",
        "w_target_raw": true_w.copy(),
        "target_label": "True $w$",
        "noise_info": [f"$w$={w:.1f}" for w in true_w],
    })

    # --- Run LMS on each scenario (no simplex constraint) ---
    fig, axes = new_figure(len(scenarios), 2, figsize=(14, 4.5 * len(scenarios)))

    for row, sc in enumerate(scenarios):
        y, reports, link = sc["y"], sc["reports"], sc["link"]
        is_endogenous = "w_target_raw" in sc

        # Apply inverse link for learning in latent space
        if link == "probit":
            y_learn = _link_inv(y, "probit")
            r_learn = _link_inv(reports, "probit")
        else:
            y_learn = y
            r_learn = reports

        w_hist = online_weight_learning(
            y_learn, r_learn, eta=0.02, eta_decay=1e-5,
            project_to_simplex=False,
        )

        # Use mean of last 1000 rounds as "learned" weight — more
        # representative than a single snapshot, especially for the
        # oscillatory endogenous DGP.
        tail = min(1000, T)
        w_final = w_hist[:, -tail:].mean(axis=1)

        if is_endogenous:
            w_target = sc["w_target_raw"]
            mae_w = np.mean(np.abs(w_target - w_final))
        else:
            w_target_dir = sc["w_target_direction"]
            w_final_dir = w_final / (w_final.sum() + 1e-12)
            mae_w = np.mean(np.abs(w_target_dir - w_final_dir))

        # Save data
        with open(ep.data(f"{sc['name'].split()[0].lower()}_weights.csv"), "w") as f:
            if is_endogenous:
                f.write("forecaster,w_target,w_learned,abs_error\n")
                for i in range(n):
                    f.write(f"{i},{w_target[i]:.6f},{w_final[i]:.6f},"
                            f"{abs(w_target[i] - w_final[i]):.6f}\n")
            else:
                f.write("forecaster,w_target_dir,w_learned_dir,w_learned_raw,abs_error_dir\n")
                for i in range(n):
                    f.write(f"{i},{w_target_dir[i]:.6f},"
                            f"{w_final_dir[i]:.6f},{w_final[i]:.6f},"
                            f"{abs(w_target_dir[i] - w_final_dir[i]):.6f}\n")

        # --- Left panel: weight trajectories ---
        ax = axes[row, 0]
        smooth_w = 200
        for i in range(n):
            raw = w_hist[i]
            ax.plot(range(T), raw, color=agent_color(i), alpha=0.08, linewidth=0.4)
            smoothed = np.convolve(raw, np.ones(smooth_w)/smooth_w, mode="valid")
            x_smooth = np.arange(smooth_w - 1, T)
            ax.plot(x_smooth, smoothed, color=agent_color(i), linewidth=1.5,
                    label=f"F{i} ({sc['noise_info'][i]})")
            if is_endogenous:
                ax.axhline(w_target[i], color=agent_color(i), ls="-",
                           linewidth=1.0, alpha=0.6)
        ax.axhline(1.0 / n, color=COLORS["slate"], ls="-", linewidth=0.8, alpha=0.5)
        ax.text(T * 0.01, 1.0 / n + 0.02, f"start = 1/{n}", fontsize=7,
                color=COLORS["slate"], alpha=0.7)
        ax.set(xlabel="Round $t$", ylabel="Learned weight $w_i$")
        ax.set_title(sc["name"], fontsize=11, fontweight="bold")
        # Set y-axis to frame the data — cap at max target + margin
        if is_endogenous:
            y_top = max(w_target) * 1.35
        else:
            y_top = max(w_final.max(), 0.8) * 1.15
        ax.set_ylim(-0.03, y_top)
        leg = ax.legend(fontsize=7, loc="best", framealpha=1.0,
                        facecolor="white", edgecolor="#cccccc")
        leg.set_zorder(100)

        # --- Right panel: target vs learned bar chart ---
        ax = axes[row, 1]
        x_pos = np.arange(n)
        width = 0.35

        if is_endogenous:
            # Show raw weights side by side
            ax.bar(x_pos - width/2, w_target, width,
                   color=[agent_color(i) for i in range(n)], alpha=0.4,
                   edgecolor="white", label=sc["target_label"])
            ax.bar(x_pos + width/2, w_final, width,
                   color=[agent_color(i) for i in range(n)], alpha=0.85,
                   edgecolor="white", label="Learned (mean last 1k)")
            for i in range(n):
                ax.text(x_pos[i] - width/2, w_target[i] + 0.01,
                        f"{w_target[i]:.3f}", ha="center", fontsize=7,
                        color=COLORS["slate"])
                ax.text(x_pos[i] + width/2, w_final[i] + 0.01,
                        f"{w_final[i]:.3f}", ha="center", fontsize=7,
                        color=COLORS["truth"])
            ax.set(ylabel="Weight (raw)")
            ax.set_title(f"Target vs learned — raw (MAE = {mae_w:.4f})",
                         fontsize=10)
        else:
            # Exogenous: show normalised directions
            ax.bar(x_pos - width/2, w_target_dir, width,
                   color=[agent_color(i) for i in range(n)], alpha=0.4,
                   edgecolor="white", label=sc["target_label"])
            ax.bar(x_pos + width/2, w_final_dir, width,
                   color=[agent_color(i) for i in range(n)], alpha=0.85,
                   edgecolor="white", label="Learned (direction)")
            for i in range(n):
                ax.text(x_pos[i] - width/2, w_target_dir[i] + 0.01,
                        f"{w_target_dir[i]:.3f}", ha="center", fontsize=7,
                        color=COLORS["slate"])
                ax.text(x_pos[i] + width/2, w_final_dir[i] + 0.01,
                        f"{w_final_dir[i]:.3f}", ha="center", fontsize=7,
                        color=COLORS["truth"])
            ax.set(ylabel="Weight (normalised direction)")
            ax.set_title(f"Target vs learned — direction (MAE = {mae_w:.4f})",
                         fontsize=10)

        ax.set_xticks(x_pos)
        ax.set_xticklabels([f"F{i}\n{sc['noise_info'][i]}" for i in range(n)],
                           fontsize=8)
        ax.legend(fontsize=8)

    fig.suptitle("Weight Learning: Exogenous vs Endogenous DGPs",
                 fontsize=14, fontweight="bold")
    fig.tight_layout()
    save_fig(fig, ep.plot("weight_learning_comparison.png"))

    print("\nWeight Learning Comparison")
    print("=" * 50)
    for sc in scenarios:
        if "w_target_raw" in sc:
            print(f"\n{sc['name']}:")
            print(f"  Target (raw): {sc['w_target_raw']}")
        else:
            print(f"\n{sc['name']}:")
            print(f"  Target direction: {sc['w_target_direction']}")


# ===================================================================
# Behaviour-driven experiments (user behaviour models)
# ===================================================================

def run_behaviour_matrix(outdir="outputs", seed=42, block="behaviour", write_summary=True):
    """
    Hold mechanism fixed. Vary only behaviour modules:
      - benign baselines
      - realistic frictions (bursty, wealth shocks, risk aversion, discrete staking)
      - adversaries (sybils, arbitrageur, collusion, manipulator, insider)
      - adaptive adversary variants
    """
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.policies.identity import (
        SingleAccountIdentity,
        SplitAccountIdentity,
    )
    from onlinev2.behaviour.policies.participation import (
        BaselineParticipation,
        BurstyParticipation,
        EdgeThresholdParticipation,
    )
    from onlinev2.behaviour.policies.reporting import (
        HedgedReporting,
        MiscalibratedReporting,
        TruthfulReporting,
    )
    from onlinev2.behaviour.policies.staking import (
        FixedFractionStaking,
        HouseMoneyStaking,
        KellyLikeStaking,
        LumpyTierStaking,
    )
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "behaviour_matrix", block)

    T = 1000
    n_users = 10
    rng = np.random.default_rng(seed)
    y = rng.uniform(0.0, 1.0, size=T)

    scenarios = {
        "benign_baseline": {"participation": BaselineParticipation(), "reporting": TruthfulReporting(), "staking": FixedFractionStaking()},
        "bursty_kelly": {"participation": BurstyParticipation(), "reporting": TruthfulReporting(), "staking": KellyLikeStaking()},
        "risk_averse_hedged": {"participation": BaselineParticipation(), "reporting": HedgedReporting(), "staking": HouseMoneyStaking()},
        "lumpy_miscalibrated": {"participation": BaselineParticipation(), "reporting": MiscalibratedReporting(), "staking": LumpyTierStaking()},
        "edge_threshold": {"participation": EdgeThresholdParticipation(), "reporting": TruthfulReporting(), "staking": FixedFractionStaking()},
        "sybil_split": {"participation": BaselineParticipation(), "reporting": TruthfulReporting(), "staking": FixedFractionStaking(), "identity": SplitAccountIdentity(k=3)},
    }

    results = {}
    dashboard_logs = {}
    for scenario_idx, (scenario_name, policies) in enumerate(scenarios.items()):
        pop = build_population(
            n_users, seed=seed,
            participation_policy=policies.get("participation"),
            reporting_policy=policies.get("reporting"),
            staking_policy=policies.get("staking"),
            identity_policy=policies.get("identity", SingleAccountIdentity()),
        )

        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        behaviour.reset(seed)

        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        for u in pop:
            state.wealth[u.traits.user_id] = u.traits.initial_wealth
            state.ewma_loss[u.traits.user_id] = 0.0

        profits = []
        n_t_list = []
        deposits_flat = []
        wagers_flat = []
        gini_ts = []
        n_eff_ts = []
        hhi_ts = []
        wealth_by_t = []
        participation_by_round = []
        top1_ts = []
        top5_ts = []
        agg_hist: list = []
        for t in range(T):
            pub = RoundPublicState(
                t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                weights_prev=state.weights_prev, sigma_prev=state.sigma,
                wealth_prev=state.wealth, profit_prev=state.profit_prev,
            )
            actions = behaviour.act(pub)
            state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
            behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
            agg_hist.append(logs["r_hat"])
            profits.append(sum(logs["profit"]))
            n_t_list.append(sum(1 for a in actions if a.participate))
            participation_by_round.append([1 if a.participate else 0 for a in actions])
            deposits_flat.extend(logs["deposits"])
            wagers_flat.extend(logs["m_agg"])
            gini_ts.append(logs["Gini"])
            n_eff_ts.append(logs["N_eff"])
            hhi_ts.append(logs["HHI"])
            wealth_by_t.append(list(logs["wealth"].values()))
            m_tot = float(np.sum(logs["m_agg"]))
            if m_tot > 1e-12:
                w_shares = np.array(logs["m_agg"]) / m_tot
                sorted_w = np.sort(w_shares)[::-1]
                top1_ts.append(float(np.max(w_shares)))
                top5_ts.append(float(np.sum(sorted_w[:5])) if len(sorted_w) >= 5 else float(np.sum(sorted_w)))
            else:
                top1_ts.append(0.0)
                top5_ts.append(0.0)

        if scenario_idx == 0 and write_summary:
            dashboard_logs["participation_per_round"] = n_t_list
            dashboard_logs["deposits_flat"] = deposits_flat
            dashboard_logs["wagers_flat"] = wagers_flat
            dashboard_logs["gini_ts"] = gini_ts
            dashboard_logs["n_eff_ts"] = n_eff_ts
            dashboard_logs["hhi_ts"] = hhi_ts
            dashboard_logs["top1_share"] = top1_ts
            dashboard_logs["top5_share"] = top5_ts
            gap_list = []
            n_acc = len(participation_by_round[0]) if participation_by_round else 0
            for i in range(n_acc):
                prev_t = -1
                for t in range(T):
                    if participation_by_round[t][i] == 1:
                        if prev_t >= 0:
                            gap_list.append(t - prev_t)
                        prev_t = t
            if gap_list:
                dashboard_logs["gap_list"] = gap_list
            W_arr = np.array(wealth_by_t)
            if W_arr.size:
                ruin_rate_ts = np.mean(W_arr <= 0, axis=1)
                dashboard_logs["ruin_rate_ts"] = ruin_rate_ts.tolist()

        results[scenario_name] = {
            "total_profit": sum(profits),
            "mean_round_profit": float(np.mean(profits)),
            "final_gini": logs["Gini"],
            "final_n_eff": logs["N_eff"],
        }

    rows = []
    for name, res in results.items():
        rows.append({"scenario": name, **res})
    _write_csv(ep.data("behaviour_matrix.csv"),
               ["scenario", "total_profit", "mean_round_profit", "final_gini", "final_n_eff"],
               rows)
    print("\nBehaviour Matrix Results")
    print("=" * 60)
    for name, res in results.items():
        print(f"  {name}: profit={res['total_profit']:.2f}, gini={res['final_gini']:.3f}, N_eff={res['final_n_eff']:.1f}")

    if write_summary and dashboard_logs:
        try:
            from onlinev2.behaviour.plotting.behaviour_dashboard import make_behaviour_dashboard
            from onlinev2.experiments.summarise import write_experiment_summary
            config = {"experiment_name": "behaviour_matrix", "T": T, "n_users": n_users, "block": block,
                      "lam": 0.3, "eta": 1.0, "sigma_min": 0.1, "omega_max": 0.0}
            logs = {"mean_N_t": float(np.mean(dashboard_logs["participation_per_round"])),
                    "mean_HHI": float(np.mean(dashboard_logs["hhi_ts"])),
                    "mean_N_eff": float(np.mean(dashboard_logs["n_eff_ts"])),
                    "final_gini": dashboard_logs["gini_ts"][-1] if dashboard_logs["gini_ts"] else None,
                    "final_ruin_rate": dashboard_logs["ruin_rate_ts"][-1] if dashboard_logs.get("ruin_rate_ts") else None}
            write_experiment_summary(ep, config, logs)
            make_behaviour_dashboard(ep, dashboard_logs, config)
        except Exception as e:
            print(f"Warning: dashboard/summary failed: {e}")


def run_preference_stress_test(outdir="outputs", seed=42, block="behaviour", write_summary=True,
                               seeds=None, scoring_mode="quantiles_crps"):
    """
    Hold signal quality fixed, compare truthful vs hedged risk-averse,
    evaluate bias and welfare.

    Uses quantiles_crps scoring so hedged reporting (narrower quantile spreads)
    actually differs from truthful. In point_mae mode, hedging has no effect
    on the point forecast, so both scenarios produce identical results.

    Multi-seed support (≥20 seeds), T ≥ 1000 rounds.
    """
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.policies.reporting import HedgedReporting, TruthfulReporting
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.core.scoring import TAUS_COARSE
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    cfg = get_experiment_config("preference_stress_test")
    if seeds is None:
        seeds = cfg.seeds
    T = max(1000, cfg.T)
    n_users = 10

    ep = _exp_paths(outdir, "preference_stress_test", block)

    taus = TAUS_COARSE if scoring_mode == "quantiles_crps" else None

    all_rows = []
    dashboard_logs = {}
    for s_idx, s in enumerate(seeds):
        rng = np.random.default_rng(s)
        y = rng.uniform(0.0, 1.0, size=T)

        seed_results = {}
        for scenario_idx, (label, reporting) in enumerate([("truthful", TruthfulReporting()), ("hedged", HedgedReporting())]):
            pop = build_population(n_users, seed=s, reporting_policy=reporting)
            behaviour = CompositeBehaviourModel(pop, scoring_mode=scoring_mode, taus=taus)
            behaviour.reset(s)

            params = MechanismParams(scoring_mode=scoring_mode, taus=taus)
            state = MechanismState()
            for u in pop:
                state.wealth[u.traits.user_id] = u.traits.initial_wealth

            profits = []
            n_t_list = []
            participation_by_round = []
            deposits_flat = []
            wagers_flat = []
            gini_ts = []
            n_eff_ts = []
            hhi_ts = []
            top1_ts = []
            top5_ts = []
            wealth_by_t = []
            agg_hist: list = []
            for t in range(T):
                pub = RoundPublicState(
                    t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                    weights_prev=state.weights_prev, sigma_prev=state.sigma,
                    wealth_prev=state.wealth, profit_prev=state.profit_prev,
                )
                actions = behaviour.act(pub)
                state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
                behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
                profits.append(sum(logs["profit"]))
                n_t_list.append(sum(1 for a in actions if a.participate))
                participation_by_round.append([1 if a.participate else 0 for a in actions])
                deposits_flat.extend(logs["deposits"])
                wagers_flat.extend(logs["m_agg"])
                gini_ts.append(logs["Gini"])
                n_eff_ts.append(logs["N_eff"])
                hhi_ts.append(logs["HHI"])
                wealth_by_t.append(list(logs["wealth"].values()))
                m_tot = float(np.sum(logs["m_agg"]))
                if m_tot > 1e-12:
                    w_shares = np.array(logs["m_agg"]) / m_tot
                    sorted_w = np.sort(w_shares)[::-1]
                    top1_ts.append(float(np.max(w_shares)))
                    top5_ts.append(float(np.sum(sorted_w[:5])) if len(sorted_w) >= 5 else float(np.sum(sorted_w)))
                else:
                    top1_ts.append(0.0)
                    top5_ts.append(0.0)
                agg_hist.append(logs["r_hat"])

            # Capture dashboard logs from first seed, first scenario
            if s_idx == 0 and scenario_idx == 0 and write_summary:
                dashboard_logs["participation_per_round"] = n_t_list
                dashboard_logs["deposits_flat"] = deposits_flat
                dashboard_logs["wagers_flat"] = wagers_flat
                dashboard_logs["gini_ts"] = gini_ts
                dashboard_logs["n_eff_ts"] = n_eff_ts
                dashboard_logs["hhi_ts"] = hhi_ts
                dashboard_logs["top1_share"] = top1_ts
                dashboard_logs["top5_share"] = top5_ts
                gap_list = []
                n_acc = len(participation_by_round[0]) if participation_by_round else 0
                for i in range(n_acc):
                    prev_t = -1
                    for t_g in range(T):
                        if participation_by_round[t_g][i] == 1:
                            if prev_t >= 0:
                                gap_list.append(t_g - prev_t)
                            prev_t = t_g
                if gap_list:
                    dashboard_logs["gap_list"] = gap_list
                W_arr = np.array(wealth_by_t)
                if W_arr.size:
                    dashboard_logs["ruin_rate_ts"] = np.mean(W_arr <= 0, axis=1).tolist()

            seed_results[label] = {
                "total_profit": sum(profits),
                "mean_profit": float(np.mean(profits)),
                "final_gini": logs["Gini"],
            }

        for label, r in seed_results.items():
            all_rows.append({"scenario": label, "seed": s, **r})

    # --- Write CSV ---
    _write_csv(ep.data("preference_stress.csv"),
               ["scenario", "seed", "total_profit", "mean_profit", "final_gini"], all_rows)

    # --- Aggregate across seeds for summary ---
    summary = {"experiment_name": "preference_stress_test",
               "config": {"T": T, "n_users": n_users, "n_seeds": len(seeds),
                           "scoring_mode": scoring_mode, "block": block},
               "scenarios": {}}
    for label in ["truthful", "hedged"]:
        scenario_rows = [r for r in all_rows if r["scenario"] == label]
        profits = np.array([r["total_profit"] for r in scenario_rows])
        if profits.size > 0:
            mean_p = float(np.mean(profits))
            se_p = float(np.std(profits, ddof=1) / np.sqrt(profits.size)) if profits.size > 1 else 0.0
            summary["scenarios"][label] = {
                "mean_total_profit": mean_p,
                "se_total_profit": se_p,
                "ci_low": mean_p - 1.96 * se_p,
                "ci_high": mean_p + 1.96 * se_p,
                "n_seeds": int(profits.size),
            }

    print("\nPreference Stress Test (quantiles_crps, multi-seed)")
    print("=" * 55)
    for label, info in summary.get("scenarios", {}).items():
        print(f"  {label}: profit={info['mean_total_profit']:.2f} ± {info['se_total_profit']:.2f}")

    if write_summary:
        try:
            with open(ep.data("summary.json"), "w") as f:
                json.dump(summary, f, indent=2, default=str)
        except Exception as e:
            print(f"Warning: summary write failed: {e}")
        try:
            from onlinev2.experiments.summarise import write_experiment_summary
            logs_out = {"final_gini": all_rows[0]["final_gini"] if all_rows else None}
            config = {"experiment_name": "preference_stress_test", "T": T, "n_users": n_users, "block": block}
            write_experiment_summary(ep, config, logs_out)
            if dashboard_logs:
                from onlinev2.behaviour.plotting.behaviour_dashboard import make_behaviour_dashboard
                make_behaviour_dashboard(ep, dashboard_logs, config)
        except Exception as e:
            print(f"Warning: summary/dashboard failed: {e}")


def run_intermittency_stress_test(outdir="outputs", seed=42, block="behaviour", write_summary=True):
    """
    Compare IID vs bursty vs edge-entry vs avoid-skill-decay participation,
    and compare missingness handling settings.
    """
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.policies.participation import (
        AvoidSkillDecayParticipation,
        BaselineParticipation,
        BurstyParticipation,
        EdgeThresholdParticipation,
    )
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "intermittency_stress_test", block)

    T = 1000
    n_users = 10
    rng = np.random.default_rng(seed)
    y = rng.uniform(0.0, 1.0, size=T)

    participation_modes = {
        "iid": BaselineParticipation(),
        "bursty": BurstyParticipation(),
        "edge_threshold": EdgeThresholdParticipation(),
        "avoid_skill_decay": AvoidSkillDecayParticipation(sigma_floor=0.5),
    }

    results = {}
    dashboard_logs = {}
    for mode_idx, (label, part_policy) in enumerate(participation_modes.items()):
        pop = build_population(n_users, seed=seed, participation_policy=part_policy)
        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        behaviour.reset(seed)

        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        for u in pop:
            state.wealth[u.traits.user_id] = u.traits.initial_wealth

        n_participations = 0
        total_rounds = 0
        profits = []
        n_t_list = []
        participation_by_round = []
        deposits_flat = []
        wagers_flat = []
        gini_ts = []
        n_eff_ts = []
        hhi_ts = []
        top1_ts = []
        top5_ts = []
        wealth_by_t = []
        agg_hist: list = []
        for t in range(T):
            pub = RoundPublicState(
                t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                weights_prev=state.weights_prev, sigma_prev=state.sigma,
                wealth_prev=state.wealth, profit_prev=state.profit_prev,
            )
            actions = behaviour.act(pub)
            n_participations += sum(1 for a in actions if a.participate)
            total_rounds += len(actions)
            state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
            behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
            profits.append(sum(logs["profit"]))
            n_t_list.append(sum(1 for a in actions if a.participate))
            participation_by_round.append([1 if a.participate else 0 for a in actions])
            deposits_flat.extend(logs["deposits"])
            wagers_flat.extend(logs["m_agg"])
            gini_ts.append(logs["Gini"])
            n_eff_ts.append(logs["N_eff"])
            hhi_ts.append(logs["HHI"])
            wealth_by_t.append(list(logs["wealth"].values()))
            m_tot = float(np.sum(logs["m_agg"]))
            if m_tot > 1e-12:
                w_shares = np.array(logs["m_agg"]) / m_tot
                sorted_w = np.sort(w_shares)[::-1]
                top1_ts.append(float(np.max(w_shares)))
                top5_ts.append(float(np.sum(sorted_w[:5])) if len(sorted_w) >= 5 else float(np.sum(sorted_w)))
            else:
                top1_ts.append(0.0)
                top5_ts.append(0.0)
            agg_hist.append(logs["r_hat"])

        if mode_idx == 0 and write_summary:
            dashboard_logs["participation_per_round"] = n_t_list
            dashboard_logs["deposits_flat"] = deposits_flat
            dashboard_logs["wagers_flat"] = wagers_flat
            dashboard_logs["gini_ts"] = gini_ts
            dashboard_logs["n_eff_ts"] = n_eff_ts
            dashboard_logs["hhi_ts"] = hhi_ts
            dashboard_logs["top1_share"] = top1_ts
            dashboard_logs["top5_share"] = top5_ts
            gap_list = []
            n_acc = len(participation_by_round[0]) if participation_by_round else 0
            for i in range(n_acc):
                prev_t = -1
                for t in range(T):
                    if participation_by_round[t][i] == 1:
                        if prev_t >= 0:
                            gap_list.append(t - prev_t)
                        prev_t = t
            if gap_list:
                dashboard_logs["gap_list"] = gap_list
            W_arr = np.array(wealth_by_t)
            if W_arr.size:
                dashboard_logs["ruin_rate_ts"] = np.mean(W_arr <= 0, axis=1).tolist()

        results[label] = {
            "total_profit": sum(profits),
            "participation_rate": n_participations / max(total_rounds, 1),
            "final_n_eff": logs["N_eff"],
        }

    rows = [{"mode": k, **v} for k, v in results.items()]
    _write_csv(ep.data("intermittency_stress.csv"), ["mode", "total_profit", "participation_rate", "final_n_eff"], rows)
    print("\nIntermittency Stress Test")
    print("=" * 50)
    for label, r in results.items():
        print(f"  {label}: profit={r['total_profit']:.2f}, part_rate={r['participation_rate']:.2f}, N_eff={r['final_n_eff']:.1f}")

    if write_summary:
        try:
            from onlinev2.experiments.summarise import write_experiment_summary
            logs = {"mean_N_t": float(np.mean([r["participation_rate"] * n_users for r in results.values()])) if results else None,
                    "mean_N_eff": float(np.mean([r["final_n_eff"] for r in results.values()])) if results else None}
            config = {"experiment_name": "intermittency_stress_test", "T": T, "n_users": n_users, "block": block}
            write_experiment_summary(ep, config, logs)
            if dashboard_logs:
                from onlinev2.behaviour.plotting.behaviour_dashboard import make_behaviour_dashboard
                make_behaviour_dashboard(ep, dashboard_logs, config)
        except Exception as e:
            print(f"Warning: summary/dashboard failed: {e}")


def run_arbitrage_scan(outdir="outputs", seed=42, block="behaviour", write_summary=True, seeds=None):
    """
    Arbitrage across (lam, seed) grid.

    Feeds the arbitrageur an F_{t-1} snapshot of other agents' (report,
    effective_wager) so it can compute the exact weighted-median arbitrage
    point (Chen-Devanur-Pennock-Vaughan 2014, Theorem 3.3 applied to the
    MAE-WSWM used by this project). Runs ``seeds`` independent seeds per
    lambda and reports mean + 95% CI.
    """
    from onlinev2.behaviour.adversaries.arbitrageur import ArbitrageurBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "arbitrage_scan", block)

    T = 1000
    n_benign = 8
    if seeds is None:
        seeds = list(range(20))

    lam_grid = [0.0, 0.1, 0.3, 0.5, 0.8, 1.0]
    per_seed_rows = []
    agg_rows = []
    traj_cache: dict = {}

    for lam_val in lam_grid:
        for s in seeds:
            rng_s = np.random.default_rng(s)
            y = rng_s.uniform(0.0, 1.0, size=T)

            pop = build_population(n_benign, seed=s)
            arb_traits = UserTraits(
                user_id="arbitrageur_0", initial_wealth=10.0,
                noise_level=0.05, stake_fraction=0.4,
            )

            snapshot = {"p_others": np.array([0.4, 0.6]), "m_others": np.array([0.5, 0.5])}

            def target_others(_state, snap=snapshot):
                return np.asarray(snap["p_others"]), np.asarray(snap["m_others"])

            arb = ArbitrageurBehaviour(
                arb_traits, scoring_mode="point_mae",
                target_others=target_others,
            )
            arb.reset(s)

            behaviour = CompositeBehaviourModel(
                pop, adversary_behaviours={arb_traits.user_id: arb},
                scoring_mode="point_mae",
            )
            behaviour.reset(s)

            params = MechanismParams(lam=lam_val, scoring_mode="point_mae")
            state = MechanismState()
            for u in pop:
                state.wealth[u.traits.user_id] = u.traits.initial_wealth
            state.wealth[arb_traits.user_id] = arb_traits.initial_wealth

            arb_profit = 0.0
            agg_hist: list = []
            wealth_traj: list = []
            for t in range(T):
                pub = RoundPublicState(
                    t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                    weights_prev=state.weights_prev, sigma_prev=state.sigma,
                    wealth_prev=state.wealth, profit_prev=state.profit_prev,
                )
                actions = behaviour.act(pub)

                p_list, m_list = [], []
                for a in actions:
                    if a.account_id == arb_traits.user_id or not a.participate:
                        continue
                    p_list.append(float(a.report) if not isinstance(a.report, (list, tuple, np.ndarray))
                                  else float(np.asarray(a.report).mean()))
                    m_list.append(max(1e-6, float(a.deposit)))

                state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
                behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)

                if p_list:
                    snapshot["p_others"] = np.asarray(p_list, dtype=float)
                    snapshot["m_others"] = np.asarray(m_list, dtype=float)

                agg_hist.append(logs["r_hat"])
                wealth_traj.append(float(state.wealth.get(arb_traits.user_id, 0.0)))

                for i, aid in enumerate(logs["ids"]):
                    if aid == arb_traits.user_id:
                        arb_profit += logs["profit"][i]

            arb_found_count = sum(1 for e in arb.arbitrage_log if e.get("arbitrage_found", False))
            part_rounds = sum(1 for e in arb.arbitrage_log
                              if e.get("deposit", 0.0) > 0.0 and e.get("arbitrage_found", False))

            per_seed_rows.append({
                "lam": lam_val,
                "seed": s,
                "arb_total_profit": arb_profit,
                "arb_final_wealth": state.wealth.get(arb_traits.user_id, 0.0),
                "arbitrage_found_rounds": arb_found_count,
                "participation_rounds": part_rounds,
            })

            # Cache the first-seed trajectory for plotting (keeps output small).
            if s == seeds[0]:
                traj_cache.setdefault(lam_val, wealth_traj)

        # Aggregate for this lambda
        lam_rows = [r for r in per_seed_rows if r["lam"] == lam_val]
        profits = [r["arb_total_profit"] for r in lam_rows]
        summ = _mean_se_ci(profits)
        agg_rows.append({
            "lam": lam_val,
            "mean_profit": summ["mean"],
            "se_profit": summ["se"],
            "ci_low": summ["ci_low"],
            "ci_high": summ["ci_high"],
            "mean_final_wealth": float(np.mean([r["arb_final_wealth"] for r in lam_rows])),
            "mean_found_rounds": float(np.mean([r["arbitrage_found_rounds"] for r in lam_rows])),
            "mean_participation_rounds": float(np.mean([r["participation_rounds"] for r in lam_rows])),
            "n_seeds": summ["n"],
        })

    _write_csv(ep.data("arbitrage_scan.csv"),
               ["lam", "seed", "arb_total_profit", "arb_final_wealth",
                "arbitrage_found_rounds", "participation_rounds"],
               per_seed_rows)
    _write_csv(ep.data("arbitrage_scan_by_lam.csv"),
               ["lam", "mean_profit", "se_profit", "ci_low", "ci_high",
                "mean_final_wealth", "mean_found_rounds", "mean_participation_rounds", "n_seeds"],
               agg_rows)

    # Trajectory CSV: long format (lam, t, wealth) for plotting.
    traj_rows = []
    for lam_val, traj in traj_cache.items():
        for t, w in enumerate(traj):
            traj_rows.append({"lam": lam_val, "t": t, "wealth": float(w)})
    _write_csv(ep.data("arbitrage_wealth_trajectories.csv"),
               ["lam", "t", "wealth"], traj_rows)

    print("\nArbitrage Scan (multi-seed)")
    print("=" * 50)
    for r in agg_rows:
        print(f"  lam={r['lam']:.1f}: profit={r['mean_profit']:+.2f} ± {r['se_profit']:.2f} "
              f"(CI: {r['ci_low']:+.2f}..{r['ci_high']:+.2f}), "
              f"found_rounds={r['mean_found_rounds']:.0f}")

    if write_summary:
        try:
            from onlinev2.behaviour.plotting.adversary_plots import (
                plot_arbitrage_scan,
                plot_arbitrage_wealth_trajectories,
            )
            from onlinev2.behaviour.plotting.behaviour_dashboard import make_behaviour_dashboard
            from onlinev2.experiments.summarise import write_experiment_summary
            config = {"experiment_name": "arbitrage_scan", "T": T, "block": block, "n_seeds": len(seeds)}
            logs = {"attacker_cumulative_profit": float(np.mean([r["mean_profit"] for r in agg_rows])) if agg_rows else None}
            write_experiment_summary(ep, config, logs)
            arb_grid = {"lam_vals": [r["lam"] for r in agg_rows], "A_theta": np.array([r["mean_profit"] for r in agg_rows])}
            make_behaviour_dashboard(ep, {"arbitrage_grid": arb_grid}, config, extra_arbitrage_heatmap=True, arbitrage_csv_path=ep.data("arbitrage_A_theta.csv"))
            plot_arbitrage_scan(ep)
            plot_arbitrage_wealth_trajectories(ep)
        except Exception as e:
            print(f"Warning: summary/dashboard failed: {e}")


def run_detection_adaptation(outdir="outputs", seed=42, block="behaviour", write_summary=True,
                             seeds=None):
    """
    Train a simple detector on fixed manipulation templates,
    then evaluate adaptive evaders.

    Key fix: attacker deposits are non-zero (stake_fraction * wealth),
    attacker initial wealth = 50.0, so attackers actually participate
    with meaningful wagers. Previous version had zero effective wager
    because ManipulatorBehaviour.deposit defaulted to 0.

    Multi-seed support (≥20 seeds), T ≥ 1000 rounds.
    """
    from onlinev2.behaviour.adversaries.evader import AdaptiveEvaderBehaviour
    from onlinev2.behaviour.adversaries.manipulator import ManipulatorBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    cfg = get_experiment_config("detection_adaptation")
    if seeds is None:
        seeds = cfg.seeds
    T = max(1000, cfg.T)
    n_benign = 8

    ep = _exp_paths(outdir, "detection_adaptation", block)

    attacker_types = {
        "fixed_manipulator": lambda traits: ManipulatorBehaviour(traits, target=0.2, kappa=5.0, scoring_mode="point_mae"),
        "adaptive_evader": lambda traits: AdaptiveEvaderBehaviour(
            traits, target=0.2, kappa=5.0, scoring_mode="point_mae",
            suspicion_threshold=0.55, ewma_beta=0.3, quiet_cutback=0.35,
        ),
    }

    all_rows = []
    dashboard_logs = {}
    for s_idx, s in enumerate(seeds):
        rng = np.random.default_rng(s)
        y = rng.uniform(0.0, 1.0, size=T)

        for atk_idx, (atk_name, atk_factory) in enumerate(attacker_types.items()):
            pop = build_population(n_benign, seed=s)
            atk_traits = UserTraits(
                user_id="attacker_0", initial_wealth=50.0,
                noise_level=0.02, stake_fraction=0.3,
            )
            atk = atk_factory(atk_traits)
            atk.reset(s)

            # Online detector state: running stats on report deviation from
            # the population average. A simple z-score of (r_attacker - mean_others)
            # over the deposit-weighted report distribution.
            det_dev_sum = 0.0
            det_dev_sq = 0.0
            det_count = 0
            det_flag_count = 0
            det_score_sum = 0.0

            behaviour = CompositeBehaviourModel(
                pop, adversary_behaviours={atk_traits.user_id: atk},
                scoring_mode="point_mae",
            )
            behaviour.reset(s)

            params = MechanismParams(scoring_mode="point_mae")
            state = MechanismState()
            for u in pop:
                state.wealth[u.traits.user_id] = u.traits.initial_wealth
            state.wealth[atk_traits.user_id] = atk_traits.initial_wealth

            atk_profit = 0.0
            n_t_list = []
            participation_by_round = []
            deposits_flat = []
            wagers_flat = []
            gini_ts = []
            n_eff_ts = []
            hhi_ts = []
            top1_ts = []
            top5_ts = []
            wealth_by_t = []
            agg_hist: list = []
            for t in range(T):
                pub = RoundPublicState(
                    t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                    weights_prev=state.weights_prev, sigma_prev=state.sigma,
                    wealth_prev=state.wealth, profit_prev=state.profit_prev,
                )
                actions = behaviour.act(pub)

                # Ensure attacker deposit is non-zero (at least stake_fraction * wealth).
                # AgentAction is frozen; rebuild the attacker action if needed.
                from dataclasses import replace as _dc_replace
                new_actions = []
                for a in actions:
                    if a.account_id == atk_traits.user_id and a.participate:
                        atk_wealth = state.wealth.get(atk_traits.user_id, atk_traits.initial_wealth)
                        min_deposit = atk_traits.stake_fraction * max(atk_wealth, 1.0)
                        if a.deposit < min_deposit:
                            a = _dc_replace(a, deposit=float(min_deposit))
                    new_actions.append(a)
                actions = new_actions

                state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))

                # Online detector: score attacker anomaly as z-score on
                # |r_atk - mean_r_others| normalised by rolling std. Score
                # fed back to the evader through observe_round_result logs.
                r_atk = None
                r_others = []
                for a in actions:
                    if not a.participate or a.report is None:
                        continue
                    rep = float(a.report) if not isinstance(a.report, (list, tuple, np.ndarray)) else float(np.mean(a.report))
                    if a.account_id == atk_traits.user_id:
                        r_atk = rep
                    else:
                        r_others.append(rep)

                detector_score = None
                if r_atk is not None and len(r_others) >= 2:
                    dev = abs(r_atk - float(np.mean(r_others)))
                    det_count += 1
                    det_dev_sum += dev
                    det_dev_sq += dev * dev
                    if det_count > 5:
                        mu = det_dev_sum / det_count
                        var = max(1e-6, det_dev_sq / det_count - mu * mu)
                        z = (dev - mu) / np.sqrt(var)
                        detector_score = float(1.0 / (1.0 + np.exp(-0.75 * z)))
                        det_score_sum += detector_score
                        if detector_score >= 0.7:
                            det_flag_count += 1

                logs_with_det = dict(logs)
                if detector_score is not None:
                    logs_with_det["detector_scores"] = {atk_traits.user_id: detector_score}

                behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs_with_det)

                agg_hist.append(logs["r_hat"])

                for i, aid in enumerate(logs["ids"]):
                    if aid == atk_traits.user_id:
                        atk_profit += logs["profit"][i]

                n_t_list.append(sum(1 for a in actions if a.participate))
                participation_by_round.append([1 if a.participate else 0 for a in actions])
                deposits_flat.extend(logs["deposits"])
                wagers_flat.extend(logs["m_agg"])
                gini_ts.append(logs["Gini"])
                n_eff_ts.append(logs["N_eff"])
                hhi_ts.append(logs["HHI"])
                wealth_by_t.append(list(logs["wealth"].values()))
                m_tot = float(np.sum(logs["m_agg"]))
                if m_tot > 1e-12:
                    w_shares = np.array(logs["m_agg"]) / m_tot
                    sorted_w = np.sort(w_shares)[::-1]
                    top1_ts.append(float(np.max(w_shares)))
                    top5_ts.append(float(np.sum(sorted_w[:5])) if len(sorted_w) >= 5 else float(np.sum(sorted_w)))
                else:
                    top1_ts.append(0.0)
                    top5_ts.append(0.0)

            # Capture dashboard logs from first seed, first attacker type
            if s_idx == 0 and atk_idx == 0 and write_summary:
                dashboard_logs["participation_per_round"] = n_t_list
                dashboard_logs["deposits_flat"] = deposits_flat
                dashboard_logs["wagers_flat"] = wagers_flat
                dashboard_logs["gini_ts"] = gini_ts
                dashboard_logs["n_eff_ts"] = n_eff_ts
                dashboard_logs["hhi_ts"] = hhi_ts
                dashboard_logs["top1_share"] = top1_ts
                dashboard_logs["top5_share"] = top5_ts
                gap_list = []
                n_acc = len(participation_by_round[0]) if participation_by_round else 0
                for i in range(n_acc):
                    prev_t = -1
                    for t_g in range(T):
                        if participation_by_round[t_g][i] == 1:
                            if prev_t >= 0:
                                gap_list.append(t_g - prev_t)
                            prev_t = t_g
                if gap_list:
                    dashboard_logs["gap_list"] = gap_list
                W_arr = np.array(wealth_by_t)
                if W_arr.size:
                    dashboard_logs["ruin_rate_ts"] = np.mean(W_arr <= 0, axis=1).tolist()

            all_rows.append({
                "attacker": atk_name,
                "seed": s,
                "total_profit": atk_profit,
                "final_wealth": state.wealth.get(atk_traits.user_id, 0.0),
                "detector_mean_score": det_score_sum / max(1, det_count - 5) if det_count > 5 else 0.0,
                "detector_flag_rate": det_flag_count / max(1, det_count - 5) if det_count > 5 else 0.0,
                "detector_eval_rounds": det_count,
            })

    # --- Write CSV ---
    _write_csv(ep.data("detection_adaptation.csv"),
               ["attacker", "seed", "total_profit", "final_wealth",
                "detector_mean_score", "detector_flag_rate", "detector_eval_rounds"],
               all_rows)

    # --- Aggregate across seeds for summary ---
    summary = {"experiment_name": "detection_adaptation",
               "config": {"T": T, "n_benign": n_benign, "n_seeds": len(seeds),
                           "attacker_initial_wealth": 50.0, "attacker_noise": 0.02,
                           "block": block},
               "attacker_types": {}}
    for atk_name in attacker_types:
        atk_rows = [r for r in all_rows if r["attacker"] == atk_name]
        profits = np.array([r["total_profit"] for r in atk_rows])
        det_scores = np.array([r["detector_mean_score"] for r in atk_rows])
        det_flags = np.array([r["detector_flag_rate"] for r in atk_rows])
        if profits.size > 0:
            mean_p = float(np.mean(profits))
            se_p = float(np.std(profits, ddof=1) / np.sqrt(profits.size)) if profits.size > 1 else 0.0
            summary["attacker_types"][atk_name] = {
                "mean_total_profit": mean_p,
                "se_total_profit": se_p,
                "ci_low": mean_p - 1.96 * se_p,
                "ci_high": mean_p + 1.96 * se_p,
                "mean_detector_score": float(np.mean(det_scores)),
                "mean_detector_flag_rate": float(np.mean(det_flags)),
                "n_seeds": int(profits.size),
            }

    print("\nDetection vs Adaptation (multi-seed)")
    print("=" * 55)
    for name, info in summary.get("attacker_types", {}).items():
        print(f"  {name}: profit={info['mean_total_profit']:+.2f} ± {info['se_total_profit']:.2f}, "
              f"detector_score={info['mean_detector_score']:.3f}, "
              f"flag_rate={info['mean_detector_flag_rate']:.3f}")

    if write_summary:
        try:
            with open(ep.data("summary.json"), "w") as f:
                json.dump(summary, f, indent=2, default=str)
        except Exception as e:
            print(f"Warning: summary write failed: {e}")
        try:
            from onlinev2.experiments.summarise import write_experiment_summary
            logs_out = {"attacker_cumulative_profit": all_rows[0]["total_profit"] if all_rows else None}
            config = {"experiment_name": "detection_adaptation", "T": T, "block": block}
            write_experiment_summary(ep, config, logs_out)
            if dashboard_logs:
                from onlinev2.behaviour.plotting.behaviour_dashboard import make_behaviour_dashboard
                make_behaviour_dashboard(ep, dashboard_logs, config)
        except Exception as e:
            print(f"Warning: summary/dashboard failed: {e}")


def _run_behaviour_scenario_loop(T, n_users, seed, scenarios, ep, block, write_summary, scenario_key="scenario"):
    """Shared loop for behaviour experiments that vary scenarios."""
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    rng = np.random.default_rng(seed)
    y = rng.uniform(0.0, 1.0, size=T)
    results = []
    for scenario_name, pop in scenarios:
        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        behaviour.reset(seed)
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        for u in pop:
            state.wealth[u.traits.user_id] = u.traits.initial_wealth
        profits, n_t_list, gini_ts, n_eff_ts = [], [], [], []
        agg_hist: list = []
        for t in range(T):
            pub = RoundPublicState(
                t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                weights_prev=state.weights_prev, sigma_prev=state.sigma,
                wealth_prev=state.wealth, profit_prev=state.profit_prev,
            )
            actions = behaviour.act(pub)
            state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
            behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
            profits.append(sum(logs["profit"]))
            n_t_list.append(sum(1 for a in actions if a.participate))
            gini_ts.append(logs["Gini"])
            n_eff_ts.append(logs["N_eff"])
            agg_hist.append(logs["r_hat"])
        results.append({
            scenario_key: scenario_name,
            "total_profit": sum(profits),
            "mean_round_profit": float(np.mean(profits)),
            "final_gini": logs["Gini"],
            "final_n_eff": logs["N_eff"],
            "participation_rate": float(np.mean(n_t_list)) / max(1, len(actions)) if actions else 0.0,
        })
    return results, y


def run_collusion_stress(outdir="outputs", seed=42, block="behaviour", write_summary=True, seeds=None):
    """Multi-seed Chun-Shachter coalition stress test.

    Compare no collusion vs weighted-mean vs weighted-median coalition
    reports. Aggregates coalition profit and detector flags across seeds.
    """
    from onlinev2.behaviour.adversaries.coordinated_group import CoordinatedGroupBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "collusion_stress", block)
    T, n_benign = 1000, 8
    if seeds is None:
        seeds = list(range(20))
    members = [
        UserTraits(user_id=f"colluder_{j}", initial_wealth=10.0,
                   noise_level=0.03 + 0.04 * j,
                   bias=(-0.12 + 0.06 * j), stake_fraction=0.2)
        for j in range(3)
    ]
    member_ids = {m.user_id for m in members}

    per_seed_rows: list = []
    detector_rows_by_scenario: dict = {}

    for s in seeds:
        rng_s = np.random.default_rng(s)
        y = rng_s.uniform(0.0, 1.0, size=T)
        for label in ["no_collusion", "collusion_weighted_mean", "collusion_weighted_median"]:
            pop = build_population(n_benign, seed=s)
            if label != "no_collusion":
                aggregation = "weighted_mean" if "mean" in label else "weighted_median"
                adv = CoordinatedGroupBehaviour(
                    members, scoring_mode="point_mae", aggregation=aggregation,
                )
                behaviour = CompositeBehaviourModel(
                    pop, adversary_behaviours={"collusion_group": adv}, scoring_mode="point_mae",
                )
            else:
                behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
            behaviour.reset(s)
            params = MechanismParams(scoring_mode="point_mae")
            state = MechanismState()
            for u in pop:
                state.wealth[u.traits.user_id] = u.traits.initial_wealth
            if label != "no_collusion":
                for u in members:
                    state.wealth[u.user_id] = u.initial_wealth

            profits, n_t_list, coalition_profit = [], [], 0.0
            actions_hist = [] if label != "no_collusion" else None
            agg_hist: list = []
            for t in range(T):
                pub = RoundPublicState(
                    t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                    weights_prev=state.weights_prev, sigma_prev=state.sigma,
                    wealth_prev=state.wealth, profit_prev=state.profit_prev,
                )
                actions = behaviour.act(pub)
                if actions_hist is not None:
                    actions_hist.append(actions)
                state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
                behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
                agg_hist.append(logs["r_hat"])
                profits.append(sum(logs["profit"]))
                n_t_list.append(sum(1 for a in actions if a.participate))
                for i, aid in enumerate(logs["ids"]):
                    if aid in member_ids:
                        coalition_profit += float(logs["profit"][i])

            n_actions = len(actions) if actions else 1
            per_seed_rows.append({
                "scenario": label,
                "seed": s,
                "total_profit": sum(profits),
                "coalition_profit": float(coalition_profit),
                "mean_profit": float(np.mean(profits)),
                "final_gini": logs["Gini"],
                "participation_rate": float(np.mean(n_t_list)) / n_actions,
            })

            if actions_hist is not None and s == seeds[0]:
                try:
                    from onlinev2.behaviour.detection.detectors import run_all_detectors
                    scores = run_all_detectors(actions_hist, list(range(len(actions_hist))))
                    detector_rows_by_scenario[label] = scores
                    _write_csv(
                        ep.data(f"detection_metrics_{label}.csv"),
                        ["scenario", "detector", "score"],
                        [{"scenario": label, "detector": k, "score": v} for k, v in scores.items()],
                    )
                except Exception:
                    pass

    # Aggregate across seeds per scenario
    agg_rows = []
    for label in ["no_collusion", "collusion_weighted_mean", "collusion_weighted_median"]:
        subset = [r for r in per_seed_rows if r["scenario"] == label]
        coalition_stats = _mean_se_ci([r["coalition_profit"] for r in subset])
        gini_stats = _mean_se_ci([r["final_gini"] for r in subset])
        agg_rows.append({
            "scenario": label,
            "mean_coalition_profit": coalition_stats["mean"],
            "se_coalition_profit": coalition_stats["se"],
            "ci_low": coalition_stats["ci_low"],
            "ci_high": coalition_stats["ci_high"],
            "mean_final_gini": gini_stats["mean"],
            "n_seeds": coalition_stats["n"],
        })

    _write_csv(
        ep.data("collusion_stress.csv"),
        ["scenario", "seed", "total_profit", "coalition_profit", "mean_profit", "final_gini", "participation_rate"],
        per_seed_rows,
    )
    _write_csv(
        ep.data("collusion_stress_summary.csv"),
        ["scenario", "mean_coalition_profit", "se_coalition_profit", "ci_low", "ci_high",
         "mean_final_gini", "n_seeds"],
        agg_rows,
    )
    print("\nCollusion Stress (multi-seed)")
    print("=" * 50)
    for r in agg_rows:
        print(f"  {r['scenario']:>30s}: coalition_profit={r['mean_coalition_profit']:+.2f} "
              f"± {r['se_coalition_profit']:.2f} (CI: {r['ci_low']:+.2f}..{r['ci_high']:+.2f})")
    if write_summary:
        try:
            from onlinev2.behaviour.plotting.adversary_plots import plot_collusion_stress
            from onlinev2.experiments.summarise import write_experiment_summary
            colluding = [r for r in agg_rows if r["scenario"] != "no_collusion"]
            logs_out = {
                "attacker_cumulative_profit": float(
                    max((r["mean_coalition_profit"] for r in colluding), default=0.0)
                ),
                "final_gini": agg_rows[-1]["mean_final_gini"] if agg_rows else None,
            }
            write_experiment_summary(
                ep,
                {"experiment_name": "collusion_stress", "T": T, "block": block,
                 "n_seeds": len(seeds)},
                logs_out,
            )
            plot_collusion_stress(ep)
        except Exception as e:
            print(f"Warning: summary failed: {e}")


def run_insider_advantage(outdir="outputs", seed=42, block="behaviour", write_summary=True, seeds=None):
    """Compare no insider vs F_{t-1}-compliant insider vs outcome-leaking attacker.

    Multi-seed AR(1) DGP so that lagged information is actually informative.

    Scenarios:
      * no_insider
      * insider_lagged: F_{t-1}-compliant, lag=1, sigma_priv=0.015
      * insider_leaked: audit-only, allow_leakage=True, reads y_t.
    """
    from onlinev2.behaviour.adversaries.privileged_information import (
        PrivilegedInformationBehaviour,
    )
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "insider_advantage", block)
    T, n_benign = 1000, 8
    if seeds is None:
        seeds = list(range(20))
    insider_traits = UserTraits(
        user_id="insider_0", initial_wealth=10.0, noise_level=0.02,
        stake_fraction=0.4, insider_bonus=0.5,
    )
    phi = 0.7
    eps_scale = 0.18

    per_seed_rows = []

    for s in seeds:
        rng_s = np.random.default_rng(s)
        y = np.zeros(T, dtype=float)
        y[0] = 0.5 + rng_s.normal(0.0, 0.1)
        for t in range(1, T):
            y[t] = 0.5 + phi * (y[t - 1] - 0.5) + rng_s.normal(0.0, eps_scale)
        y = np.clip(y, 0.0, 1.0)

        scenarios = [
            ("no_insider", None),
            (
                "insider_lagged",
                lambda: PrivilegedInformationBehaviour(
                    insider_traits, scoring_mode="point_mae",
                    mode="lagged_noisy", lag=1, sigma_priv=0.015,
                ),
            ),
            (
                "insider_leaked",
                lambda y_ref=y: PrivilegedInformationBehaviour(
                    insider_traits, scoring_mode="point_mae",
                    mode="leaked_future", lookahead=0, sigma_priv=0.01,
                    allow_leakage=True, y_sequence=y_ref,
                ),
            ),
        ]

        for label, factory in scenarios:
            pop = build_population(n_benign, seed=s)
            if factory is not None:
                adv = factory()
                behaviour = CompositeBehaviourModel(
                    pop, adversary_behaviours={insider_traits.user_id: adv},
                    scoring_mode="point_mae",
                )
            else:
                adv = None
                behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
            behaviour.reset(s)
            params = MechanismParams(scoring_mode="point_mae")
            state = MechanismState()
            for u in pop:
                state.wealth[u.traits.user_id] = u.traits.initial_wealth
            if adv is not None:
                state.wealth[insider_traits.user_id] = insider_traits.initial_wealth

            insider_profit = 0.0
            insider_score_sum = 0.0
            insider_rounds = 0
            agg_hist: list = []
            for t in range(T):
                pub = RoundPublicState(
                    t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                    weights_prev=state.weights_prev, sigma_prev=state.sigma,
                    wealth_prev=state.wealth, profit_prev=state.profit_prev,
                )
                actions = behaviour.act(pub)
                state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
                behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
                agg_hist.append(logs["r_hat"])
                for i, aid in enumerate(logs["ids"]):
                    if "insider" in str(aid):
                        insider_profit += logs["profit"][i]
                        insider_score_sum += logs["scores"][i]
                        insider_rounds += 1
            per_seed_rows.append({
                "scenario": label,
                "seed": s,
                "insider_profit": insider_profit,
                "mean_insider_score": insider_score_sum / max(1, insider_rounds),
                "final_gini": logs["Gini"],
                "insider_rounds": insider_rounds,
            })

    # Aggregate per scenario
    agg_rows = []
    for label in ["no_insider", "insider_lagged", "insider_leaked"]:
        subset = [r for r in per_seed_rows if r["scenario"] == label]
        profit_stats = _mean_se_ci([r["insider_profit"] for r in subset])
        score_stats = _mean_se_ci([r["mean_insider_score"] for r in subset])
        agg_rows.append({
            "scenario": label,
            "mean_insider_profit": profit_stats["mean"],
            "se_insider_profit": profit_stats["se"],
            "ci_low": profit_stats["ci_low"],
            "ci_high": profit_stats["ci_high"],
            "mean_insider_score": score_stats["mean"],
            "n_seeds": profit_stats["n"],
        })

    _write_csv(
        ep.data("insider_advantage.csv"),
        ["scenario", "seed", "insider_profit", "mean_insider_score", "final_gini", "insider_rounds"],
        per_seed_rows,
    )
    _write_csv(
        ep.data("insider_advantage_summary.csv"),
        ["scenario", "mean_insider_profit", "se_insider_profit", "ci_low", "ci_high",
         "mean_insider_score", "n_seeds"],
        agg_rows,
    )
    print("\nInsider Advantage (multi-seed, AR(1) DGP)")
    print("=" * 50)
    for r in agg_rows:
        print(f"  {r['scenario']:>18s}: profit={r['mean_insider_profit']:+.2f} ± "
              f"{r['se_insider_profit']:.2f} (CI: {r['ci_low']:+.2f}..{r['ci_high']:+.2f}), "
              f"mean_score={r['mean_insider_score']:.3f}")
    if write_summary:
        try:
            from onlinev2.behaviour.plotting.adversary_plots import plot_insider_advantage
            from onlinev2.experiments.summarise import write_experiment_summary
            logs_out = {"attacker_cumulative_profit": agg_rows[-1]["mean_insider_profit"]
                        if agg_rows else None}
            write_experiment_summary(
                ep,
                {"experiment_name": "insider_advantage", "T": T, "block": block,
                 "n_seeds": len(seeds), "dgp": f"AR(1) phi={phi}, eps={eps_scale}"},
                logs_out,
            )
            plot_insider_advantage(ep)
        except Exception:
            pass


def run_wash_activity_gaming(outdir="outputs", seed=42, block="behaviour", write_summary=True, seeds=None):
    """Multi-seed wash / activity-gaming stress test.

    Metrics: activity inflation, wash-account profit, plus detector
    scores from `onlinev2.behaviour.detection.detectors`.
    """
    from onlinev2.behaviour.adversaries.wash_trader import WashTraderBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "wash_activity_gaming", block)
    T, n_benign = 1000, 8
    if seeds is None:
        seeds = list(range(20))
    wash_traits = UserTraits(user_id="wash_0", initial_wealth=10.0, noise_level=0.05, stake_fraction=0.2)

    def _run(factory, s, collect_actions=False):
        rng_s = np.random.default_rng(s)
        y = rng_s.uniform(0.0, 1.0, size=T)
        pop = build_population(n_benign, seed=s)
        if factory is None:
            behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        else:
            adv = factory()
            behaviour = CompositeBehaviourModel(
                pop, adversary_behaviours={"wash_0": adv}, scoring_mode="point_mae",
            )
        behaviour.reset(s)
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        for u in pop:
            state.wealth[u.traits.user_id] = u.traits.initial_wealth
        if factory is not None:
            state.wealth["wash_0"] = wash_traits.initial_wealth
        activity_count = 0
        wash_profit = 0.0
        actions_hist = [] if collect_actions else None
        agg_hist: list = []
        for t in range(T):
            pub = RoundPublicState(
                t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                weights_prev=state.weights_prev, sigma_prev=state.sigma,
                wealth_prev=state.wealth, profit_prev=state.profit_prev,
            )
            actions = behaviour.act(pub)
            if actions_hist is not None:
                actions_hist.append(actions)
            state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
            behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
            agg_hist.append(logs["r_hat"])
            activity_count += sum(1 for a in actions if a.participate)
            for i, aid in enumerate(logs["ids"]):
                if str(aid).startswith("wash_0"):
                    wash_profit += logs["profit"][i]
        return activity_count, wash_profit, actions_hist

    scenarios = [
        ("no_wash", None),
        ("wash_k3_anchor", lambda: WashTraderBehaviour(
            wash_traits, k_accounts=3, scoring_mode="point_mae",
            wash_report_style="anchor", sync_strength=1.0,
        )),
        ("wash_k5_split", lambda: WashTraderBehaviour(
            wash_traits, k_accounts=5, scoring_mode="point_mae",
            wash_report_style="split_bet", sync_strength=1.0,
        )),
    ]

    per_seed_rows = []
    # Per-seed baseline activity for relative inflation.
    baseline_by_seed = {}
    for s in seeds:
        baseline_activity, _, _ = _run(None, s)
        baseline_by_seed[s] = baseline_activity
        per_seed_rows.append({
            "scenario": "no_wash", "seed": s,
            "total_activity": baseline_activity, "n_rounds": T,
            "inflation_rate": 0.0, "wash_profit": 0.0,
        })

    first_seed = seeds[0]
    for label, factory in scenarios[1:]:
        for idx, s in enumerate(seeds):
            activity, wash_prof, actions_hist = _run(
                factory, s, collect_actions=(s == first_seed)
            )
            per_seed_rows.append({
                "scenario": label, "seed": s,
                "total_activity": activity, "n_rounds": T,
                "inflation_rate": (activity - baseline_by_seed[s]) / max(1, baseline_by_seed[s]),
                "wash_profit": wash_prof,
            })
            if s == first_seed:
                try:
                    from onlinev2.behaviour.detection.detectors import run_all_detectors
                    scores = run_all_detectors(actions_hist, list(range(len(actions_hist))))
                    _write_csv(
                        ep.data(f"detector_scores_{label}.csv"),
                        ["scenario", "detector", "score"],
                        [{"scenario": label, "detector": k, "score": v} for k, v in scores.items()],
                    )
                except Exception:
                    pass

    # Aggregate per scenario
    agg_rows = []
    for label, _ in scenarios:
        subset = [r for r in per_seed_rows if r["scenario"] == label]
        inflation_stats = _mean_se_ci([r["inflation_rate"] for r in subset])
        profit_stats = _mean_se_ci([r["wash_profit"] for r in subset])
        agg_rows.append({
            "scenario": label,
            "mean_inflation_rate": inflation_stats["mean"],
            "se_inflation_rate": inflation_stats["se"],
            "mean_wash_profit": profit_stats["mean"],
            "se_wash_profit": profit_stats["se"],
            "n_seeds": inflation_stats["n"],
        })

    _write_csv(
        ep.data("wash_activity_gaming.csv"),
        ["scenario", "seed", "total_activity", "n_rounds", "inflation_rate", "wash_profit"],
        per_seed_rows,
    )
    _write_csv(
        ep.data("wash_activity_gaming_summary.csv"),
        ["scenario", "mean_inflation_rate", "se_inflation_rate",
         "mean_wash_profit", "se_wash_profit", "n_seeds"],
        agg_rows,
    )
    print("\nWash Activity Gaming (multi-seed)")
    print("=" * 50)
    for r in agg_rows:
        print(f"  {r['scenario']:>18s}: inflation={r['mean_inflation_rate']:+.1%} "
              f"± {r['se_inflation_rate']:.1%}, wash_profit={r['mean_wash_profit']:+.2f} "
              f"± {r['se_wash_profit']:.2f}")
    if write_summary:
        try:
            from onlinev2.behaviour.plotting.adversary_plots import plot_wash_activity
            from onlinev2.experiments.summarise import write_experiment_summary
            logs_out = {"attacker_cumulative_profit": agg_rows[-1]["mean_wash_profit"] if agg_rows else None}
            write_experiment_summary(
                ep,
                {"experiment_name": "wash_activity_gaming", "T": T, "block": block,
                 "n_seeds": len(seeds)},
                logs_out,
            )
            plot_wash_activity(ep)
        except Exception:
            pass


def run_strategic_reporting(outdir="outputs", seed=42, block="behaviour", write_summary=True, seeds=None):
    """Multi-seed sweep over (pull, target) measuring aggregate shift vs cost.

    Metrics
    -------
    mean_agg_error: |r_hat - y|, averaged over rounds.
    mean_r_hat_shift: r_hat(adversarial) - r_hat(baseline), averaged;
        paired across seeds for tighter CIs.
    attacker_profit: cumulative wagering profit of the adversary.
    """
    from onlinev2.behaviour.adversaries.strategic_reporter import StrategicReporterBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "strategic_reporting", block)
    T, n_benign = 1000, 8
    if seeds is None:
        seeds = list(range(20))

    strat_traits = UserTraits(
        user_id="strategic_0", initial_wealth=10.0, manipulation_strength=0.8,
    )

    def _run(factory, s):
        rng_s = np.random.default_rng(s)
        y = rng_s.uniform(0.0, 1.0, size=T)
        pop = build_population(n_benign, seed=s)
        if factory is None:
            behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        else:
            adv = factory()
            behaviour = CompositeBehaviourModel(
                pop, adversary_behaviours={"strategic_0": adv}, scoring_mode="point_mae",
            )
        behaviour.reset(s)
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        for u in pop:
            state.wealth[u.traits.user_id] = u.traits.initial_wealth
        if factory is not None:
            state.wealth["strategic_0"] = 10.0
        r_hats, agg_errs, adv_profit = [], [], 0.0
        agg_hist: list = []
        for t in range(T):
            pub = RoundPublicState(
                t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                weights_prev=state.weights_prev, sigma_prev=state.sigma,
                wealth_prev=state.wealth, profit_prev=state.profit_prev,
            )
            actions = behaviour.act(pub)
            state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
            behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
            r_hat = logs.get("r_hat", 0.5)
            r_hats.append(float(r_hat))
            agg_hist.append(r_hat)
            agg_errs.append(abs(float(r_hat) - float(y[t])))
            for i, aid in enumerate(logs["ids"]):
                if aid == "strategic_0":
                    adv_profit += logs["profit"][i]
        return np.asarray(r_hats, dtype=float), np.asarray(agg_errs, dtype=float), adv_profit

    sweeps = [
        ("baseline_truthful", None),
        ("pull_0.3_target_0.9", lambda: StrategicReporterBehaviour(
            strat_traits, target=0.9, pull=0.3, scoring_mode="point_mae")),
        ("pull_0.6_target_0.9", lambda: StrategicReporterBehaviour(
            strat_traits, target=0.9, pull=0.6, scoring_mode="point_mae")),
        ("pull_1.0_target_0.9", lambda: StrategicReporterBehaviour(
            strat_traits, target=0.9, pull=1.0, scoring_mode="point_mae")),
    ]

    per_seed_rows = []
    for s in seeds:
        baseline_r, baseline_err, _ = _run(None, s)
        for label, factory in sweeps:
            if factory is None:
                r_hats, errs, prof = baseline_r, baseline_err, 0.0
            else:
                r_hats, errs, prof = _run(factory, s)
            per_seed_rows.append({
                "scenario": label,
                "seed": s,
                "mean_agg_error": float(np.mean(errs)),
                "mean_r_hat_shift": float(np.mean(r_hats - baseline_r)),
                "attacker_profit": float(prof),
            })

    agg_rows = []
    for label, _ in sweeps:
        subset = [r for r in per_seed_rows if r["scenario"] == label]
        shift_stats = _mean_se_ci([r["mean_r_hat_shift"] for r in subset])
        profit_stats = _mean_se_ci([r["attacker_profit"] for r in subset])
        err_stats = _mean_se_ci([r["mean_agg_error"] for r in subset])
        agg_rows.append({
            "scenario": label,
            "mean_r_hat_shift": shift_stats["mean"],
            "se_r_hat_shift": shift_stats["se"],
            "mean_agg_error": err_stats["mean"],
            "mean_attacker_profit": profit_stats["mean"],
            "se_attacker_profit": profit_stats["se"],
            "n_seeds": shift_stats["n"],
        })

    _write_csv(
        ep.data("strategic_reporting.csv"),
        ["scenario", "seed", "mean_agg_error", "mean_r_hat_shift", "attacker_profit"],
        per_seed_rows,
    )
    _write_csv(
        ep.data("strategic_reporting_summary.csv"),
        ["scenario", "mean_r_hat_shift", "se_r_hat_shift", "mean_agg_error",
         "mean_attacker_profit", "se_attacker_profit", "n_seeds"],
        agg_rows,
    )
    print("\nStrategic Reporting (multi-seed)")
    print("=" * 50)
    for r in agg_rows:
        print(f"  {r['scenario']:>24s}: shift={r['mean_r_hat_shift']:+.4f} "
              f"± {r['se_r_hat_shift']:.4f}, atk_profit={r['mean_attacker_profit']:+.2f} "
              f"± {r['se_attacker_profit']:.2f}")
    if write_summary:
        try:
            from onlinev2.behaviour.plotting.adversary_plots import plot_strategic_reporting
            from onlinev2.experiments.summarise import write_experiment_summary
            logs_out = {
                "attacker_cumulative_profit": agg_rows[-1]["mean_attacker_profit"] if agg_rows else None,
            }
            write_experiment_summary(
                ep,
                {"experiment_name": "strategic_reporting", "T": T, "block": block,
                 "n_seeds": len(seeds)},
                logs_out,
            )
            plot_strategic_reporting(ep)
        except Exception:
            pass


def run_identity_attack_matrix(outdir="outputs", seed=42, block="behaviour", write_summary=True):
    """Compare single account vs sybil split vs reputation reset vs collusive multi-account."""
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.policies.identity import (
        CollusiveMultiAccountIdentity,
        ReputationResetIdentity,
        SingleAccountIdentity,
        SplitAccountIdentity,
    )
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "identity_attack_matrix", block)
    T, n_users = 1000, 8
    rng = np.random.default_rng(seed)
    y = rng.uniform(0.0, 1.0, size=T)
    scenarios = [
        ("single_account", SingleAccountIdentity()),
        ("sybil_split_3", SplitAccountIdentity(k=3)),
        ("reputation_reset", ReputationResetIdentity()),
        ("collusive_multi_3", CollusiveMultiAccountIdentity(k=3)),
    ]
    results = []
    for scenario_name, identity in scenarios:
        pop = build_population(n_users, seed=seed, identity_policy=identity)
        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        behaviour.reset(seed)
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        for u in pop:
            state.wealth[u.traits.user_id] = u.traits.initial_wealth
        profits, n_eff_ts = [], []
        agg_hist: list = []
        for t in range(T):
            pub = RoundPublicState(t=t, y_history=y[:t].tolist(), agg_history=agg_hist, weights_prev=state.weights_prev,
                                  sigma_prev=state.sigma, wealth_prev=state.wealth, profit_prev=state.profit_prev)
            actions = behaviour.act(pub)
            state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
            behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
            profits.append(sum(logs["profit"]))
            n_eff_ts.append(logs["N_eff"])
            agg_hist.append(logs["r_hat"])
        results.append({"identity": scenario_name, "total_profit": sum(profits), "final_n_eff": logs["N_eff"], "final_gini": logs["Gini"]})
    _write_csv(ep.data("identity_attack_matrix.csv"), ["identity", "total_profit", "final_n_eff", "final_gini"], results)
    if write_summary:
        try:
            from onlinev2.experiments.summarise import write_experiment_summary
            write_experiment_summary(ep, {"experiment_name": "identity_attack_matrix", "T": T, "block": block}, {})
        except Exception:
            pass


def run_drift_adaptation(outdir="outputs", seed=42, block="behaviour", write_summary=True):
    """Compare fast vs slow adaptor to drift in y process."""
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.policies.belief import (
        FastAdaptorBeliefModel,
        GaussianBeliefModel,
        SlowAdaptorBeliefModel,
    )
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "drift_adaptation", block)
    T, n_users = 1000, 8
    rng = np.random.default_rng(seed)
    y = np.concatenate([rng.uniform(0.3, 0.5, size=T // 2), rng.uniform(0.5, 0.7, size=T - T // 2)])
    scenarios = [
        ("baseline", GaussianBeliefModel()),
        ("fast_adaptor", FastAdaptorBeliefModel()),
        ("slow_adaptor", SlowAdaptorBeliefModel()),
    ]
    results = []
    for scenario_name, belief in scenarios:
        pop = build_population(n_users, seed=seed, belief_policy=belief)
        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        behaviour.reset(seed)
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        for u in pop:
            state.wealth[u.traits.user_id] = u.traits.initial_wealth
        mae_list = []
        agg_hist: list = []
        for t in range(T):
            pub = RoundPublicState(t=t, y_history=y[:t].tolist(), agg_history=agg_hist, weights_prev=state.weights_prev,
                                  sigma_prev=state.sigma, wealth_prev=state.wealth, profit_prev=state.profit_prev)
            actions = behaviour.act(pub)
            state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
            behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
            if logs.get("r_hat") is not None:
                r = logs["r_hat"] if isinstance(logs["r_hat"], (int, float)) else (np.mean(logs["r_hat"]) if hasattr(logs["r_hat"], "__len__") else 0.5)
                mae_list.append(abs(float(r) - float(y[t])))
            agg_hist.append(logs["r_hat"])
        results.append({"belief": scenario_name, "mean_mae": float(np.mean(mae_list)) if mae_list else 0.0, "final_gini": logs["Gini"]})
    _write_csv(ep.data("drift_adaptation.csv"), ["belief", "mean_mae", "final_gini"], results)
    if write_summary:
        try:
            from onlinev2.experiments.summarise import write_experiment_summary
            write_experiment_summary(ep, {"experiment_name": "drift_adaptation", "T": T, "block": block}, {})
        except Exception:
            pass


def run_stake_policy_matrix(outdir="outputs", seed=42, block="behaviour", write_summary=True):
    """Compare fixed fraction vs Kelly-like vs house-money vs lumpy vs break-even vs volatility-sensitive."""
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.policies.staking import (
        BreakEvenStaking,
        FixedFractionStaking,
        HouseMoneyStaking,
        KellyLikeStaking,
        LumpyTierStaking,
        VolatilitySensitiveStaking,
    )
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "stake_policy_matrix", block)
    T, n_users = 1000, 8
    rng = np.random.default_rng(seed)
    y = rng.uniform(0.0, 1.0, size=T)
    scenarios = [
        ("fixed_fraction", FixedFractionStaking()),
        ("kelly_like", KellyLikeStaking()),
        ("house_money", HouseMoneyStaking()),
        ("lumpy_tier", LumpyTierStaking()),
        ("break_even", BreakEvenStaking()),
        ("volatility_sensitive", VolatilitySensitiveStaking()),
    ]
    results = []
    for scenario_name, staking in scenarios:
        pop = build_population(n_users, seed=seed, staking_policy=staking)
        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        behaviour.reset(seed)
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        for u in pop:
            state.wealth[u.traits.user_id] = u.traits.initial_wealth
        profits, deposits_sum = [], []
        agg_hist: list = []
        for t in range(T):
            pub = RoundPublicState(t=t, y_history=y[:t].tolist(), agg_history=agg_hist, weights_prev=state.weights_prev,
                                  sigma_prev=state.sigma, wealth_prev=state.wealth, profit_prev=state.profit_prev)
            actions = behaviour.act(pub)
            state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
            behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
            profits.append(sum(logs["profit"]))
            deposits_sum.append(sum(logs["deposits"]))
            agg_hist.append(logs["r_hat"])
        results.append({"staking": scenario_name, "total_profit": sum(profits), "mean_deposit": float(np.mean(deposits_sum)), "final_gini": logs["Gini"]})
    _write_csv(ep.data("stake_policy_matrix.csv"), ["staking", "total_profit", "mean_deposit", "final_gini"], results)
    if write_summary:
        try:
            from onlinev2.experiments.summarise import write_experiment_summary
            write_experiment_summary(ep, {"experiment_name": "stake_policy_matrix", "T": T, "block": block}, {})
        except Exception:
            pass


# ===================================================================
# QA vs Linear Pooling comparison
# ===================================================================

def run_qa_vs_lp_comparison(
    T: int = 1000,
    n_forecasters: int = 10,
    missing_prob: float = 0.2,
    seeds=None,
    outdir: str = "outputs",
    block: str = "core",
    warm_start: int = 200,
    n_grid: int = 200,
):
    """Compare pointwise weighted quantile averaging (QA) against linear opinion pooling (LP).

    **Quantile Averaging (QA)** — the current implementation:
        q_hat(τ_k) = Σ_i w_i · q_i(τ_k)
    This is a pointwise weighted average of reported quantiles at each level.
    It is NOT a linear opinion pool over CDFs.

    **Linear Opinion Pooling (LP)**:
        F_agg(x) = Σ_i w_i · F_i(x)
    The aggregated CDF is a weighted mixture of individual CDFs, then inverted
    to obtain quantiles. For simplicity we approximate this by:
      1. Build a fine evaluation grid of x-values spanning the range of all reports.
      2. For each forecaster, construct a piecewise-linear CDF from their quantile
         reports (with 0 and 1 anchors at the extremes).
      3. Compute F_agg(x) = Σ_i w_i · F_i(x) on the grid.
      4. Invert F_agg to get q_lp(τ_k) for each target τ_k.

    Reports CRPS differences between the two methods across seeds.
    Writes results to ``<outdir>/<block>/experiments/qa_vs_lp/data/``.
    """
    cfg = get_experiment_config("forecast_aggregation")
    if seeds is None:
        seeds = cfg.seeds
    T = max(T, cfg.T)
    n_forecasters = cfg.n_forecasters

    ep = _exp_paths(outdir, "qa_vs_lp", block)
    tau_i = cfg.tau_i()
    taus = cfg.taus()

    all_rows = []
    for s in seeds:
        y, q_reports_pre, _ = generate_truth_and_quantile_reports_latent(
            T, n_forecasters, tau_i, taus, seed=s, sigma_z=cfg.sigma_z,
        )

        # Run simulation to get wager weights
        res = run_simulation(
            T=T, n_forecasters=n_forecasters, missing_prob=missing_prob,
            seed=s, scoring_mode="quantiles_crps", taus=taus,
            y_pre=y, q_reports_pre=q_reports_pre, forecaster_noise_pre=tau_i,
            store_history=True,
        )

        crps_qa_list = []
        crps_lp_list = []

        for t in range(warm_start, T):
            y_t = float(y[t])
            alpha_t = res["alpha_hist"][:, t]
            m_t = res["wager_hist"][:, t].copy()
            m_t[alpha_t == 1] = 0.0
            M = float(np.sum(m_t))
            if M < 1e-12:
                continue

            w = m_t / M
            q_t = q_reports_pre[:, t, :]  # (n, K)
            active = (alpha_t == 0)

            # --- QA: pointwise weighted quantile average ---
            q_qa = np.sum(w[:, None] * q_t, axis=0)  # (K,)
            crps_qa = float(crps_hat_from_quantiles(y_t, q_qa.reshape(1, -1), taus)[0])

            # --- LP: linear opinion pooling via CDF mixture + inversion ---
            # Build evaluation grid
            q_min = float(np.min(q_t[active]))
            q_max = float(np.max(q_t[active]))
            margin = max(0.1, (q_max - q_min) * 0.2)
            x_grid = np.linspace(q_min - margin, q_max + margin, n_grid)

            # For each active forecaster, build piecewise-linear CDF from quantiles
            # Anchor: F(x_min) = 0, F(q(τ_k)) = τ_k, F(x_max) = 1
            F_agg = np.zeros(n_grid)
            for i in range(n_forecasters):
                if not active[i]:
                    continue
                # Anchor points for CDF
                x_anchors = np.concatenate([[x_grid[0]], q_t[i], [x_grid[-1]]])
                f_anchors = np.concatenate([[0.0], taus, [1.0]])
                # Interpolate CDF on grid
                F_i = np.interp(x_grid, x_anchors, f_anchors)
                F_i = np.clip(F_i, 0.0, 1.0)
                F_agg += w[i] * F_i

            # Invert F_agg to get quantiles at target taus
            q_lp = np.interp(taus, F_agg, x_grid)

            crps_lp = float(crps_hat_from_quantiles(y_t, q_lp.reshape(1, -1), taus)[0])

            crps_qa_list.append(crps_qa)
            crps_lp_list.append(crps_lp)

        mean_crps_qa = float(np.mean(crps_qa_list)) if crps_qa_list else np.nan
        mean_crps_lp = float(np.mean(crps_lp_list)) if crps_lp_list else np.nan

        all_rows.append({
            "seed": s,
            "mean_crps_qa": mean_crps_qa,
            "mean_crps_lp": mean_crps_lp,
            "delta_crps_lp_minus_qa": mean_crps_lp - mean_crps_qa,
            "n_rounds_evaluated": len(crps_qa_list),
        })

    # --- Write results ---
    cols = ["seed", "mean_crps_qa", "mean_crps_lp", "delta_crps_lp_minus_qa", "n_rounds_evaluated"]
    _write_csv(ep.data("qa_vs_lp.csv"), cols, all_rows)

    # --- Summary JSON ---
    deltas = np.array([r["delta_crps_lp_minus_qa"] for r in all_rows])
    deltas = deltas[np.isfinite(deltas)]
    qa_vals = np.array([r["mean_crps_qa"] for r in all_rows])
    qa_vals = qa_vals[np.isfinite(qa_vals)]
    lp_vals = np.array([r["mean_crps_lp"] for r in all_rows])
    lp_vals = lp_vals[np.isfinite(lp_vals)]

    mean_delta = float(np.mean(deltas)) if deltas.size else 0.0
    se_delta = float(np.std(deltas, ddof=1) / np.sqrt(deltas.size)) if deltas.size > 1 else 0.0

    summary = {
        "experiment_name": "qa_vs_lp",
        "description": (
            "Comparison of pointwise weighted Quantile Averaging (QA, current implementation) "
            "against Linear opinion Pooling (LP). QA computes q_hat(tau) = sum_i w_i * q_i(tau). "
            "LP computes F_agg(x) = sum_i w_i * F_i(x) then inverts to get quantiles. "
            "Positive delta means LP has higher (worse) CRPS than QA."
        ),
        "config": {
            "T": T,
            "n_forecasters": n_forecasters,
            "n_seeds": len(seeds),
            "dgp_name": cfg.dgp_name,
            "warm_start": warm_start,
            "n_grid": n_grid,
        },
        "results": {
            "mean_crps_qa": float(np.mean(qa_vals)) if qa_vals.size else None,
            "mean_crps_lp": float(np.mean(lp_vals)) if lp_vals.size else None,
            "delta_lp_minus_qa_mean": mean_delta,
            "delta_lp_minus_qa_se": se_delta,
            "delta_lp_minus_qa_ci_low": mean_delta - 1.96 * se_delta,
            "delta_lp_minus_qa_ci_high": mean_delta + 1.96 * se_delta,
            "n_seeds": int(deltas.size),
        },
    }

    import json as _json
    with open(ep.data("summary.json"), "w") as f:
        _json.dump(summary, f, indent=2, default=str)

    print("\nQA vs Linear Pooling Comparison")
    print("=" * 60)
    print(f"  QA  mean CRPS: {summary['results']['mean_crps_qa']}")
    print(f"  LP  mean CRPS: {summary['results']['mean_crps_lp']}")
    print(f"  Δ (LP − QA):   {mean_delta:.6f} ± {se_delta:.6f}")
    print(f"  95% CI:        [{mean_delta - 1.96 * se_delta:.6f}, {mean_delta + 1.96 * se_delta:.6f}]")


# Entry point: use python -m onlinev2.experiments.cli or run-onlinev2-experiments


def run_sybil_arbitrage(outdir="outputs", seed=42, block="behaviour", write_summary=True, seeds=None):
    """Sybil-proofness stress test for the arbitrage-seeking attack.

    Holds the total attacker stake constant and fans it out across
    k in {1, 3, 5} sybil accounts. Under a sybilproof mechanism the
    arbitrage profit should be approximately invariant to k; any
    systematic k-trend is a finding.

    Metrics
    -------
    total_arbitrage_profit: summed profit over all sybils of the attacker.
    mean_sybil_n_eff: mean of N_eff_t, inflated by sybil splits.
    """
    from onlinev2.behaviour.adversaries.sybil_arbitrage import SybilArbitrageBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "sybil_arbitrage", block)
    T, n_benign = 1000, 8
    if seeds is None:
        seeds = list(range(20))

    k_grid = [1, 3, 5]
    per_seed_rows: list = []

    for s in seeds:
        rng_s = np.random.default_rng(s)
        y = rng_s.uniform(0.0, 1.0, size=T)

        for k in k_grid:
            pop = build_population(n_benign, seed=s)
            parent_traits = UserTraits(
                user_id="sybil_arb", initial_wealth=10.0,
                noise_level=0.05, stake_fraction=0.4,
            )

            snapshot = {"p_others": np.array([0.4, 0.6]), "m_others": np.array([0.5, 0.5])}

            def target_others(_state, snap=snapshot):
                return np.asarray(snap["p_others"]), np.asarray(snap["m_others"])

            adv = SybilArbitrageBehaviour(
                traits=parent_traits,
                k_accounts=k,
                scoring_mode="point_mae",
                target_others=target_others,
            )
            adv.reset(s)

            # Single adversary key; its act() returns k linked AgentActions.
            behaviour = CompositeBehaviourModel(
                pop, adversary_behaviours={"sybil_arb_entry": adv},
                scoring_mode="point_mae",
            )
            behaviour.reset(s)

            params = MechanismParams(scoring_mode="point_mae")
            state = MechanismState()
            for u in pop:
                state.wealth[u.traits.user_id] = u.traits.initial_wealth
            # Wealth is held jointly by the parent user_id. Distribute
            # it across the k sybils so the deposit sum matches a
            # single-account run.
            per_wealth = parent_traits.initial_wealth / float(k)
            for j in range(k):
                state.wealth[f"{parent_traits.user_id}__sybil_{j}"] = per_wealth

            total_profit = 0.0
            n_eff_ts: list = []
            agg_hist: list = []
            for t in range(T):
                pub = RoundPublicState(
                    t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                    weights_prev=state.weights_prev, sigma_prev=state.sigma,
                    wealth_prev=state.wealth, profit_prev=state.profit_prev,
                )
                actions = behaviour.act(pub)

                # Snapshot F_t for the next round's arbitrage point.
                p_list, m_list = [], []
                for a in actions:
                    if a.account_id.startswith(parent_traits.user_id) or not a.participate:
                        continue
                    p_list.append(float(a.report) if not isinstance(a.report, (list, tuple, np.ndarray))
                                  else float(np.asarray(a.report).mean()))
                    m_list.append(max(1e-6, float(a.deposit)))

                state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
                behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)

                if p_list:
                    snapshot["p_others"] = np.asarray(p_list, dtype=float)
                    snapshot["m_others"] = np.asarray(m_list, dtype=float)
                agg_hist.append(logs["r_hat"])
                n_eff_ts.append(logs["N_eff"])

                for i, aid in enumerate(logs["ids"]):
                    if aid.startswith(parent_traits.user_id):
                        total_profit += float(logs["profit"][i])

            per_seed_rows.append({
                "k": k,
                "seed": s,
                "total_arbitrage_profit": total_profit,
                "mean_n_eff": float(np.mean(n_eff_ts)),
                "arbitrage_found_rounds": sum(
                    1 for e in adv.arbitrage_log if e.get("arbitrage_found", False)
                ),
            })

    # Aggregate per k
    agg_rows = []
    for k in k_grid:
        subset = [r for r in per_seed_rows if r["k"] == k]
        profit_stats = _mean_se_ci([r["total_arbitrage_profit"] for r in subset])
        neff_stats = _mean_se_ci([r["mean_n_eff"] for r in subset])
        agg_rows.append({
            "k": k,
            "mean_profit": profit_stats["mean"],
            "se_profit": profit_stats["se"],
            "ci_low": profit_stats["ci_low"],
            "ci_high": profit_stats["ci_high"],
            "mean_n_eff": neff_stats["mean"],
            "se_n_eff": neff_stats["se"],
            "n_seeds": profit_stats["n"],
        })

    _write_csv(
        ep.data("sybil_arbitrage.csv"),
        ["k", "seed", "total_arbitrage_profit", "mean_n_eff", "arbitrage_found_rounds"],
        per_seed_rows,
    )
    _write_csv(
        ep.data("sybil_arbitrage_summary.csv"),
        ["k", "mean_profit", "se_profit", "ci_low", "ci_high",
         "mean_n_eff", "se_n_eff", "n_seeds"],
        agg_rows,
    )
    print("\nSybil Arbitrage (sybil-proofness audit)")
    print("=" * 50)
    for r in agg_rows:
        print(f"  k={r['k']}: profit={r['mean_profit']:+.2f} ± {r['se_profit']:.2f} "
              f"(CI {r['ci_low']:+.2f}..{r['ci_high']:+.2f}), N_eff={r['mean_n_eff']:.2f}")

    if write_summary:
        try:
            from onlinev2.behaviour.plotting.adversary_plots import plot_sybil_arbitrage
            from onlinev2.experiments.summarise import write_experiment_summary
            logs_out = {
                "attacker_cumulative_profit": float(
                    np.mean([r["mean_profit"] for r in agg_rows])
                ) if agg_rows else None,
            }
            write_experiment_summary(
                ep,
                {"experiment_name": "sybil_arbitrage", "T": T, "block": block,
                 "n_seeds": len(seeds), "k_grid": k_grid},
                logs_out,
            )
            plot_sybil_arbitrage(ep)
        except Exception as e:
            print(f"Warning: summary failed: {e}")


def run_arbitrage_crowd_size(outdir="outputs", seed=42, block="behaviour",
                             write_summary=True, seeds=None):
    """2D sweep of the arbitrage attack over (λ, n_benign).

    Tests whether the arbitrageur's advantage scales with the crowd size.
    Theoretically, a larger benign population has more disagreement so
    the weighted-median arbitrage point stays profitable; but the
    attacker's m_i / M_t share shrinks, capping the per-round payoff.
    The net effect is an empirical question resolved here.
    """
    from onlinev2.behaviour.adversaries.arbitrageur import ArbitrageurBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "arbitrage_crowd_size", block)
    T = 500
    if seeds is None:
        seeds = list(range(10))
    lam_grid = [0.0, 0.5, 1.0]
    n_grid = [4, 8, 16, 32]

    per_seed_rows = []

    for lam_val in lam_grid:
        for n_benign in n_grid:
            for s in seeds:
                rng_s = np.random.default_rng(s)
                y = rng_s.uniform(0.0, 1.0, size=T)

                pop = build_population(n_benign, seed=s)
                arb_traits = UserTraits(
                    user_id="arbitrageur_0", initial_wealth=10.0,
                    noise_level=0.05, stake_fraction=0.4,
                )
                snapshot = {"p_others": np.full(n_benign, 0.5),
                            "m_others": np.ones(n_benign) * 0.5}

                def target_others(_state, snap=snapshot):
                    return np.asarray(snap["p_others"]), np.asarray(snap["m_others"])

                arb = ArbitrageurBehaviour(
                    arb_traits, scoring_mode="point_mae",
                    target_others=target_others,
                )
                arb.reset(s)

                behaviour = CompositeBehaviourModel(
                    pop, adversary_behaviours={arb_traits.user_id: arb},
                    scoring_mode="point_mae",
                )
                behaviour.reset(s)

                params = MechanismParams(lam=lam_val, scoring_mode="point_mae")
                state = MechanismState()
                for u in pop:
                    state.wealth[u.traits.user_id] = u.traits.initial_wealth
                state.wealth[arb_traits.user_id] = arb_traits.initial_wealth

                arb_profit = 0.0
                agg_hist: list = []
                for t in range(T):
                    pub = RoundPublicState(
                        t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                        weights_prev=state.weights_prev, sigma_prev=state.sigma,
                        wealth_prev=state.wealth, profit_prev=state.profit_prev,
                    )
                    actions = behaviour.act(pub)

                    p_list, m_list = [], []
                    for a in actions:
                        if a.account_id == arb_traits.user_id or not a.participate:
                            continue
                        p_list.append(float(a.report) if not isinstance(a.report, (list, tuple, np.ndarray))
                                      else float(np.asarray(a.report).mean()))
                        m_list.append(max(1e-6, float(a.deposit)))

                    state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
                    behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)

                    if p_list:
                        snapshot["p_others"] = np.asarray(p_list, dtype=float)
                        snapshot["m_others"] = np.asarray(m_list, dtype=float)

                    agg_hist.append(logs["r_hat"])
                    for i, aid in enumerate(logs["ids"]):
                        if aid == arb_traits.user_id:
                            arb_profit += logs["profit"][i]

                per_seed_rows.append({
                    "lam": lam_val,
                    "n_benign": n_benign,
                    "seed": s,
                    "arb_total_profit": arb_profit,
                    "arb_final_wealth": state.wealth.get(arb_traits.user_id, 0.0),
                })

    # Aggregate per (lam, n_benign)
    agg_rows = []
    for lam_val in lam_grid:
        for n_benign in n_grid:
            subset = [r for r in per_seed_rows
                      if r["lam"] == lam_val and r["n_benign"] == n_benign]
            stats = _mean_se_ci([r["arb_total_profit"] for r in subset])
            agg_rows.append({
                "lam": lam_val,
                "n_benign": n_benign,
                "mean_profit": stats["mean"],
                "se_profit": stats["se"],
                "ci_low": stats["ci_low"],
                "ci_high": stats["ci_high"],
                "n_seeds": stats["n"],
            })

    _write_csv(
        ep.data("arbitrage_crowd_size.csv"),
        ["lam", "n_benign", "seed", "arb_total_profit", "arb_final_wealth"],
        per_seed_rows,
    )
    _write_csv(
        ep.data("arbitrage_crowd_size_summary.csv"),
        ["lam", "n_benign", "mean_profit", "se_profit", "ci_low", "ci_high", "n_seeds"],
        agg_rows,
    )
    print("\nArbitrage × Crowd-size sweep (multi-seed)")
    print("=" * 50)
    for r in agg_rows:
        print(f"  lam={r['lam']:.1f}, n={r['n_benign']:2d}: profit="
              f"{r['mean_profit']:+.2f} ± {r['se_profit']:.2f}")

    if write_summary:
        try:
            from onlinev2.behaviour.plotting.adversary_plots import plot_arbitrage_crowd_size
            from onlinev2.experiments.summarise import write_experiment_summary
            write_experiment_summary(
                ep,
                {"experiment_name": "arbitrage_crowd_size", "T": T, "block": block,
                 "n_seeds": len(seeds), "lam_grid": lam_grid, "n_grid": n_grid},
                {"attacker_cumulative_profit":
                    float(np.mean([r["mean_profit"] for r in agg_rows]))},
            )
            plot_arbitrage_crowd_size(ep)
        except Exception as e:
            print(f"Warning: summary/dashboard failed: {e}")


def run_informed_collusion(outdir="outputs", seed=42, block="behaviour",
                           write_summary=True, seeds=None):
    """Coalition of insiders: Chun-Shachter aggregation applied to members
    that each see an F_{t-1}-compliant privileged signal.

    Compares:
      * baseline (no adversary)
      * collusion_only (Chun-Shachter, truthful beliefs with trait noise/bias)
      * informed_collusion (Chun-Shachter + insider precision per member,
        retaining some residual bias to preserve disagreement)

    **Theoretical note.** The Chun-Shachter arbitrage comes from
    *within-coalition disagreement* (Chen-Devanur-Pennock-Vaughan 2014
    Theorem 3.3). Informed members with *identical* beliefs would have no
    internal disagreement and the arbitrage would vanish. In practice
    insiders retain idiosyncratic bias (e.g. institutional priors), so
    informed collusion combines the precision bonus of privileged
    information with a residual Chun-Shachter arbitrage, yielding higher
    total profit than pure-collusion and higher than a single lone
    insider.
    """
    from onlinev2.behaviour.adversaries.coordinated_group import CoordinatedGroupBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "informed_collusion", block)
    T, n_benign = 1000, 8
    if seeds is None:
        seeds = list(range(10))
    phi, eps_scale = 0.7, 0.18

    per_seed_rows = []
    for s in seeds:
        rng_s = np.random.default_rng(s)
        y = np.zeros(T, dtype=float)
        y[0] = 0.5 + rng_s.normal(0.0, 0.1)
        for t in range(1, T):
            y[t] = 0.5 + phi * (y[t - 1] - 0.5) + rng_s.normal(0.0, eps_scale)
        y = np.clip(y, 0.0, 1.0)

        members = [
            UserTraits(user_id=f"informed_{j}", initial_wealth=10.0,
                       noise_level=0.03 + 0.04 * j,
                       bias=(-0.12 + 0.06 * j), stake_fraction=0.2,
                       insider_bonus=0.3)
            for j in range(3)
        ]
        member_ids = {m.user_id for m in members}

        for label in ["baseline", "collusion_only", "informed_collusion"]:
            pop = build_population(n_benign, seed=s)
            adv_map: dict = {}
            if label == "collusion_only":
                adv_map = {"collusion_group": CoordinatedGroupBehaviour(
                    members, scoring_mode="point_mae", aggregation="weighted_mean",
                )}
            elif label == "informed_collusion":
                # Each member runs a privileged-info insider with the
                # same lag/sigma; their beliefs therefore share a strong
                # common component (the lagged y) but differ in bias.
                # The coalition still broadcasts their wager-weighted mean.
                # We wire the insiders as policies inside a coordinated
                # group by overriding members' beliefs through a custom
                # CoordinatedGroupBehaviour subclass-equivalent: since
                # CoordinatedGroupBehaviour consumes trait-based beliefs,
                # we boost precision by shrinking noise_level here.
                informed_members = [
                    UserTraits(
                        user_id=m.user_id,
                        initial_wealth=m.initial_wealth,
                        noise_level=0.015,  # insider precision
                        bias=m.bias * 0.25,  # residual bias only
                        stake_fraction=m.stake_fraction,
                        insider_bonus=m.insider_bonus,
                    )
                    for m in members
                ]
                adv_map = {"informed_coalition": CoordinatedGroupBehaviour(
                    informed_members, scoring_mode="point_mae",
                    aggregation="weighted_mean",
                )}
            behaviour = CompositeBehaviourModel(
                pop, adversary_behaviours=adv_map if adv_map else None,
                scoring_mode="point_mae",
            )
            behaviour.reset(s)
            params = MechanismParams(scoring_mode="point_mae")
            state = MechanismState()
            for u in pop:
                state.wealth[u.traits.user_id] = u.traits.initial_wealth
            if label != "baseline":
                for u in members:
                    state.wealth[u.user_id] = u.initial_wealth

            coalition_profit = 0.0
            agg_hist: list = []
            for t in range(T):
                pub = RoundPublicState(
                    t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                    weights_prev=state.weights_prev, sigma_prev=state.sigma,
                    wealth_prev=state.wealth, profit_prev=state.profit_prev,
                )
                actions = behaviour.act(pub)
                state, logs = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
                behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
                agg_hist.append(logs["r_hat"])
                for i, aid in enumerate(logs["ids"]):
                    if aid in member_ids:
                        coalition_profit += float(logs["profit"][i])

            per_seed_rows.append({
                "scenario": label,
                "seed": s,
                "coalition_profit": float(coalition_profit),
                "final_gini": float(logs["Gini"]),
            })

    agg_rows = []
    for label in ["baseline", "collusion_only", "informed_collusion"]:
        subset = [r for r in per_seed_rows if r["scenario"] == label]
        stats = _mean_se_ci([r["coalition_profit"] for r in subset])
        agg_rows.append({
            "scenario": label,
            "mean_coalition_profit": stats["mean"],
            "se_coalition_profit": stats["se"],
            "ci_low": stats["ci_low"],
            "ci_high": stats["ci_high"],
            "n_seeds": stats["n"],
        })

    _write_csv(
        ep.data("informed_collusion.csv"),
        ["scenario", "seed", "coalition_profit", "final_gini"],
        per_seed_rows,
    )
    _write_csv(
        ep.data("informed_collusion_summary.csv"),
        ["scenario", "mean_coalition_profit", "se_coalition_profit",
         "ci_low", "ci_high", "n_seeds"],
        agg_rows,
    )
    print("\nInformed Collusion (multi-seed, AR(1) DGP)")
    print("=" * 50)
    for r in agg_rows:
        print(f"  {r['scenario']:>22s}: coalition_profit="
              f"{r['mean_coalition_profit']:+.2f} ± {r['se_coalition_profit']:.2f} "
              f"(CI {r['ci_low']:+.2f}..{r['ci_high']:+.2f})")

    if write_summary:
        try:
            from onlinev2.behaviour.plotting.adversary_plots import plot_informed_collusion
            from onlinev2.experiments.summarise import write_experiment_summary
            logs_out = {
                "attacker_cumulative_profit": float(
                    max((r["mean_coalition_profit"] for r in agg_rows
                         if r["scenario"] != "baseline"), default=0.0)
                ),
            }
            write_experiment_summary(
                ep,
                {"experiment_name": "informed_collusion", "T": T, "block": block,
                 "n_seeds": len(seeds), "dgp": f"AR(1) phi={phi}"},
                logs_out,
            )
            plot_informed_collusion(ep)
        except Exception as e:
            print(f"Warning: summary failed: {e}")


def run_reputation_reset(outdir="outputs", seed=42, block="behaviour",
                         write_summary=True, seeds=None):
    """Whitewashing attacker: resets identity when reputation stock falls.

    Compares three scenarios across multiple seeds:

      * baseline: no attacker.
      * manipulator_no_reset: fixed identity, aggressive target=0.9
        manipulation. Expected to go bankrupt / accumulate large losses.
      * reputation_reset: same manipulation but the attacker resets
        identity when cumulative profit drops below a threshold.

    Reports cumulative profit across *all* identities under the attacker's
    control plus the number of resets. A successful mechanism should
    keep the reset-attacker's total profit bounded (not unboundedly
    positive) even though it can reset. The κ > 0 staleness decay and
    newcomer prior L0 are the mechanism's levers; this experiment
    measures their residual effect.
    """
    from onlinev2.behaviour.adversaries.reputation_reset import ReputationResetBehaviour
    from onlinev2.behaviour.adversaries.strategic_influence import StrategicInfluenceBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = _exp_paths(outdir, "reputation_reset", block)
    T, n_benign = 1000, 8
    if seeds is None:
        seeds = list(range(10))

    attacker_traits = UserTraits(
        user_id="reset_attacker",
        initial_wealth=20.0,  # Enough to fund multiple resets
        manipulation_strength=0.8,
        noise_level=0.03,
    )

    scenarios = [
        ("baseline", None),
        (
            "manipulator_no_reset",
            lambda: StrategicInfluenceBehaviour(
                attacker_traits, target=0.9, scoring_mode="point_mae",
                aggressiveness=1.0,
            ),
        ),
        (
            "reputation_reset",
            lambda: ReputationResetBehaviour(
                attacker_traits, target=0.9, scoring_mode="point_mae",
                reset_threshold=-3.0, cooldown=50, warmup=20,
            ),
        ),
    ]

    per_seed_rows: list = []
    for s in seeds:
        rng_s = np.random.default_rng(s)
        y = rng_s.uniform(0.0, 1.0, size=T)
        for label, factory in scenarios:
            pop = build_population(n_benign, seed=s)
            adv_map: dict = {}
            adv_ref = None
            if factory is not None:
                adv_ref = factory()
                adv_map = {"attacker_entry": adv_ref}
            behaviour = CompositeBehaviourModel(
                pop, adversary_behaviours=adv_map if adv_map else None,
                scoring_mode="point_mae",
            )
            # Use κ > 0 so the staleness decay actually penalises newcomers.
            params = MechanismParams(
                scoring_mode="point_mae", kappa=0.05, sigma_init=0.2,
            )
            behaviour.reset(s)
            state = MechanismState()
            for u in pop:
                state.wealth[u.traits.user_id] = u.traits.initial_wealth
            if factory is not None:
                state.wealth[attacker_traits.user_id] = attacker_traits.initial_wealth

            total_attacker_profit = 0.0
            agg_hist: list = []
            for t in range(T):
                pub = RoundPublicState(
                    t=t, y_history=y[:t].tolist(), agg_history=agg_hist,
                    weights_prev=state.weights_prev, sigma_prev=state.sigma,
                    wealth_prev=state.wealth, profit_prev=state.profit_prev,
                )
                actions = behaviour.act(pub)
                state, logs = run_round(
                    state=state, params=params, actions=actions, y_t=float(y[t]),
                )
                # Enrich logs with profit_by_account so reputation_reset
                # adversary's observe_round_result can track its own PnL.
                pba = dict(zip(logs["ids"], logs["profit"]))
                logs_enriched = {**logs, "profit_by_account": pba}
                behaviour.observe_round_result(
                    t=t, y_t=float(y[t]), logs_t=logs_enriched,
                )
                agg_hist.append(logs["r_hat"])
                for aid, profit in pba.items():
                    if str(aid).startswith(attacker_traits.user_id):
                        total_attacker_profit += float(profit)

            n_resets = getattr(adv_ref, "num_resets", 0) if adv_ref else 0
            per_seed_rows.append({
                "scenario": label,
                "seed": s,
                "attacker_profit": total_attacker_profit,
                "n_resets": int(n_resets),
            })

    # Aggregate per scenario
    agg_rows = []
    for label, _ in scenarios:
        subset = [r for r in per_seed_rows if r["scenario"] == label]
        profit_stats = _mean_se_ci([r["attacker_profit"] for r in subset])
        resets_stats = _mean_se_ci([r["n_resets"] for r in subset])
        agg_rows.append({
            "scenario": label,
            "mean_attacker_profit": profit_stats["mean"],
            "se_attacker_profit": profit_stats["se"],
            "ci_low": profit_stats["ci_low"],
            "ci_high": profit_stats["ci_high"],
            "mean_n_resets": resets_stats["mean"],
            "n_seeds": profit_stats["n"],
        })

    _write_csv(
        ep.data("reputation_reset.csv"),
        ["scenario", "seed", "attacker_profit", "n_resets"],
        per_seed_rows,
    )
    _write_csv(
        ep.data("reputation_reset_summary.csv"),
        ["scenario", "mean_attacker_profit", "se_attacker_profit",
         "ci_low", "ci_high", "mean_n_resets", "n_seeds"],
        agg_rows,
    )
    print("\nReputation Reset / Whitewashing (multi-seed)")
    print("=" * 50)
    for r in agg_rows:
        print(f"  {r['scenario']:>22s}: profit="
              f"{r['mean_attacker_profit']:+.2f} ± {r['se_attacker_profit']:.2f} "
              f"(CI {r['ci_low']:+.2f}..{r['ci_high']:+.2f}), "
              f"resets={r['mean_n_resets']:.1f}")

    if write_summary:
        try:
            from onlinev2.behaviour.plotting.adversary_plots import plot_reputation_reset
            from onlinev2.experiments.summarise import write_experiment_summary
            logs_out = {
                "attacker_cumulative_profit": agg_rows[-1]["mean_attacker_profit"]
                if agg_rows else None,
            }
            write_experiment_summary(
                ep,
                {"experiment_name": "reputation_reset", "T": T, "block": block,
                 "n_seeds": len(seeds), "kappa": 0.05, "warmup": 20,
                 "cooldown": 50, "reset_threshold": -3.0},
                logs_out,
            )
            plot_reputation_reset(ep)
        except Exception as e:
            print(f"Warning: summary failed: {e}")
