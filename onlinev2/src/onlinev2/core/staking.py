"""
Deterministic staking: bankroll-based deposits, confidence proxy, skill-gated
effective wagers, and dominance cap.

Pipeline: confidence from quantile width → deposit from wealth → effective wager
→ dominance cap → wealth update. The confidence term is a heuristic proxy
derived from quantile width in probit space; it is not itself induced by a
proper scoring rule. Pure mechanism logic only; no I/O.
"""

from typing import Optional

import numpy as np
from scipy.stats import norm


def confidence_from_quantiles(
    q_t: np.ndarray,
    taus: np.ndarray,
    *,
    tau_L: float = 0.1,
    tau_H: float = 0.9,
    eps: float = 1e-6,
    beta_c: float = 1.0,
    c_min: float = 0.8,
    c_max: float = 1.0,
    space: str = "raw",
) -> np.ndarray:
    """
    Bounded confidence multiplier c_i from quantile width.

    Canonical formula (Masters notes, §Step 1):
        Delta_i = q_i(tau_H) - q_i(tau_L)         # width on the observation scale
        c_i     = clip(exp(-beta_c * Delta_i), c_min, c_max).

    A wider forecast produces a smaller c; a narrower forecast produces a larger
    c. Values are bounded in [c_min, c_max].

    Parameters
    ----------
    q_t : (n, K) quantile matrix on the observation scale, values in [0, 1].
    taus : (K,) nominal levels (used to locate tau_L and tau_H).
    space : {'raw', 'probit'}, default 'raw'
        - 'raw' (canonical): width is q_i(tau_H) - q_i(tau_L) on the [0, 1]
          observation scale. Matches Masters notes and the HTML explorer.
        - 'probit' (legacy): width is Phi^{-1}(q_i(tau_H)) - Phi^{-1}(q_i(tau_L))
          on the latent Gaussian axis. Exposed for backward compatibility;
          retained because it is used in earlier experiments. Do not use
          'probit' without also updating the thesis text — the theory notes
          describe raw width.

    Important
    ---------
    Safe for theorem claims only when the input quantiles are history (e.g.
    t-1) or otherwise fixed before the current round report is chosen. If q_t
    is the current round report, deposits become report-dependent and the
    standard truthfulness argument does not apply.

    Returns (n,) in [c_min, c_max].
    """
    q_t = np.asarray(q_t, dtype=np.float64)
    taus = np.asarray(taus, dtype=np.float64).ravel()

    if q_t.ndim == 1:
        q_t = q_t.reshape(1, -1)
    n, K = q_t.shape

    idx_L = int(np.argmin(np.abs(taus - tau_L)))
    idx_H = int(np.argmin(np.abs(taus - tau_H)))

    q_lo = q_t[:, idx_L]
    q_hi = q_t[:, idx_H]

    if space == "raw":
        # Canonical (Masters notes §Step 1): width on the observation scale.
        delta = np.maximum(q_hi - q_lo, 0.0)
    elif space == "probit":
        # Legacy: width on the latent Gaussian axis. Clip to avoid +/-inf.
        q_lo_c = np.clip(q_lo, eps, 1.0 - eps)
        q_hi_c = np.clip(q_hi, eps, 1.0 - eps)
        z_lo = norm.ppf(q_lo_c)
        z_hi = norm.ppf(q_hi_c)
        delta = np.maximum(z_hi - z_lo, 0.0)
    else:
        raise ValueError(f"space must be 'raw' or 'probit', got {space!r}")

    c = np.exp(-float(beta_c) * delta)
    return np.clip(c, float(c_min), float(c_max))


def choose_deposits(
    W_t: np.ndarray,
    c_t: np.ndarray,
    alpha_t: np.ndarray,
    *,
    f: float = 0.3,
    b_max: float = 10.0,
) -> np.ndarray:
    """
    Deterministic deposit: b_i = min(W_i, b_max, f * W_i * c_i) for active agents.
    Returns (n,) deposits, 0 for absent.

    Important:
        For theorem-preserving weighted-score settlement, c_t must be fixed before
        the agent chooses the round-t report, for example from lagged reports or
        another exogenous/precommitted signal. If c_t is computed from the current
        round report, then b_t and hence m_t become report-dependent, and the
        standard truthfulness argument does not apply.
    """
    W_t = np.asarray(W_t, dtype=np.float64).ravel()
    c_t = np.asarray(c_t, dtype=np.float64).ravel()
    alpha_t = np.asarray(alpha_t, dtype=np.int32).ravel()

    raw = float(f) * W_t * c_t
    b_t = np.minimum(np.minimum(raw, W_t), float(b_max))
    b_t = np.maximum(b_t, 0.0)
    b_t[alpha_t == 1] = 0.0
    return b_t


def skill_gate(sigma: np.ndarray, lam: float, eta: float = 1.0) -> np.ndarray:
    """g(sigma) = lam + (1 - lam) * sigma^eta. Returns (n,) in [lam, 1]. lam must be in [0, 1]."""
    lam = float(lam)
    if not (0.0 <= lam <= 1.0):
        raise ValueError(f"lam must be in [0, 1], got {lam}")
    sigma = np.asarray(sigma, dtype=np.float64)
    return lam + (1.0 - lam) * np.power(np.clip(sigma, 0.0, 1.0), float(eta))


