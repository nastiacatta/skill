"""
Mechanism metrics: PIT, sharpness, concentration (HHI, N_eff, Gini), and
in-memory network feature/edge data for collusion analysis.

Pure computation and in-memory accumulation only. No file I/O; CSV/plot
export belongs in io/ or experiments/.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

import numpy as np


def validate_quantile_monotonicity(
    quantiles: np.ndarray,
    taus: np.ndarray,
    eps: float = 1e-12,
) -> bool:
    """
    Check that quantiles are non-decreasing in tau.
    Returns True if valid, False if crossing.
    """
    quantiles = np.asarray(quantiles, dtype=np.float64).ravel()
    taus = np.asarray(taus, dtype=np.float64).ravel()
    if quantiles.size < 2:
        return True
    diffs = np.diff(quantiles)
    return bool(np.all(diffs >= -eps))


def compute_pit(
    y_t: float,
    quantiles: np.ndarray,
    taus: np.ndarray,
) -> float:
    """
    Truncated PIT diagnostic from interpolated quantiles.

    When ``y_t`` is outside the reported quantile range, returns the first or
    last reported ``tau`` (e.g. with default ``taus = [0.1, ..., 0.9]``, PIT
    values are truncated to ``[0.1, 0.9]``, not the full ``[0, 1]``). So this
    is an *approximate, truncated* PIT, not the classical PIT (predictive CDF
    at the observation). Under a perfectly calibrated predictive CDF the
    output has atoms of mass ``taus[0]`` at ``taus[0]`` and mass ``1 - taus[-1]``
    at ``taus[-1]``, plus the continuous restriction of a uniform distribution
    on ``(taus[0], taus[-1])``.

    For the KS test against this correct null distribution, use
    :func:`_ks_uniform_truncated`. Comparing to ``Uniform(0, 1)`` (e.g. via
    :func:`_ks_uniform`) inflates the KS statistic by roughly
    ``max(taus[0], 1 - taus[-1])`` even for a perfectly calibrated forecaster.

    Assumes quantiles are ordered (:func:`validate_quantile_monotonicity`).
    """
    quantiles = np.asarray(quantiles, dtype=np.float64).ravel()
    taus = np.asarray(taus, dtype=np.float64).ravel()

    if y_t <= quantiles[0]:
        return float(taus[0])
    if y_t >= quantiles[-1]:
        return float(taus[-1])

    idx = np.searchsorted(quantiles, y_t)
    if idx == 0:
        return float(taus[0])
    q_lo, q_hi = quantiles[idx - 1], quantiles[idx]
    tau_lo, tau_hi = taus[idx - 1], taus[idx]
    if abs(q_hi - q_lo) < 1e-15:
        return float((tau_lo + tau_hi) / 2.0)
    frac = (y_t - q_lo) / (q_hi - q_lo)
    return float(tau_lo + frac * (tau_hi - tau_lo))


def compute_pit_extended(
    y_t: float,
    quantiles: np.ndarray,
    taus: np.ndarray,
    *,
    support_lo: float = 0.0,
    support_hi: float = 1.0,
) -> float:
    """
    Untruncated PIT on a bounded support by linear tail extension.

    The reported quantile fan only covers ``[taus[0], taus[-1]]`` (e.g.
    ``[0.1, 0.9]`` on the nine-level grid). Below ``taus[0]`` and above
    ``taus[-1]`` the predictive CDF is unknown; the reported fan is
    silent. For a bounded-support observation (normalised Elia wind power,
    ``y ∈ [0, 1]``), a principled default is to extend the reported CDF
    linearly to the support boundaries: the CDF is 0 at ``support_lo``
    and 1 at ``support_hi``, linearly interpolated between
    ``(support_lo, 0)`` → ``(quantiles[0], taus[0])`` in the lower tail
    and between ``(quantiles[-1], taus[-1])`` → ``(support_hi, 1)`` in
    the upper tail.

    The returned PIT lies in ``[0, 1]`` and is distributed uniformly on
    ``[0, 1]`` under a calibrated predictive CDF, so the KS statistic
    against ``Uniform(0, 1)`` is the correct null — no ``taus[0]``-bias
    correction is required.

    Why this exists
    ---------------
    ``compute_pit`` returns truncated values in ``[taus[0], taus[-1]]``
    with atoms at the boundaries, which is the right diagnostic for the
    reliability plot (it preserves the information "the fan does not
    report this region"). For *recalibration*, an atom-at-the-boundary
    PIT is the wrong input: the isotonic map built from it has no data
    in ``G_x ∈ [0, taus[0])`` or ``G_x ∈ (taus[-1], 1]`` and the
    recalibrated quantiles at τ ∈ {0.1, 0.9} come from boundary linear
    interpolation against pinned ``(0, 0)`` and ``(1, 1)`` endpoints —
    i.e., a structural under-correction in the tails. This extended PIT
    spreads the atom mass uniformly into the tails under the bounded-
    support assumption, giving the isotonic fitter actual data at every
    τ.

    Parameters
    ----------
    y_t : float
        Observation, assumed in ``[support_lo, support_hi]``.
    quantiles : array-like of shape (K,)
        Monotone non-decreasing quantile vector at ``taus``.
    taus : array-like of shape (K,)
        Strictly-increasing levels in the open interval (0, 1).
    support_lo, support_hi : float
        Bounds of the outcome support. Defaults ``(0.0, 1.0)`` match the
        normalisation used throughout the ``onlinev2`` pipeline.

    Returns
    -------
    float
        Extended PIT in ``[0, 1]``. For ``y_t`` inside the reported fan
        the value matches ``compute_pit``; outside the fan it extends
        linearly to the support boundary.
    """
    quantiles = np.asarray(quantiles, dtype=np.float64).ravel()
    taus = np.asarray(taus, dtype=np.float64).ravel()
    y = float(y_t)
    support_lo = float(support_lo)
    support_hi = float(support_hi)

    if quantiles.size == 0 or quantiles.size != taus.size:
        raise ValueError(
            f"quantiles and taus must have matching positive length; "
            f"got sizes {quantiles.size} and {taus.size}"
        )

    # Lower tail: (support_lo, 0) -> (quantiles[0], taus[0])
    if y <= quantiles[0]:
        if quantiles[0] <= support_lo + 1e-15:
            # Degenerate lower tail; return taus[0] atom value.
            return float(taus[0])
        y_clipped = max(y, support_lo)
        frac = (y_clipped - support_lo) / (quantiles[0] - support_lo)
        return float(frac * taus[0])

    # Upper tail: (quantiles[-1], taus[-1]) -> (support_hi, 1)
    if y >= quantiles[-1]:
        if quantiles[-1] >= support_hi - 1e-15:
            return float(taus[-1])
        y_clipped = min(y, support_hi)
        frac = (y_clipped - quantiles[-1]) / (support_hi - quantiles[-1])
        return float(taus[-1] + frac * (1.0 - taus[-1]))

    # Interior: match compute_pit exactly.
    idx = np.searchsorted(quantiles, y)
    if idx == 0:
        return float(taus[0])
    q_lo, q_hi = quantiles[idx - 1], quantiles[idx]
    tau_lo, tau_hi = taus[idx - 1], taus[idx]
    if abs(q_hi - q_lo) < 1e-15:
        return float((tau_lo + tau_hi) / 2.0)
    frac = (y - q_lo) / (q_hi - q_lo)
    return float(tau_lo + frac * (tau_hi - tau_lo))


def compute_sharpness(
    quantiles: np.ndarray,
    taus: np.ndarray,
    *,
    tau_L: float = 0.1,
    tau_H: float = 0.9,
) -> Dict[str, float]:
    """Sharpness proxies: interval_width, iqr, entropy_proxy."""
    quantiles = np.asarray(quantiles, dtype=np.float64).ravel()
    taus = np.asarray(taus, dtype=np.float64).ravel()

    idx_L = int(np.argmin(np.abs(taus - tau_L)))
    idx_H = int(np.argmin(np.abs(taus - tau_H)))
    idx_25 = int(np.argmin(np.abs(taus - 0.25)))
    idx_75 = int(np.argmin(np.abs(taus - 0.75)))

    interval_width = float(quantiles[idx_H] - quantiles[idx_L])
    iqr = float(quantiles[idx_75] - quantiles[idx_25])

    diffs = np.diff(quantiles)
    diffs = np.maximum(diffs, 1e-15)
    entropy_proxy = float(-np.sum(np.log(diffs)))

    return {
        "interval_width": interval_width,
        "iqr": iqr,
        "entropy_proxy": entropy_proxy,
    }


def compute_hhi(weights: np.ndarray) -> float:
    """Herfindahl–Hirschman Index: H_t = sum_i w_{i,t}^2. Weights normalised (sum 1)."""
    w = np.asarray(weights, dtype=np.float64).ravel()
    total = float(w.sum())
    if total < 1e-15:
        return 0.0
    w_norm = w / total
    return float(np.sum(w_norm ** 2))


def compute_n_eff(weights: np.ndarray) -> float:
    """
    Effective number of participants: N_eff = 1 / H for normalised weights.

    With tilde{w}_i = w_i / sum_j w_j, N_eff = 1 / sum_i tilde{w}_i^2.
    If sum_i w_i = 0 (no active mass), returns 0.0 so zero-weight is not
    reported as full participation.
    """
    w = np.asarray(weights, dtype=np.float64).ravel()
    total = float(w.sum())
    if total < 1e-15:
        return 0.0
    w_norm = w / total
    hhi = float(np.sum(w_norm ** 2))
    if hhi < 1e-15:
        return 0.0
    return 1.0 / hhi


def compute_gini(values: np.ndarray) -> float:
    """Gini coefficient. 0 = perfect equality, approaches 1 for maximal inequality."""
    x = np.asarray(values, dtype=np.float64).ravel()
    x = x[x >= 0]
    if x.size == 0:
        return 0.0
    x_sorted = np.sort(x)
    n = x.size
    total = float(x_sorted.sum())
    if total <= 0.0:
        return 0.0
    index = np.arange(1, n + 1, dtype=np.float64)
    return float((2.0 * np.sum(index * x_sorted) - (n + 1) * total) / (n * total))


class NetworkExporter:
    """
    Builds similarity graph data in rolling windows for collusion detection.
    Node features and edge weights are computed in memory only.
    Use io or experiments layer to write CSV/plots.
    """

    def __init__(self, window_size: int = 50) -> None:
        self.window_size = window_size
        self._agent_reports: Dict[str, List[float]] = {}
        self._agent_stakes: Dict[str, List[float]] = {}
        self._agent_participation: Dict[str, List[int]] = {}

    def record_round(
        self,
        *,
        agent_ids: List[str],
        reports: Dict[str, float],
        stakes: Dict[str, float],
        participation: Dict[str, bool],
    ) -> None:
        """Record one round of observations."""
        for aid in agent_ids:
            if aid not in self._agent_reports:
                self._agent_reports[aid] = []
                self._agent_stakes[aid] = []
                self._agent_participation[aid] = []

            self._agent_reports[aid].append(reports.get(aid, np.nan))
            self._agent_stakes[aid].append(stakes.get(aid, 0.0))
            self._agent_participation[aid].append(
                1 if participation.get(aid, False) else 0
            )

            if len(self._agent_reports[aid]) > self.window_size:
                self._agent_reports[aid] = self._agent_reports[aid][-self.window_size:]
                self._agent_stakes[aid] = self._agent_stakes[aid][-self.window_size:]
                self._agent_participation[aid] = self._agent_participation[aid][-self.window_size:]

    def compute_node_features(self) -> Dict[str, Dict[str, float]]:
        """Compute node feature vector for each agent."""
        features = {}
        for aid in self._agent_reports:
            stakes = np.array(self._agent_stakes[aid])
            reports = np.array(self._agent_reports[aid])
            participation = np.array(self._agent_participation[aid])

            valid_reports = reports[np.isfinite(reports)]

            features[aid] = {
                "mean_stake": float(np.mean(stakes)),
                "stake_var": float(np.var(stakes)),
                "participation_rate": float(np.mean(participation)),
                "median_report": float(np.median(valid_reports)) if valid_reports.size > 0 else 0.5,
                "report_width": float(np.std(valid_reports)) if valid_reports.size > 1 else 0.0,
            }
        return features

    def compute_edge_weights(self) -> List[Dict[str, Any]]:
        """Compute pairwise similarity edges."""
        agents = sorted(self._agent_reports.keys())
        edges = []

        for i, a1 in enumerate(agents):
            for a2 in agents[i + 1:]:
                r1 = np.array(self._agent_reports[a1])
                r2 = np.array(self._agent_reports[a2])
                s1 = np.array(self._agent_stakes[a1])
                s2 = np.array(self._agent_stakes[a2])
                p1 = np.array(self._agent_participation[a1])
                p2 = np.array(self._agent_participation[a2])

                min_len = min(len(r1), len(r2))
                if min_len < 3:
                    continue
                r1, r2 = r1[-min_len:], r2[-min_len:]
                s1, s2 = s1[-min_len:], s2[-min_len:]
                p1, p2 = p1[-min_len:], p2[-min_len:]

                valid = np.isfinite(r1) & np.isfinite(r2)
                if valid.sum() < 3:
                    report_corr = 0.0
                else:
                    rv1, rv2 = r1[valid], r2[valid]
                    if np.std(rv1) < 1e-12 or np.std(rv2) < 1e-12:
                        report_corr = 0.0
                    else:
                        report_corr = float(np.corrcoef(rv1, rv2)[0, 1])

                if np.std(s1) < 1e-12 or np.std(s2) < 1e-12:
                    stake_corr = 0.0
                else:
                    stake_corr = float(np.corrcoef(s1, s2)[0, 1])

                sync_participation = float(np.mean(p1 == p2))

                edges.append({
                    "source": a1,
                    "target": a2,
                    "report_corr": report_corr,
                    "stake_corr": stake_corr,
                    "sync_participation": sync_participation,
                })

        return edges

    def get_export_data(self) -> tuple:
        """
        Return (node_rows, edge_rows) for CSV export by io/ or experiments/.
        Does not perform file I/O.
        """
        features = self.compute_node_features()
        node_rows = [{"agent_id": aid, **feat} for aid, feat in features.items()]
        edge_rows = self.compute_edge_weights()
        return node_rows, edge_rows


class RoundMetricsLogger:
    """Accumulates per-round metrics (PIT, sharpness, HHI, N_eff, Gini) in memory."""

    def __init__(self, taus: Optional[Sequence[float]] = None) -> None:
        if taus is None:
            self.taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9], dtype=np.float64)
        else:
            self.taus = np.asarray(taus, dtype=np.float64).ravel().copy()
        self.pit_values: List[float] = []
        self.sharpness_values: List[Dict[str, float]] = []
        self.hhi_values: List[float] = []
        self.n_eff_values: List[float] = []
        self.gini_values: List[float] = []

    def log_round(
        self,
        *,
        y_t: float,
        agg_quantiles: Optional[np.ndarray] = None,
        weights: np.ndarray,
        wealth: np.ndarray,
    ) -> Dict[str, Any]:
        """Log metrics for one round. Returns dict of computed values."""
        metrics: Dict[str, Any] = {}

        if agg_quantiles is not None:
            pit = compute_pit(y_t, agg_quantiles, self.taus)
            self.pit_values.append(pit)
            metrics["PIT"] = pit

            sharpness = compute_sharpness(agg_quantiles, self.taus)
            self.sharpness_values.append(sharpness)
            metrics["sharpness"] = sharpness

        hhi = compute_hhi(weights)
        n_eff = compute_n_eff(weights)
        gini = compute_gini(wealth)

        self.hhi_values.append(hhi)
        self.n_eff_values.append(n_eff)
        self.gini_values.append(gini)

        metrics["HHI"] = hhi
        metrics["N_eff"] = n_eff
        metrics["Gini"] = gini

        return metrics

    def summary(self) -> Dict[str, Any]:
        """Return summary statistics across all rounds.

        ``pit_ks_uniform`` is computed against the *truncated uniform* null
        distribution on ``[taus[0], taus[-1]]`` with point masses at the
        boundaries equal to ``taus[0]`` and ``1 - taus[-1]``. This is the
        correct null for ``compute_pit``'s truncated PIT (see docstring):
        PIT values below ``taus[0]`` collapse to ``taus[0]`` and values
        above ``taus[-1]`` collapse to ``taus[-1]``. Using Uniform(0, 1) as
        the null here would trigger a spurious ~``taus[0] + (1 - taus[-1])``
        KS bias even on a perfectly calibrated forecaster. The legacy
        ``pit_ks_uniform01`` is also emitted for backward compatibility.
        """
        out: Dict[str, Any] = {}
        if self.pit_values:
            pit_arr = np.array(self.pit_values)
            out["pit_mean"] = float(np.mean(pit_arr))
            out["pit_std"] = float(np.std(pit_arr))
            out["pit_ks_uniform"] = _ks_uniform_truncated(pit_arr, self.taus)
            out["pit_ks_uniform01"] = _ks_uniform(pit_arr)
        if self.hhi_values:
            out["hhi_mean"] = float(np.mean(self.hhi_values))
            out["n_eff_mean"] = float(np.mean(self.n_eff_values))
            out["gini_mean"] = float(np.mean(self.gini_values))
            out["gini_final"] = float(self.gini_values[-1])
        return out


def _ks_uniform(x: np.ndarray) -> float:
    """KS statistic against Uniform(0,1). Kept for backward compatibility.

    Prefer ``_ks_uniform_truncated`` when ``x`` is the output of
    ``compute_pit`` on a finite quantile grid; see that function's docstring
    for why the Uniform(0, 1) null is wrong in that setting.

    Returns 0.0 on an empty input — matches the convention in
    :func:`_ks_uniform_truncated`.
    """
    x_sorted = np.sort(x)
    n = len(x_sorted)
    if n == 0:
        return 0.0
    ecdf = np.arange(1, n + 1) / n
    return float(np.max(np.abs(ecdf - x_sorted)))


def _ks_uniform_truncated(x: np.ndarray, taus: np.ndarray) -> float:
    """KS statistic against the truncated-PIT null on ``[taus[0], taus[-1]]``.

    ``compute_pit`` returns values in ``[taus[0], taus[-1]]`` with point
    masses at the boundaries: under a perfectly calibrated predictive CDF
    the mass at ``taus[0]`` is exactly ``taus[0]`` (from ``y <= q(taus[0])``)
    and the mass at ``taus[-1]`` is exactly ``1 - taus[-1]``. The correct
    null CDF is

        F_null(u) = 0                    for u < taus[0]
                  = taus[0]              at u = taus[0]  (lower atom)
                  = u                    for taus[0] < u < taus[-1]
                  = 1                    for u >= taus[-1] (upper atom)

    i.e. a mixture of a continuous uniform on the open interior plus two
    boundary point masses with total mass ``taus[0] + (1 - taus[-1])``.

    The Kolmogorov–Smirnov statistic ``sup_u |F_emp(u) - F_null(u)|`` is
    evaluated at all jump points of either distribution (the sample values
    plus the two boundaries), including both the right and left limits at
    each jump to catch jump mismatches. Ties are handled correctly: the
    empirical CDF at a tied value equals ``(# samples <= u) / n``, not
    ``(rank) / n``.

    Using Uniform(0, 1) as the null instead inflates the KS statistic by
    roughly ``max(taus[0], 1 - taus[-1])`` even for a perfectly calibrated
    forecaster — on the default 5-tau grid ``[0.1, ..., 0.9]`` this spurious
    bias is ≈ 0.1.

    Returns a non-negative KS distance; 0.0 for an empty input.
    """
    taus = np.asarray(taus, dtype=np.float64).ravel()
    x = np.asarray(x, dtype=np.float64).ravel()
    n = x.size
    if n == 0:
        return 0.0

    tau_lo = float(taus[0])
    tau_hi = float(taus[-1])

    # Build candidate evaluation points: unique sample values + boundaries.
    candidates = np.unique(np.concatenate([x, [tau_lo, tau_hi]]))
    x_sorted = np.sort(x)

    def _emp_cdf_right(u: float) -> float:
        """F_emp(u) = (#samples <= u) / n."""
        return float(np.searchsorted(x_sorted, u, side="right")) / n

    def _emp_cdf_left(u: float) -> float:
        """F_emp(u-) = (#samples < u) / n."""
        return float(np.searchsorted(x_sorted, u, side="left")) / n

    def _null_right(u: float) -> float:
        if u < tau_lo:
            return 0.0
        if u >= tau_hi:
            return 1.0
        return float(u)  # in [tau_lo, tau_hi), with the atom at tau_lo giving F = tau_lo

    def _null_left(u: float) -> float:
        """Left limit of the null CDF at u."""
        if u <= tau_lo:
            return 0.0
        if u > tau_hi:
            return 1.0
        if u == tau_hi:
            return tau_hi  # just below tau_hi, null is continuous with value = tau_hi
        return float(u)

    ks = 0.0
    for u in candidates:
        u = float(u)
        d_right = abs(_emp_cdf_right(u) - _null_right(u))
        d_left = abs(_emp_cdf_left(u) - _null_left(u))
        if d_right > ks:
            ks = d_right
        if d_left > ks:
            ks = d_left
    return float(ks)
