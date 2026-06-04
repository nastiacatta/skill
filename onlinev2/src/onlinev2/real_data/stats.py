"""
Statistical tests for forecast comparison on a single time series.

Diebold-Mariano test: compares two forecast methods using their per-round
loss differences, accounting for autocorrelation.
"""
from __future__ import annotations

import numpy as np

BOOTSTRAP_CI_SEED = 20260510


def diebold_mariano_test(
    losses_1: np.ndarray,
    losses_2: np.ndarray,
    h: int = 1,
    hac_bandwidth: int | str | None = "auto",
) -> dict:
    """Diebold-Mariano test for equal predictive accuracy.

    Tests H0: E[d_t] = 0 where d_t = loss_1(t) - loss_2(t).
    Negative mean(d) means method 2 is better.

    Args:
        losses_1: per-round losses for method 1 (e.g., uniform)
        losses_2: per-round losses for method 2 (e.g., mechanism)
        h: forecast horizon. When ``hac_bandwidth`` is ``None`` the
            Newey-West bandwidth is ``max(0, h - 1)``, the minimal
            correction for overlapping forecast errors. This is
            adequate only when the loss differential ``d_t`` is
            approximately white noise outside the overlap horizon; on
            autocorrelated real-data series (wind, electricity prices)
            it understates ``Var(mean(d))`` and inflates ``|DM|``.
            Kept as a fallback for reproducibility of earlier numbers.
        hac_bandwidth: HAC (Newey-West) truncation lag.
            - ``"auto"`` (default): Andrews (1991) data-driven rule,
              ``floor(4 * (n / 100) ** (2/9))``, a standard choice for
              the Bartlett kernel that automatically grows with sample
              size. On a 17,000-point wind series this picks a
              bandwidth of roughly 25, which captures the dominant
              autocorrelation structure of hourly wind-power losses.
            - ``None``: fall back to ``max(0, h - 1)`` (legacy).
            - ``int``: use the given non-negative bandwidth verbatim.

    Returns:
        dict with dm_stat, p_value, mean_diff, se, n, hac_lag (the
        lag actually used) and hac_bandwidth_mode (the requested mode).
    """
    d = np.array(losses_1) - np.array(losses_2)
    n = len(d)
    if n < 10:
        return {
            "dm_stat": 0,
            "p_value": 1,
            "mean_diff": 0,
            "se": 0,
            "n": n,
            "hac_lag": 0,
            "hac_bandwidth_mode": hac_bandwidth if hac_bandwidth is not None else "horizon-1",
        }

    mean_d = float(np.mean(d))

    # Select HAC truncation lag.
    # * "auto" -> Andrews (1991) rule for the Bartlett kernel: M = 4 * (n/100)^(2/9).
    #   Citation: Andrews, D. W. K. (1991). "Heteroskedasticity and Autocorrelation
    #   Consistent Covariance Matrix Estimation". Econometrica, 59(3).
    # * None   -> legacy h - 1 (minimal correction for h-step-ahead overlap).
    # * int    -> use as given.
    bandwidth_mode: str
    if hac_bandwidth == "auto":
        max_lag = int(np.floor(4.0 * (n / 100.0) ** (2.0 / 9.0)))
        max_lag = max(max_lag, max(0, h - 1))  # never below the overlap minimum
        bandwidth_mode = "andrews_auto"
    elif hac_bandwidth is None:
        max_lag = max(0, h - 1)
        bandwidth_mode = "horizon-1"
    elif isinstance(hac_bandwidth, (int, np.integer)):
        if int(hac_bandwidth) < 0:
            raise ValueError(
                f"hac_bandwidth must be >= 0 when given as int, "
                f"got {hac_bandwidth}"
            )
        max_lag = int(hac_bandwidth)
        bandwidth_mode = f"fixed({max_lag})"
    else:
        raise ValueError(
            f"hac_bandwidth must be 'auto', None, or non-negative int; "
            f"got {hac_bandwidth!r}"
        )

    # Newey-West (Bartlett kernel) variance estimator.
    gamma_0 = float(np.mean((d - mean_d) ** 2))
    gamma_sum = 0.0
    for k in range(1, max_lag + 1):
        gamma_k = float(np.mean((d[k:] - mean_d) * (d[:-k] - mean_d)))
        # Bartlett taper weight 1 - k / (max_lag + 1) ∈ (0, 1].
        weight = 1.0 - k / (max_lag + 1)
        gamma_sum += 2.0 * weight * gamma_k

    var_d = (gamma_0 + gamma_sum) / n
    if var_d <= 0:
        var_d = gamma_0 / n

    se = float(np.sqrt(var_d))
    dm_stat = mean_d / se if se > 1e-15 else 0.0

    # Two-sided p-value (normal approximation, valid for large n)
    p_value = 2 * _norm_sf(abs(dm_stat))

    return {
        "dm_stat": float(dm_stat),
        "p_value": float(p_value),
        "mean_diff": float(mean_d),
        "se": float(se),
        "n": n,
        "significant_5pct": p_value < 0.05,
        "significant_1pct": p_value < 0.01,
        "hac_lag": int(max_lag),
        "hac_bandwidth_mode": bandwidth_mode,
    }


def _norm_sf(x: float) -> float:
    """Standard normal survival function (1 - Phi(x))."""
    # Abramowitz & Stegun 7.1.26 erf approximation
    sign = -1 if x < 0 else 1
    z = abs(x) / np.sqrt(2)
    t = 1 / (1 + 0.3275911 * z)
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    erf_approx = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * np.exp(-z * z)
    cdf = 0.5 * (1 + sign * erf_approx)
    return 1 - cdf


def bootstrap_ci(
    losses_1: np.ndarray,
    losses_2: np.ndarray,
    n_bootstrap: int = 1000,
    block_size: int = 50,
    alpha: float = 0.05,
    seed: int = BOOTSTRAP_CI_SEED,
) -> dict:
    """Block bootstrap confidence interval for mean loss difference.

    Uses circular block bootstrap to preserve autocorrelation structure.

    Args:
        losses_1, losses_2: per-round losses
        n_bootstrap: number of bootstrap samples
        block_size: size of contiguous blocks
        alpha: significance level (default 5%)
        seed: random seed (default ``BOOTSTRAP_CI_SEED = 20260510``)

    Returns:
        dict with ci_lower, ci_upper, mean_diff, bootstrap_se
    """
    d = np.array(losses_1) - np.array(losses_2)
    n = len(d)
    rng = np.random.default_rng(seed)

    n_blocks = max(1, n // block_size)
    boot_means = []

    for _ in range(n_bootstrap):
        # Circular block bootstrap
        starts = rng.integers(0, n, size=n_blocks)
        indices = np.concatenate([np.arange(s, s + block_size) % n for s in starts])[:n]
        boot_means.append(float(np.mean(d[indices])))

    boot_means = np.array(boot_means)
    ci_lower = float(np.percentile(boot_means, 100 * alpha / 2))
    ci_upper = float(np.percentile(boot_means, 100 * (1 - alpha / 2)))

    return {
        "mean_diff": float(np.mean(d)),
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "bootstrap_se": float(np.std(boot_means)),
        "n_bootstrap": n_bootstrap,
        "block_size": block_size,
        "alpha": alpha,
    }
