"""
Effective wager computation.

m_i = b_i * g(sigma_i), where g(sigma) = lam + (1 - lam) * sigma^eta.
With eta=1: m_i = b_i * (lam + (1 - lam) * sigma_i).
Pure mechanism logic only.
"""

import numpy as np


def effective_wager(deposits, sigma, lam, eta=1.0):
    """
    Effective wager: m_i = b_i * (lam + (1-lam) * sigma_i^eta).
    Returns (n,) effective wagers, m_i <= b_i always.
    """
    deposits = np.asarray(deposits, dtype=np.float64)
    sigma = np.asarray(sigma, dtype=np.float64)
    g = float(lam) + (1.0 - float(lam)) * np.power(np.clip(sigma, 0.0, 1.0), float(eta))
    return deposits * g


def refund(deposits, m):
    """Refund: b_i - m_i (portion of deposit not placed at risk)."""
    deposits = np.asarray(deposits, dtype=np.float64)
    m = np.asarray(m, dtype=np.float64)
    return deposits - m
