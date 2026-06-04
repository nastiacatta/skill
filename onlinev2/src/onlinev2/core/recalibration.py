"""Post-hoc rolling isotonic recalibration of aggregate quantile forecasts.

This module implements the Kuleshov–Fenner–Ermon (KFE) recalibration
construction (arXiv:1807.00263, §3.1) on top of the ``onlinev2`` mechanism's
aggregate quantile output. The layer is strictly additive: it consumes the
mechanism's output without modifying ``core/aggregation.py::aggregate_forecast``
and is disabled by default inside the real-data runner.

Theoretical background
----------------------
Ranjan and Gneiting (2010, JRSS-B,
doi:10.1111/j.1467-9868.2009.00726.x) prove that a linear pool of
calibrated — or miscalibrated — predictive CDFs is generically
**uncalibrated**, even when every input forecaster is calibrated. This
is the root cause of the ~0.017 mean tail deviation observed in the
mechanism aggregate on the Elia offshore-wind slice, recorded at
``onlinev2/outputs/audit_per_quantile/coverage.json``.

Kuleshov, Fenner and Ermon (2018, "Accurate Uncertainties for Deep
Learning Using Calibrated Regression", ICML, arXiv:1807.00263) show that
any black-box probabilistic regressor can be made marginally calibrated
by post-processing its predictive CDF with a monotone map fitted to
held-out Probability Integral Transform (PIT) values by isotonic
regression, with convergence as the held-out sample grows.

Gneiting and Ranjan (2013, "Combining Predictive Distributions",
arXiv:1106.1638) develop the parametric (Beta-transformed linear pool)
cousin of KFE; we adopt the non-parametric KFE route here and list BLP
as future work.

The rolling extension below replaces KFE's one-shot held-out set with a
sliding buffer of the most recent ``window_size`` PITs, following the
prequential framing of Dawid (1984, "Statistical theory: the prequential
approach", JRSS-A). This lets the recalibrator track slow regime changes
in multi-year wind series where stationarity cannot be assumed.

The layer targets the calibration limb of the Gneiting, Balabdaoui and
Raftery (2007, JRSS-B) calibration-and-sharpness principle: maximise
sharpness subject to calibration.

References
----------
- Kuleshov, V., Fenner, N., & Ermon, S. (2018). *Accurate Uncertainties
  for Deep Learning Using Calibrated Regression*. ICML.
  `arXiv:1807.00263 <https://arxiv.org/abs/1807.00263>`_.
- Gneiting, T., & Ranjan, R. (2013). *Combining Predictive Distributions*.
  `arXiv:1106.1638 <https://arxiv.org/abs/1106.1638>`_ (BLP cousin).
- Ranjan, R., & Gneiting, T. (2010). *Combining probability forecasts*.
  JRSS-B. `doi:10.1111/j.1467-9868.2009.00726.x
  <https://rss.onlinelibrary.wiley.com/doi/10.1111/j.1467-9868.2009.00726.x>`_
  (impossibility result for linear pools).
- Gneiting, T., Balabdaoui, F., & Raftery, A. E. (2007).
  *Probabilistic forecasts, calibration and sharpness*. JRSS-B.
- Dawid, A. P. (1984). *Statistical theory: the prequential approach*.
  JRSS-A.

Implements the rolling recalibration layer for prequential PIT calibration.
"""
from __future__ import annotations

from collections import deque
from typing import Optional, Tuple

import numpy as np
from scipy.optimize import isotonic_regression

from onlinev2.core.metrics import compute_pit, compute_pit_extended


