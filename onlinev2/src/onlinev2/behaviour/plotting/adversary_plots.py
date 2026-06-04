"""
Plots for adversary-focused behaviour experiments.

Produces per-experiment adversary diagnostics: attack profit vs λ with
95% CIs (arbitrage_scan), coalition profit vs scenario (collusion_stress),
insider profit by regime (insider_advantage), wash-style activity
inflation vs profit cost (wash_activity_gaming), strategic-reporting
shift vs attacker profit (strategic_reporting), and sybil-invariance of
the arbitrage profit (sybil_arbitrage).

All helpers read the matching ``*_summary.csv`` produced by the runners
and fail silently if the file is missing — plots are an enhancement, not
a precondition for the experiment to complete.
"""
from __future__ import annotations

import csv
import os
from typing import Dict, List, Optional

import matplotlib.pyplot as plt
import numpy as np

from onlinev2.plotting.style import COLORS, new_figure, save_fig


def _read_csv(path: str) -> Optional[List[Dict[str, str]]]:
    if not os.path.exists(path):
        return None
    with open(path, "r", newline="") as fh:
        return list(csv.DictReader(fh))


def plot_arbitrage_scan(ep, csv_path: Optional[str] = None) -> Optional[str]:
    """Bar chart of mean arbitrage profit ± 95% CI across λ."""
    path = csv_path or ep.data("arbitrage_scan_by_lam.csv")
    rows = _read_csv(path)
    if not rows:
        return None
    lams = [float(r["lam"]) for r in rows]
    means = [float(r["mean_profit"]) for r in rows]
    ci_low = [float(r["ci_low"]) for r in rows]
    ci_high = [float(r["ci_high"]) for r in rows]
    yerr = np.array([
        [m - lo for m, lo in zip(means, ci_low)],
        [hi - m for m, hi in zip(means, ci_high)],
    ])
    fig, ax = new_figure(figsize=(6.5, 4.0))
    ax.bar(lams, means, width=0.08, color=COLORS["pink"],
           yerr=yerr, capsize=4, label="arbitrageur profit")
    ax.axhline(0, color=COLORS["reference"], lw=0.8)
    ax.set_xlabel(r"$\lambda$ (skill-weighting fraction)")
    ax.set_ylabel("Total attacker profit (T=1000)")
    ax.set_title("Arbitrage-seeker profit vs λ (multi-seed mean ± 95% CI)")
    ax.grid(True, alpha=0.3)
    out = ep.plot("arbitrage_profit_by_lam.png")
    save_fig(fig, out)
    return out


def plot_arbitrage_wealth_trajectories(ep) -> Optional[str]:
    """Line plot of the arbitrageur's wealth over time for each λ (seed 0)."""
    rows = _read_csv(ep.data("arbitrage_wealth_trajectories.csv"))
    if not rows:
        return None
    # Group by lam
    by_lam: Dict[float, Dict[str, list]] = {}
    for r in rows:
        lam = float(r["lam"])
        t = int(r["t"])
        w = float(r["wealth"])
        entry = by_lam.setdefault(lam, {"t": [], "w": []})
        entry["t"].append(t)
        entry["w"].append(w)
    if not by_lam:
        return None
    fig, ax = new_figure(figsize=(7.0, 4.2))
    palette = [COLORS["slate"], COLORS["blue"], COLORS["teal"],
               COLORS["green"], COLORS["orange"], COLORS["pink"]]
    for i, lam in enumerate(sorted(by_lam.keys())):
        ts = np.asarray(by_lam[lam]["t"])
        ws = np.asarray(by_lam[lam]["w"])
        order = np.argsort(ts)
        ax.plot(ts[order], ws[order],
                color=palette[i % len(palette)], lw=1.2, label=f"λ = {lam:.1f}")
    ax.axhline(10.0, color=COLORS["reference"], lw=0.5, ls="-",
               label="initial wealth")
    ax.set_xlabel("round t")
    ax.set_ylabel("arbitrageur wealth")
    ax.set_title("Attacker wealth trajectory (seed 0) vs λ")
    ax.grid(True, alpha=0.3)
    ax.legend(loc="upper left", ncol=2, fontsize=8)
    out = ep.plot("arbitrage_wealth_trajectories.png")
    save_fig(fig, out)
    return out


