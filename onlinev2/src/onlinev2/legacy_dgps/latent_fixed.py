"""
Latent Bayes-consistent data generators (truth fixed first).

Formulas (tau_true = true observation noise; platform uses sigma for learned performance score):
  Z_t ~ N(0, sigma_Z^2),  y_t = Phi(Z_t)
  X_{i,t} = Z_t + beta_i + eps_{i,t},  eps_{i,t} ~ N(0, tau_true_i^2)
  k = sigma_Z^2 / (sigma_Z^2 + tau_true_i^2)
  mu_{i,t} = k_i * (X_{i,t} - beta_i)
  v_i = sigma_Z^2 * tau_true_i^2 / (sigma_Z^2 + tau_true_i^2)
  Point report (median for MAE): r_{i,t} = Phi(mu_{i,t})
  Quantile: q_{i,t}(alpha) = Phi(mu_{i,t} + kappa_i * sqrt(v_i) * Phi^{-1}(alpha))

Symbol hygiene vs mechanism code:
  beta_i = forecaster bias (DGP)      vs  b_i = deposit (mechanism)
  mu_{i,t} = posterior mean (DGP)      vs  m_i = effective wager (mechanism)
  tau_i = observation noise (DGP)      vs  sigma_i = learned performance score (mechanism)
"""
from __future__ import annotations

import numpy as np
from scipy.stats import norm

# Clip margin for link inverse to avoid inf at 0/1; tolerance for in-range and monotonicity checks
_EPS = 1e-12
_TOL = 1e-12


def _phi(z: np.ndarray) -> np.ndarray:
    """Probit link: Phi(z)."""
    return norm.cdf(z).astype(np.float64)


def _phi_inv(y: np.ndarray, eps: float = _EPS) -> np.ndarray:
    """Inverse probit; clip y to (eps, 1-eps) to avoid infinities."""
    y = np.asarray(y, dtype=np.float64)
    y = np.clip(y, eps, 1.0 - eps)
    return norm.ppf(y).astype(np.float64)


