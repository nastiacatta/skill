"""Property tests for deposit interaction analysis module.

Uses Hypothesis to verify correctness properties across random inputs.

Properties tested:
- Property 7: Deposit interaction computation (Req 7.1, 7.2)
"""

from __future__ import annotations

import numpy as np
from hypothesis import given, settings
from hypothesis import strategies as st

from onlinev2.analysis.deposit_interaction import (
    InteractionAnalysis,
    analyse_deposit_interaction,
)
from onlinev2.analysis.stats import compute_ci, compute_se

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_POLICIES = ["fixed", "bankroll", "kelly"]
_METHODS = ["blended", "stake_only", "skill_only"]


@st.composite
def policy_results_data(draw: st.DrawFn) -> dict[str, list[dict]]:
    """Generate random per-policy master_comparison rows.

    Produces 2–3 policies, each with 5–20 seeds, and multiple methods
    including 'blended'.
    """
    n_policies = draw(st.integers(min_value=2, max_value=3))
    policies = draw(
        st.lists(
            st.sampled_from(_POLICIES),
            min_size=n_policies,
            max_size=n_policies,
            unique=True,
        )
    )
    n_seeds = draw(st.integers(min_value=5, max_value=20))

    results: dict[str, list[dict]] = {}
    for policy in policies:
        rows: list[dict] = []
        for seed in range(n_seeds):
            for method in _METHODS:
                delta = draw(
                    st.floats(
                        min_value=-1.0,
                        max_value=1.0,
                        allow_nan=False,
                        allow_infinity=False,
                    )
                )
                mean_crps = draw(
                    st.floats(
                        min_value=0.0,
                        max_value=2.0,
                        allow_nan=False,
                        allow_infinity=False,
                    )
                )
                rows.append(
                    {
                        "method": method,
                        "seed": seed,
                        "mean_crps": mean_crps,
                        "delta_crps_vs_equal": delta,
                    }
                )
        results[policy] = rows

    return results


# ---------------------------------------------------------------------------
# Property 7: Deposit interaction computation
# ---------------------------------------------------------------------------


class TestDepositInteraction:
    """Property 7 – interaction effect and per-policy-method statistics.

    **Validates: Requirements 7.1, 7.2**
    """

    @given(data=policy_results_data())
    @settings(max_examples=100)
    def test_per_policy_method_statistics(self, data: dict[str, list[dict]]) -> None:
        """Per-policy-method mean, SE, CI match independent computation.

        **Validates: Requirements 7.1**
        """
        result = analyse_deposit_interaction(data)
        assert isinstance(result, InteractionAnalysis)

        # Independently compute expected statistics for each (policy, method)
        for pmr in result.per_policy:
            # Collect deltas for this (policy, method) from input
            expected_deltas: list[float] = []
            for row in data[pmr.deposit_policy]:
                if row["method"] == pmr.method:
                    expected_deltas.append(float(row["delta_crps_vs_equal"]))

            arr = np.array(expected_deltas, dtype=np.float64)
            expected_mean = float(np.mean(arr))
            expected_se = compute_se(arr)
            expected_ci_low, expected_ci_high = compute_ci(expected_mean, expected_se)

            np.testing.assert_allclose(
                pmr.mean_delta_crps, expected_mean, atol=1e-10,
                err_msg=f"Mean mismatch for {pmr.deposit_policy}/{pmr.method}",
            )
            np.testing.assert_allclose(
                pmr.se, expected_se, atol=1e-10,
                err_msg=f"SE mismatch for {pmr.deposit_policy}/{pmr.method}",
            )
            np.testing.assert_allclose(
                pmr.ci_low, expected_ci_low, atol=1e-10,
                err_msg=f"CI low mismatch for {pmr.deposit_policy}/{pmr.method}",
            )
            np.testing.assert_allclose(
                pmr.ci_high, expected_ci_high, atol=1e-10,
                err_msg=f"CI high mismatch for {pmr.deposit_policy}/{pmr.method}",
            )

    @given(data=policy_results_data())
    @settings(max_examples=100)
    def test_interaction_effect_formula(self, data: dict[str, list[dict]]) -> None:
        """Interaction effect equals difference of blended deltas across policies.

        **Validates: Requirements 7.2**
        """
        result = analyse_deposit_interaction(data)
        assert isinstance(result, InteractionAnalysis)

        # Collect blended deltas per policy
        blended_by_policy: dict[str, np.ndarray] = {}
        for policy, rows in data.items():
            blended_deltas = [
                float(r["delta_crps_vs_equal"])
                for r in rows
                if r["method"] == "blended"
            ]
            if blended_deltas:
                blended_by_policy[policy] = np.array(blended_deltas, dtype=np.float64)

        # Determine which two policies are used
        if "fixed" in blended_by_policy and "bankroll" in blended_by_policy:
            policy_a, policy_b = "fixed", "bankroll"
        else:
            available = sorted(blended_by_policy.keys())
            policy_a, policy_b = available[0], available[1]

        mean_a = float(np.mean(blended_by_policy[policy_a]))
        mean_b = float(np.mean(blended_by_policy[policy_b]))
        se_a = compute_se(blended_by_policy[policy_a])
        se_b = compute_se(blended_by_policy[policy_b])

        expected_effect = mean_a - mean_b
        expected_se = float(np.sqrt(se_a**2 + se_b**2))
        expected_ci_low, expected_ci_high = compute_ci(expected_effect, expected_se)

        np.testing.assert_allclose(
            result.interaction_effect, expected_effect, atol=1e-10,
        )
        np.testing.assert_allclose(
            result.interaction_se, expected_se, atol=1e-10,
        )
        np.testing.assert_allclose(
            result.interaction_ci_low, expected_ci_low, atol=1e-10,
        )
        np.testing.assert_allclose(
            result.interaction_ci_high, expected_ci_high, atol=1e-10,
        )
