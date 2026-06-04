"""
Plot learned weight convergence vs true weights.

Plots only; no data generation or learning.
"""
from __future__ import annotations

import numpy as np


def _rolling_mean(x: np.ndarray, window: int) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        out = np.zeros_like(x)
        for i in range(len(x)):
            out[i] = np.mean(x[max(0, i - window + 1) : i + 1])
        return out
    out = np.zeros_like(x)
    for i in range(x.shape[-1]):
        out[..., i] = np.mean(x[..., max(0, i - window + 1) : i + 1], axis=-1)
    return out


def plot_weight_convergence(
    w_hist: np.ndarray,
    true_w: np.ndarray,
    *,
    method_labels: list[str] | None = None,
    smooth_window: int = 500,
    title: str = "Learned weights vs true",
    save_path: str | None = None,
):
    """
    Plot weight convergence. w_hist shape (n_methods, n_forecasters, T) or (n_forecasters, T).
    true_w shape (n_forecasters,).
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if w_hist.ndim == 2:
        w_hist = w_hist[np.newaxis, ...]
    n_methods, n_forecasters, T = w_hist.shape

    if method_labels is None:
        method_labels = [f"Method {i+1}" for i in range(n_methods)]

    # Add bottom space proportional to legend row count so the
    # below-axes legend on the bottom panel does not collide with the
    # x-axis label.
    fig, axes = plt.subplots(
        n_methods, 1,
        figsize=(10, 3.2 * n_methods + 0.6),
        sharex=True,
        constrained_layout=True,
    )
    if n_methods == 1:
        axes = [axes]
    fig.suptitle(title, fontsize=11)

    legend_ncol = min(max(n_forecasters, 1), 6)
    for m in range(n_methods):
        ax = axes[m]
        w_smooth = _rolling_mean(w_hist[m], smooth_window)
        for i in range(n_forecasters):
            ax.plot(w_hist[m, i], color=f"C{i}", alpha=0.15, linewidth=0.5)
            ax.plot(w_smooth[i], color=f"C{i}", linewidth=2, label=f"$w_{i+1}$ (smoothed)")
        for i in range(n_forecasters):
            ax.axhline(true_w[i], color=f"C{i}", linestyle="-", alpha=0.6, linewidth=0.6)
        ax.set_ylabel("weight")
        ax.set_title(method_labels[m])
        ax.grid(True, alpha=0.3)
        ax.set_ylim(-0.05, 1.05)

    axes[-1].set_xlabel("time t")
    # One shared legend below the bottom panel; per-panel inset legends
    # collide with the smoothed lines that hug the top of the axes.
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(
        handles, labels,
        loc="lower center",
        bbox_to_anchor=(0.5, -0.02),
        ncol=legend_ncol,
        fontsize=8,
        frameon=False,
    )
    if save_path:
        plt.savefig(save_path, dpi=120, bbox_inches="tight")
        plt.close()
    else:
        return fig, axes
