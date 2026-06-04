"""Shared statistical functions for analysis modules.

All five analysis-gap modules use these helpers to ensure cross-gap
consistency in ΔCRPS computation, standard-error estimation, and
confidence-interval construction (Requirement 14).
"""

from __future__ import annotations

from typing import Any

import numpy as np

from onlinev2.experiments.helpers import _sanitise_for_json


def paired_delta_crps(
    method_crps: np.ndarray,
    baseline_crps: np.ndarray,
) -> np.ndarray:
    """Per-seed ΔCRPS: method − baseline.

    Parameters
    ----------
    method_crps : np.ndarray
        Mean CRPS per seed for the method under test.  Shape ``(n_seeds,)``.
    baseline_crps : np.ndarray
        Mean CRPS per seed for the baseline (e.g. equal weights).
        Same shape as *method_crps*.

    Returns
    -------
    np.ndarray
        Element-wise difference ``method_crps - baseline_crps``.
        Negative values indicate the method improves on the baseline.
    """
    method_crps = np.asarray(method_crps, dtype=np.float64)
    baseline_crps = np.asarray(baseline_crps, dtype=np.float64)
    return method_crps - baseline_crps


def compute_se(deltas: np.ndarray) -> float:
    """Standard error of the mean for *deltas*.

    Uses ``std(ddof=1) / sqrt(n)`` on finite values.  Returns ``0.0``
    when fewer than two finite values are available (consistent with
    ``helpers.se``).

    Parameters
    ----------
    deltas : np.ndarray
        Array of per-seed (or per-round) delta values.

    Returns
    -------
    float
        Standard error, or ``0.0`` when *n* ≤ 1 or all values are NaN.
    """
    deltas = np.asarray(deltas, dtype=np.float64)
    finite = deltas[np.isfinite(deltas)]
    if finite.size <= 1:
        return 0.0
    return float(np.std(finite, ddof=1) / np.sqrt(finite.size))


def compute_ci(
    mean: float,
    se: float,
    z: float = 1.96,
) -> tuple[float, float]:
    """Symmetric confidence interval around *mean*.

    Parameters
    ----------
    mean : float
        Point estimate.
    se : float
        Standard error.
    z : float, optional
        Z-score for the desired confidence level (default 1.96 for 95 %).

    Returns
    -------
    tuple[float, float]
        ``(mean - z * se, mean + z * se)``.
    """
    half_width = z * se
    return (mean - half_width, mean + half_width)


def sanitise_json(obj: Any) -> Any:
    """Replace NaN / Inf with ``None`` for JSON serialisation.

    Convenience wrapper around :func:`onlinev2.experiments.helpers._sanitise_for_json`.

    Parameters
    ----------
    obj : Any
        Arbitrary nested structure (dict, list, float, np scalar/array, …).

    Returns
    -------
    Any
        A copy with all non-finite floats replaced by ``None``.
    """
    return _sanitise_for_json(obj)