class RollingRecalibrator:
    """Rolling post-hoc isotonic recalibration of a quantile forecast panel.

    The recalibrator maintains a FIFO buffer of the most recent
    ``window_size`` ``(q_agg, y, pit)`` triples. On each ``fit`` call it
    projects the empirical CDF of the buffer's PITs onto the identity by
    Pool-Adjacent-Violators isotonic regression (via
    ``scipy.optimize.isotonic_regression``). The fitted monotone map
    ``G : [0, 1] → [0, 1]`` with ``G(0)=0`` and ``G(1)=1`` is then used by
    ``transform`` to compute the recalibrated quantile vector
    ``q_calibrated(τ_k) = q_mechanism(G^{-1}(τ_k))`` by two piecewise-linear
    interpolations.

    Parameters
    ----------
    taus : array-like of shape (K,)
        Quantile levels of the mechanism aggregate, strictly increasing in
        ``(0, 1)``. Must match the grid used by the mechanism output.
    window_size : int, default 500
        Maximum number of ``(q_agg, y, pit)`` triples retained. Oldest
        triples are evicted FIFO inside ``update``.
    min_pits : int, default 100
        Floor below which ``transform`` returns ``q_agg`` unchanged.
        Must satisfy ``min_pits <= window_size``.
    refit_every : int, default 50
        Cadence hint for the caller; any positive integer is admissible.
        The recalibrator itself does not enforce this cadence — the runner
        is responsible for calling ``fit`` at the desired interval.
    pit_mode : {"extended", "truncated"}, default "extended"
        How to compute the PIT fed into the isotonic fitter.
        ``"extended"`` (the default as of the A3 tail-extrapolation fix)
        uses :func:`onlinev2.core.metrics.compute_pit_extended`, which
        linearly extends the reported quantile fan to the bounded
        support ``[pit_support_lo, pit_support_hi]`` so PIT values
        span the full ``[0, 1]`` interval. This gives the isotonic
        fitter data at every τ, including below ``taus[0]`` and above
        ``taus[-1]`` — the range where the legacy ``"truncated"`` PIT
        had no observations and the map was forced to boundary-
        interpolate between the pinned ``(0, 0)`` / ``(1, 1)``
        endpoints and the first observed PIT value.
        ``"truncated"`` reproduces the pre-fix behaviour for
        reproducibility of earlier outputs.
    pit_support_lo, pit_support_hi : float, defaults ``0.0`` / ``1.0``
        Bounds of the outcome support, used only when
        ``pit_mode="extended"``. The defaults match the ``[0, 1]``
        normalisation used by the real-data pipeline.

    Attributes
    ----------
    n_pits : int (read-only property)
        Current number of triples in the rolling buffer.
    is_fitted : bool (read-only property)
        Whether ``fit`` has completed successfully at least once.
    G_grid : tuple[np.ndarray, np.ndarray] (read-only property)
        The fitted isotonic map as ``(x_grid, y_grid)``; both arrays are
        non-decreasing with first element ``0.0`` and last ``1.0``.
        Returns ``(None, None)`` before the first successful fit.

    Raises
    ------
    ValueError
        On invalid ``taus`` (not strictly increasing, not in ``(0, 1)``) or
        non-positive integer sizing parameters, or if
        ``min_pits > window_size``.

    References
    ----------
    Kuleshov–Fenner–Ermon 2018, arXiv:1807.00263, §3.1.
    """

    def __init__(
        self,
        taus: np.ndarray,
        window_size: int = 500,
        min_pits: int = 100,
        refit_every: int = 50,
        *,
        pit_mode: str = "extended",
        pit_support_lo: float = 0.0,
        pit_support_hi: float = 1.0,
    ) -> None:
        taus_arr = np.asarray(taus, dtype=np.float64).ravel()
        if taus_arr.size < 2:
            raise ValueError(
                f"taus must have at least 2 entries, got size {taus_arr.size}"
            )
        if not np.all(np.isfinite(taus_arr)):
            raise ValueError("taus must be finite")
        if not np.all(np.diff(taus_arr) > 0):
            raise ValueError("taus must be strictly increasing")
        if taus_arr[0] <= 0.0 or taus_arr[-1] >= 1.0:
            raise ValueError(
                f"taus must lie in the open interval (0, 1); "
                f"got first={taus_arr[0]}, last={taus_arr[-1]}"
            )

        for name, value in (
            ("window_size", window_size),
            ("min_pits", min_pits),
            ("refit_every", refit_every),
        ):
            if not isinstance(value, (int, np.integer)) or bool(isinstance(value, bool)):
                raise ValueError(
                    f"{name} must be a positive integer, got {type(value).__name__}={value}"
                )
            if int(value) <= 0:
                raise ValueError(f"{name} must be positive, got {value}")

        window_size = int(window_size)
        min_pits = int(min_pits)
        refit_every = int(refit_every)
        if min_pits > window_size:
            raise ValueError(
                f"min_pits ({min_pits}) must be <= window_size ({window_size})"
            )

        if pit_mode not in {"extended", "truncated"}:
            raise ValueError(
                f"pit_mode must be 'extended' or 'truncated', got {pit_mode!r}"
            )
        if not (float(pit_support_lo) < float(pit_support_hi)):
            raise ValueError(
                f"pit_support_lo ({pit_support_lo}) must be < "
                f"pit_support_hi ({pit_support_hi})"
            )

        self.taus: np.ndarray = taus_arr.copy()
        self.window_size: int = window_size
        self.min_pits: int = min_pits
        self.refit_every: int = refit_every
        self.pit_mode: str = pit_mode
        self.pit_support_lo: float = float(pit_support_lo)
        self.pit_support_hi: float = float(pit_support_hi)

        # Rolling buffer of (q_agg, y, pit) triples. FIFO eviction is handled
        # automatically by deque's ``maxlen`` argument.
        self._buffer: deque = deque(maxlen=window_size)

        # Fitted isotonic map; None until the first successful fit.
        self._G_x: Optional[np.ndarray] = None
        self._G_y: Optional[np.ndarray] = None
        self._is_fitted: bool = False

    # --- Public API --------------------------------------------------------

    def update(self, q_agg: np.ndarray, y: float) -> None:
        """Record one ``(q_agg, y)`` pair into the rolling buffer.

        Computes the PIT ``u = compute_pit(y, q_agg, self.taus)`` and appends
        ``(q_agg.copy(), float(y), u)`` to the internal deque. If the deque is
        at ``window_size``, the oldest triple is evicted FIFO.

        Parameters
        ----------
        q_agg : array-like of shape (K,)
            The mechanism's aggregate quantile vector at ``self.taus``.
        y : float
            The realised outcome for the round.

        Satisfies Requirement 1.1 (``update``) and Requirement 6.1 (rolling
        eviction).
        """
        q = np.asarray(q_agg, dtype=np.float64).ravel().copy()
        if q.size != self.taus.size:
            raise ValueError(
                f"q_agg length ({q.size}) must match taus length ({self.taus.size})"
            )
        y_f = float(y)
        if self.pit_mode == "extended":
            pit = float(
                compute_pit_extended(
                    y_f, q, self.taus,
                    support_lo=self.pit_support_lo,
                    support_hi=self.pit_support_hi,
                )
            )
        else:
            pit = float(compute_pit(y_f, q, self.taus))
        # deque(maxlen=...) evicts from the left automatically when full.
        self._buffer.append((q, y_f, pit))

    def fit(self) -> None:
        """Refit the isotonic map ``G`` from the current PIT buffer.

        No-op when ``n_pits < min_pits`` — the recalibrator remains in its
        previous state (possibly unfitted). On success sets ``is_fitted`` to
        True and updates ``G_grid``.

        Satisfies Requirement 1.1 (``fit``) and Requirement 1.5 (``G``
        monotone with ``G(0) = 0``, ``G(1) = 1``).
        """
        n = self.n_pits
        if n < self.min_pits:
            return

        # Extract the current PIT buffer as a 1-D float array.
        pits = self._compute_pit_buffer()

        # Fit the isotonic map via PAV. We project the empirical CDF (ecdf =
        # rank/n at the sorted PITs) onto the non-decreasing cone. For the
        # PAV input itself, ecdf is already monotone so ``isotonic_regression``
        # returns ecdf unchanged; the actual KFE step lives in how we use the
        # (pits_sorted, ecdf) pair as the ``G`` lookup table.
        pits_sorted = np.sort(pits)
        ecdf = (np.arange(1, n + 1, dtype=np.float64)) / float(n)
        G_raw = isotonic_regression(ecdf, increasing=True).x

        # Pin the boundary: G(0) = 0 and G(1) = 1. This guarantees Req 1.5
        # regardless of the empirical PIT distribution.
        self._G_x = np.concatenate(([0.0], pits_sorted, [1.0]))
        self._G_y = np.concatenate(([0.0], G_raw, [1.0]))

        # Numerical safety: clip to [0, 1] and ensure monotone (PAV already
        # guarantees monotonicity, but pinned boundary plus floating-point
        # noise can produce tiny violations that break np.interp contract).
        self._G_x = np.clip(self._G_x, 0.0, 1.0)
        self._G_y = np.clip(self._G_y, 0.0, 1.0)
        # Enforce strict non-decrease via cumulative maximum.
        self._G_x = np.maximum.accumulate(self._G_x)
        self._G_y = np.maximum.accumulate(self._G_y)

        self._is_fitted = True

    def transform(self, q_agg: np.ndarray) -> np.ndarray:
        """Return the recalibrated quantile vector at ``self.taus``.

        When unfitted (``is_fitted is False``), returns a float64 copy of the
        input unchanged — the recalibrator is a strict identity. Otherwise
        computes the two-step interpolation

            u_k    = np.interp(tau_k, G_y, G_x)          # G^{-1}(tau_k)
            q_k'   = np.interp(u_k,   self.taus, q_agg)  # mechanism lookup

        where both steps are piecewise-linear (inversion and application).

        Parameters
        ----------
        q_agg : array-like of shape (K,)
            The mechanism's aggregate quantile vector at ``self.taus``.

        Returns
        -------
        np.ndarray of shape (K,)
            The recalibrated quantile vector, float64.

        Satisfies Requirement 1.1 (``transform``), Requirement 1.3 (identity
        below ``min_pits``) and Requirement 1.4 (two-step interp semantics).
        """
        q = np.asarray(q_agg, dtype=np.float64).ravel()
        if q.size != self.taus.size:
            raise ValueError(
                f"q_agg length ({q.size}) must match taus length ({self.taus.size})"
            )
        if not self._is_fitted:
            # Defensive copy — callers should not observe the same array
            # object they passed in being reused downstream.
            return q.copy()

        assert self._G_x is not None and self._G_y is not None
        # Step 1: invert G via its (G_y -> G_x) lookup table.
        # np.interp requires the x-coordinate array (2nd arg) to be
        # non-decreasing; we enforced that in fit().
        u_values = np.interp(self.taus, self._G_y, self._G_x)
        # Step 2: map u_k back through the mechanism quantile grid.
        q_recal = np.interp(u_values, self.taus, q)
        return np.asarray(q_recal, dtype=np.float64)

    # --- Read-only state ---------------------------------------------------

    @property
    def n_pits(self) -> int:
        """Current number of triples in the rolling buffer."""
        return len(self._buffer)

    @property
    def is_fitted(self) -> bool:
        """True iff ``fit`` has completed successfully at least once."""
        return self._is_fitted

    @property
    def G_grid(self) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
        """Return the fitted isotonic map as ``(x_grid, y_grid)``.

        Both arrays are non-decreasing with boundary ``(0, 0)`` and ``(1, 1)``.
        Returns ``(None, None)`` before the first successful fit.
        """
        if not self._is_fitted:
            return (None, None)
        # Return defensive copies so callers cannot mutate internal state.
        assert self._G_x is not None and self._G_y is not None
        return (self._G_x.copy(), self._G_y.copy())

    # --- Private helpers ---------------------------------------------------

    def _compute_pit_buffer(self) -> np.ndarray:
        """Return the current PIT buffer as a 1-D float64 array."""
        if not self._buffer:
            return np.empty(0, dtype=np.float64)
        return np.asarray([t[2] for t in self._buffer], dtype=np.float64)
