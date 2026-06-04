"""Tests for the A3 recalibration tail-extrapolation fix.

Covers:
  1. ``compute_pit_extended`` produces values in ``[0, 1]`` and matches
     ``compute_pit`` strictly inside the reported fan.
  2. The linear tail extension is monotone increasing in ``y``.
  3. Under a calibrated forecast, extended-PIT is approximately
     ``Uniform(0, 1)`` (no atoms at the grid boundaries, unlike the
     truncated PIT).
  4. ``RollingRecalibrator(pit_mode="extended")`` — the post-A3 default —
     buffers PITs that span ``[0, 1]``, not ``[taus[0], taus[-1]]``.
  5. ``pit_mode="truncated"`` reproduces the pre-A3 behaviour exactly.
"""
from __future__ import annotations

import numpy as np
import pytest

from onlinev2.core.metrics import compute_pit, compute_pit_extended
from onlinev2.core.recalibration import RollingRecalibrator


TAUS = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])


def _normal_quantile_fan(mu: float = 0.5, sigma: float = 0.1) -> np.ndarray:
    from scipy.stats import norm
    return mu + sigma * norm.ppf(TAUS)


class TestComputePITExtended:
    """compute_pit_extended: untruncated PIT by linear tail extension."""

    def test_interior_matches_truncated(self):
        """Inside the reported fan both functions agree bitwise."""
        q = _normal_quantile_fan()
        rng = np.random.default_rng(0)
        # Only points strictly inside the reported fan
        ys = np.clip(rng.uniform(q[0] + 1e-6, q[-1] - 1e-6, size=200), q[0], q[-1])
        for y in ys:
            assert compute_pit(float(y), q, TAUS) == pytest.approx(
                compute_pit_extended(float(y), q, TAUS), abs=1e-12
            )

    def test_boundary_values(self):
        """Support boundaries map to {0, 1}."""
        q = _normal_quantile_fan()
        assert compute_pit_extended(0.0, q, TAUS) == pytest.approx(0.0, abs=1e-12)
        assert compute_pit_extended(1.0, q, TAUS) == pytest.approx(1.0, abs=1e-12)

    def test_in_range(self):
        """Output is always in [0, 1] for y in [support_lo, support_hi]."""
        q = _normal_quantile_fan()
        rng = np.random.default_rng(1)
        for y in rng.uniform(0.0, 1.0, size=200):
            pit = compute_pit_extended(float(y), q, TAUS)
            assert 0.0 <= pit <= 1.0

    def test_monotone_in_y(self):
        """extended PIT is monotone non-decreasing in y."""
        q = _normal_quantile_fan()
        ys = np.linspace(0.0, 1.0, 201)
        pits = np.array([compute_pit_extended(float(y), q, TAUS) for y in ys])
        diffs = np.diff(pits)
        # Allow microscopic float noise around plateaus
        assert np.all(diffs >= -1e-12)

    def test_tail_extension_is_linear(self):
        """Linear extension: in the lower tail, PIT == y * taus[0] / q[0]."""
        q = _normal_quantile_fan(mu=0.5, sigma=0.1)
        # Mid-tail point
        y = 0.5 * q[0]  # halfway between support_lo=0 and q[0]
        expected = y * TAUS[0] / q[0]  # linear between (0, 0) and (q[0], taus[0])
        assert compute_pit_extended(y, q, TAUS) == pytest.approx(expected, abs=1e-10)

    def test_calibrated_forecast_is_uniform(self):
        """Under a calibrated Gaussian forecast, extended-PIT ≈ Uniform(0, 1).

        The truncated PIT has atoms at taus[0] and taus[-1]; the extended
        PIT replaces those atoms with uniform mass in the tails, so under
        calibration the extended distribution is uniform on [0, 1].
        """
        from scipy.stats import norm
        rng = np.random.default_rng(42)
        N = 5000
        true_sigma = 0.12
        ys = rng.normal(0.5, true_sigma, size=N)
        ys = np.clip(ys, 0.0, 1.0)
        # Perfectly-calibrated quantile fan for the same distribution
        q_fan = np.array(
            [np.clip(0.5 + true_sigma * norm.ppf(tau), 0.0, 1.0) for tau in TAUS]
        )
        pits_ext = np.array(
            [compute_pit_extended(float(y), q_fan, TAUS) for y in ys]
        )
        pits_trunc = np.array(
            [compute_pit(float(y), q_fan, TAUS) for y in ys]
        )
        # Extended: mean ≈ 0.5, spread across [0, 1]
        # Truncated: atoms at 0.1 and 0.9 — fraction at either extreme is
        # noticeably larger than the extended-PIT fraction at those values.
        frac_at_boundary_trunc = float(
            np.mean((pits_trunc == TAUS[0]) | (pits_trunc == TAUS[-1]))
        )
        # ~taus[0] + (1 - taus[-1]) = 0.2 mass at boundaries under calibration.
        assert frac_at_boundary_trunc > 0.15
        # Extended: no atoms (every y gets a unique PIT in [0, 1]).
        # The only way PIT == taus[0] or taus[-1] under extended is if
        # y falls exactly on q[0] or q[-1]; that's measure zero in practice.
        frac_at_boundary_ext = float(
            np.mean((pits_ext == TAUS[0]) | (pits_ext == TAUS[-1]))
        )
        assert frac_at_boundary_ext < 0.02
        # Extended PITs span [0, 1] densely.
        assert float(np.quantile(pits_ext, 0.01)) < TAUS[0]
        assert float(np.quantile(pits_ext, 0.99)) > TAUS[-1]


