"""Property tests for panel sweep analysis module.

Uses Hypothesis to verify correctness properties across random inputs.

Properties tested:
- Property 8: Panel sweep statistics (Req 9.2)
- Property 9: Minimum reliable N identification (Req 9.3, 9.5)
"""

from __future__ import annotations

import numpy as np
from hypothesis import given, settings
from hypothesis import strategies as st

from onlinev2.analysis.panel_sweep import (
    PanelSweepResult,
    compute_panel_sweep,
)
from onlinev2.analysis.stats import compute_ci, compute_se

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------


@st.composite
def panel_sweep_data(draw: st.DrawFn) -> dict[int, list[dict]]:
    """Generate random per-seed results for multiple panel sizes.

    Produces 1–5 panel sizes (N=3–20), each with 5–50 seeds of blended
    method deltas.
    """
    n_panels = draw(st.integers(min_value=1, max_value=5))
    panel_sizes = draw(
        st.lists(
            st.integers(min_value=3, max_value=20),
            min_size=n_panels,
            max_size=n_panels,
            unique=True,
        )
    )
    n_seeds = draw(st.integers(min_value=5, max_value=50))

    results: dict[int, list[dict]] = {}
    for n in panel_sizes:
        rows: list[dict] = []
        for seed in range(n_seeds):
            delta = draw(
                st.floats(
                    min_value=-1.0,
                    max_value=1.0,
                    allow_nan=False,
                    allow_infinity=False,
                )
            )
            rows.append(
                {
                    "method": "blended",
                    "seed": seed,
                    "mean_crps": 0.5,
                    "delta_crps_vs_equal": delta,
                }
            )
        results[n] = rows

    return results


@st.composite
def ci_results_data(draw: st.DrawFn) -> list[tuple[int, float]]:
    """Generate random (N, ci_high) pairs for testing minimum reliable N.

    Returns a list of (panel_size, ci_high) tuples.
    """
    n_panels = draw(st.integers(min_value=2, max_value=8))
    panel_sizes = sorted(draw(
        st.lists(
            st.integers(min_value=3, max_value=50),
            min_size=n_panels,
            max_size=n_panels,
            unique=True,
        )
    ))
    results: list[tuple[int, float]] = []
    for n in panel_sizes:
        ci_high = draw(
            st.floats(
                min_value=-0.5,
                max_value=0.5,
                allow_nan=False,
                allow_infinity=False,
            )
        )
        results.append((n, ci_high))
    return results


# ---------------------------------------------------------------------------
# Property 8: Panel sweep statistics
# ---------------------------------------------------------------------------


class TestPanelSweepStatistics:
    """Property 8 – mean, SE, CI computed correctly for each panel size.

    **Validates: Requirements 9.2**
    """

    @given(data=panel_sweep_data())
    @settings(max_examples=100)
    def test_per_n_statistics(self, data: dict[int, list[dict]]) -> None:
        """Mean, SE, CI match independent computation for each N.

        **Validates: Requirements 9.2**
        """
        result = compute_panel_sweep(data)
        assert isinstance(result, PanelSweepResult)

        for psr in result.results:
            # Independently compute expected statistics
            blended_deltas = [
                float(r["delta_crps_vs_equal"])
                for r in data[psr.n]
                if r["method"] == "blended"
            ]
            arr = np.array(blended_deltas, dtype=np.float64)
            expected_mean = float(np.mean(arr))
            expected_se = compute_se(arr)
            expected_ci_low, expected_ci_high = compute_ci(expected_mean, expected_se)

            np.testing.assert_allclose(
                psr.mean_delta_crps, expected_mean, atol=1e-10,
                err_msg=f"Mean mismatch for N={psr.n}",
            )
            np.testing.assert_allclose(
                psr.se, expected_se, atol=1e-10,
                err_msg=f"SE mismatch for N={psr.n}",
            )
            np.testing.assert_allclose(
                psr.ci_low, expected_ci_low, atol=1e-10,
                err_msg=f"CI low mismatch for N={psr.n}",
            )
            np.testing.assert_allclose(
                psr.ci_high, expected_ci_high, atol=1e-10,
                err_msg=f"CI high mismatch for N={psr.n}",
            )


# ---------------------------------------------------------------------------
# Property 9: Minimum reliable N identification
# ---------------------------------------------------------------------------


class TestMinimumReliableN:
    """Property 9 – minimumReliableN is smallest N where ciHigh < 0, or None.

    **Validates: Requirements 9.3, 9.5**
    """

    @given(data=panel_sweep_data())
    @settings(max_examples=100)
    def test_minimum_reliable_n_correct(self, data: dict[int, list[dict]]) -> None:
        """minimumReliableN is smallest N where ciHigh < 0, or None.

        **Validates: Requirements 9.3, 9.5**
        """
        result = compute_panel_sweep(data)
        assert isinstance(result, PanelSweepResult)

        # Independently find the expected minimum reliable N
        expected_min_n: int | None = None
        for psr in result.results:
            if not (np.isnan(psr.ci_high) or np.isnan(psr.ci_low)):
                if psr.ci_high < 0:
                    expected_min_n = psr.n
                    break

        assert result.minimum_reliable_n == expected_min_n

    @given(ci_data=ci_results_data())
    @settings(max_examples=100)
    def test_minimum_reliable_n_from_ci_values(
        self, ci_data: list[tuple[int, float]]
    ) -> None:
        """Verify minimum reliable N logic with explicit CI values.

        **Validates: Requirements 9.3, 9.5**
        """
        # Build input data that will produce the desired ci_high values
        # We use seeds with identical deltas to control the CI precisely
        results_by_n: dict[int, list[dict]] = {}
        for n, ci_high in ci_data:
            # To get a specific ci_high, we need mean + 1.96*se = ci_high
            # Use 10 identical seeds so se ≈ 0, meaning ci_high ≈ mean
            # Actually, with identical values, se=0, so ci_high = mean
            rows = [
                {
                    "method": "blended",
                    "seed": s,
                    "mean_crps": 0.5,
                    "delta_crps_vs_equal": ci_high,  # all same → mean=ci_high, se=0
                }
                for s in range(10)
            ]
            results_by_n[n] = rows

        result = compute_panel_sweep(results_by_n)

        # Expected: smallest N where ci_high < 0
        sorted_data = sorted(ci_data, key=lambda x: x[0])
        expected_min_n: int | None = None
        for n, ci_high in sorted_data:
            if ci_high < 0:
                expected_min_n = n
                break

        assert result.minimum_reliable_n == expected_min_n