def generate_truth_and_reports_latent(
    T: int,
    n: int,
    tau_i: np.ndarray,
    seed: int | None = None,
    *,
    sigma_z: float = 1.0,
    beta_i: np.ndarray | None = None,
    b_i: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    IID latent truth + Bayes-consistent point reports.

    Returns:
        y: (T,) truth in (0,1)
        reports: (n, T) point reports in (0,1)
        tau_true: (n,) true observation noise per forecaster (smaller = better skill)
    """
    rng = np.random.default_rng(seed)
    tau_true = np.asarray(tau_i, dtype=np.float64).ravel()
    if tau_true.size != n:
        raise ValueError(f"tau_i must have length n (got {tau_true.size})")
    if np.any(tau_true <= 0):
        raise ValueError("tau_i must be strictly positive")

    _beta = beta_i if beta_i is not None else b_i
    if _beta is None:
        _beta = np.zeros(n, dtype=np.float64)
    else:
        _beta = np.asarray(_beta, dtype=np.float64).ravel()
        if _beta.size != n:
            raise ValueError(f"beta_i must have length n (got {_beta.size})")

    Z = rng.normal(0.0, sigma_z, size=T).astype(np.float64)
    y = _phi(Z)

    Z_broadcast = np.broadcast_to(Z, (n, T))
    eps = rng.normal(0.0, 1.0, size=(n, T)).astype(np.float64)
    tau_broadcast = np.broadcast_to(tau_true[:, None], (n, T))
    X = Z_broadcast + _beta[:, None] + tau_broadcast * eps

    sig2 = float(sigma_z) ** 2
    denom = sig2 + tau_true ** 2
    mu = (sig2 / denom)[:, None] * (X - _beta[:, None])
    reports = _phi(mu)

    # --- Fail-fast checks (exact shapes, finite, in (0,1)) ---
    if y.shape != (T,):
        raise ValueError(f"y.shape must be (T,) = ({T},), got {y.shape}")
    if reports.shape != (n, T):
        raise ValueError(f"reports.shape must be (n, T) = ({n}, {T}), got {reports.shape}")
    if not np.all(np.isfinite(y)):
        raise ValueError("y contains non-finite values")
    if not np.all(np.isfinite(reports)):
        raise ValueError("reports contains non-finite values")
    if np.any(y <= _TOL) or np.any(y >= 1.0 - _TOL):
        raise ValueError("y must be strictly in (0, 1)")
    if np.any(reports <= _TOL) or np.any(reports >= 1.0 - _TOL):
        raise ValueError("reports must be strictly in (0, 1)")

    return y, reports, tau_true


def generate_truth_and_quantile_reports_latent(
    T: int,
    n: int,
    tau_i: np.ndarray,
    taus: np.ndarray,
    seed: int | None = None,
    *,
    sigma_z: float = 1.0,
    beta_i: np.ndarray | None = None,
    b_i: np.ndarray | None = None,
    kappa_i: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    IID latent truth + Bayes-consistent quantile reports.

    kappa_i: miscalibration; kappa_i=1 is calibrated. Shape (n,) or None (all 1).
    Returns:
        y: (T,), q_reports: (n, T, K), tau_true: (n,)
    """
    rng = np.random.default_rng(seed)
    tau_true = np.asarray(tau_i, dtype=np.float64).ravel()
    taus = np.asarray(taus, dtype=np.float64).ravel()
    if tau_true.size != n:
        raise ValueError(f"tau_i must have length n (got {tau_true.size})")
    if np.any(tau_true <= 0):
        raise ValueError("tau_i must be strictly positive")
    K = taus.size
    z_tau = norm.ppf(taus).astype(np.float64)

    _beta = beta_i if beta_i is not None else b_i
    if _beta is None:
        _beta = np.zeros(n, dtype=np.float64)
    else:
        _beta = np.asarray(_beta, dtype=np.float64).ravel()
        if _beta.size != n:
            raise ValueError(f"beta_i must have length n (got {_beta.size})")
    if kappa_i is None:
        kappa_i = np.ones(n, dtype=np.float64)
    else:
        kappa_i = np.asarray(kappa_i, dtype=np.float64).ravel()
        if kappa_i.size != n:
            raise ValueError(f"kappa_i must have length n (got {kappa_i.size})")

    Z = rng.normal(0.0, sigma_z, size=T).astype(np.float64)
    y = _phi(Z)

    Z_broadcast = np.broadcast_to(Z, (n, T))
    eps = rng.normal(0.0, 1.0, size=(n, T)).astype(np.float64)
    tau_broadcast = np.broadcast_to(tau_true[:, None], (n, T))
    X = Z_broadcast + _beta[:, None] + tau_broadcast * eps

    sig2 = float(sigma_z) ** 2
    denom = sig2 + tau_true ** 2
    mu = (sig2 / denom)[:, None] * (X - _beta[:, None])
    v = (sig2 * tau_true ** 2 / denom)[:, None]
    sqrt_v = np.sqrt(v)

    q_latent = mu[:, :, None] + (kappa_i[:, None, None] * sqrt_v[:, :, None] * z_tau[None, None, :])
    q_reports = _phi(q_latent)

    # Enforce monotonicity in alpha
    tau_order = np.argsort(taus)
    for i in range(n):
        for t in range(T):
            row = q_reports[i, t, tau_order].copy()
            q_reports[i, t, tau_order] = np.maximum.accumulate(row)

    # --- Fail-fast checks ---
    if y.shape != (T,):
        raise ValueError(f"y.shape must be (T,) = ({T},), got {y.shape}")
    if q_reports.shape != (n, T, K):
        raise ValueError(f"q_reports.shape must be (n, T, K) = ({n}, {T}, {K}), got {q_reports.shape}")
    if not np.all(np.isfinite(y)) or not np.all(np.isfinite(q_reports)):
        raise ValueError("y or q_reports contains non-finite values")
    if np.any(y <= _TOL) or np.any(y >= 1.0 - _TOL):
        raise ValueError("y must be strictly in (0, 1)")
    if np.any(q_reports <= _TOL) or np.any(q_reports >= 1.0 - _TOL):
        raise ValueError("q_reports must be strictly in (0, 1)")
    for i in range(n):
        for t in range(T):
            d = np.diff(q_reports[i, t, :])
            if np.any(d < -_TOL):
                raise ValueError(f"Quantiles must be monotone in alpha for (i,t)=({i},{t}); got diff min {float(np.min(d))}")

    return y, q_reports, tau_true
