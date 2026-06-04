"""Property tests for cross-gap ΔCRPS and SE/CI consistency.

**Validates: Requirements 14.1, 14.2**

Property 10: Cross-gap ΔCRPS and SE/CI consistency
For any pair of CRPS arrays (method vs baseline), the shared stats module
SHALL compute correct ΔCRPS values, SE values, and CI bounds.
"""

from __future__ import annotations

import numpy as np
from hypothesis import given, settings
from hypothesis import strategies as st
from hypothesis.extra.numpy import arrays

from onlinev2.analysis.stats import compute_ci, compute_se, paired_delta_crps

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_crps_array = arrays(
    dtype=np.float64,
    shape=st.integers(min_value=2, max_value=50),
    elements=st.floats(min_value=0.0, max_value=2.0, allow_nan=False, allow_infinity=False),
)


# ---------------------------------------------------------------------------
# Property 10: Cross-gap ΔCRPS and SE/CI consistency
# ---------------------------------------------------------------------------


class TestCrossGapConsistency:
    """Property 10 – shared stats helpers produce correct, consistent results."""

    @given(method=_crps_array, data=st.data())
    @settings(max_examples=100)
    def test_delta_equals_difference(self, method: np.ndarray, data: st.DataObject) -> None:
        """**Validates: Requirements 14.1**

        paired_delta_crps(m, b) == m - b element-wise.
        """
        baseline = data.draw(
            arrays(
                dtype=np.float64,
                shape=method.shape[0],
                elements=st.floats(min_value=0.0, max_value=2.0, allow_nan=False, allow_infinity=False),
            )
        )
        deltas = paired_delta_crps(method, baseline)
        np.testing.assert_allclose(deltas, method - baseline, atol=1e-15)

    @given(method=_crps_array, data=st.data())
    @settings(max_examples=100)
    def test_se_matches_manual(self, method: np.ndarray, data: st.DataObject) -> None:
        """**Validates: Requirements 14.2**

        SE == std(deltas, ddof=1) / sqrt(n) computed independently.
        """
        baseline = data.draw(
            arrays(
                dtype=np.float64,
                shape=method.shape[0],
                elements=st.floats(min_value=0.0, max_value=2.0, allow_nan=False, allow_infinity=False),
            )
        )
        deltas = paired_delta_crps(method, baseline)
        se = compute_se(deltas)

        n = deltas.size
        if n <= 1:
            assert se == 0.0
        else:
            expected_se = float(np.std(deltas, ddof=1) / np.sqrt(n))
            np.testing.assert_allclose(se, expected_se, atol=1e-12)

    @given(method=_crps_array, data=st.data())
    @settings(max_examples=100)
    def test_ci_symmetric_around_mean(self, method: np.ndarray, data: st.DataObject) -> None:
        """**Validates: Requirements 14.2**

        CI bounds are symmetric: mean - z*se and mean + z*se.
        """
        baseline = data.draw(
            arrays(
                dtype=np.float64,
                shape=method.shape[0],
                elements=st.floats(min_value=0.0, max_value=2.0, allow_nan=False, allow_infinity=False),
            )
        )
        deltas = paired_delta_crps(method, baseline)
        mean_val = float(np.mean(deltas))
        se = compute_se(deltas)
        ci_low, ci_high = compute_ci(mean_val, se)

        np.testing.assert_allclose(ci_low, mean_val - 1.96 * se, atol=1e-12)
        np.testing.assert_allclose(ci_high, mean_val + 1.96 * se, atol=1e-12)
        # CI width is non-negative
        assert ci_high >= ci_low

    @given(
        mean=st.floats(min_value=-2.0, max_value=2.0, allow_nan=False, allow_infinity=False),
        se=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
        z=st.floats(min_value=0.0, max_value=5.0, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=100)
    def test_ci_custom_z(self, mean: float, se: float, z: float) -> None:
        """**Validates: Requirements 14.2**

        compute_ci respects the z parameter.
        """
        ci_low, ci_high = compute_ci(mean, se, z=z)
        np.testing.assert_allclose(ci_low, mean - z * se, atol=1e-12)
        np.testing.assert_allclose(ci_high, mean + z * se, atol=1e-12)


# ---------------------------------------------------------------------------
# Additional imports for Properties 11 and 12
# ---------------------------------------------------------------------------

import json
import math
import os
import tempfile
from dataclasses import asdict

from onlinev2.analysis.ablation_interpret import (
    AblationInterpretation,
    AblationStep,
    write_interpretation,
)
from onlinev2.analysis.deposit_interaction import (
    InteractionAnalysis,
    PolicyMethodResult,
    write_interaction_analysis,
)
from onlinev2.analysis.panel_sweep import (
    PanelSizeResult,
    PanelSweepResult,
    write_panel_sweep,
)
from onlinev2.analysis.regime_breakdown import (
    RegimeStats,
    write_regime_breakdown,
)
from onlinev2.analysis.stats import sanitise_json

# ---------------------------------------------------------------------------
# Strategies for Properties 11 and 12
# ---------------------------------------------------------------------------

_nan_or_inf = st.sampled_from([float("nan"), float("inf"), float("-inf")])

_finite_or_special = st.one_of(
    st.floats(min_value=-2.0, max_value=2.0, allow_nan=False, allow_infinity=False),
    _nan_or_inf,
)


@st.composite
def ablation_with_specials(draw: st.DrawFn) -> AblationInterpretation:
    """Generate an AblationInterpretation with possible NaN/Inf values."""
    n_steps = draw(st.integers(min_value=1, max_value=5))
    steps = []
    for i in range(n_steps):
        steps.append(
            AblationStep(
                variant=f"V{i}",
                label=f"Step {i}",
                delta_crps_contribution=draw(_finite_or_special),
                is_negligible=draw(st.booleans()),
                complexity_level=draw(st.sampled_from(["low", "medium", "high"])),
            )
        )
    return AblationInterpretation(
        steps=steps,
        dominant_step=steps[0].variant,
        conclusion="Test conclusion.",
        skill_gate_threat=draw(st.booleans()),
    )


@st.composite
def regime_stats_with_specials(draw: st.DrawFn) -> list[RegimeStats]:
    """Generate a list of RegimeStats with possible NaN/Inf values."""
    n = draw(st.integers(min_value=1, max_value=4))
    stats = []
    for i in range(n):
        mean_val = draw(_finite_or_special)
        se_val = draw(_finite_or_special)
        stats.append(
            RegimeStats(
                regime_name=f"Regime {i}",
                n_rounds=draw(st.integers(min_value=0, max_value=500)),
                mean_delta_crps=mean_val,
                se=se_val,
                ci_low=draw(_finite_or_special),
                ci_high=draw(_finite_or_special),
            )
        )
    return stats


@st.composite
def interaction_with_specials(draw: st.DrawFn) -> InteractionAnalysis:
    """Generate an InteractionAnalysis with possible NaN/Inf values."""
    n_per = draw(st.integers(min_value=0, max_value=4))
    per_policy = []
    for i in range(n_per):
        per_policy.append(
            PolicyMethodResult(
                deposit_policy=f"policy_{i}",
                method="blended",
                mean_delta_crps=draw(_finite_or_special),
                se=draw(_finite_or_special),
                ci_low=draw(_finite_or_special),
                ci_high=draw(_finite_or_special),
            )
        )
    return InteractionAnalysis(
        per_policy=per_policy,
        interaction_effect=draw(_finite_or_special),
        interaction_se=draw(_finite_or_special),
        interaction_ci_low=draw(_finite_or_special),
        interaction_ci_high=draw(_finite_or_special),
        interpretation="Test interpretation.",
    )


@st.composite
def panel_sweep_with_specials(draw: st.DrawFn) -> PanelSweepResult:
    """Generate a PanelSweepResult with possible NaN/Inf values."""
    n = draw(st.integers(min_value=1, max_value=5))
    results = []
    for i in range(n):
        results.append(
            PanelSizeResult(
                n=draw(st.integers(min_value=3, max_value=50)),
                mean_delta_crps=draw(_finite_or_special),
                se=draw(_finite_or_special),
                ci_low=draw(_finite_or_special),
                ci_high=draw(_finite_or_special),
            )
        )
    return PanelSweepResult(
        results=results,
        minimum_reliable_n=draw(st.one_of(st.none(), st.integers(min_value=3, max_value=50))),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _assert_no_nan_inf_in_json(json_str: str) -> None:
    """Assert that a JSON string contains no NaN or Infinity literals."""
    # JSON.parse would fail on NaN/Infinity, so json.loads should succeed
    parsed = json.loads(json_str)
    _check_no_nan_inf(parsed)


def _check_no_nan_inf(obj: object) -> None:
    """Recursively check that no float values are NaN or Inf."""
    if isinstance(obj, float):
        assert not math.isnan(obj), "Found NaN in JSON output"
        assert not math.isinf(obj), "Found Inf in JSON output"
    elif isinstance(obj, dict):
        for v in obj.values():
            _check_no_nan_inf(v)
    elif isinstance(obj, (list, tuple)):
        for item in obj:
            _check_no_nan_inf(item)


# ---------------------------------------------------------------------------
# Property 11: JSON sanitisation across all modules
# ---------------------------------------------------------------------------


class TestJsonSanitisation:
    """Property 11 – NaN/Inf replaced with null in serialised JSON.

    **Validates: Requirements 12.1, 13.1, 14.3**
    """

    @given(interp=ablation_with_specials())
    @settings(max_examples=100)
    def test_ablation_sanitisation(self, interp: AblationInterpretation) -> None:
        """Ablation interpretation JSON has no NaN/Inf.

        **Validates: Requirements 12.1**
        """
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            out_path = tmp.name
        try:
            write_interpretation(interp, out_path)
            with open(out_path) as f:
                content = f.read()
            _assert_no_nan_inf_in_json(content)
        finally:
            os.unlink(out_path)

    @given(stats=regime_stats_with_specials())
    @settings(max_examples=100)
    def test_regime_sanitisation(self, stats: list[RegimeStats]) -> None:
        """Regime breakdown JSON has no NaN/Inf.

        **Validates: Requirements 13.1**
        """
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            out_path = tmp.name
        try:
            write_regime_breakdown(stats, out_path)
            with open(out_path) as f:
                content = f.read()
            _assert_no_nan_inf_in_json(content)
        finally:
            os.unlink(out_path)

    @given(analysis=interaction_with_specials())
    @settings(max_examples=100)
    def test_deposit_interaction_sanitisation(
        self, analysis: InteractionAnalysis
    ) -> None:
        """Deposit interaction JSON has no NaN/Inf.

        **Validates: Requirements 14.3**
        """
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            out_path = tmp.name
        try:
            write_interaction_analysis(analysis, out_path)
            with open(out_path) as f:
                content = f.read()
            _assert_no_nan_inf_in_json(content)
        finally:
            os.unlink(out_path)

    @given(sweep=panel_sweep_with_specials())
    @settings(max_examples=100)
    def test_panel_sweep_sanitisation(self, sweep: PanelSweepResult) -> None:
        """Panel sweep JSON has no NaN/Inf.

        **Validates: Requirements 14.3**
        """
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            out_path = tmp.name
        try:
            write_panel_sweep(sweep, out_path)
            with open(out_path) as f:
                content = f.read()
            _assert_no_nan_inf_in_json(content)
        finally:
            os.unlink(out_path)


# ---------------------------------------------------------------------------
# Property 12: Deterministic output
# ---------------------------------------------------------------------------


class TestDeterministicOutput:
    """Property 12 – same input produces byte-identical JSON output.

    **Validates: Requirements 12.3, 13.3**
    """

    @given(interp=ablation_with_specials())
    @settings(max_examples=100)
    def test_ablation_deterministic(self, interp: AblationInterpretation) -> None:
        """Ablation interpretation produces identical JSON on two runs.

        **Validates: Requirements 12.3**
        """
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp1:
            path1 = tmp1.name
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp2:
            path2 = tmp2.name
        try:
            write_interpretation(interp, path1)
            write_interpretation(interp, path2)
            with open(path1, "rb") as f1, open(path2, "rb") as f2:
                assert f1.read() == f2.read()
        finally:
            os.unlink(path1)
            os.unlink(path2)

    @given(stats=regime_stats_with_specials())
    @settings(max_examples=100)
    def test_regime_deterministic(self, stats: list[RegimeStats]) -> None:
        """Regime breakdown produces identical JSON on two runs.

        **Validates: Requirements 13.3**
        """
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp1:
            path1 = tmp1.name
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp2:
            path2 = tmp2.name
        try:
            write_regime_breakdown(stats, path1)
            write_regime_breakdown(stats, path2)
            with open(path1, "rb") as f1, open(path2, "rb") as f2:
                assert f1.read() == f2.read()
        finally:
            os.unlink(path1)
            os.unlink(path2)

    @given(analysis=interaction_with_specials())
    @settings(max_examples=100)
    def test_deposit_interaction_deterministic(
        self, analysis: InteractionAnalysis
    ) -> None:
        """Deposit interaction produces identical JSON on two runs.

        **Validates: Requirements 12.3, 13.3**
        """
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp1:
            path1 = tmp1.name
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp2:
            path2 = tmp2.name
        try:
            write_interaction_analysis(analysis, path1)
            write_interaction_analysis(analysis, path2)
            with open(path1, "rb") as f1, open(path2, "rb") as f2:
                assert f1.read() == f2.read()
        finally:
            os.unlink(path1)
            os.unlink(path2)

    @given(sweep=panel_sweep_with_specials())
    @settings(max_examples=100)
    def test_panel_sweep_deterministic(self, sweep: PanelSweepResult) -> None:
        """Panel sweep produces identical JSON on two runs.

        **Validates: Requirements 12.3, 13.3**
        """
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp1:
            path1 = tmp1.name
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp2:
            path2 = tmp2.name
        try:
            write_panel_sweep(sweep, path1)
            write_panel_sweep(sweep, path2)
            with open(path1, "rb") as f1, open(path2, "rb") as f2:
                assert f1.read() == f2.read()
        finally:
            os.unlink(path1)
            os.unlink(path2)
