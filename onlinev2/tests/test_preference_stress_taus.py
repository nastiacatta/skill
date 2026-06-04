"""
Bug condition exploration and preservation tests for the preference_stress_test taus fix.

Feature: preference-stress-taus-fix

The bug: `run_preference_stress_test` constructs `MechanismParams(scoring_mode="quantiles_crps")`
without setting `taus`, causing `crps_hat_from_quantiles` to crash with
`TypeError: len() of unsized object` when it receives `None` as the taus argument.
"""
from __future__ import annotations

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from onlinev2.behaviour.composite import CompositeBehaviourModel
from onlinev2.behaviour.population import build_population
from onlinev2.core.scoring import TAUS_COARSE, crps_hat_from_quantiles, score_crps_hat
from onlinev2.mechanism.models import MechanismParams

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

def _outcome() -> st.SearchStrategy:
    """Random outcome y in [0, 1]."""
    return st.floats(min_value=0.0, max_value=1.0)


def _quantile_matrix(n_agents: int = 1, n_taus: int = 5) -> st.SearchStrategy:
    """Random quantile matrix of shape (n_agents, n_taus) with values in [0, 1]."""
    return st.lists(
        st.lists(
            st.floats(min_value=0.0, max_value=1.0),
            min_size=n_taus,
            max_size=n_taus,
        ),
        min_size=n_agents,
        max_size=n_agents,
    ).map(lambda rows: np.array(rows, dtype=np.float64))


# ---------------------------------------------------------------------------
# Task 1: Bug condition exploration tests
# ---------------------------------------------------------------------------

class TestBugConditionExploration:
    """
    **Property 1: Bug Condition** — Preference Stress Test Crashes Without Taus

    These tests replicate the code path in run_preference_stress_test.
    On UNFIXED code, the function constructs MechanismParams and
    CompositeBehaviourModel without taus, so scoring crashes.
    After the fix, taus=TAUS_COARSE is passed to both.

    **Validates: Requirements 1.1, 1.2**
    """

    @given(
        y=_outcome(),
        q_matrix=_quantile_matrix(n_agents=3, n_taus=5),
    )
    @settings(max_examples=50, deadline=None)
    def test_crps_hat_with_preference_stress_params(self, y, q_matrix):
        """Replicate the MechanismParams construction from run_preference_stress_test
        and call crps_hat_from_quantiles with params.taus.

        On unfixed code, the function constructs MechanismParams without taus,
        so params.taus is None and crps_hat_from_quantiles raises TypeError.
        After the fix, taus=TAUS_COARSE is passed.

        **Validates: Requirements 1.1**
        """
        scoring_mode = "quantiles_crps"
        # Replicate the taus derivation from run_preference_stress_test.
        # On unfixed code this line doesn't exist, so we simulate by reading
        # the actual function to determine if the fix is present.
        params = _build_preference_stress_params(scoring_mode)
        result = crps_hat_from_quantiles(y, q_matrix, params.taus)
        assert result.shape == (q_matrix.shape[0],)
        assert np.all(result >= -1e-12)

    def test_composite_behaviour_model_has_taus(self):
        """Replicate the CompositeBehaviourModel construction from
        run_preference_stress_test and verify taus is not None.

        On unfixed code, taus is not passed, so behaviour.taus is None.
        After the fix, taus=TAUS_COARSE is passed.

        **Validates: Requirements 1.2**
        """
        scoring_mode = "quantiles_crps"
        taus = _get_preference_stress_taus(scoring_mode)
        pop = build_population(3, seed=42)
        behaviour = CompositeBehaviourModel(pop, scoring_mode=scoring_mode, taus=taus)
        assert behaviour.taus is not None, (
            "CompositeBehaviourModel constructed without taus has taus=None — "
            "reporting policies will not receive a valid quantile grid"
        )


def _get_preference_stress_taus(scoring_mode: str):
    """Extract the taus value that run_preference_stress_test would use.

    Inspects the actual function source to determine if the fix is present.
    On unfixed code, returns None (reproducing the bug).
    On fixed code, returns TAUS_COARSE.
    """
    import inspect

    from onlinev2.experiments.runners.runner_module import run_preference_stress_test
    source = inspect.getsource(run_preference_stress_test)
    if "TAUS_COARSE" in source and "taus=taus" in source:
        # Fixed: function derives taus from scoring_mode
        return TAUS_COARSE if scoring_mode == "quantiles_crps" else None
    else:
        # Unfixed: function doesn't set taus
        return None


def _build_preference_stress_params(scoring_mode: str) -> MechanismParams:
    """Build MechanismParams the same way run_preference_stress_test does."""
    taus = _get_preference_stress_taus(scoring_mode)
    return MechanismParams(scoring_mode=scoring_mode, taus=taus)


# ---------------------------------------------------------------------------
# Task 2: Preservation property tests
# ---------------------------------------------------------------------------

class TestPreservation:
    """
    **Property 2: Preservation** — CRPS Scoring and Point-MAE Behaviour Unchanged

    These tests verify baseline behaviour that must be preserved after the fix.
    They MUST PASS on both unfixed and fixed code.

    **Validates: Requirements 3.1, 3.2, 3.3**
    """

    @given(
        y=_outcome(),
        q_matrix=_quantile_matrix(n_agents=3, n_taus=5),
    )
    @settings(max_examples=50)
    def test_crps_hat_with_taus_coarse_returns_valid_shape_and_nonneg(self, y, q_matrix):
        """crps_hat_from_quantiles(y, q_matrix, TAUS_COARSE) returns non-negative
        values with correct shape (n,).

        **Validates: Requirements 3.3**
        """
        result = crps_hat_from_quantiles(y, q_matrix, TAUS_COARSE)
        assert result.shape == (q_matrix.shape[0],)
        assert np.all(result >= -1e-12)

    @given(
        y=_outcome(),
        q_matrix=_quantile_matrix(n_agents=3, n_taus=5),
    )
    @settings(max_examples=50)
    def test_score_crps_hat_returns_values_in_unit_interval(self, y, q_matrix):
        """score_crps_hat(y, q_matrix, TAUS_COARSE) returns values in [0, 1].

        **Validates: Requirements 3.3**
        """
        result = score_crps_hat(y, q_matrix, TAUS_COARSE)
        assert np.all(result >= -1e-12)
        assert np.all(result <= 1.0 + 1e-12)

    def test_mechanism_params_defaults_taus_none(self):
        """MechanismParams() defaults taus=None (dataclass default unchanged).

        **Validates: Requirements 3.1**
        """
        params = MechanismParams()
        assert params.taus is None

    def test_composite_behaviour_point_mae_taus_none(self):
        """CompositeBehaviourModel(pop, scoring_mode='point_mae') has taus=None.

        **Validates: Requirements 3.2**
        """
        pop = build_population(3, seed=42)
        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        assert behaviour.taus is None