def plot_collusion_stress(ep) -> Optional[str]:
    rows = _read_csv(ep.data("collusion_stress_summary.csv"))
    if not rows:
        return None
    labels = [r["scenario"] for r in rows]
    means = [float(r["mean_coalition_profit"]) for r in rows]
    lows = [float(r["ci_low"]) for r in rows]
    highs = [float(r["ci_high"]) for r in rows]
    yerr = np.array([
        [m - lo for m, lo in zip(means, lows)],
        [hi - m for m, hi in zip(means, highs)],
    ])
    colors = [COLORS["reference"], COLORS["pink"], COLORS["purple"]][: len(labels)]
    fig, ax = new_figure(figsize=(7.0, 4.0))
    ax.bar(range(len(labels)), means, color=colors, yerr=yerr, capsize=4)
    ax.axhline(0, color=COLORS["reference"], lw=0.8)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=20, ha="right", fontsize=9)
    ax.set_ylabel("Coalition profit (mean ± 95% CI)")
    ax.set_title("Chun-Shachter coalition profit: weighted mean vs median")
    ax.grid(True, alpha=0.3, axis="y")
    out = ep.plot("coalition_profit.png")
    save_fig(fig, out)
    return out


def plot_insider_advantage(ep) -> Optional[str]:
    rows = _read_csv(ep.data("insider_advantage_summary.csv"))
    if not rows:
        return None
    labels = [r["scenario"] for r in rows]
    means = [float(r["mean_insider_profit"]) for r in rows]
    lows = [float(r["ci_low"]) for r in rows]
    highs = [float(r["ci_high"]) for r in rows]
    yerr = np.array([
        [m - lo for m, lo in zip(means, lows)],
        [hi - m for m, hi in zip(means, highs)],
    ])
    colors = [COLORS["reference"], COLORS["blue"], COLORS["red"]][: len(labels)]
    fig, ax = new_figure(figsize=(7.0, 4.0))
    ax.bar(range(len(labels)), means, color=colors, yerr=yerr, capsize=4)
    ax.axhline(0, color=COLORS["reference"], lw=0.8)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=20, ha="right", fontsize=9)
    ax.set_ylabel("Insider profit (mean ± 95% CI)")
    ax.set_title("Insider advantage (AR(1) DGP): legitimate vs leaked")
    ax.grid(True, alpha=0.3, axis="y")
    out = ep.plot("insider_profit.png")
    save_fig(fig, out)
    return out


def plot_wash_activity(ep) -> Optional[str]:
    rows = _read_csv(ep.data("wash_activity_gaming_summary.csv"))
    if not rows:
        return None
    labels = [r["scenario"] for r in rows]
    infl = [float(r["mean_inflation_rate"]) for r in rows]
    prof = [float(r["mean_wash_profit"]) for r in rows]
    fig, ax = new_figure(figsize=(7.0, 4.0))
    ax2 = ax.twinx()
    x = np.arange(len(labels))
    ax.bar(x - 0.18, infl, width=0.36, color=COLORS["teal"], label="inflation rate")
    ax2.bar(x + 0.18, prof, width=0.36, color=COLORS["orange"], label="wash profit")
    ax.axhline(0, color=COLORS["reference"], lw=0.8)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=20, ha="right", fontsize=9)
    ax.set_ylabel("Activity inflation rate", color=COLORS["teal"])
    ax2.set_ylabel("Wash profit", color=COLORS["orange"])
    ax.set_title("Wash / activity gaming: inflation vs profit cost")
    ax.grid(True, alpha=0.3, axis="y")
    # Combined legend below the panel so it never sits on top of bars.
    handles1, labels1 = ax.get_legend_handles_labels()
    handles2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(
        handles1 + handles2, labels1 + labels2,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.22),
        ncol=2,
        fontsize=9,
        frameon=False,
    )
    out = ep.plot("wash_activity.png")
    save_fig(fig, out)
    return out


