"""Lambert-style self-financed weighted-score wagering core, with optional
utility redistribution.

The skill pool is self-financed. The utility pool is an added extension used by
this project. Pure mechanism logic only; no plotting or file I/O.
"""

import numpy as np


def skill_payoff(scores, m, alpha=None, eps=1e-12):
    """
    Skill component (wager pool): Pi_i = m_i * (1 + s_i - s_bar).
    s_bar = sum_j m_j s_j / sum_j m_j. If sum m = 0, return zeros.
    """
    s = np.asarray(scores, dtype=np.float64).flatten().copy()
    m = np.asarray(m, dtype=np.float64).flatten().copy()

    if s.shape != m.shape:
        raise ValueError("scores and wagers must have same shape")

    if alpha is not None:
        alpha = np.asarray(alpha, dtype=np.int32).flatten()
        if alpha.shape != m.shape:
            raise ValueError("alpha must match shape")
        miss = (alpha == 1)
        m[miss] = 0.0
        s[miss] = 0.0
    s = np.clip(s, 0.0, 1.0)

    M = float(m.sum())
    if M <= float(eps):
        return np.zeros_like(m)

    s_bar = float((m * s).sum() / M)
    return m * (1.0 + s - s_bar)


def utility_payoff(scores, m, s_client, U, alpha=None, eps=1e-12):
    """
    Utility component: 1_{U>0} * (s_tilde_i * m_i / sum_j s_tilde_j m_j) * U.
    s_tilde_i = 1_{s_i > s_c} * s_i. If U <= 0 or sum s_tilde m = 0, return zeros.
    """
    s = np.asarray(scores, dtype=np.float64).flatten()
    m = np.asarray(m, dtype=np.float64).flatten()

    if alpha is not None:
        alpha = np.asarray(alpha, dtype=np.int32).flatten()
        miss = (alpha == 1)
        m = m.copy()
        m[miss] = 0.0
        s = np.where(miss, 0.0, np.clip(s, 0.0, 1.0))
    else:
        s = np.clip(s, 0.0, 1.0)

    if float(U) <= 0.0:
        return np.zeros_like(m)

    s_tilde = np.where(s > float(s_client), s, 0.0)
    denom = float((s_tilde * m).sum())
    if denom <= float(eps):
        return np.zeros_like(m)

    return (s_tilde * m / denom) * float(U)


def settle_round(b, sigma, lam, scores, alpha=None, s_client=None, U=0.0, eps=1e-12,
                 eta=1.0, m_pre=None):
    """
    Full settlement per Lambert: skill pool + utility, cashflow.

    m_i = b_i * (lam + (1-lam)*sigma_i^eta). refund_i = b_i - m_i.
    cashout_i = refund_i + total_payoff_i. profit_i = cashout_i - b_i = total_payoff_i - m_i.
    """
    lam = float(lam)
    if not (0.0 <= lam <= 1.0):
        raise ValueError(f"lam must be in [0, 1], got {lam}")

    b = np.asarray(b, dtype=np.float64).flatten().copy()
    sigma = np.asarray(sigma, dtype=np.float64).flatten()
    s = np.asarray(scores, dtype=np.float64).flatten()

    if alpha is not None:
        alpha = np.asarray(alpha, dtype=np.int32).flatten()
        b[alpha == 1] = 0.0

    if m_pre is not None:
        m = np.asarray(m_pre, dtype=np.float64).flatten().copy()
        if np.any(m < -eps):
            raise ValueError("m_pre must be non-negative")
        m = np.maximum(m, 0.0)
        if alpha is not None:
            m[alpha == 1] = 0.0
        # Enforce m_i <= b_i for participating agents
        for i in range(len(b)):
            if alpha is None or alpha[i] == 0:
                if m[i] > b[i] + eps:
                    m[i] = float(b[i])
    else:
        g = float(lam) + (1.0 - float(lam)) * np.power(np.clip(sigma, 0.0, 1.0), float(eta))
        m = b * g
        if alpha is not None:
            m[alpha == 1] = 0.0

    refund = b - m
    pi_skill = skill_payoff(s, m, alpha=alpha, eps=eps)

    s_c = float(s_client) if s_client is not None else 0.0
    pi_util = utility_payoff(s, m, s_c, U, alpha=alpha, eps=eps)

    total_payoff = pi_skill + pi_util
    cashout = refund + total_payoff
    prof = total_payoff - m

    return {
        "b": b,
        "sigma": sigma,
        "m": m,
        "refund": refund,
        "skill_payoff": pi_skill,
        "utility_payoff": pi_util,
        "total_payoff": total_payoff,
        "cashout": cashout,
        "profit": prof,
    }


def raja_competitive_payout(scores, wagers, alpha=None, eps=1e-12):
    """Legacy: skill payoff only (no utility). For backward compat."""
    return skill_payoff(scores, wagers, alpha=alpha, eps=eps)


def profit(payouts, wagers):
    """Profit = payouts - wagers (per agent)."""
    payouts = np.asarray(payouts, dtype=np.float64).flatten()
    wagers = np.asarray(wagers, dtype=np.float64).flatten()
    if payouts.shape != wagers.shape:
        raise ValueError("payouts and wagers must have the same shape")
    return payouts - wagers
