"""F1: CoordinatedGroupBehaviour should auto-select weighted_median
under point_mae (MAE arbitrage-free target) and weighted_mean otherwise.

Before the fix the default was hardcoded to weighted_mean, which is
the Chun-Shachter arbitrage-free target for differentiable scores but
sub-optimal for MAE. Under the MAE-WSWM used throughout the thesis'
synthetic experiments, a coalition playing the weighted_mean instead
of the weighted_median under-attacks the mechanism and therefore
understates the robustness benchmark.
"""
from __future__ import annotations

import numpy as np
import pytest

from onlinev2.behaviour.adversaries.coordinated_group import (
    CoordinatedGroupBehaviour,
)
from onlinev2.behaviour.traits import UserTraits


def _make_members(n: int = 3) -> list[UserTraits]:
    return [
        UserTraits(
            user_id=f"member_{i}",
            initial_wealth=10.0,
            noise_level=0.05,
            stake_fraction=0.2,
        )
        for i in range(n)
    ]


def test_auto_mode_is_default():
    """Default aggregation is 'auto'."""
    adv = CoordinatedGroupBehaviour(_make_members())
    assert adv.aggregation == "auto"


def test_auto_picks_median_under_point_mae():
    """scoring_mode='point_mae' + aggregation='auto' → weighted_median."""
    adv = CoordinatedGroupBehaviour(_make_members(), scoring_mode="point_mae")
    assert adv._resolve_aggregation() == "weighted_median"


def test_auto_picks_mean_under_quantiles_crps():
    """scoring_mode='quantiles_crps' + aggregation='auto' → weighted_mean."""
    adv = CoordinatedGroupBehaviour(
        _make_members(), scoring_mode="quantiles_crps"
    )
    assert adv._resolve_aggregation() == "weighted_mean"


def test_explicit_choice_overrides_auto():
    """Explicit aggregation passes through unchanged."""
    for scoring in ["point_mae", "quantiles_crps"]:
        for choice in ["weighted_mean", "weighted_median"]:
            adv = CoordinatedGroupBehaviour(
                _make_members(), scoring_mode=scoring, aggregation=choice
            )
            assert adv._resolve_aggregation() == choice, (
                f"Explicit aggregation={choice} should override 'auto' "
                f"under scoring_mode={scoring}"
            )


def test_auto_median_gives_different_report_from_mean():
    """The two aggregation modes give different reports when beliefs disagree
    — otherwise the default choice would not matter."""
    # Use 3 beliefs where mean ≠ median
    beliefs = np.array([0.1, 0.5, 0.9])
    wagers = np.array([1.0, 1.0, 1.0])

    adv_mean = CoordinatedGroupBehaviour(
        _make_members(), scoring_mode="point_mae", aggregation="weighted_mean"
    )
    adv_median = CoordinatedGroupBehaviour(
        _make_members(), scoring_mode="point_mae", aggregation="weighted_median"
    )
    # Uniform wagers → arithmetic mean = 0.5, median = 0.5 (tie).
    # Use non-uniform wagers to get a clear difference.
    wagers_asym = np.array([3.0, 1.0, 1.0])
    assert not np.isclose(
        adv_mean._aggregate_report(beliefs, wagers_asym),
        adv_median._aggregate_report(beliefs, wagers_asym),
    )


def test_factory_now_picks_median_under_mae():
    """The factory call path (no explicit aggregation) should now auto-
    select weighted_median under MAE — this is the fix for F1."""
    from onlinev2.behaviour.factory import make_behaviour

    # make_behaviour('COORDINATED_GROUP', ...) drops to the factory path
    # that constructs CoordinatedGroupBehaviour without aggregation=,
    # so it should auto-select via the new resolver.
    comp = make_behaviour(
        "COORDINATED_GROUP",
        n_users=5,
        seed=0,
        scoring_mode="point_mae",
        taus=None,
        b_max=10.0,
    )
    # Walk the composite to find the coordinated_group adversary.
    found = False
    for adv in comp.adversary_behaviours.values():
        if isinstance(adv, CoordinatedGroupBehaviour):
            assert adv._resolve_aggregation() == "weighted_median", (
                "Factory-built coordinated_group under MAE should auto-"
                "select weighted_median; got "
                f"{adv._resolve_aggregation()}"
            )
            found = True
    assert found, "coordinated_group adversary not found in composite"