def plot_strategic_reporting(ep) -> Optional[str]:
    rows = _read_csv(ep.data("strategic_reporting_summary.csv"))
    if not rows:
        return None
    labels = [r["scenario"] for r in rows]
    shifts = [float(r["mean_r_hat_shift"]) for r in rows]
    profits = [float(r["mean_attacker_profit"]) for r in rows]
    fig, ax = new_figure(figsize=(6.5, 4.5))
    ax.scatter(profits, shifts, c=COLORS["purple"], s=80, edgecolors="black")
    for x, y, lab in zip(profits, shifts, labels):
        ax.annotate(lab.replace("pull_", "pull="), (x, y), fontsize=8,
                    xytext=(6, 6), textcoords="offset points")
    ax.axhline(0, color=COLORS["reference"], lw=0.6)
    ax.axvline(0, color=COLORS["reference"], lw=0.6)
    ax.set_xlabel("Attacker profit (mean)")
    ax.set_ylabel(r"$\Delta \hat r$ vs baseline (mean)")
    ax.set_title("Strategic reporter: aggregate shift vs profit cost")
    ax.grid(True, alpha=0.3)
    out = ep.plot("strategic_reporting_frontier.png")
    save_fig(fig, out)
    return out


def plot_sybil_arbitrage(ep) -> Optional[str]:
    rows = _read_csv(ep.data("sybil_arbitrage_summary.csv"))
    if not rows:
        return None
    ks = [int(r["k"]) for r in rows]
    means = [float(r["mean_profit"]) for r in rows]
    lows = [float(r["ci_low"]) for r in rows]
    highs = [float(r["ci_high"]) for r in rows]
    yerr = np.array([
        [m - lo for m, lo in zip(means, lows)],
        [hi - m for m, hi in zip(means, highs)],
    ])
    fig, ax = new_figure(figsize=(6.0, 4.0))
    ax.errorbar(ks, means, yerr=yerr, fmt="o-", color=COLORS["pink"],
                capsize=4, linewidth=1.5, markersize=8)
    ax.axhline(means[0], color=COLORS["reference"], ls="-", lw=0.6,
               label="k=1 baseline")
    ax.set_xticks(ks)
    ax.set_xlabel("k (number of sybil accounts)")
    ax.set_ylabel("Total arbitrage profit (mean ± 95% CI)")
    ax.set_title("Sybil-proofness audit: profit invariance across k")
    ax.legend(loc="best", fontsize=9)
    ax.grid(True, alpha=0.3)
    out = ep.plot("sybil_arbitrage_profit.png")
    save_fig(fig, out)
    return out


def plot_arbitrage_crowd_size(ep) -> Optional[str]:
    """Heatmap-style grouped bars of arbitrage profit over (λ, n_benign)."""
    rows = _read_csv(ep.data("arbitrage_crowd_size_summary.csv"))
    if not rows:
        return None
    lams = sorted({float(r["lam"]) for r in rows})
    ns = sorted({int(r["n_benign"]) for r in rows})
    # Index rows by (lam, n)
    grid: Dict[tuple, float] = {}
    err_grid: Dict[tuple, float] = {}
    for r in rows:
        grid[(float(r["lam"]), int(r["n_benign"]))] = float(r["mean_profit"])
        err_grid[(float(r["lam"]), int(r["n_benign"]))] = float(r["se_profit"])
    fig, ax = new_figure(figsize=(7.5, 4.0))
    bar_width = 0.8 / len(lams)
    x_base = np.arange(len(ns))
    palette = [COLORS["slate"], COLORS["orange"], COLORS["pink"]]
    for i, lam in enumerate(lams):
        heights = [grid.get((lam, n), 0.0) for n in ns]
        errs = [err_grid.get((lam, n), 0.0) for n in ns]
        ax.bar(x_base + i * bar_width, heights, width=bar_width,
               color=palette[i % len(palette)],
               yerr=errs, capsize=3, label=f"λ = {lam:.1f}")
    ax.axhline(0, color=COLORS["reference"], lw=0.6)
    ax.set_xticks(x_base + bar_width * (len(lams) - 1) / 2)
    ax.set_xticklabels([str(n) for n in ns])
    ax.set_xlabel("n_benign (crowd size)")
    ax.set_ylabel("Mean arbitrage profit (T=500)")
    ax.set_title("Arbitrage profit vs crowd size and λ")
    ax.legend(loc="upper right", fontsize=9)
    ax.grid(True, alpha=0.3, axis="y")
    out = ep.plot("arbitrage_crowd_size.png")
    save_fig(fig, out)
    return out


