"""Per-τ OGD aggregate (per-quantile reference baseline).

This module provides a real per-τ implementation of the Vitali & Pinson
(2025) OGD aggregate: for each quantile level τ in a grid, a separate
``run_main_rewards`` is run over the panel at that τ, and the resulting
per-τ aggregates are stacked into a quantile fan.

    Vitali, M. and Pinson, P. (2025). "Probabilistic prediction markets
    with intermittent contributions." arXiv:2510.13385.

The ``michael_ogd_centered_median_fan`` baseline used in the results
tables runs the reference algorithm at τ = 0.5 only and shifts the
ensemble's own per-τ median by that central offset; the label makes that
approximation explicit. This module computes the full per-τ fan instead,
running the OGD update independently at every quantile level.

The public function is :func:`run_main_rewards_per_tau` which takes a
quantile panel of shape ``(T, N, K)`` and a τ grid of length ``K`` and
returns a ``dict`` with

- ``q_agg`` — shape ``(T, K)``: the per-τ aggregate quantile forecast.
- ``y_hat_per_tau`` — shape ``(T, K)``: the τ-specific OGD point output.
- ``weights_per_tau`` — shape ``(T, N, K)``: per-τ online weights.

A crossing-correction step enforces that ``q_agg[t, :]`` is
non-decreasing in τ via isotonic projection (``PAVA``) per round.

Example
-------
>>> import numpy as np
>>> from onlinev2.mechanism.michael_port_per_tau import run_main_rewards_per_tau
>>> rng = np.random.default_rng(0)
>>> panel = rng.uniform(0, 1, size=(200, 3, 5))
>>> panel.sort(axis=2)  # each forecaster's quantiles are non-decreasing
>>> y = rng.uniform(0, 1, size=200)
>>> taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
>>> out = run_main_rewards_per_tau(panel, y, taus, config={"eta": 0.01})
>>> out["q_agg"].shape == (200, 5)
True
>>> # Monotone in τ by construction.
>>> np.all(np.diff(out["q_agg"], axis=1) >= -1e-12)
True
"""
from __future__ import annotations

from typing import Any, Mapping

import numpy as np

from .michael_port import run_main_rewards


def _isotonic_projection(x: np.ndarray) -> np.ndarray:
    """Pool-adjacent-violators: project ``x`` onto the monotone-non-decreasing
    cone. Runs in O(len(x)) and is used per round to enforce that the
    stacked per-τ aggregates satisfy ``q_agg[t, k] <= q_agg[t, k+1]``.
    """
    x = np.asarray(x, dtype=np.float64).copy()
    n = len(x)
    if n <= 1:
        return x
    # Block-based PAV: each block is (sum, weight).
    sums: list[float] = []
    weights: list[float] = []
    for v in x:
        sums.append(float(v))
        weights.append(1.0)
        while len(sums) >= 2 and sums[-2] / weights[-2] > sums[-1] / weights[-1]:
            s = sums.pop() + sums[-1]
            w = weights.pop() + weights[-1]
            sums[-1] = s
            weights[-1] = w
    out = np.empty(n, dtype=np.float64)
    idx = 0
    for s, w in zip(sums, weights):
        mean = s / w
        count = int(w)
        out[idx : idx + count] = mean
        idx += count
    return out


def run_main_rewards_per_tau(
    panel: np.ndarray,
    y: np.ndarray,
    taus: np.ndarray,
    config: Mapping[str, Any] | None = None,
    enforce_monotone: bool = True,
) -> dict[str, np.ndarray]:
    """Per-τ Michael OGD: run ``run_main_rewards`` once per quantile level.

    Parameters
    ----------
    panel : np.ndarray
        Shape ``(T, N, K)``. ``panel[:, :, k]`` is the per-forecaster
        quantile-``τ_k`` prediction over the T rounds.
    y : np.ndarray
        Outcomes of shape ``(T,)``.
    taus : np.ndarray
        Quantile levels of length ``K``. Must be non-decreasing in
        ``[0, 1]``.
    config : mapping, optional
        Forwarded to :func:`run_main_rewards`. Per-τ ``quantile`` is set
        automatically; any ``quantile`` key in ``config`` is ignored.
    enforce_monotone : bool
        If True (default), the stacked ``q_agg`` is projected per round
        onto the monotone-non-decreasing cone in τ. This is the isotonic
        crossing-correction step Ranjan & Gneiting (2010) recommend when
        pooling quantile forecasts.

    Returns
    -------
    dict with keys:
        - ``q_agg`` (T, K): per-τ aggregate (post-isotonic if enabled).
        - ``y_hat_per_tau`` (T, K): raw per-τ OGD point output before
          monotone projection.
        - ``weights_per_tau`` (T, N, K): per-τ online weights.
    """
    panel = np.asarray(panel, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64).ravel()
    taus = np.asarray(taus, dtype=np.float64).ravel()

    if panel.ndim != 3:
        raise ValueError(
            f"panel must have shape (T, N, K); got ndim={panel.ndim}"
        )
    T, N, K = panel.shape
    if taus.shape != (K,):
        raise ValueError(
            f"taus length {len(taus)} must match panel's K dimension {K}"
        )
    if y.shape != (T,):
        raise ValueError(
            f"y length {len(y)} must match panel's T dimension {T}"
        )
    if np.any(np.diff(taus) <= 0):
        raise ValueError("taus must be strictly increasing")

    base_config = dict(config) if config else {}
    base_config.pop("quantile", None)  # overridden per-τ

    y_hat_per_tau = np.zeros((T, K), dtype=np.float64)
    weights_per_tau = np.zeros((T, N, K), dtype=np.float64)

    for k, tau_k in enumerate(taus):
        cfg_k = {**base_config, "quantile": float(tau_k)}
        out_k = run_main_rewards(panel[:, :, k], y, cfg_k)
        y_hat_per_tau[:, k] = out_k["y_hat"]
        weights_per_tau[:, :, k] = out_k["weights"]

    if enforce_monotone:
        q_agg = np.array(
            [_isotonic_projection(y_hat_per_tau[t]) for t in range(T)],
            dtype=np.float64,
        )
    else:
        q_agg = y_hat_per_tau.copy()

    return {
        "q_agg": q_agg,
        "y_hat_per_tau": y_hat_per_tau,
        "weights_per_tau": weights_per_tau,
    }
