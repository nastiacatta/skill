"""Regime-conditional ΔCRPS breakdown module.

Partitions simulation rounds into regimes (early/late, high/low volatility,
pre/post perturbation) and computes per-regime ΔCRPS statistics.

Requirements: 3.1–3.7, 13.1–13.3
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass

import numpy as np

from onlinev2.analysis.stats import compute_ci, compute_se, sanitise_json

# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------


@dataclass
class RegimeStats:
    """Statistics for a single regime partition."""

    regime_name: str
    n_rounds: int
    mean_delta_crps: float
    se: float
    ci_low: float
    ci_high: float
    warning: str | None = None  # "low sample size (n=X)" if n_rounds < 10


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _validate_inputs(
    crps_method: np.ndarray,
    crps_baseline: np.ndarray,
) -> dict | None:
    """Return an error dict if inputs are invalid, else None."""
    if crps_method.size == 0 or crps_baseline.size == 0:
        return {"error": "empty_input", "detail": "CRPS arrays are empty"}
    if crps_method.shape != crps_baseline.shape:
        return {
            "error": "shape_mismatch",
            "detail": (
                f"crps_method shape {crps_method.shape} != "
                f"crps_baseline shape {crps_baseline.shape}"
            ),
        }
    return None


def _compute_regime_stats(
    delta_rounds: np.ndarray,
    regime_name: str,
) -> RegimeStats:
    """Compute mean, SE, CI for a flat array of per-round deltas."""
    n = int(delta_rounds.size)
    if n == 0:
        return RegimeStats(
            regime_name=regime_name,
            n_rounds=0,
            mean_delta_crps=float("nan"),
            se=float("nan"),
            ci_low=float("nan"),
            ci_high=float("nan"),
            warning="low sample size (n=0)",
        )
    mean_val = float(np.mean(delta_rounds))
    se_val = compute_se(delta_rounds)
    ci_low, ci_high = compute_ci(mean_val, se_val)
    warning = f"low sample size (n={n})" if n < 10 else None
    return RegimeStats(
        regime_name=regime_name,
        n_rounds=n,
        mean_delta_crps=mean_val,
        se=se_val,
        ci_low=ci_low,
        ci_high=ci_high,
        warning=warning,
    )


def _get_early_late_indices(T: int, warm_start: int = 0) -> tuple[np.ndarray, np.ndarray]:
    """Return indices for early (first 20%) and late (last 20%) rounds after warm_start."""
    effective_T = T - warm_start
    if effective_T <= 0:
        return np.array([], dtype=int), np.array([], dtype=int)
    n_regime = int(np.floor(0.2 * effective_T))
    if n_regime == 0:
        return np.array([], dtype=int), np.array([], dtype=int)
    early = np.arange(warm_start, warm_start + n_regime)
    late = np.arange(T - n_regime, T)
    return early, late


def _get_volatility_indices(y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return indices for high-vol (top quartile) and low-vol (bottom quartile).

    Volatility is measured as |y_t - y_{t-1}| for t >= 1.
    Returns indices into the original y array (starting from index 1).
    """
    if y.size < 2:
        return np.array([], dtype=int), np.array([], dtype=int)
    abs_diff = np.abs(np.diff(y))
    # Indices in abs_diff correspond to rounds 1..T-1 in y
    q75 = np.percentile(abs_diff, 75)
    q25 = np.percentile(abs_diff, 25)
    # +1 because abs_diff[i] corresponds to round i+1 in y
    high_vol_mask = abs_diff >= q75
    low_vol_mask = abs_diff <= q25
    high_vol = np.where(high_vol_mask)[0] + 1
    low_vol = np.where(low_vol_mask)[0] + 1
    return high_vol, low_vol


def _get_perturbation_indices(
    sigma_hist: np.ndarray,
) -> tuple[np.ndarray, np.ndarray] | None:
    """Return pre/post perturbation indices based on max drop in mean σ.

    sigma_hist: shape (T, n_agents) or (T,).
    Returns (pre_indices, post_indices) or None if not applicable.
    """
    sigma_hist = np.asarray(sigma_hist, dtype=np.float64)
    if sigma_hist.ndim == 1:
        mean_sigma = sigma_hist
    else:
        mean_sigma = np.mean(sigma_hist, axis=1)

    if mean_sigma.size < 2:
        return None

    # Compute drops: mean_sigma[t] - mean_sigma[t-1], negative = drop
    drops = np.diff(mean_sigma)
    # Find the round with the maximum drop (most negative value)
    max_drop_idx = int(np.argmin(drops))
    # The perturbation happens at round max_drop_idx + 1
    split_round = max_drop_idx + 1

    if split_round <= 0 or split_round >= len(mean_sigma):
        return None

    pre = np.arange(0, split_round)
    post = np.arange(split_round, len(mean_sigma))
    return pre, post


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------


