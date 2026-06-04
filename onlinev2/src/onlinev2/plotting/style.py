"""
Shared plot styling for all onlinev2 experiments.

Single source of truth for the Python palette. Mirrors
`presentation/R/theme_thesis.R` and
`dashboard/src/components/slides/shared/presentationConstants.ts`
so Python-generated PNGs share the same visual language as the R
and React versions.

Usage:
    from onlinev2.plotting.style import apply_style, COLORS, new_figure, save_fig

apply_style() sets global matplotlib defaults (call once at startup).
COLORS provides a named palette for consistent colouring across experiments.
new_figure() / save_fig() are thin wrappers that enforce the house style.
"""
from __future__ import annotations

import os
from typing import Any

# ---------------------------------------------------------------------------
# Palette — aligned with the React slide constants and R theme
# ---------------------------------------------------------------------------
# Semantic names match `PALETTE` in presentationConstants.ts / theme_thesis.R.
# Legacy keys (pink, blue, green, orange, purple, red, teal, slate) are kept
# as aliases so existing call sites keep working.
COLORS = {
    # Semantic names (primary)
    "navy":     "#1B2A4A",
    "imperial": "#003E74",
    "teal":     "#2E8B8B",
    "coral":    "#E85D4A",
    "purple":   "#7C3AED",
    "orange":   "#E67E22",
    "slate":    "#64748B",
    "charcoal": "#2D3748",
    "border":   "#CBD5E1",
    "lightBg":  "#F1F5F9",
    "offWhite": "#F8FAFC",
    "white":    "#FFFFFF",

    # Legacy aliases — keep call sites working
    "pink":      "#E85D4A",   # coral (was a magenta — tuned to slide coral)
    "blue":      "#003E74",   # imperial blue
    "green":     "#2E8B8B",   # teal
    "red":       "#E85D4A",   # coral
    "truth":     "#1B2A4A",   # near-black navy for ground truth
    "reference": "#CBD5E1",   # subtle grey for reference lines
}

# Ordered palette for cycling through forecasters / agents.
# Matches FORECASTER_COLOURS in theme_thesis.R and FORECASTER_META.
PALETTE = [
    COLORS["navy"],       # Forecaster 0
    COLORS["teal"],       # Forecaster 1
    COLORS["coral"],      # Forecaster 2
    COLORS["purple"],     # Forecaster 3
    COLORS["orange"],     # Forecaster 4
    COLORS["slate"],      # Forecaster 5
    COLORS["imperial"],   # Forecaster 6
    COLORS["charcoal"],   # Forecaster 7 (fallback)
]


def agent_color(i: int) -> str:
    """Return a palette colour for agent index i (cycles)."""
    return PALETTE[i % len(PALETTE)]


# ---------------------------------------------------------------------------
# Matplotlib style defaults
# ---------------------------------------------------------------------------

_STYLE_APPLIED = False


def apply_style() -> None:
    """Set matplotlib rcParams for clean, slide-ready plots."""
    global _STYLE_APPLIED
    if _STYLE_APPLIED:
        return
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
        return

    plt.rcParams.update({
        # Figure
        "figure.facecolor":  "white",
        "figure.dpi":        120,
        "savefig.dpi":       200,
        "savefig.bbox":      "tight",
        "savefig.pad_inches": 0.18,
        "savefig.facecolor": "white",

        # Font — match the slide deck
        "font.family":       "sans-serif",
        "font.sans-serif":   ["Avenir Next", "Avenir", "Helvetica Neue", "Arial"],
        "font.size":         12,
        "axes.titlesize":    14,
        "axes.titleweight":  "bold",
        "axes.titlecolor":   COLORS["navy"],
        "axes.labelsize":    12,
        "axes.labelweight":  "bold",
        "axes.labelcolor":   COLORS["charcoal"],
        "axes.edgecolor":    COLORS["border"],
        "xtick.labelsize":   10,
        "ytick.labelsize":   10,
        "xtick.color":       COLORS["slate"],
        "ytick.color":       COLORS["slate"],
        "legend.fontsize":   10,

        # Grid — horizontal only, soft
        "axes.grid":         True,
        "axes.grid.axis":    "y",
        "axes.grid.which":   "major",
        "grid.alpha":        0.5,
        "grid.color":        COLORS["border"],
        "grid.linewidth":    0.35,

        # Axes
        "axes.spines.top":    False,
        "axes.spines.right":  False,
        "axes.spines.left":   False,
        "axes.spines.bottom": True,
        "axes.linewidth":     0.6,

        # Lines
        "lines.linewidth":  1.8,
        "lines.markersize": 6,

        # Legend
        "legend.framealpha": 0.95,
        "legend.edgecolor":  COLORS["border"],
        "legend.fancybox":   True,

        # Colour cycle
        "axes.prop_cycle":   __import__("matplotlib").rcsetup.cycler("color", PALETTE),

        # Layout — constrained_layout reflows axes to make room for ticks,
        # labels, legends, and titles, so dashboard PNGs do not lose ink
        # when the legend grows or the y-axis label wraps. The inner
        # padding keeps panels from drifting apart on multi-axes figures.
        "figure.constrained_layout.use":     True,
        "figure.constrained_layout.h_pad":   0.04,
        "figure.constrained_layout.w_pad":   0.04,
        "figure.constrained_layout.hspace":  0.04,
        "figure.constrained_layout.wspace":  0.04,
    })
    _STYLE_APPLIED = True


def new_figure(
    nrows: int = 1,
    ncols: int = 1,
    figsize: tuple[float, float] | None = None,
    **kwargs: Any,
):
    """Create a new figure with the house style applied."""
    apply_style()
    import matplotlib.pyplot as plt

    if figsize is None:
        w = 6 * ncols
        h = 4.5 * nrows
        figsize = (min(w, 20), min(h, 16))

    kwargs.setdefault("constrained_layout", True)
    fig, axes = plt.subplots(nrows, ncols, figsize=figsize, **kwargs)
    return fig, axes


def save_fig(fig, path: str, close: bool = True) -> str:
    """Save figure to `path`, creating parent directories as needed.

    Returns the path so callers can chain.
    """
    import matplotlib.pyplot as plt

    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    fig.savefig(path, facecolor="white")
    if close:
        plt.close(fig)
    return path
