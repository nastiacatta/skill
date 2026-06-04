#!/usr/bin/env python3
"""LEGACY convenience generator (kept on disk for reference).

This script is the older convenience generator that was once used to
refresh ``writing/figures/wind_primary_comparison.png`` and
``writing/figures/arbitrage.png`` after a normalisation audit; it has
since been superseded by the canonical figure-generation pipeline.

Status (verified by grep against ``writing/include_order.txt`` and the
chapter Markdown / TeX sources):

  * ``writing/include_order.txt`` does not reference either output
    filename.
  * ``writing/60_results_real_data.md`` and
    ``writing/appendix/C_behaviour_presets.md`` embed the canonical PDF
    siblings (``wind_primary_comparison.pdf``, ``arbitrage.pdf``), not
    the PNGs this script writes.
  * The PNG filenames appear only in ``writing/overleaf/main.tex`` (an
    Overleaf-only export bundle) and in ``writing/figures_and_tables.md``
    (registry; lists the ``.pdf`` source path).
  * The canonical build entry point ``writing/build_pdf.py`` reads
    Markdown via ``include_order.txt`` and never picks up the PNG
    outputs of this script.

Re-running THIS legacy script will overwrite the canonical PNG companions
in ``writing/figures/`` with stylings that no longer match the canonical
look (e.g. sans-serif Avenir Next instead of the serif body font, bold
axis titles, in-axis chart titles).

Recommended action: do not run this script. It is retained only so that
its history stays in the repository; it should be deleted in a follow-up
commit. The CLI guard below requires ``--i-know-this-is-legacy`` before
any output is produced.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WIND_JSON = REPO_ROOT / "dashboard/public/data/real_data/elia_wind/data/comparison.json"
CROWD_CSV = REPO_ROOT / "onlinev2/outputs/behaviour/experiments/arbitrage_crowd_size/data/arbitrage_crowd_size_summary.csv"
FIG_DIR = REPO_ROOT / "writing/figures"

# Palette is the bright Tol vibrant / qualitative scheme used by the
# rest of the thesis figures. Slot names are kept for backward
# compatibility with the chart code below.
PALETTE = {
    "navy": "#4477AA",        # Tol bright blue
    "imperial": "#4477AA",
    "teal": "#0077BB",        # Tol vibrant teal-blue
    "coral": "#CC3311",       # Tol vibrant red — the thesis accent
    "purple": "#AA3377",
    "charcoal": "#333333",
    "slate": "#737373",
    "border": "#CBD5E1",
    "lightBg": "#F1F5F9",
    "orange": "#EE7733",
}

# Semantic colours for the methods shown in the wind master comparison.
# The thesis-canonical role palette (see writing/.tools/STYLE_ROLES.md)
# pins the proposed mechanism to the light-pink anchor and the external
# comparator to bright teal; the entries below stay consistent with that
# scheme so a reader who has scanned the headline plots recognises the
# mechanism row immediately.
METHOD_COLOURS = {
    "oracle": "#1F2A38",                                # oracle / deep slate
    "per_round_inv_crps_hindsight": "#AA3377",
    "best_single": "#EE7733",
    "inverse_variance": "#B7327A",                      # post-processed pink
    "michael_ogd_centered_median_fan": "#1FA39A",       # external teal
    "median": "#999999",
    "trimmed_mean": "#BBBBBB",
    "mechanism": "#F49AC1",                             # proposed mechanism (light pink)
    "skill": "#228833",
    "uniform": "#8C8C8C",                               # baseline grey
}

METHOD_LABELS = {
    "oracle": "Per-round inv-var (oracle)",
    "per_round_inv_crps_hindsight": "Rolling best single",
    "best_single": "Best single forecaster",
    "inverse_variance": "Inverse variance (hindsight)",
    "michael_ogd_centered_median_fan": "Shifted-median fan",
    "median": "Median",
    "trimmed_mean": "Trimmed mean",
    "mechanism": "Mechanism (this project)",
    "skill": "Skill only",
    "uniform": "Equal weights (baseline)",
}


def apply_style() -> None:
    """Apply the shared matplotlib style used by all thesis figures."""
    mpl.rcParams.update(
        {
            "font.family": ["Avenir Next", "Helvetica Neue", "Arial", "sans-serif"],
            "font.size": 13,
            "axes.edgecolor": PALETTE["border"],
            "axes.linewidth": 0.8,
            "axes.titleweight": "bold",
            "axes.titlesize": 16,
            "axes.labelweight": "bold",
            "axes.labelsize": 14,
            "axes.labelcolor": PALETTE["charcoal"],
            "axes.spines.top": False,
            "axes.spines.right": False,
            "xtick.color": PALETTE["charcoal"],
            "ytick.color": PALETTE["charcoal"],
            "xtick.labelsize": 12,
            "ytick.labelsize": 12,
            "xtick.major.size": 0,
            "ytick.major.size": 0,
            "grid.color": PALETTE["border"],
            "grid.linestyle": "-",
            "grid.linewidth": 0.4,
            "grid.alpha": 0.9,
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "savefig.facecolor": "white",
        }
    )


def render_wind_primary_comparison() -> Path:
    """Rebuild the 10-rule CRPS bar chart for the Elia wind headline slice."""
    with WIND_JSON.open() as fh:
        data = json.load(fh)

    rows = {r["method"]: r for r in data["rows"] if r["method"] in METHOD_COLOURS}

    # Sort methods best → worst by mean CRPS so the reader scans top-down.
    sorted_methods = sorted(rows.keys(), key=lambda m: rows[m]["mean_crps"])
    labels = [METHOD_LABELS[m] for m in sorted_methods]
    crps = np.array([rows[m]["mean_crps"] for m in sorted_methods])
    deltas = np.array([rows[m].get("delta_crps_vs_equal", 0.0) * 100 for m in sorted_methods])
    uniform_mean = next(r["mean_crps"] for r in data["rows"] if r["method"] == "uniform")
    pct_vs_uniform = (crps - uniform_mean) / uniform_mean * 100

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=300)
    ys = np.arange(len(sorted_methods))

    colours = [METHOD_COLOURS[m] for m in sorted_methods]
    bars = ax.barh(ys, crps, color=colours, height=0.68, edgecolor="white", linewidth=0.6)

    # Emphasise the mechanism bar with a navy outline.
    for bar, method in zip(bars, sorted_methods):
        if method == "mechanism":
            bar.set_edgecolor(PALETTE["navy"])
            bar.set_linewidth(1.6)

    # Vertical reference line at the uniform baseline value.
    ax.axvline(uniform_mean, color=PALETTE["slate"], linestyle="-", linewidth=0.9, alpha=0.55)
    ax.text(
        uniform_mean,
        len(sorted_methods) - 0.3,
        "  Equal weights baseline",
        color=PALETTE["slate"],
        fontsize=10,
        fontweight="bold",
        va="bottom",
        ha="left",
    )

    # Numeric annotations at bar ends.
    max_crps = float(crps.max())
    for y, value, pct in zip(ys, crps, pct_vs_uniform):
        label = f"{value:.4f}   ({pct:+.1f}%)"
        ax.text(
            value + max_crps * 0.01,
            y,
            label,
            va="center",
            ha="left",
            fontsize=11,
            color=PALETTE["charcoal"],
            fontweight="medium",
        )

    ax.set_yticks(ys)
    ax.set_yticklabels(labels)
    ax.invert_yaxis()
    ax.set_xlim(0, max_crps * 1.22)
    ax.set_xlabel("Mean CRPS  (↓ lower is better)")
    ax.xaxis.grid(True, which="major")
    ax.set_axisbelow(True)

    T_raw = data["config"]["T"]
    warmup = data["config"].get("warmup", 200)
    ax.set_title(
        f"Elia offshore-wind headline slice  ·  T = {T_raw - warmup:,} evaluation rounds",
        loc="left",
        pad=14,
    )

    fig.tight_layout()
    out = FIG_DIR / "wind_primary_comparison.png"
    fig.savefig(out, bbox_inches="tight", dpi=300)
    plt.close(fig)
    return out


def _load_crowd_csv() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Return (lam, n_benign, profit, se) arrays from the arbitrage_crowd_size CSV."""
    import csv

    lam: list[float] = []
    n_benign: list[int] = []
    profit: list[float] = []
    se: list[float] = []
    with CROWD_CSV.open() as fh:
        for row in csv.DictReader(fh):
            lam.append(float(row["lam"]))
            n_benign.append(int(row["n_benign"]))
            profit.append(float(row["mean_profit"]))
            se.append(float(row["se_profit"]))
    return np.array(lam), np.array(n_benign), np.array(profit), np.array(se)