def compute_regime_breakdown(
    crps_method: np.ndarray,
    crps_baseline: np.ndarray,
    y: np.ndarray,
    sigma_hist: np.ndarray | None = None,
    warm_start: int = 0,
) -> list[RegimeStats] | dict:
    """Partition rounds into regimes and compute per-regime ΔCRPS statistics.

    Parameters
    ----------
    crps_method : np.ndarray
        Per-round CRPS for the method. Shape ``(T,)`` for single seed
        or ``(n_seeds, T)`` for multi-seed.
    crps_baseline : np.ndarray
        Per-round CRPS for the baseline. Same shape as *crps_method*.
    y : np.ndarray
        Outcome series. Shape ``(T,)`` for single seed or ``(n_seeds, T)``
        for multi-seed (uses first seed for volatility computation).
    sigma_hist : np.ndarray | None
        Skill history. Shape ``(T, n_agents)`` or ``(T,)`` for single seed,
        or ``(n_seeds, T, n_agents)`` / ``(n_seeds, T)`` for multi-seed.
        If provided, pre/post perturbation regimes are computed.
    warm_start : int
        Number of initial rounds to skip for early/late regime computation.

    Returns
    -------
    list[RegimeStats] | dict
        List of regime statistics, or error dict on invalid input.
    """
    crps_method = np.asarray(crps_method, dtype=np.float64)
    crps_baseline = np.asarray(crps_baseline, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)

    # Validate
    err = _validate_inputs(crps_method, crps_baseline)
    if err is not None:
        return err

    # Normalise to 2D: (n_seeds, T)
    if crps_method.ndim == 1:
        crps_method = crps_method[np.newaxis, :]
        crps_baseline = crps_baseline[np.newaxis, :]
    if y.ndim == 1:
        y_2d = y[np.newaxis, :]
    else:
        y_2d = y

    n_seeds, T = crps_method.shape

    # Per-round delta: (n_seeds, T)
    delta = crps_method - crps_baseline

    # Use first seed's y for volatility partitioning
    y_for_vol = y_2d[0]

    results: list[RegimeStats] = []

    # --- Early / Late ---
    early_idx, late_idx = _get_early_late_indices(T, warm_start)
    if early_idx.size > 0:
        early_deltas = delta[:, early_idx].ravel()
        results.append(_compute_regime_stats(early_deltas, "Early (first 20%)"))
    if late_idx.size > 0:
        late_deltas = delta[:, late_idx].ravel()
        results.append(_compute_regime_stats(late_deltas, "Late (last 20%)"))

    # --- High / Low volatility ---
    if y_for_vol.size >= 2:
        high_vol_idx, low_vol_idx = _get_volatility_indices(y_for_vol)
        # Filter indices to valid range for delta
        high_vol_idx = high_vol_idx[high_vol_idx < T]
        low_vol_idx = low_vol_idx[low_vol_idx < T]
        if high_vol_idx.size > 0:
            high_vol_deltas = delta[:, high_vol_idx].ravel()
            results.append(_compute_regime_stats(high_vol_deltas, "High-volatility (top quartile)"))
        if low_vol_idx.size > 0:
            low_vol_deltas = delta[:, low_vol_idx].ravel()
            results.append(_compute_regime_stats(low_vol_deltas, "Low-volatility (bottom quartile)"))

    # --- Pre / Post perturbation ---
    if sigma_hist is not None:
        sigma_hist = np.asarray(sigma_hist, dtype=np.float64)
        # For multi-seed, use first seed's sigma_hist
        if sigma_hist.ndim == 3:
            sigma_for_split = sigma_hist[0]
        elif sigma_hist.ndim == 2:
            # Could be (T, n_agents) for single seed or (n_seeds, T) for multi-seed
            # If n_seeds matches and first dim != T, treat as multi-seed
            if sigma_hist.shape[0] == n_seeds and n_seeds != T:
                sigma_for_split = sigma_hist[0]
            else:
                sigma_for_split = sigma_hist
        else:
            sigma_for_split = sigma_hist

        pert = _get_perturbation_indices(sigma_for_split)
        if pert is not None:
            pre_idx, post_idx = pert
            pre_idx = pre_idx[pre_idx < T]
            post_idx = post_idx[post_idx < T]
            if pre_idx.size > 0:
                pre_deltas = delta[:, pre_idx].ravel()
                results.append(_compute_regime_stats(pre_deltas, "Pre-perturbation"))
            if post_idx.size > 0:
                post_deltas = delta[:, post_idx].ravel()
                results.append(_compute_regime_stats(post_deltas, "Post-perturbation"))

    return results


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------


def write_regime_breakdown(stats: list[RegimeStats], out_path: str) -> None:
    """Serialise a list of :class:`RegimeStats` to JSON.

    Applies :func:`sanitise_json` to replace NaN/Inf with ``None``
    before writing.

    Parameters
    ----------
    stats : list[RegimeStats]
        The regime statistics to serialise.
    out_path : str
        Destination file path.
    """
    raw = [asdict(s) for s in stats]
    sanitised = sanitise_json(raw)
    os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(sanitised, f, indent=2)
