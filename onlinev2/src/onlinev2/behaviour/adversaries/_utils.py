"""
Shared utilities for adversary behaviours.

The adversary classes accept a ``scoring_mode`` parameter and a ``taus``
grid, and must emit a scalar report in ``point_mae`` mode or a quantile
vector in ``quantiles_crps`` mode. This module centralises the
mode-aware report construction so every adversary uses the same noise
model and clamping convention.

Noise model: a spread ``sigma_q`` around a scalar target ``mu``. For
``quantiles_crps`` we emit

    q_k = clip(mu + sigma_q * Phi^{-1}(tau_k), 0, 1)

using the same inverse-normal approximation as the benign
``GaussianBeliefModel``. For ``point_mae`` we just return ``mu``.
"""
from __future__ import annotations

from typing import Optional, Sequence

import numpy as np

try:
    from scipy.stats import norm as _norm
except Exception:  # scipy is optional; fall back to a rough grid
    _norm = None


def _normal_ppf(p: float) -> float:
    if _norm is not None:
        return float(_norm.ppf(p))
    grid_p = np.array([0.001, 0.01, 0.05, 0.5, 0.95, 0.99, 0.999], dtype=float)
    grid_z = np.array([-3.09, -2.33, -1.645, 0.0, 1.645, 2.33, 3.09], dtype=float)
    return float(np.interp(float(p), grid_p, grid_z))


def _clamp01(x: float) -> float:
    return float(np.clip(float(x), 0.0, 1.0))


def make_report(
    mu: float,
    scoring_mode: str,
    *,
    taus: Optional[Sequence[float]] = None,
    sigma_q: float = 0.05,
):
    """Construct a report in the requested scoring mode.

    For ``point_mae`` this returns ``clamp01(mu)``.
    For ``quantiles_crps`` this returns a length-K quantile vector
    centred at ``mu`` with spread ``sigma_q``.
    """
    if scoring_mode == "quantiles_crps":
        if taus is None:
            taus = (0.1, 0.25, 0.5, 0.75, 0.9)
        s = max(1e-4, float(sigma_q))
        return np.asarray(
            [_clamp01(mu + s * _normal_ppf(float(t))) for t in taus],
            dtype=float,
        )
    return _clamp01(mu)
