"""
Michael allocation: utility split from historical Shapley and out-of-sample loss.

r_{i,t}^{(τ)} = U_t^{(τ)} [ δ r_{i,t}^{is(τ)} + (1-δ) r_{i,t}^{oos(τ)} ]
with r^{is} from Shapley and r^{oos} from loss-based scoring. No Lambert/Raja wager pool.
"""

import numpy as np


def michael_oos_allocation(
    losses: np.ndarray, alpha: np.ndarray, eps: float = 1e-12
) -> np.ndarray:
    """
    Out-of-sample allocation: sc_i = 1 - L_i / sum_j L_j, then r^{oos}_i = sc_i / sum sc_j
    over present sellers. Missing get zero.
    """
    losses = np.asarray(losses, dtype=float).ravel()
    alpha = np.asarray(alpha, dtype=int).ravel()
    present = alpha == 0

    out = np.zeros_like(losses, dtype=float)
    if not np.any(present):
        return out

    denom_L = float(losses[present].sum())
    if denom_L <= eps:
        out[present] = 1.0 / present.sum()
        return out

    sc = np.zeros_like(losses, dtype=float)
    sc[present] = 1.0 - losses[present] / denom_L

    denom_sc = float(sc[present].sum())
    if denom_sc <= eps:
        out[present] = 1.0 / present.sum()
    else:
        out[present] = sc[present] / denom_sc
    return out


def update_phi_c(phi_prev: np.ndarray, phi_s: np.ndarray, lam: float) -> np.ndarray:
    """
    Historical Shapley EWMA: φ_{c,t}^{(τ)} = λ φ_{c,t-1}^{(τ)} + (1-λ) φ_{s,t}^{(τ)}.
    """
    phi_prev = np.asarray(phi_prev, dtype=float).ravel()
    phi_s = np.asarray(phi_s, dtype=float).ravel()
    return lam * phi_prev + (1.0 - lam) * phi_s


def normalise_present(
    v: np.ndarray, alpha: np.ndarray, eps: float = 1e-12
) -> np.ndarray:
    """Normalise v over present (alpha=0) agents; missing get zero."""
    v = np.asarray(v, dtype=float).ravel().copy()
    alpha = np.asarray(alpha, dtype=int).ravel()
    v[alpha == 1] = 0.0
    s = float(v.sum())
    if s <= eps:
        present = alpha == 0
        if np.any(present):
            v[present] = 1.0 / present.sum()
        return v
    return v / s


def michael_rewards(
    U_tau: float, delta_is: float, r_is: np.ndarray, r_oos: np.ndarray
) -> np.ndarray:
    """
    r^{(τ)} = U^{(τ)} [ δ r^{is} + (1-δ) r^{oos} ].
    """
    r_is = np.asarray(r_is, dtype=float).ravel()
    r_oos = np.asarray(r_oos, dtype=float).ravel()
    return float(U_tau) * (
        float(delta_is) * r_is + (1.0 - float(delta_is)) * r_oos
    )
