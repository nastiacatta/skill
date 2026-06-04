"""
Online skill estimation: EWMA loss tracking and loss-to-skill mapping.

L_t tracks exponentially weighted *normalised* loss per forecaster (in [0,1]).
sigma_t = f(L_t) maps accumulated loss to skill in [sigma_min, 1].

Assumptions:
  - MAE mode: loss in [0,1] for y,r in [0,1].
  - CRPS-hat mode: loss in [0,2]; normalised L = loss/2.
  - When kappa > 0 and L0 is set, absent forecasters' L decays toward L0.
Pure computation only; no I/O.
"""

import numpy as np


def default_initial_loss(sigma_min, gamma, sigma_init=None, eps=1e-3):
    """
    Map a conservative sigma_init into a finite initial EWMA loss so that
    unseen accounts do not start at sigma=1. If sigma_init is None, use
    a conservative default and clip to < 1.
    """
    s_min = float(sigma_min)
    if sigma_init is None:
        sigma_init = max(s_min + float(eps), 0.2)
    sigma_init = min(float(sigma_init), 1.0 - 1e-6)
    if not (s_min < sigma_init < 1.0):
        raise ValueError("Need sigma_min < sigma_init < 1")
    return missingness_L0(sigma_init, s_min, float(gamma))


def update_ewma_loss(
    L_prev,
    losses_t,
    alpha_t,
    rho,
    kappa=0.0,
    L0=0.0,
    m_t=None,
    m_ref=1.0,
    use_exposure_weighting=False,
):
    """
    EWMA loss update per forecaster.

    Present (alpha=0): L = (1 - rho_eff) * L_prev + rho_eff * loss.
    When use_exposure_weighting is True, rho_eff_i = rho * min(1, m_i / m_ref).
    Missing (alpha=1): L = (1 - kappa) * L_prev + kappa * L0 (unchanged).

    Invariants preserved under bugfix spec `mechanism-correctness-audit-fix`
    (clauses 1.22 κ=0 preserves missing, 1.20 σ_t uses only L_{t-1}).
    Do NOT refactor without re-running `pytest -m audit onlinev2/tests/audit/`.
    """
    L_prev = np.asarray(L_prev, dtype=np.float64)
    losses_t = np.asarray(losses_t, dtype=np.float64)
    alpha_t = np.asarray(alpha_t, dtype=np.int32)

    L = L_prev.copy()
    present = (alpha_t == 0)
    missing = (alpha_t == 1)

    if np.any(present):
        rho_eff = np.full(L.shape, float(rho), dtype=np.float64)

        if use_exposure_weighting:
            if m_t is None:
                raise ValueError("m_t must be provided when use_exposure_weighting=True")
            m_ref_val = float(m_ref)
            if m_ref_val <= 0.0:
                raise ValueError(
                    f"m_ref must be > 0 when use_exposure_weighting=True, got {m_ref_val}"
                )
            m_t = np.asarray(m_t, dtype=np.float64)
            exposure = np.minimum(1.0, np.maximum(m_t, 0.0) / m_ref_val)
            rho_eff[present] = rho_eff[present] * exposure[present]

        L[present] = (
            (1.0 - rho_eff[present]) * L[present]
            + rho_eff[present] * losses_t[present]
        )

    if float(kappa) != 0.0 and np.any(missing):
        L[missing] = (1.0 - float(kappa)) * L[missing] + float(kappa) * float(L0)

    return L


def loss_to_skill(L_prev, sigma_min, gamma):
    """sigma = sigma_min + (1 - sigma_min) * exp(-gamma * L). Clamped to [sigma_min, 1].

    Invariants preserved under bugfix spec `mechanism-correctness-audit-fix`
    (clauses 1.18 σ bounds, 1.19 strictly decreasing in L, 1.23 calibrate_gamma
    round-trip). Do NOT refactor without re-running the audit PBT suite.
    """
    L_prev = np.asarray(L_prev, dtype=np.float64)
    s_min = float(sigma_min)
    sigma = s_min + (1.0 - s_min) * np.exp(-float(gamma) * L_prev)
    return np.clip(sigma, s_min, 1.0)


def calibrate_gamma(sigma_ref, sigma_min, L_ref):
    """
    Derive gamma so that loss_to_skill(L_ref) == sigma_ref.
    gamma = -ln((sigma_ref - sigma_min) / (1 - sigma_min)) / L_ref
    """
    sigma_ref = float(sigma_ref)
    sigma_min = float(sigma_min)
    L_ref = float(L_ref)
    if L_ref <= 0.0:
        raise ValueError("L_ref must be > 0")
    if not (sigma_min < sigma_ref < 1.0):
        raise ValueError("Need sigma_min < sigma_ref < 1")
    return -np.log((sigma_ref - sigma_min) / (1.0 - sigma_min)) / L_ref


def missingness_L0(sigma_0, sigma_min, gamma):
    """
    Derive L0 so that loss_to_skill(L0) == sigma_0.
    When kappa > 0, absent forecasters' L decays toward L0.
    """
    sigma_0 = float(sigma_0)
    sigma_min = float(sigma_min)
    gamma = float(gamma)
    if gamma <= 0.0:
        raise ValueError("gamma must be > 0")
    if not (sigma_min < sigma_0 < 1.0):
        raise ValueError("Need sigma_min < sigma_0 < 1")
    return -np.log((sigma_0 - sigma_min) / (1.0 - sigma_min)) / gamma
