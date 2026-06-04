"""Scoring rules used by the mechanism.

Point mode (`point_mae`) uses absolute loss, so it elicits a median-type point
forecast. Absolute loss is proper for the median, and strictly proper only when
the predictive median is unique.

Quantile mode (`quantiles_crps`) uses a finite-grid quantile score (CRPS-hat):
    C_hat = (2 / K) * sum_k L^{tau_k}(y, q_k),
i.e. average pinball loss over reported quantiles. This is a quantile-grid
approximation to CRPS, not exact CRPS. Tail caveats:

  * The classical Gneiting–Raftery CRPS integrates pinball over tau in (0, 1).
    Any finite grid ``taus`` only covers ``[taus[0], taus[-1]]``, so the
    tails ``[0, taus[0]) u (taus[-1], 1]`` contribute zero to C_hat. On the
    default ``TAUS_COARSE = [0.1, 0.25, 0.5, 0.75, 0.9]`` this silently
    drops 20% of the classical integration range. Use ``TAUS_FINE`` for a
    9-level equidistant grid, or a denser grid for tail-sensitive work.
  * The simple-average formula ``(2/K) * sum pinball`` is only exact for
    equidistant grids (trapezoidal rule). For non-equidistant grids this
    module applies trapezoidal weights so existing results on equidistant
    grids are unchanged.
  * Report C_hat as "CRPS-hat" or "finite quantile score", not "CRPS".

Settlement uses bounded affine score maps that land in [0, 1]:
    score_mae      = 1 - |y - r|
    score_crps_hat = 1 - C_hat / 2

This module is pure: no I/O, no plotting, no subprocess.
Used only by core.runner.
"""

import numpy as np

# Canonical quantile grids for CRPS approximation
TAUS_COARSE = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
"""5-level non-equidistant grid (legacy). Adequate for quick checks."""

TAUS_FINE = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
"""9-level equidistant grid. Provides better CRPS approximation quality
because the trapezoidal rule used in CRPS_hat is exact for equidistant grids.
Recommended for new experiments."""


def mae_loss(outcome, report):
    """Mean absolute error: |report - outcome|."""
    outcome = np.asarray(outcome, dtype=np.float64)
    report = np.asarray(report, dtype=np.float64)
    return float(np.mean(np.abs(report - outcome)))


def score_mae(outcome, report):
    """Bounded score induced by absolute loss on [0, 1].

    s = clip(1 - |y - r|, 0, 1).

    This is proper for median-type point forecasts. Use stricter wording only
    when the predictive median is known to be unique.

    The result is clamped to [0, 1] so that downstream settlement always
    receives valid scores, even if y or r lie slightly outside [0, 1] due
    to floating-point noise in the DGP.
    """
    outcome = np.asarray(outcome, dtype=np.float64)
    report = np.asarray(report, dtype=np.float64)
    s = np.clip(1.0 - np.abs(outcome - report), 0.0, 1.0)
    return float(np.mean(s))


def mae_score(outcome, report, c=1.0, eps=1e-12):
    """Legacy API: s = clip(1 - MAE/c, 0, 1). Kept for backward compat only."""
    c = float(c)
    if c <= 0.0:
        raise ValueError("c must be > 0")
    loss = mae_loss(outcome, report)
    return float(np.clip(1.0 - loss / (c + float(eps)), 0.0, 1.0))


def pinball_loss(y, q, tau):
    """Pinball loss L^(tau)(y,q). tau in (0,1)."""
    y = np.asarray(y, dtype=np.float64)
    q = np.asarray(q, dtype=np.float64)
    tau = float(tau)
    if not (0 < tau < 1):
        raise ValueError("tau must be in (0,1)")
    err = y - q
    return np.where(err >= 0, tau * err, (tau - 1.0) * err)


def _is_equidistant(taus: np.ndarray, atol: float = 1e-10) -> bool:
    """Check whether tau levels are equidistant."""
    if len(taus) < 2:
        return True
    diffs = np.diff(taus)
    return bool(np.allclose(diffs, diffs[0], atol=atol))


def crps_hat_from_quantiles(y, q_matrix, taus):
    """Finite-grid CRPS surrogate via pinball loss.

    For **equidistant** tau grids the formula is the standard average:

        C_hat = (2 / K) * sum_k pinball(y, q_k, tau_k).

    For **non-equidistant** grids the simple average over-weights some
    regions of the distribution relative to others.  To correct for this,
    we use a trapezoidal-rule weighting:

        C_hat = 2 * sum_k  w_k * pinball(y, q_k, tau_k),

    where w_k is the width of the interval centred on tau_k (half the
    distance to each neighbour, with boundary adjustments for the first
    and last levels).  For equidistant grids this reduces to the simple
    average, so existing results are unchanged.

    Returns per-agent loss; with y, q in [0, 1], C_hat lies in [0, 2].
    """
    y = np.asarray(y, dtype=np.float64)
    q_matrix = np.asarray(q_matrix, dtype=np.float64)
    taus = np.asarray(taus, dtype=np.float64)
    if q_matrix.ndim == 1:
        q_matrix = q_matrix.reshape(1, -1)
    n, K = q_matrix.shape
    if len(taus) != K:
        raise ValueError("taus length must match q_matrix columns")

    losses = np.zeros(n, dtype=np.float64)
    for k, tau in enumerate(taus):
        losses += pinball_loss(y, q_matrix[:, k], tau)

    if _is_equidistant(taus):
        # Simple average — identical to the original formula.
        return 2.0 * losses / K

    # Trapezoidal weights for non-equidistant grids.
    # w_k = (tau_{k+1} - tau_{k-1}) / 2  for interior points,
    # with boundary adjustments so that sum(w_k) = tau_K - tau_0.
    w = np.empty(K, dtype=np.float64)
    w[0] = (taus[1] - taus[0]) / 2.0
    w[-1] = (taus[-1] - taus[-2]) / 2.0
    for k in range(1, K - 1):
        w[k] = (taus[k + 1] - taus[k - 1]) / 2.0
    # Normalise so that sum(w) = 1 (makes C_hat comparable across grids).
    w /= w.sum()

    losses_weighted = np.zeros(n, dtype=np.float64)
    for k, tau in enumerate(taus):
        losses_weighted += w[k] * pinball_loss(y, q_matrix[:, k], tau)
    return 2.0 * losses_weighted


def score_crps_hat(y, q_matrix, taus):
    """Bounded score induced by the finite-grid CRPS surrogate (CRPS-hat).

    s = clip(1 - C_hat / 2, 0, 1), where C_hat is the (possibly
    trapezoidally-weighted) pinball loss over quantiles.
    Used by settlement; describe as CRPS-hat or finite quantile score,
    not exact CRPS.

    The result is clamped to [0, 1] so that downstream settlement always
    receives valid scores.
    """
    crps = crps_hat_from_quantiles(y, q_matrix, taus)
    s = np.clip(1.0 - crps / 2.0, 0.0, 1.0)
    return s


def score_from_loss(loss, c, eps=1e-12):
    """Legacy affine map: s = 1 - loss/c, clamped to [0,1]. Prefer score_mae/score_crps_hat."""
    loss = np.asarray(loss, dtype=np.float64)
    c = float(c)
    if c <= 0.0:
        raise ValueError("c must be > 0")
    return np.clip(1.0 - loss / (c + float(eps)), 0.0, 1.0)


def normalised_loss(loss, scoring_mode):
    """Normalise loss to [0,1]. MAE: as-is; CRPS-hat: loss/2."""
    loss = np.asarray(loss, dtype=np.float64)
    if scoring_mode == "quantiles_crps":
        return loss / 2.0
    return loss