def render_arbitrage() -> Path:
    """Rebuild the arbitrage profit figure (λ × crowd size)."""
    lam, n_benign, profit, se = _load_crowd_csv()

    lam_levels = sorted(set(lam.tolist()))
    n_levels = sorted(set(n_benign.tolist()))

    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)

    # Palette: Paul Tol incandescent (bright sequential perceptually uniform ramp).
    cmap = plt.get_cmap("plasma", len(n_levels))
    for i, n in enumerate(n_levels):
        mask = n_benign == n
        order = np.argsort(lam[mask])
        xs = lam[mask][order]
        ys = profit[mask][order]
        errs = se[mask][order]
        colour = cmap(i)
        ax.errorbar(
            xs,
            ys,
            yerr=errs,
            marker="o",
            markersize=6,
            linewidth=1.6,
            capsize=3,
            color=colour,
            label=f"n = {n}",
        )

    ax.axhline(0, color=PALETTE["slate"], linewidth=0.8, alpha=0.7)
    ax.set_xlabel("Skill-gate floor  λ")
    ax.set_ylabel("Mean arbitrageur profit  (±1 SE)")
    ax.yaxis.grid(True, which="major")
    ax.set_axisbelow(True)
    ax.set_xticks(lam_levels)
    ax.set_title(
        "Arbitrage profit rises with λ and with the benign crowd size",
        loc="left",
        pad=14,
    )

    legend = ax.legend(
        title="Benign crowd size",
        loc="upper left",
        frameon=False,
        fontsize=11,
        title_fontsize=11,
    )
    legend.get_title().set_fontweight("bold")

    fig.tight_layout()
    out = FIG_DIR / "arbitrage.png"
    fig.savefig(out, bbox_inches="tight", dpi=300)
    plt.close(fig)
    return out


