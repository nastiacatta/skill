"""Property tests for ablation interpretation module.

Uses Hypothesis to verify correctness properties across random inputs.

Properties tested:
- Property 1: Ablation contribution computation (Req 1.1)
- Property 2: Ablation classification correctness (Req 1.2, 1.3, 1.4)
- Property 3: Ablation JSON round-trip (Req 1.8, 12.2)
"""

from __future__ import annotations

import csv
import json
import os
import tempfile

from hypothesis import given, settings
from hypothesis import strategies as st

from onlinev2.analysis.ablation_interpret import (
    AblationInterpretation,
    AblationStep,
    interpret_ablation,
    write_interpretation,
)

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# All possible non-Full variants
_ALL_VARIANTS = ["A-", "B-", "C-", "D-", "E-"]


@st.composite
def ablation_csv_data(draw: st.DrawFn) -> tuple[str, dict[str, list[float]]]:
    """Generate a temporary ablation CSV and return (path, variant->crps_list).

    Always includes "Full" plus 1–5 additional variants, each with 1–50 seeds.
    CRPS values are in [0, 2].
    """
    n_extra = draw(st.integers(min_value=1, max_value=5))
    extra_variants = draw(
        st.lists(
            st.sampled_from(_ALL_VARIANTS),
            min_size=n_extra,
            max_size=n_extra,
            unique=True,
        )
    )
    variants = ["Full"] + extra_variants
    n_seeds = draw(st.integers(min_value=1, max_value=50))

    # Generate CRPS values per (variant, seed)
    variant_crps: dict[str, list[float]] = {}
    rows: list[dict[str, str]] = []
    for variant in variants:
        crps_values: list[float] = []
        for seed in range(n_seeds):
            crps = draw(
                st.floats(min_value=0.0, max_value=2.0, allow_nan=False, allow_infinity=False)
            )
            crps_values.append(crps)
            rows.append({"variant": variant, "seed": str(seed), "mean_crps": str(crps)})
        variant_crps[variant] = crps_values

    # Write to temp CSV
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="")
    writer = csv.DictWriter(tmp, fieldnames=["variant", "seed", "mean_crps"])
    writer.writeheader()
    writer.writerows(rows)
    tmp.close()

    return tmp.name, variant_crps


# ---------------------------------------------------------------------------
# Property 1: Ablation contribution computation
# ---------------------------------------------------------------------------


class TestAblationContribution:
    """Property 1 – deltaCrpsContribution equals independently computed mean difference.

    **Validates: Requirements 1.1**
    """

    @given(data=ablation_csv_data())
    @settings(max_examples=100)
    def test_contribution_equals_mean_difference(
        self, data: tuple[str, dict[str, list[float]]]
    ) -> None:
        csv_path, variant_crps = data
        try:
            result = interpret_ablation(csv_path)
            assert isinstance(result, AblationInterpretation)

            full_mean = sum(variant_crps["Full"]) / len(variant_crps["Full"])

            for step in result.steps:
                variant_values = variant_crps[step.variant]
                variant_mean = sum(variant_values) / len(variant_values)
                expected = variant_mean - full_mean
                assert abs(step.delta_crps_contribution - expected) < 1e-10, (
                    f"Variant {step.variant}: got {step.delta_crps_contribution}, "
                    f"expected {expected}"
                )
        finally:
            os.unlink(csv_path)


# ---------------------------------------------------------------------------
# Property 2: Ablation classification correctness
# ---------------------------------------------------------------------------


class TestAblationClassification:
    """Property 2 – sorting, negligible flag, and skill gate threat are correct.

    **Validates: Requirements 1.2, 1.3, 1.4**
    """

    @given(data=ablation_csv_data())
    @settings(max_examples=100)
    def test_steps_sorted_descending_abs_contribution(
        self, data: tuple[str, dict[str, list[float]]]
    ) -> None:
        csv_path, _ = data
        try:
            result = interpret_ablation(csv_path)
            assert isinstance(result, AblationInterpretation)

            abs_contributions = [abs(s.delta_crps_contribution) for s in result.steps]
            assert abs_contributions == sorted(abs_contributions, reverse=True)
        finally:
            os.unlink(csv_path)

    @given(data=ablation_csv_data())
    @settings(max_examples=100)
    def test_negligible_flag_correct(
        self, data: tuple[str, dict[str, list[float]]]
    ) -> None:
        csv_path, variant_crps = data
        try:
            result = interpret_ablation(csv_path)
            assert isinstance(result, AblationInterpretation)

            full_mean = sum(variant_crps["Full"]) / len(variant_crps["Full"])
            threshold = 0.01 * full_mean if full_mean != 0 else 0.0

            for step in result.steps:
                expected_negligible = abs(step.delta_crps_contribution) < threshold
                assert step.is_negligible == expected_negligible, (
                    f"Variant {step.variant}: is_negligible={step.is_negligible}, "
                    f"expected={expected_negligible}, |contrib|={abs(step.delta_crps_contribution)}, "
                    f"threshold={threshold}"
                )
        finally:
            os.unlink(csv_path)

    @given(data=ablation_csv_data())
    @settings(max_examples=100)
    def test_skill_gate_threat_correct(
        self, data: tuple[str, dict[str, list[float]]]
    ) -> None:
        csv_path, variant_crps = data
        try:
            result = interpret_ablation(csv_path)
            assert isinstance(result, AblationInterpretation)

            # Compute expected skill_gate_threat
            c_negligible = False
            if "C-" in variant_crps:
                full_mean = sum(variant_crps["Full"]) / len(variant_crps["Full"])
                c_values = variant_crps["C-"]
                c_mean = sum(c_values) / len(c_values)
                c_contribution = c_mean - full_mean
                threshold = 0.01 * full_mean if full_mean != 0 else 0.0
                c_negligible = abs(c_contribution) < threshold

            assert result.skill_gate_threat == c_negligible
        finally:
            os.unlink(csv_path)


# ---------------------------------------------------------------------------
# Property 3: Ablation JSON round-trip
# ---------------------------------------------------------------------------


class TestAblationRoundTrip:
    """Property 3 – interpret → serialise → deserialise produces equivalent object.

    **Validates: Requirements 1.8, 12.2**
    """

    @given(data=ablation_csv_data())
    @settings(max_examples=100)
    def test_json_round_trip(
        self, data: tuple[str, dict[str, list[float]]]
    ) -> None:
        csv_path, _ = data
        try:
            result = interpret_ablation(csv_path)
            assert isinstance(result, AblationInterpretation)

            # Serialise to JSON via write_interpretation
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            ) as tmp:
                json_path = tmp.name

            write_interpretation(result, json_path)

            # Deserialise
            with open(json_path) as f:
                loaded = json.load(f)

            # Verify structure
            assert "steps" in loaded
            assert "dominant_step" in loaded
            assert "conclusion" in loaded
            assert "skill_gate_threat" in loaded

            assert len(loaded["steps"]) == len(result.steps)
            assert loaded["dominant_step"] == result.dominant_step
            assert loaded["conclusion"] == result.conclusion
            assert loaded["skill_gate_threat"] == result.skill_gate_threat

            for orig, rt in zip(result.steps, loaded["steps"]):
                assert rt["variant"] == orig.variant
                assert rt["label"] == orig.label
                assert abs(rt["delta_crps_contribution"] - orig.delta_crps_contribution) < 1e-10
                assert rt["is_negligible"] == orig.is_negligible
                assert rt["complexity_level"] == orig.complexity_level

            os.unlink(json_path)
        finally:
            os.unlink(csv_path)