def effective_wager_bankroll(
    b_t: np.ndarray,
    sigma_t: np.ndarray,
    lam: float,
    eta: float = 1.0,
) -> np.ndarray:
    """Effective wager m_i = b_i * g(sigma_i). Returns (n,) with m_i <= b_i."""
    b_t = np.asarray(b_t, dtype=np.float64)
    g = skill_gate(sigma_t, lam, eta)
    return b_t * g


def effective_wager_capped(
    b_t: np.ndarray,
    sigma_t: np.ndarray,
    lam: float,
    eta: float = 1.0,
    alpha_t: Optional[np.ndarray] = None,
    omega_max: Optional[float] = None,
    eps: float = 1e-12,
) -> np.ndarray:
    """
    Single wager vector for both settlement and aggregation: raw effective wager
    from b, sigma, lam, eta; zero out absent if alpha_t given; apply cap if
    omega_max active. Returns (n,) to be used as m_pre and for aggregation.
    """
    m_t = effective_wager_bankroll(b_t, sigma_t, lam, eta)

    if alpha_t is not None:
        alpha_t = np.asarray(alpha_t, dtype=np.int32).ravel()
        m_t = np.asarray(m_t, dtype=np.float64).ravel().copy()
        m_t[alpha_t == 1] = 0.0

    if omega_max is not None and omega_max > 0.0:
        m_t = cap_weight_shares(m_t, omega_max=omega_max, eps=eps)

    return m_t


def cap_weight_shares(
    m_t: np.ndarray,
    omega_max: float = 0.25,
    eps: float = 1e-12,
) -> np.ndarray:
    """
    Project onto the capped simplex: same total mass, each share in [0, omega_max].

    Uses water-filling (capped-simplex projection). Invariants:
      sum_i m_i^cap = sum_i m_i,
      0 <= m_i^cap / sum_j m_j^cap <= omega_max,
      m_i^cap >= 0.

    Returns m_cap (same shape as input, non-negative, mass-preserving).
    """
    m_t = np.asarray(m_t, dtype=np.float64).ravel().copy()
    if np.any(m_t < -eps):
        raise ValueError("cap_weight_shares requires non-negative wagers")
    m_t = np.maximum(m_t, 0.0)
    M = float(m_t.sum())
    if M <= eps:
        out = m_t.copy()
        assert abs(out.sum() - M) <= eps, "mass preservation (zero total)"
        return out

    n = m_t.size
    om = float(omega_max)
    if om >= 1.0:
        out = m_t.copy()
        assert abs(out.sum() - M) <= eps, "mass preservation (no cap)"
        return out
    if om < 1.0 / n - eps:
        raise ValueError(
            f"omega_max={om} must be >= 1/n={1.0/n} for feasible capped simplex"
        )

    # Water-filling: sort descending; k largest get cap, rest share remainder equally.
    order = np.argsort(-m_t)
    m_sorted = m_t[order]
    r_k = (1.0 - om * np.arange(n, dtype=np.float64)) / (
        n - np.arange(n, dtype=np.float64)
    )
    r_k[-1] = 0.0
    k = 0
    for k in range(n):
        fill = r_k[k] * M
        if m_sorted[k] <= fill + eps:
            if k == 0 or m_sorted[k - 1] >= om * M - eps:
                break
    # k = number of coordinates at cap; rest get fill = (1 - k*om)/(n-k) * M
    fill_val = (1.0 - k * om) / (n - k) * M if k < n else 0.0
    fill_val = max(0.0, fill_val)  # avoid negative from floating point
    m_cap_sorted = np.where(
        np.arange(n) < k,
        om * M,
        fill_val,
    )
    m_cap = np.empty_like(m_t)
    m_cap[order] = m_cap_sorted
    # Numerical safeguard: clip to non-negative and renormalize to preserve mass
    m_cap = np.maximum(m_cap, 0.0)
    out_sum = float(m_cap.sum())
    if out_sum > eps:
        m_cap = m_cap * (M / out_sum)

    # Post-computation invariants (explicit raises survive python -O)
    out_sum = float(m_cap.sum())
    if abs(out_sum - M) > eps:
        raise RuntimeError(
            f"mass preservation violated: sum(m_cap)={out_sum:.12g}, expected {M:.12g}, "
            f"delta={abs(out_sum - M):.6e}"
        )
    shares_out = m_cap / out_sum
    cap_tol = max(eps, 1e-8)
    max_share = float(np.max(shares_out))
    if not np.all(shares_out <= om + cap_tol):
        raise RuntimeError(
            f"cap condition violated: max share {max_share:.12g} > omega_max={om:.12g} + tol={cap_tol:.6e}"
        )
    min_val = float(np.min(m_cap))
    if not np.all(m_cap >= -eps):
        raise RuntimeError(
            f"non-negativity violated: min(m_cap)={min_val:.12g}, bound=-{eps:.6e}"
        )

    return m_cap


def update_wealth(
    W_t: np.ndarray,
    profit_t: np.ndarray,
) -> np.ndarray:
    """W_{t+1} = max(0, W_t + profit_t)."""
    W_t = np.asarray(W_t, dtype=np.float64).ravel()
    profit_t = np.asarray(profit_t, dtype=np.float64).ravel()
    return np.maximum(0.0, W_t + profit_t)