LEGACY_FLAG = "--i-know-this-is-legacy"

LEGACY_WARNING = (
    "scripts/gen_thesis_figures.py is a legacy convenience script.\n"
    "Its outputs (wind_primary_comparison.png, arbitrage.png) are NOT\n"
    "consumed by the canonical writing/build_pdf.py LaTeX build, which\n"
    "embeds the .pdf canonical figures. Re-running this script may\n"
    "overwrite the canonical PNG companions with off-style renders.\n"
    "\n"
    f"To proceed anyway, re-run with the explicit flag {LEGACY_FLAG}.\n"
)


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if LEGACY_FLAG not in args:
        sys.stderr.write(LEGACY_WARNING)
        return 2

    # Heavy plotting imports deferred until after the legacy guard so
    # that the warning lands cleanly even in environments where the
    # matplotlib backend cannot be initialised.
    global mpl, plt, np
    import matplotlib as mpl  # noqa: F401  (used by apply_style)
    import matplotlib.pyplot as plt  # noqa: F401
    import numpy as np  # noqa: F401

    if not WIND_JSON.exists():
        print(f"missing: {WIND_JSON}", file=sys.stderr)
        return 1
    if not CROWD_CSV.exists():
        print(f"missing: {CROWD_CSV}", file=sys.stderr)
        return 1

    FIG_DIR.mkdir(parents=True, exist_ok=True)
    apply_style()

    wrote_wind = render_wind_primary_comparison()
    print(f"wrote: {wrote_wind}")
    wrote_arb = render_arbitrage()
    print(f"wrote: {wrote_arb}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
