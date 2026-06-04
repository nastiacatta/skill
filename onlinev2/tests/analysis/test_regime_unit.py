"""Unit tests for regime breakdown module.

Requirements: 3.5, 3.6
"""

from __future__ import annotations

import json
import os
import tempfile

import numpy as np
import pytest

from onlinev2.analysis.regime_breakdown import (
    RegimeStats,
    compute_regime_breakdown,
    write_regime_breakdown,
)
from onlinev2.analysis.stats import compute_ci, compute_se

# ---------------------------------------------------------------------------
# Low sample size warning (Req 3.5)
# ---------------------------------------------------------------------------


class TestLowSampleSizeWarning:
    """Test that regimes with < 10 rounds get a warning."""

    def test_small_T_produces_warning(self) -> None:
        """With T=20, early regime has floor(0.2*20)=4 rounds → warning."""
        T = 20
        crps_method = np.random.default_rng(42).uniform(0, 1, size=T)
        crps_baseline = np.random.default_rng(43).uniform(0, 1, size=T)
        y = np.random.default_rng(44).uniform(0, 1, size=T)

        result = compute_regime_breakdown(crps_method, crps_baseline, y)
        assert isinstance(result, list)

        # Early regime should have 4 rounds
        early = [r for r in result if "Early" in r.regime_name]
        assert len(early) == 1
        assert early[0].n_rounds == 4
        assert early[0].warning is not None
        assert "low sample size" in early[0].warning
        assert "n=4" in early[0].warning

    def test_large_T_no_warning(self) -> None:
        """With T=100, early regime has floor(0.2*100)=20 rounds → no warning."""
        T = 100
        crps_method = np.random.default_rng(42).uniform(0, 1, size=T)
        crps_baseline = np.random.default_rng(43).uniform(0, 1, size=T)
        y = np.random.default_rng(44).uniform(0, 1, size=T)

        result = compute_regime_breakdown(crps_method, crps_baseline, y)
        assert isinstance(result, list)

        early = [r for r in result if "Early" in r.regime_name]
        assert len(early) == 1
        assert early[0].n_rounds == 20
        assert early[0].warning is None


# ---------------------------------------------------------------------------
# Basic regime breakdown with known inputs
# ---------------------------------------------------------------------------


class TestKnownInputs:
    """Test regime breakdown with known, deterministic inputs."""

    def test_basic_breakdown(self) -> None:
        """Verify regime breakdown produces expected regimes."""
        T = 100
        rng = np.random.default_rng(42)
        crps_method = rng.uniform(0, 1, size=T)
        crps_baseline = rng.uniform(0, 1, size=T)
        y = rng.uniform(0, 1, size=T)

        result = compute_regime_breakdown(crps_method, crps_baseline, y)
        assert isinstance(result, list)
        assert len(result) >= 4  # early, late, high-vol, low-vol

        regime_names = [r.regime_name for r in result]
        assert any("Early" in n for n in regime_names)
        assert any("Late" in n for n in regime_names)
        assert any("High-volatility" in n for n in regime_names)
        assert any("Low-volatility" in n for n in regime_names)

    def test_constant_delta_produces_zero_se(self) -> None:
        """When method and baseline differ by a constant, SE should be 0."""
        T = 100
        crps_baseline = np.ones(T) * 0.5
        crps_method = np.ones(T) * 0.3  # constant delta = -0.2
        y = np.linspace(0, 1, T)

        result = compute_regime_breakdown(crps_method, crps_baseline, y)
        assert isinstance(result, list)

        for regime in result:
            if regime.n_rounds > 1:
                assert abs(regime.mean_delta_crps - (-0.2)) < 1e-10
                assert abs(regime.se) < 1e-10

    def test_perturbation_regimes_with_sigma_hist(self) -> None:
        """When sigma_hist is provided, pre/post perturbation regimes appear."""
        T = 100
        rng = np.random.default_rng(42)
        crps_method = rng.uniform(0, 1, size=T)
        crps_baseline = rng.uniform(0, 1, size=T)
        y = rng.uniform(0, 1, size=T)

        # Create sigma_hist with a clear drop at round 50
        sigma_hist = np.ones((T, 3)) * 0.8
        sigma_hist[50:, :] = 0.3  # big drop at round 50

        result = compute_regime_breakdown(
            crps_method, crps_baseline, y, sigma_hist=sigma_hist
        )
        assert isinstance(result, list)

        regime_names = [r.regime_name for r in result]
        assert any("Pre-perturbation" in n for n in regime_names)
        assert any("Post-perturbation" in n for n in regime_names)


