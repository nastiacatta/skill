"""Unit tests for ablation interpretation module.

Requirements: 1.6, 1.7
"""

from __future__ import annotations

import csv
import json
import os
import tempfile

import pytest

from onlinev2.analysis.ablation_interpret import (
    STEP_COMPLEXITY,
    STEP_LABELS,
    AblationInterpretation,
    interpret_ablation,
    write_interpretation,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _write_csv(path: str, rows: list[dict]) -> None:
    """Write ablation CSV rows to *path*."""
    fieldnames = ["variant", "seed", "mean_crps"]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


# ---------------------------------------------------------------------------
# Complexity level mapping
# ---------------------------------------------------------------------------


class TestComplexityMapping:
    """Test that complexity levels match the spec (Req 1.6)."""

    def test_a_minus_is_low(self) -> None:
        assert STEP_COMPLEXITY["A-"] == "low"

    def test_b_minus_is_medium(self) -> None:
        assert STEP_COMPLEXITY["B-"] == "medium"

    def test_c_minus_is_high(self) -> None:
        assert STEP_COMPLEXITY["C-"] == "high"

    def test_d_minus_is_medium(self) -> None:
        assert STEP_COMPLEXITY["D-"] == "medium"

    def test_e_minus_is_low(self) -> None:
        assert STEP_COMPLEXITY["E-"] == "low"

    def test_label_mapping(self) -> None:
        assert STEP_LABELS["A-"] == "Confidence proxy"
        assert STEP_LABELS["B-"] == "Deposit"
        assert STEP_LABELS["C-"] == "Skill gate"
        assert STEP_LABELS["D-"] == "Weight cap"
        assert STEP_LABELS["E-"] == "Wealth update"


# ---------------------------------------------------------------------------
# Error cases (Req 1.7)
# ---------------------------------------------------------------------------


class TestErrorCases:
    """Test that error conditions return error dicts, not exceptions."""

    def test_missing_csv_returns_error_dict(self) -> None:
        result = interpret_ablation("/nonexistent/path/ablation.csv")
        assert isinstance(result, dict)
        assert "error" in result
        assert "detail" in result

    def test_empty_csv_returns_error_dict(self) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["variant", "seed", "mean_crps"])
            writer.writeheader()
            path = f.name

        try:
            result = interpret_ablation(path)
            assert isinstance(result, dict)
            assert "error" in result
        finally:
            os.unlink(path)

    def test_single_variant_returns_error_dict(self) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            path = f.name

        _write_csv(path, [{"variant": "Full", "seed": "0", "mean_crps": "0.5"}])

        try:
            result = interpret_ablation(path)
            assert isinstance(result, dict)
            assert "error" in result
        finally:
            os.unlink(path)

    def test_missing_full_variant_returns_error_dict(self) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            path = f.name

        _write_csv(
            path,
            [
                {"variant": "A-", "seed": "0", "mean_crps": "0.5"},
                {"variant": "B-", "seed": "0", "mean_crps": "0.6"},
            ],
        )

        try:
            result = interpret_ablation(path)
            assert isinstance(result, dict)
            assert "error" in result
            assert "Full" in result.get("detail", "")
        finally:
            os.unlink(path)


# ---------------------------------------------------------------------------
# Known ablation CSV produces expected interpretation
# ---------------------------------------------------------------------------


class TestKnownAblation:
    """Test a known ablation CSV produces the expected interpretation."""

    def test_known_csv(self) -> None:
        """Full=0.5 across 3 seeds, C-=0.6 (big contribution), A-=0.501 (negligible)."""
        rows = [
            # Full: mean = 0.5
            {"variant": "Full", "seed": "0", "mean_crps": "0.5"},
            {"variant": "Full", "seed": "1", "mean_crps": "0.5"},
            {"variant": "Full", "seed": "2", "mean_crps": "0.5"},
            # C-: mean = 0.6, contribution = 0.1
            {"variant": "C-", "seed": "0", "mean_crps": "0.6"},
            {"variant": "C-", "seed": "1", "mean_crps": "0.6"},
            {"variant": "C-", "seed": "2", "mean_crps": "0.6"},
            # A-: mean = 0.501, contribution = 0.001 (< 0.01 * 0.5 = 0.005 → negligible)
            {"variant": "A-", "seed": "0", "mean_crps": "0.501"},
            {"variant": "A-", "seed": "1", "mean_crps": "0.501"},
            {"variant": "A-", "seed": "2", "mean_crps": "0.501"},
        ]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            path = f.name

        _write_csv(path, rows)

        try:
            result = interpret_ablation(path)
            assert isinstance(result, AblationInterpretation)

            # Two steps
            assert len(result.steps) == 2

            # C- should be dominant (|0.1| > |0.001|)
            assert result.dominant_step == "C-"
            assert result.steps[0].variant == "C-"
            assert abs(result.steps[0].delta_crps_contribution - 0.1) < 1e-10
            assert result.steps[0].is_negligible is False
            assert result.steps[0].complexity_level == "high"
            assert result.steps[0].label == "Skill gate"

            # A- should be negligible
            assert result.steps[1].variant == "A-"
            assert abs(result.steps[1].delta_crps_contribution - 0.001) < 1e-10
            assert result.steps[1].is_negligible is True
            assert result.steps[1].complexity_level == "low"
            assert result.steps[1].label == "Confidence proxy"

            # Skill gate is NOT negligible, so no threat
            assert result.skill_gate_threat is False

            # Conclusion mentions the dominant step
            assert "skill gate" in result.conclusion.lower()
        finally:
            os.unlink(path)

    def test_skill_gate_threat_when_c_negligible(self) -> None:
        """When C- contribution is negligible, skill_gate_threat should be True."""
        rows = [
            {"variant": "Full", "seed": "0", "mean_crps": "0.5"},
            {"variant": "Full", "seed": "1", "mean_crps": "0.5"},
            # C-: mean = 0.5001, contribution = 0.0001 (< 0.005 → negligible)
            {"variant": "C-", "seed": "0", "mean_crps": "0.5001"},
            {"variant": "C-", "seed": "1", "mean_crps": "0.5001"},
        ]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            path = f.name

        _write_csv(path, rows)

        try:
            result = interpret_ablation(path)
            assert isinstance(result, AblationInterpretation)
            assert result.skill_gate_threat is True
        finally:
            os.unlink(path)

    def test_write_interpretation_produces_valid_json(self) -> None:
        """write_interpretation should produce parseable JSON."""
        rows = [
            {"variant": "Full", "seed": "0", "mean_crps": "0.5"},
            {"variant": "B-", "seed": "0", "mean_crps": "0.7"},
        ]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            csv_path = f.name

        _write_csv(csv_path, rows)

        try:
            result = interpret_ablation(csv_path)
            assert isinstance(result, AblationInterpretation)

            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            ) as jf:
                json_path = jf.name

            write_interpretation(result, json_path)

            with open(json_path) as f:
                loaded = json.load(f)

            assert "steps" in loaded
            assert "dominant_step" in loaded
            assert loaded["dominant_step"] == "B-"

            os.unlink(json_path)
        finally:
            os.unlink(csv_path)
