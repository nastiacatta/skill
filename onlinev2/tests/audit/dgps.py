"""Synthetic data-generating processes (DGPs) for the audit suite.

Each DGP is a pure function of ``(seed, T, N, params)`` using a local
``np.random.default_rng(seed)`` — no global RNG state.

All DGPs return observations clipped into [0, 1] so the mechanism's
unit-bounded scoring assumptions hold.  A "panel" is shape
``(T, N, n_taus)`` when quantile reports are needed and shape
``(T, N)`` when point reports are sufficient; the convention is decided
per-DGP and documented below.

Canonical quantile grid: ``TAUS = [0.1, 0.2, …, 0.9]`` (9 equidistant
levels) — matches ``core.scoring.TAUS_FINE`` so CRPS-hat is an exact
trapezoidal approximation.
"""
from __future__ import annotations

from typing import Sequence

import numpy as np

TAUS_DEFAULT = np.asarray(
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], dtype=np.float64
)


def _noise_quantiles(
    point: np.ndarray,
    scale: np.ndarray,
    taus: np.ndarray,
) -> np.ndarray:
    """Expand (T,N) point forecasts + (N,) scales into (T, N, K) Gaussian-quantile panel."""
    from scipy.stats import norm

    T, N = point.shape
    K = len(taus)
    z = norm.ppf(taus).reshape(1, 1, K)
    q = point[:, :, None] + scale.reshape(1, N, 1) * z
    return np.clip(q, 0.0, 1.0)


def stationary_ar1(
    seed: int,
    T: int,
    N: int,
    phi: float = 0.7,
    noise_scales: Sequence[float] | None = None,
    taus: np.ndarray = TAUS_DEFAULT,
) -> tuple[np.ndarray, np.ndarray]:
    """Stationary AR(1) with N forecasters of known Gaussian precision.

    y_t = phi * y_{t-1} + ε_t,  ε_t ~ N(0, 0.05²),  clipped to [0, 1].
    forecaster_i's mean forecast is the true next mean + bias_i; its
    reported quantiles are Gaussian around the mean with scale
    ``noise_scales[i]``.

    Returns ``(panel, y)`` with shapes ``(T, N, K)`` and ``(T,)``.
    """
    rng = np.random.default_rng(seed)
    if noise_scales is None:
        noise_scales = np.linspace(0.04, 0.12, N)
    noise_scales = np.asarray(noise_scales, dtype=np.float64)

    y = np.zeros(T, dtype=np.float64)
    y[0] = 0.5
    innov = 0.05 * rng.standard_normal(T)
    for t in range(1, T):
        y[t] = phi * y[t - 1] + (1.0 - phi) * 0.5 + innov[t]
    y = np.clip(y, 0.0, 1.0)

    # Forecaster point forecasts: next-step mean with per-forecaster bias.
    biases = rng.uniform(-0.02, 0.02, size=N)
    # shifted by one (forecast at t uses y[t-1])
    shifted = np.concatenate(([0.5], y[:-1]))
    point = phi * shifted[:, None] + (1.0 - phi) * 0.5 + biases[None, :]
    point = np.clip(point, 0.0, 1.0)

    panel = _noise_quantiles(point, noise_scales, taus)
    return panel, y