def plot_informed_collusion(ep) -> Optional[str]:
    rows = _read_csv(ep.data("informed_collusion_summary.csv"))
    if not rows:
        return None
    labels = [r["scenario"] for r in rows]
    means = [float(r["mean_coalition_profit"]) for r in rows]
    lows = [float(r["ci_low"]) for r in rows]
    highs = [float(r["ci_high"]) for r in rows]
    yerr = np.array([
        [m - lo for m, lo in zip(means, lows)],
        [hi - m for m, hi in zip(means, highs)],
    ])
    colors = [COLORS["reference"], COLORS["purple"], COLORS["pink"]][: len(labels)]
    fig, ax = new_figure(figsize=(7.0, 4.0))
    ax.bar(range(len(labels)), means, color=colors, yerr=yerr, capsize=4)
    ax.axhline(0, color=COLORS["reference"], lw=0.8)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=15, ha="right", fontsize=9)
    ax.set_ylabel("Coalition profit (mean ± 95% CI)")
    ax.set_title("Coalition vs informed-coalition profit (AR(1) DGP)")
    ax.grid(True, alpha=0.3, axis="y")
    out = ep.plot("informed_collusion.png")
    save_fig(fig, out)
    return out


def plot_reputation_reset(ep) -> Optional[str]:
    """Grouped bars: attacker profit and number of identity resets per scenario."""
    rows = _read_csv(ep.data("reputation_reset_summary.csv"))
    if not rows:
        return None
    labels = [r["scenario"] for r in rows]
    profits = [float(r["mean_attacker_profit"]) for r in rows]
    lows = [float(r["ci_low"]) for r in rows]
    highs = [float(r["ci_high"]) for r in rows]
    resets = [float(r["mean_n_resets"]) for r in rows]
    yerr = np.array([
        [p - lo for p, lo in zip(profits, lows)],
        [hi - p for p, hi in zip(profits, highs)],
    ])
    fig, ax = new_figure(figsize=(7.5, 4.2))
    ax2 = ax.twinx()
    x = np.arange(len(labels))
    bar_profit = ax.bar(x - 0.2, profits, width=0.4, color=COLORS["pink"],
                        yerr=yerr, capsize=4, label="attacker profit")
    bar_reset = ax2.bar(x + 0.2, resets, width=0.4, color=COLORS["teal"],
                        label="mean resets")
    ax.axhline(0, color=COLORS["reference"], lw=0.8)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=15, ha="right", fontsize=9)
    ax.set_ylabel("Attacker profit (mean ± 95% CI)", color=COLORS["pink"])
    ax2.set_ylabel("Mean number of resets", color=COLORS["teal"])
    ax.set_title("Reputation-reset attack profile")
    ax.grid(True, alpha=0.3, axis="y")
    ax.legend(
        [bar_profit, bar_reset], ["attacker profit", "mean resets"],
        loc="upper center",
        bbox_to_anchor=(0.5, -0.22),
        ncol=2,
        fontsize=9,
        frameon=False,
    )
    out = ep.plot("reputation_reset.png")
    save_fig(fig, out)
    return out


def make_all_adversary_plots(ep) -> Dict[str, Optional[str]]:
    """Attempt each plot; return the paths of those successfully written."""
    out: Dict[str, Optional[str]] = {}
    for name, fn in [
        ("arbitrage_scan", plot_arbitrage_scan),
        ("arbitrage_wealth_trajectories", plot_arbitrage_wealth_trajectories),
        ("arbitrage_crowd_size", plot_arbitrage_crowd_size),
        ("collusion_stress", plot_collusion_stress),
        ("informed_collusion", plot_informed_collusion),
        ("insider_advantage", plot_insider_advantage),
        ("reputation_reset", plot_reputation_reset),
        ("wash_activity_gaming", plot_wash_activity),
        ("strategic_reporting", plot_strategic_reporting),
        ("sybil_arbitrage", plot_sybil_arbitrage),
    ]:
        try:
            out[name] = fn(ep)
        except Exception:
            out[name] = None
    return out
