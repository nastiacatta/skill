"""
Standardised four-panel diagnostic plot for experiment outputs.

Panel 1: Relative CRPS improvement (Δ vs baseline) — bar chart with error bars
Panel 2: PIT or reliability diagram — scatter with diagonal reference
Panel 3: Wealth/influence concentration (HHI, N_eff, Gini) — grouped bar chart
Panel 4: Failure mode (where the method breaks) — line chart or text summary

Usage:
    from onlinev2.plotting.four_panel import plot_four_panel

    results = {
        "experiment_name": "forecast_aggregation",
        "methods": {
            "equal":    {"delta_crps_mean": 0.0, "delta_crps_se": 0.0, ...},
            "blended":  {"delta_crps_mean": -0.003, "delta_crps_se": 0.001, ...},
        },
        "reliability": {0.1: 0.11, 0.25: 0.24, 0.5: 0.49, 0.75: 0.76, 0.9: 0.88},
        "failure_notes": ["blended degrades when all forecasters have equal skill"],
    }
    plot_four_panel(results, "/path/to/output.png")
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np

from onlinev2.plotting.style import COLORS, PALETTE, new_figure, save_fig


def plot_four_panel(
    results: Dict[str, Any],
    save_path: str,
    title: Optional[str] = None,
) -> str:
    """Generate a standardised four-panel diagnostic figure.

    Parameters
    ----------
    results : dict
        Standardised experiment results with the following keys:

        ``experiment_name`` : str
            Human-readable experiment identifier.

        ``methods`` : dict[str, dict]
            Per-method summary. Each value should contain:
            - ``delta_crps_mean`` : float — mean Δ CRPS vs equal weights
            - ``delta_crps_se``   : float — standard error of Δ CRPS
            - ``mean_hhi``        : float (optional) — mean HHI
            - ``mean_n_eff``      : float (optional) — mean effective N
            - ``final_gini``      : float (optional) — final Gini coefficient

        ``reliability`` : dict[float, float], optional
            Mapping from nominal τ to empirical coverage p̂(τ).

        ``reliability_se`` : dict[float, float], optional
            Mapping from nominal τ to SE of p̂(τ).

        ``failure_notes`` : list[str], optional
            Free-text notes on where the method breaks.

    save_path : str
        File path for the saved PNG.

    title : str, optional
        Override the figure suptitle.

    Returns
    -------
    str
        The path the figure was saved to.
    """
    exp_name = results.get("experiment_name", "Experiment")
    methods_data = results.get("methods", {})
    reliability = results.get("reliability", {})
    reliability_se = results.get("reliability_se", {})
    failure_notes: List[str] = results.get("failure_notes", [])

    fig, axes = new_figure(2, 2, figsize=(15, 11))

    # ------------------------------------------------------------------
    # Panel 1: Relative CRPS improvement (Δ vs baseline) — bar chart
    # ------------------------------------------------------------------
    ax1 = axes[0, 0]
    method_names = list(methods_data.keys())
    if method_names:
        means = [methods_data[m].get("delta_crps_mean", 0.0) for m in method_names]
        ses = [methods_data[m].get("delta_crps_se", 0.0) for m in method_names]
        x_pos = np.arange(len(method_names))
        colors = [PALETTE[i % len(PALETTE)] for i in range(len(method_names))]

        ax1.bar(x_pos, means, color=colors, alpha=0.85, edgecolor="white")
        ax1.errorbar(
            x_pos, means,
            yerr=[np.array(ses) * 1.96, np.array(ses) * 1.96],
            fmt="none", color=COLORS["truth"], capsize=5, linewidth=1.2,
        )
        ax1.axhline(0, color=COLORS["reference"], ls="-", lw=0.6)
        ax1.set_xticks(x_pos)
        ax1.set_xticklabels(method_names, rotation=20, ha="right")
    ax1.set(
        xlabel="Method",
        ylabel="Δ CRPS vs equal (negative = better)",
        title="Panel 1: Relative CRPS Improvement",
    )

    # ------------------------------------------------------------------
    # Panel 2: PIT / reliability diagram — scatter with diagonal
    # ------------------------------------------------------------------
    ax2 = axes[0, 1]
    ax2.plot([0, 1], [0, 1], ls="-", color=COLORS["reference"], lw=0.6, label="Perfect")
    if reliability:
        taus_sorted = sorted(reliability.keys())
        p_hats = [reliability[t] for t in taus_sorted]
        tau_arr = np.array(taus_sorted)
        p_arr = np.array(p_hats)

        if reliability_se:
            se_arr = np.array([reliability_se.get(t, 0.0) for t in taus_sorted])
            ax2.errorbar(
                tau_arr, p_arr, yerr=1.96 * se_arr,
                fmt="o", color=COLORS["pink"], markersize=8, capsize=4,
                zorder=5, label="Mean ± 95% CI",
            )
        else:
            ax2.scatter(tau_arr, p_arr, color=COLORS["pink"], s=60, zorder=5, label="Observed")

        ax2.plot(tau_arr, p_arr, color=COLORS["pink"], linewidth=1.2, alpha=0.6)
        for t_val, p_val in zip(tau_arr, p_arr):
            if np.isfinite(p_val):
                ax2.annotate(
                    f"  {p_val:.3f}", (t_val, p_val),
                    fontsize=7, color=COLORS["slate"],
                )
    ax2.set(
        xlabel="Nominal quantile level τ",
        ylabel="Empirical coverage p̂(τ)",
        title="Panel 2: Reliability Diagram",
    )
    ax2.set_xlim(-0.02, 1.02)
    ax2.set_ylim(-0.02, 1.02)
    ax2.set_aspect("equal")
    ax2.legend(
        fontsize=8,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.18),
        ncol=2,
        frameon=False,
    )

    # ------------------------------------------------------------------
    # Panel 3: Concentration metrics — grouped bar chart
    # ------------------------------------------------------------------
    ax3 = axes[1, 0]
    concentration_metrics = ["mean_hhi", "mean_n_eff", "final_gini"]
    metric_labels = ["HHI", "N_eff", "Gini"]

    if method_names:
        n_metrics = len(concentration_metrics)
        n_methods = len(method_names)
        bar_width = 0.8 / max(n_methods, 1)
        x_base = np.arange(n_metrics)

        for j, method in enumerate(method_names):
            vals = []
            for cm in concentration_metrics:
                v = methods_data[method].get(cm, 0.0)
                vals.append(v if np.isfinite(v) else 0.0)
            offset = (j - n_methods / 2 + 0.5) * bar_width
            ax3.bar(
                x_base + offset, vals, width=bar_width,
                color=PALETTE[j % len(PALETTE)], alpha=0.85,
                label=method, edgecolor="white",
            )
        ax3.set_xticks(x_base)
        ax3.set_xticklabels(metric_labels)
        ax3.legend(
            fontsize=7,
            loc="upper center",
            bbox_to_anchor=(0.5, -0.18),
            ncol=min(n_methods, 3),
            frameon=False,
        )
    ax3.set(
        xlabel="Concentration metric",
        ylabel="Value",
        title="Panel 3: Wealth / Influence Concentration",
    )

    # ------------------------------------------------------------------
    # Panel 4: Failure mode — text summary
    # ------------------------------------------------------------------
    ax4 = axes[1, 1]
    ax4.axis("off")
    ax4.set_title("Panel 4: Failure Modes", fontsize=13)

    if failure_notes:
        y_pos = 0.90
        for i, note in enumerate(failure_notes[:8]):  # cap at 8 notes
            bullet = "•"
            ax4.text(
                0.05, y_pos, f"{bullet}  {note}",
                transform=ax4.transAxes, fontsize=10,
                color=COLORS["truth"], verticalalignment="top",
                wrap=True,
            )
            y_pos -= 0.12
    else:
        ax4.text(
            0.5, 0.5, "No failure modes identified.",
            transform=ax4.transAxes, fontsize=11,
            color=COLORS["slate"], ha="center", va="center",
        )

    # ------------------------------------------------------------------
    # Final layout
    # ------------------------------------------------------------------
    suptitle = title or f"Four-Panel Diagnostic: {exp_name}"
    fig.suptitle(suptitle, fontsize=15, fontweight="bold")
    return save_fig(fig, save_path)
