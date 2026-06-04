"""Unit tests for panel sweep analysis module.

Tests specific examples and edge cases:
- No reliable N case (all CIs cross zero → None)
- Known inputs produce expected results
"""

from __future__ import annotations

import json
import math
import os
import tempfile

import numpy as np
import pytest

from onlinev2.analysis.panel_sweep import (
    PanelSweepResult,
    compute_panel_sweep,
    write_panel_sweep,
)


class TestNoReliableN:
    """Requirement 9.5 – no reliable N when all CIs cross zero."""

    def test_all_cis_cross_zero(self) -> None:
        """When all panel sizes have CIs crossing zero, minimum_reliable_n is None."""
        # Use deltas that span both positive and negative → CI crosses zero
        results_by_n = {
            3: [
                {"method": "blended", "seed": i, "mean_crps": 0.5, "delta_crps_vs_equal": d}
                for i, d in enumerate([0.1, -0.1, 0.05, -0.05, 0.02])
            ],
            6: [
                {"method": "blended", "seed": i, "mean_crps": 0.5, "delta_crps_vs_equal": d}
                for i, d in enumerate([0.08, -0.12, 0.03, -0.07, 0.01])
            ],
            10: [
                {"method": "blended", "seed": i, "mean_crps": 0.5, "delta_crps_vs_equal": d}
                for i, d in enumerate([0.05, -0.05, 0.02, -0.02, 0.01])
            ],
        }
        result = compute_panel_sweep(results_by_n)
        assert isinstance(result, PanelSweepResult)
        assert result.minimum_reliable_n is None

    def test_positive_deltas_no_reliable_n(self) -> None:
        """When all deltas are positive, CI is entirely > 0, so no reliable N."""
        results_by_n = {
            3: [
                {"method": "blended", "seed": i, "mean_crps": 0.5, "delta_crps_vs_equal": 0.1}
                for i in range(10)
            ],
        }
        result = compute_panel_sweep(results_by_n)
        assert result.minimum_reliable_n is None


class TestKnownInputs:
    """Known inputs produce expected results."""

    def test_single_panel_size(self) -> None:
        """Single panel size with known deltas."""
        deltas = [-0.2, -0.3, -0.1, -0.25, -0.15]
        results_by_n = {
            6: [
                {"method": "blended", "seed": i, "mean_crps": 0.5, "delta_crps_vs_equal": d}
                for i, d in enumerate(deltas)
            ],
        }
        result = compute_panel_sweep(results_by_n)
        assert len(result.results) == 1
        psr = result.results[0]
        assert psr.n == 6

        arr = np.array(deltas, dtype=np.float64)
        expected_mean = float(np.mean(arr))
        np.testing.assert_allclose(psr.mean_delta_crps, expected_mean, atol=1e-10)

    def test_reliable_n_found(self) -> None:
        """When one panel size has CI entirely < 0, it is identified."""
        # N=3: mixed → CI crosses zero
        # N=10: all strongly negative → CI entirely < 0
        results_by_n = {
            3: [
                {"method": "blended", "seed": i, "mean_crps": 0.5, "delta_crps_vs_equal": d}
                for i, d in enumerate([0.1, -0.1, 0.05, -0.05, 0.02])
            ],
            10: [
                {"method": "blended", "seed": i, "mean_crps": 0.5, "delta_crps_vs_equal": -0.5}
                for i in range(20)
            ],
        }
        result = compute_panel_sweep(results_by_n)
        assert result.minimum_reliable_n == 10

    def test_results_sorted_by_n(self) -> None:
        """Results are sorted by panel size N."""
        results_by_n = {
            20: [
                {"method": "blended", "seed": 0, "mean_crps": 0.5, "delta_crps_vs_equal": -0.1}
                for _ in range(5)
            ],
            3: [
                {"method": "blended", "seed": 0, "mean_crps": 0.5, "delta_crps_vs_equal": -0.05}
                for _ in range(5)
            ],
            10: [
                {"method": "blended", "seed": 0, "mean_crps": 0.5, "delta_crps_vs_equal": -0.08}
                for _ in range(5)
            ],
        }
        result = compute_panel_sweep(results_by_n)
        ns = [r.n for r in result.results]
        assert ns == sorted(ns)

    def test_non_blended_rows_ignored(self) -> None:
        """Only blended method rows are used for panel sweep."""
        results_by_n = {
            6: [
                {"method": "blended", "seed": 0, "mean_crps": 0.5, "delta_crps_vs_equal": -0.2},
                {"method": "stake_only", "seed": 0, "mean_crps": 0.7, "delta_crps_vs_equal": 0.5},
                {"method": "blended", "seed": 1, "mean_crps": 0.4, "delta_crps_vs_equal": -0.3},
            ],
        }
        result = compute_panel_sweep(results_by_n)
        psr = result.results[0]
        # Only blended deltas: [-0.2, -0.3]
        np.testing.assert_allclose(psr.mean_delta_crps, -0.25, atol=1e-10)


class TestWritePanelSweep:
    """Test JSON serialisation."""

    def test_write_and_read(self) -> None:
        sweep = PanelSweepResult(results=[], minimum_reliable_n=6)
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            out_path = tmp.name

        try:
            write_panel_sweep(sweep, out_path)
            with open(out_path) as f:
                loaded = json.load(f)
            assert loaded["minimum_reliable_n"] == 6
            assert loaded["results"] == []
        finally:
            os.unlink(out_path)

    def test_nan_sanitised(self) -> None:
        from onlinev2.analysis.panel_sweep import PanelSizeResult

        sweep = PanelSweepResult(
            results=[
                PanelSizeResult(
                    n=3,
                    mean_delta_crps=float("nan"),
                    se=float("nan"),
                    ci_low=float("nan"),
                    ci_high=float("nan"),
                )
            ],
            minimum_reliable_n=None,
        )
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            out_path = tmp.name

        try:
            write_panel_sweep(sweep, out_path)
            with open(out_path) as f:
                loaded = json.load(f)
            assert loaded["results"][0]["mean_delta_crps"] is None
            assert loaded["minimum_reliable_n"] is None
        finally:
            os.unlink(out_path)