# ---------------------------------------------------------------------------
# Multi-seed pooling
# ---------------------------------------------------------------------------


class TestMultiSeedPooling:
    """Test multi-seed aggregation produces correct results."""

    def test_multi_seed_pools_rounds(self) -> None:
        """With K seeds and T rounds, early regime should have K * floor(0.2*T) rounds."""
        K = 3
        T = 100
        rng = np.random.default_rng(42)
        crps_method = rng.uniform(0, 1, size=(K, T))
        crps_baseline = rng.uniform(0, 1, size=(K, T))
        y = rng.uniform(0, 1, size=(K, T))

        result = compute_regime_breakdown(crps_method, crps_baseline, y)
        assert isinstance(result, list)

        early = [r for r in result if "Early" in r.regime_name]
        assert len(early) == 1
        expected_n = K * int(np.floor(0.2 * T))
        assert early[0].n_rounds == expected_n

    def test_multi_seed_stats_match_manual(self) -> None:
        """Verify pooled stats match manual computation."""
        K = 2
        T = 50
        rng = np.random.default_rng(42)
        crps_method = rng.uniform(0, 1, size=(K, T))
        crps_baseline = rng.uniform(0, 1, size=(K, T))
        y = rng.uniform(0, 1, size=(K, T))

        result = compute_regime_breakdown(crps_method, crps_baseline, y)
        assert isinstance(result, list)

        delta = crps_method - crps_baseline
        n_regime = int(np.floor(0.2 * T))
        early_deltas = delta[:, :n_regime].ravel()

        early = [r for r in result if "Early" in r.regime_name][0]
        assert abs(early.mean_delta_crps - float(np.mean(early_deltas))) < 1e-10
        assert abs(early.se - compute_se(early_deltas)) < 1e-10


# ---------------------------------------------------------------------------
# Empty input returns error dict
# ---------------------------------------------------------------------------


class TestErrorCases:
    """Test error handling for invalid inputs."""

    def test_empty_arrays_return_error(self) -> None:
        result = compute_regime_breakdown(
            np.array([]), np.array([]), np.array([])
        )
        assert isinstance(result, dict)
        assert "error" in result

    def test_mismatched_shapes_return_error(self) -> None:
        result = compute_regime_breakdown(
            np.array([0.1, 0.2, 0.3]),
            np.array([0.1, 0.2]),
            np.array([0.5, 0.5, 0.5]),
        )
        assert isinstance(result, dict)
        assert "error" in result


# ---------------------------------------------------------------------------
# Write regime breakdown
# ---------------------------------------------------------------------------


class TestWriteRegimeBreakdown:
    """Test JSON serialisation."""

    def test_write_produces_valid_json(self) -> None:
        stats = [
            RegimeStats(
                regime_name="Early (first 20%)",
                n_rounds=20,
                mean_delta_crps=-0.05,
                se=0.01,
                ci_low=-0.0696,
                ci_high=-0.0304,
            ),
            RegimeStats(
                regime_name="Late (last 20%)",
                n_rounds=5,
                mean_delta_crps=-0.1,
                se=0.02,
                ci_low=-0.1392,
                ci_high=-0.0608,
                warning="low sample size (n=5)",
            ),
        ]

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json_path = f.name

        try:
            write_regime_breakdown(stats, json_path)
            with open(json_path) as f:
                loaded = json.load(f)

            assert isinstance(loaded, list)
            assert len(loaded) == 2
            assert loaded[0]["regime_name"] == "Early (first 20%)"
            assert loaded[1]["warning"] == "low sample size (n=5)"
        finally:
            os.unlink(json_path)

    def test_write_handles_nan(self) -> None:
        """NaN values should be replaced with null in JSON."""
        stats = [
            RegimeStats(
                regime_name="Empty",
                n_rounds=0,
                mean_delta_crps=float("nan"),
                se=float("nan"),
                ci_low=float("nan"),
                ci_high=float("nan"),
                warning="low sample size (n=0)",
            ),
        ]

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json_path = f.name

        try:
            write_regime_breakdown(stats, json_path)
            with open(json_path) as f:
                loaded = json.load(f)

            assert loaded[0]["mean_delta_crps"] is None
            assert loaded[0]["se"] is None
        finally:
            os.unlink(json_path)