class TestRollingRecalibratorPITMode:
    """RollingRecalibrator picks the correct PIT variant based on pit_mode."""

    def test_default_is_extended(self):
        """Post-A3 default is extended."""
        rc = RollingRecalibrator(TAUS)
        assert rc.pit_mode == "extended"

    def test_truncated_mode_reproduces_legacy(self):
        """pit_mode='truncated' stores the same PITs the pre-A3 code did."""
        rc_trunc = RollingRecalibrator(TAUS, pit_mode="truncated")
        q = _normal_quantile_fan()
        rc_trunc.update(q, 0.0)  # Well below q[0] — atom at taus[0]
        rc_trunc.update(q, 1.0)  # Well above q[-1] — atom at taus[-1]
        pits = rc_trunc._compute_pit_buffer()
        assert pits[0] == pytest.approx(TAUS[0])
        assert pits[1] == pytest.approx(TAUS[-1])

    def test_extended_mode_spreads_tails(self):
        """pit_mode='extended' maps y=0 to 0 and y=1 to 1 (not to taus)."""
        rc_ext = RollingRecalibrator(TAUS, pit_mode="extended")
        q = _normal_quantile_fan()
        rc_ext.update(q, 0.0)
        rc_ext.update(q, 1.0)
        pits = rc_ext._compute_pit_buffer()
        assert pits[0] == pytest.approx(0.0, abs=1e-12)
        assert pits[1] == pytest.approx(1.0, abs=1e-12)

    def test_invalid_pit_mode_raises(self):
        with pytest.raises(ValueError, match="pit_mode"):
            RollingRecalibrator(TAUS, pit_mode="bogus")

    def test_invalid_support_raises(self):
        with pytest.raises(ValueError, match="pit_support"):
            RollingRecalibrator(TAUS, pit_support_lo=1.0, pit_support_hi=0.0)

    def test_extended_transform_preserves_identity_when_unfitted(self):
        """Unfitted extended recalibrator still returns the input unchanged."""
        rc = RollingRecalibrator(TAUS, pit_mode="extended")
        q = _normal_quantile_fan()
        out = rc.transform(q)
        np.testing.assert_allclose(out, q, atol=1e-12)


class TestExtendedPITImprovesTailRecalibration:
    """Sanity check: under a biased forecast the extended-PIT buffer has
    data in the tails that the truncated-PIT buffer lacks."""

    def test_tails_populated_under_bias(self):
        """A forecast that systematically under-estimates high y produces
        extended PITs in the upper tail; truncated PITs stack at taus[-1]."""
        rng = np.random.default_rng(123)
        N = 600
        # Forecast is N(0.45, 0.08); truth is N(0.55, 0.08) — right-shifted.
        from scipy.stats import norm
        ys = np.clip(rng.normal(0.55, 0.08, size=N), 0.0, 1.0)
        q_fan = np.clip(0.45 + 0.08 * norm.ppf(TAUS), 0.0, 1.0)

        rc_ext = RollingRecalibrator(TAUS, window_size=N, min_pits=50, pit_mode="extended")
        rc_trunc = RollingRecalibrator(TAUS, window_size=N, min_pits=50, pit_mode="truncated")
        for y in ys:
            rc_ext.update(q_fan, float(y))
            rc_trunc.update(q_fan, float(y))

        pits_ext = rc_ext._compute_pit_buffer()
        pits_trunc = rc_trunc._compute_pit_buffer()

        # Truncated buffer: large atom at taus[-1]=0.9
        atom_trunc = float(np.mean(pits_trunc == TAUS[-1]))
        # Extended buffer: no large atom; tail mass is spread into (0.9, 1.0)
        atom_ext = float(np.mean(pits_ext == TAUS[-1]))
        tail_mass_ext = float(np.mean(pits_ext > TAUS[-1]))

        assert atom_trunc > 0.15
        assert atom_ext < 0.02
        assert tail_mass_ext > 0.15  # same information lives above 0.9 now