def shifted_mean_regime(
    seed: int,
    T: int,
    N: int,
    breakpoints: Sequence[int] | None = None,
    taus: np.ndarray = TAUS_DEFAULT,
) -> tuple[np.ndarray, np.ndarray]:
    """Piecewise-stationary series where the mean shifts at given breakpoints.

    Used to expose fit-is-no-op: a forecaster refit pre- and post-
    breakpoint should observe materially different histories.
    """
    rng = np.random.default_rng(seed)
    if breakpoints is None:
        breakpoints = [T // 3, 2 * T // 3]
    means = [0.3, 0.7, 0.5][: len(breakpoints) + 1]
    y = np.zeros(T, dtype=np.float64)
    cur = 0
    for bp, m in zip(list(breakpoints) + [T], means):
        n = bp - cur
        y[cur:bp] = m + 0.03 * rng.standard_normal(n)
        cur = bp
    y = np.clip(y, 0.0, 1.0)

    biases = rng.uniform(-0.02, 0.02, size=N)
    noise_scales = np.linspace(0.05, 0.10, N)
    shifted = np.concatenate(([y[0]], y[:-1]))
    point = shifted[:, None] + biases[None, :]
    point = np.clip(point, 0.0, 1.0)
    panel = _noise_quantiles(point, noise_scales, taus)
    return panel, y


def known_sigma_panel(
    seed: int,
    T: int = 2000,
    N: int = 4,
    sigma_truth: Sequence[float] | None = None,
    taus: np.ndarray = TAUS_DEFAULT,
) -> tuple[np.ndarray, np.ndarray]:
    """Panel where forecaster i's Gaussian scale is fixed to ``sigma_truth[i]``.

    Used by the Property 7 Spearman clause: the learned σ ordering should
    track the known-truth noise-scale ordering after ≥ 2000 rounds.
    """
    rng = np.random.default_rng(seed)
    if sigma_truth is None:
        # Strictly increasing so rank is well-defined.
        sigma_truth = np.linspace(0.03, 0.15, N)
    sigma_truth = np.asarray(sigma_truth, dtype=np.float64)

    y = 0.5 + 0.05 * rng.standard_normal(T)
    y = np.clip(y, 0.0, 1.0)
    # Each forecaster reports a noisy point forecast of y_t with its own σ.
    shifted = np.concatenate(([0.5], y[:-1]))
    point = (shifted[:, None] + sigma_truth[None, :] * rng.standard_normal((T, N)))
    point = np.clip(point, 0.0, 1.0)
    panel = _noise_quantiles(point, sigma_truth, taus)
    return panel, y


def all_zero_loss(
    seed: int,
    T: int,
    N: int,
    taus: np.ndarray = TAUS_DEFAULT,
) -> tuple[np.ndarray, np.ndarray]:
    """Degenerate panel: every forecaster's report equals y_t exactly.

    Losses are then identically zero, exercising the
    ``michael_oos_allocation`` all-zero branch (bug clause 1.34).
    """
    rng = np.random.default_rng(seed)
    y = np.clip(0.5 + 0.05 * rng.standard_normal(T), 0.0, 1.0)
    K = len(taus)
    panel = np.repeat(y[:, None, None], N, axis=1)
    panel = np.repeat(panel, K, axis=2)
    return panel, y


def best_single_dominant(
    seed: int,
    T: int,
    N: int,
    dominance: float = 0.3,
    taus: np.ndarray = TAUS_DEFAULT,
) -> tuple[np.ndarray, np.ndarray, int]:
    """Panel with one forecaster strictly better than the rest.

    The best forecaster's noise scale is ``dominance`` × the others'.
    Returns ``(panel, y, best_idx)``.
    """
    rng = np.random.default_rng(seed)
    base_scale = 0.10
    scales = np.full(N, base_scale)
    best_idx = int(rng.integers(0, N))
    scales[best_idx] = dominance * base_scale

    y = 0.5 + 0.05 * rng.standard_normal(T)
    y = np.clip(y, 0.0, 1.0)
    shifted = np.concatenate(([0.5], y[:-1]))
    point = shifted[:, None] + scales[None, :] * rng.standard_normal((T, N))
    point = np.clip(point, 0.0, 1.0)
    panel = _noise_quantiles(point, scales, taus)
    return panel, y, best_idx


def non_constant_but_quiet(
    seed: int,
    T: int,
    N: int,
    taus: np.ndarray = TAUS_DEFAULT,
) -> tuple[np.ndarray, np.ndarray]:
    """Low-variance, non-constant series. Degeneracy tests should still see spread."""
    rng = np.random.default_rng(seed)
    y = 0.5 + 0.02 * np.sin(np.linspace(0, 10 * np.pi, T)) + 0.01 * rng.standard_normal(T)
    y = np.clip(y, 0.0, 1.0)
    scales = np.linspace(0.03, 0.06, N)
    biases = rng.uniform(-0.01, 0.01, size=N)
    shifted = np.concatenate(([y[0]], y[:-1]))
    point = shifted[:, None] + biases[None, :]
    point = np.clip(point, 0.0, 1.0)
    panel = _noise_quantiles(point, scales, taus)
    return panel, y
