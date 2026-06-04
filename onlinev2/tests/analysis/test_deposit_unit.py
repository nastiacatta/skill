"""Unit tests for deposit interaction analysis module.

Tests specific examples and edge cases:
- Single-policy warning
- Empty input returns error dict
- Known inputs produce expected results
"""

from __future__ import annotations

import json
import math
import os
import tempfile

import numpy as np
import pytest

from onlinev2.analysis.deposit_interaction import (
    InteractionAnalysis,
    analyse_deposit_interaction,
    write_interaction_analysis,
)
from onlinev2.analysis.stats import compute_ci, compute_se


class TestSinglePolicyWarning:
    """Requirement 7.4 – single policy returns partial result with warning."""

    def test_single_policy_returns_warning(self) -> None:
        rows = [
            {"method": "blended", "seed": 0, "mean_crps": 0.5, "delta_crps_vs_equal": -0.1},
            {"method": "blended", "seed": 1, "mean_crps": 0.6, "delta_crps_vs_equal": -0.2},
        ]
        result = analyse_deposit_interaction({"fixed": rows})
        assert isinstance(result, InteractionAnalysis)
        assert result.warning is not None
        assert "2 policies" in result.warning
        assert math.isnan(result.interaction_effect)

    def test_single_policy_has_per_policy_stats(self) -> None:
        rows = [
            {"method": "blended", "seed": 0, "mean_crps": 0.5, "delta_crps_vs_equal": -0.1},
            {"method": "blended", "seed": 1, "mean_crps": 0.6, "delta_crps_vs_equal": -0.2},
        ]
        result = analyse_deposit_interaction({"fixed": rows})
        assert isinstance(result, InteractionAnalysis)
        assert len(result.per_policy) > 0
        assert result.per_policy[0].deposit_policy == "fixed"


class TestEmptyInput:
    """Empty input returns error dict."""

    def test_empty_dict_returns_error(self) -> None:
        result = analyse_deposit_interaction({})
        assert isinstance(result, dict)
        assert "error" in result
        assert result["error"] == "empty_input"


class TestKnownInputs:
    """Known inputs produce expected results."""

    def test_two_policies_known_values(self) -> None:
        # Fixed policy: blended deltas = [-0.2, -0.2, -0.2] → mean = -0.2
        # Bankroll policy: blended deltas = [-0.1, -0.1, -0.1] → mean = -0.1
        # Interaction = (-0.2) - (-0.1) = -0.1
        fixed_rows = [
            {"method": "blended", "seed": i, "mean_crps": 0.5, "delta_crps_vs_equal": -0.2}
            for i in range(3)
        ]
        bankroll_rows = [
            {"method": "blended", "seed": i, "mean_crps": 0.6, "delta_crps_vs_equal": -0.1}
            for i in range(3)
        ]
        result = analyse_deposit_interaction({
            "fixed": fixed_rows,
            "bankroll": bankroll_rows,
        })
        assert isinstance(result, InteractionAnalysis)
        assert result.warning is None
        np.testing.assert_allclose(result.interaction_effect, -0.1, atol=1e-10)
        # SE: both have se=0 (all identical), so interaction_se = 0
        np.testing.assert_allclose(result.interaction_se, 0.0, atol=1e-10)

    def test_interpretation_generated(self) -> None:
        fixed_rows = [
            {"method": "blended", "seed": i, "mean_crps": 0.5, "delta_crps_vs_equal": -0.2}
            for i in range(5)
        ]
        bankroll_rows = [
            {"method": "blended", "seed": i, "mean_crps": 0.6, "delta_crps_vs_equal": -0.1}
            for i in range(5)
        ]
        result = analyse_deposit_interaction({
            "fixed": fixed_rows,
            "bankroll": bankroll_rows,
        })
        assert isinstance(result, InteractionAnalysis)
        assert len(result.interpretation) > 0
        assert "ΔCRPS" in result.interpretation

    def test_multiple_methods_per_policy(self) -> None:
        fixed_rows = [
            {"method": "blended", "seed": 0, "mean_crps": 0.5, "delta_crps_vs_equal": -0.2},
            {"method": "stake_only", "seed": 0, "mean_crps": 0.7, "delta_crps_vs_equal": -0.05},
            {"method": "blended", "seed": 1, "mean_crps": 0.4, "delta_crps_vs_equal": -0.3},
            {"method": "stake_only", "seed": 1, "mean_crps": 0.6, "delta_crps_vs_equal": -0.08},
        ]
        bankroll_rows = [
            {"method": "blended", "seed": 0, "mean_crps": 0.6, "delta_crps_vs_equal": -0.1},
            {"method": "stake_only", "seed": 0, "mean_crps": 0.8, "delta_crps_vs_equal": -0.02},
            {"method": "blended", "seed": 1, "mean_crps": 0.5, "delta_crps_vs_equal": -0.15},
            {"method": "stake_only", "seed": 1, "mean_crps": 0.7, "delta_crps_vs_equal": -0.03},
        ]
        result = analyse_deposit_interaction({
            "fixed": fixed_rows,
            "bankroll": bankroll_rows,
        })
        assert isinstance(result, InteractionAnalysis)
        # Should have 4 per-policy entries: 2 policies × 2 methods
        assert len(result.per_policy) == 4


class TestWriteInteractionAnalysis:
    """Test JSON serialisation."""

    def test_write_and_read(self) -> None:
        analysis = InteractionAnalysis(
            per_policy=[],
            interaction_effect=-0.1,
            interaction_se=0.02,
            interaction_ci_low=-0.14,
            interaction_ci_high=-0.06,
            interpretation="Test interpretation.",
        )
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            out_path = tmp.name

        try:
            write_interaction_analysis(analysis, out_path)
            with open(out_path) as f:
                loaded = json.load(f)
            assert loaded["interaction_effect"] == pytest.approx(-0.1)
            assert loaded["interpretation"] == "Test interpretation."
            assert loaded["warning"] is None
        finally:
            os.unlink(out_path)

    def test_nan_sanitised(self) -> None:
        analysis = InteractionAnalysis(
            per_policy=[],
            interaction_effect=float("nan"),
            interaction_se=float("nan"),
            interaction_ci_low=float("nan"),
            interaction_ci_high=float("nan"),
            interpretation="Partial result.",
            warning="test warning",
        )
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            out_path = tmp.name

        try:
            write_interaction_analysis(analysis, out_path)
            with open(out_path) as f:
                loaded = json.load(f)
            assert loaded["interaction_effect"] is None
            assert loaded["interaction_se"] is None
        finally:
            os.unlink(out_path)
