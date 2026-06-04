"""
Quality-over-quantity behaviour dashboard.

Produces exactly 7 standard plots (plus optional arbitrage heatmap for arbitrage_scan).
Same naming, consistent styling, readable defaults.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np

from onlinev2.plotting.style import COLORS, new_figure, save_fig


def make_behaviour_dashboard(
    paths: Any,
    logs: Dict[str, Any],
    config: Dict[str, Any],
    *,
    extra_arbitrage_heatmap: bool = False,
    arbitrage_csv_path: Optional[str] = None,
) -> None:
    """
    Generate the 7 standard behaviour dashboard plots.

    paths: object with .plot(filename) returning full path for plots.
    logs: dict with optional keys:
      - participation_per_round: (T,) N_t = sum_i a_{i,t}
      - gap_list: list of per-account inter-arrival gaps
      - deposits_flat: 1d array of all b_{i,t}
      - wagers_flat: 1d array of all m_{i,t}
      - wagers_vs_width: (N, 2) array [m, delta] for scatter, or (m_arr, width_arr)
      - coverage_80: float or (T,) empirical coverage of [q_0.1, q_0.9]
      - sharpness_delta: 1d array of interval widths Delta_{i,t}
      - top1_share: (T,) top-1 weight share
      - top5_share: (T,) top-5 weight share
      - hhi_ts: (T,) H_t
      - n_eff_ts: (T,) N^eff_t
      - gini_ts: (T,) Gini(W_t)
      - ruin_rate_ts: (T,) R_t = (1/n)*sum_i 1[W_{i,t}=0]
      - arbitrage_grid: dict with lam_vals, eta_vals (or single param), A_theta 2d array
    config: experiment name, T, n_accounts, etc. (for titles).
    extra_arbitrage_heatmap: if True, produce plot 8 (arbitrage margin heatmap).
    arbitrage_csv_path: if set, export A(theta) table to this path.
    """

    config.get("experiment_name", "behaviour")
    config.get("T", 0)

    # 1) Participation over time: N_t
    if "participation_per_round" in logs:
        n_t = np.asarray(logs["participation_per_round"]).ravel()
        fig, ax = new_figure(1, 1)
        ax.plot(n_t, color=COLORS["blue"], linewidth=1.0)
        ax.set(xlabel="Round $t$", ylabel="$N_t$ (active accounts)", title="Participation over time")
        save_fig(fig, paths.plot("01_participation_over_time.png"))

    # 2) Gap distribution: histogram of inter-arrival gaps
    if "gap_list" in logs:
        gaps = [g for g in logs["gap_list"] if g is not None and g > 0]
        if gaps:
            fig, ax = new_figure(1, 1)
            ax.hist(gaps, bins=min(50, max(10, len(gaps) // 5)), color=COLORS["teal"], alpha=0.7, edgecolor="white")
            ax.set(xlabel="Inter-arrival gap (rounds)", ylabel="Count", title="Gap distribution")
            save_fig(fig, paths.plot("02_gap_distribution.png"))

    # 3) Stake distributions: deposits and effective wagers (pooled)
    if "deposits_flat" in logs or "wagers_flat" in logs:
        fig, axes = new_figure(1, 2)
        if "deposits_flat" in logs:
            b = np.asarray(logs["deposits_flat"]).ravel()
            b = b[b > 0]
            if b.size:
                axes[0].hist(b, bins=min(40, max(10, b.size // 5)), color=COLORS["blue"], alpha=0.7, edgecolor="white")
            axes[0].set(xlabel="$b_{i,t}$ (deposit)", ylabel="Count", title="Deposits (pooled)")
        if "wagers_flat" in logs:
            m = np.asarray(logs["wagers_flat"]).ravel()
            m = m[m > 0]
            if m.size:
                axes[1].hist(m, bins=min(40, max(10, m.size // 5)), color=COLORS["green"], alpha=0.7, edgecolor="white")
            axes[1].set(xlabel="$m_{i,t}$ (effective wager)", ylabel="Count", title="Effective wagers (pooled)")
        save_fig(fig, paths.plot("03_stake_distributions.png"))

    # 4) Stake as a signal: m vs interval width (or uncertainty proxy)
    if "wagers_vs_width" in logs:
        data = np.asarray(logs["wagers_vs_width"])
        if data.ndim == 2 and data.shape[1] >= 2:
            m_vals, width_vals = data[:, 0], data[:, 1]
        elif isinstance(logs["wagers_vs_width"], (list, tuple)) and len(logs["wagers_vs_width"]) == 2:
            m_vals = np.asarray(logs["wagers_vs_width"][0]).ravel()
            width_vals = np.asarray(logs["wagers_vs_width"][1]).ravel()
        else:
            m_vals = width_vals = np.array([])
        if m_vals.size and width_vals.size:
            fig, ax = new_figure(1, 1)
            ax.scatter(width_vals, m_vals, alpha=0.4, s=8, color=COLORS["purple"])
            ax.set(xlabel=r"$\Delta_{i,t}$ (interval width $q_{0.9}-q_{0.1}$)", ylabel="$m_{i,t}$", title="Stake as a signal")
            save_fig(fig, paths.plot("04_stake_vs_uncertainty.png"))

    # 5) Calibration + sharpness: coverage of [q_0.1, q_0.9] and sharpness histogram
    if "coverage_80" in logs or "sharpness_delta" in logs:
        fig, axes = new_figure(1, 2)
        if "coverage_80" in logs:
            cov = logs["coverage_80"]
            if np.isscalar(cov):
                axes[0].bar([0], [float(cov)], color=COLORS["blue"], label="Empirical")
                axes[0].axhline(0.8, color=COLORS["reference"], linestyle="-", linewidth=0.6, label="Nominal 0.8")
            else:
                cov_arr = np.asarray(cov).ravel()
                axes[0].plot(cov_arr, color=COLORS["blue"], label="Empirical coverage")
                axes[0].axhline(0.8, color=COLORS["reference"], linestyle="-", linewidth=0.6, label="Nominal 0.8")
            axes[0].set(ylabel="Coverage", title=r"Coverage of $[q_{0.1}, q_{0.9}]$")
            axes[0].legend(fontsize=8)
        if "sharpness_delta" in logs:
            delta = np.asarray(logs["sharpness_delta"]).ravel()
            delta = delta[np.isfinite(delta) & (delta > 0)]
            if delta.size:
                axes[1].hist(delta, bins=min(40, max(10, delta.size // 5)), color=COLORS["orange"], alpha=0.7, edgecolor="white")
            axes[1].set(xlabel=r"$\Delta_{i,t}$", ylabel="Count", title="Sharpness")
        save_fig(fig, paths.plot("05_calibration_sharpness.png"))

    # 6) Concentration over time: top-1 and top-5 share; HHI and N_eff
    if "top1_share" in logs or "hhi_ts" in logs:
        fig1, ax1 = new_figure(1, 1)
        if "top1_share" in logs:
            t1 = np.asarray(logs["top1_share"]).ravel()
            ax1.plot(t1, color=COLORS["pink"], label="Top-1 share")
        if "top5_share" in logs:
            t5 = np.asarray(logs["top5_share"]).ravel()
            ax1.plot(t5, color=COLORS["blue"], label="Top-5 share")
        ax1.set(xlabel="Round $t$", ylabel="Weight share", title="Concentration: top-k share")
        ax1.legend(fontsize=8)
        save_fig(fig1, paths.plot("06a_concentration_topk.png"))

        fig2, ax2 = new_figure(1, 1)
        twin_handles, twin_labels = [], []
        if "hhi_ts" in logs:
            hhi = np.asarray(logs["hhi_ts"]).ravel()
            line_h, = ax2.plot(hhi, color=COLORS["green"], label="$H_t$")
            twin_handles.append(line_h)
            twin_labels.append("$H_t$")
        if "n_eff_ts" in logs:
            n_eff = np.asarray(logs["n_eff_ts"]).ravel()
            ax2_twin = ax2.twinx()
            line_n, = ax2_twin.plot(n_eff, color=COLORS["orange"], label="$N^{\\mathrm{eff}}_t$", alpha=0.8)
            ax2_twin.set_ylabel("$N^{\\mathrm{eff}}_t$")
            twin_handles.append(line_n)
            twin_labels.append("$N^{\\mathrm{eff}}_t$")
        ax2.set(xlabel="Round $t$", ylabel="$H_t$", title="Concentration: HHI and $N^{\\mathrm{eff}}_t$")
        if twin_handles:
            ax2.legend(
                twin_handles, twin_labels,
                loc="upper center",
                bbox_to_anchor=(0.5, -0.18),
                ncol=len(twin_handles),
                fontsize=8,
                frameon=False,
            )
        save_fig(fig2, paths.plot("06b_concentration_hhi_neff.png"))

    # 7) Wealth health: Gini(W_t) and ruin rate
    if "gini_ts" in logs or "ruin_rate_ts" in logs:
        fig, ax1 = new_figure(1, 1)
        twin_handles, twin_labels = [], []
        if "gini_ts" in logs:
            gini = np.asarray(logs["gini_ts"]).ravel()
            line_g, = ax1.plot(gini, color=COLORS["red"], label="Gini($W_t$)")
            twin_handles.append(line_g)
            twin_labels.append("Gini($W_t$)")
        ax1.set(xlabel="Round $t$", ylabel="Gini", title="Wealth health")
        if "ruin_rate_ts" in logs:
            ruin = np.asarray(logs["ruin_rate_ts"]).ravel()
            ax2 = ax1.twinx()
            line_r, = ax2.plot(ruin, color=COLORS["slate"], label="Ruin rate $R_t$", alpha=0.8)
            ax2.set_ylabel("Ruin rate")
            twin_handles.append(line_r)
            twin_labels.append("Ruin rate $R_t$")
        if twin_handles:
            ax1.legend(
                twin_handles, twin_labels,
                loc="upper center",
                bbox_to_anchor=(0.5, -0.18),
                ncol=len(twin_handles),
                fontsize=8,
                frameon=False,
            )
        save_fig(fig, paths.plot("07_wealth_health.png"))

    # 8) Arbitrage margin heatmap (only for arbitrage_scan)
    if extra_arbitrage_heatmap and "arbitrage_grid" in logs:
        grid = logs["arbitrage_grid"]
        lam_vals = grid.get("lam_vals", [])
        # support 1d (lam only) or 2d (lam x eta)
        A_theta = np.asarray(grid.get("A_theta", grid.get("arb_total_profit", [])))
        if A_theta.size and len(lam_vals) > 0:
            if A_theta.ndim == 1:
                fig, ax = new_figure(1, 1)
                ax.bar(range(len(lam_vals)), A_theta, color=COLORS["blue"], alpha=0.7)
                ax.set_xticks(range(len(lam_vals)))
                ax.set_xticklabels([f"{v:.2f}" for v in lam_vals])
                ax.set(xlabel="$\\lambda$", ylabel="$A(\\theta)$", title="Arbitrage margin by $\\lambda$")
            else:
                fig, ax = new_figure(1, 1)
                eta_vals = grid.get("eta_vals", range(A_theta.shape[1]))
                im = ax.imshow(A_theta, aspect="auto", cmap="RdYlGn_r", origin="lower")
                ax.set_xticks(range(len(eta_vals)))
                ax.set_xticklabels([f"{v:.2f}" for v in eta_vals])
                ax.set_yticks(range(len(lam_vals)))
                ax.set_yticklabels([f"{v:.2f}" for v in lam_vals])
                ax.set(xlabel="$\\eta$", ylabel="$\\lambda$", title="Arbitrage margin $A(\\theta)$")
                fig.colorbar(im, ax=ax, shrink=0.8)
            save_fig(fig, paths.plot("08_arbitrage_margin_heatmap.png"))

            if arbitrage_csv_path:
                import csv
                import os
                os.makedirs(os.path.dirname(arbitrage_csv_path), exist_ok=True)
                with open(arbitrage_csv_path, "w", newline="") as f:
                    w = csv.writer(f)
                    if A_theta.ndim == 1:
                        w.writerow(["lam", "A_theta"])
                        for i, lam in enumerate(lam_vals):
                            w.writerow([lam, A_theta[i] if i < len(A_theta) else ""])
                    else:
                        w.writerow(["lam", "eta", "A_theta"])
                        for i, lam in enumerate(lam_vals):
                            for j, eta in enumerate(eta_vals):
                                w.writerow([lam, eta, A_theta[i, j] if i < A_theta.shape[0] and j < A_theta.shape[1] else ""])
