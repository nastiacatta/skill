"""
Factory for constructing behaviour models from preset names.

Accepts canonical and legacy preset names. Strategic participant types
use internal keys (e.g. arbitrage_seeking, coordinated_group); the
single-account strategic participant id is retained as attacker_0 for
backwards compatibility with existing tests and experiment logs.
"""
from __future__ import annotations

from typing import Any, Optional, Sequence

from onlinev2.behaviour.composite import CompositeBehaviourModel
from onlinev2.behaviour.config.behaviour_configs import get_preset_kwargs
from onlinev2.behaviour.population import build_population
from onlinev2.behaviour.protocol import BehaviourModel
from onlinev2.behaviour.traits import UserTraits


def make_behaviour(
    name: str,
    *,
    n_users: int = 10,
    seed: int = 42,
    scoring_mode: str = "point_mae",
    taus: Optional[Sequence[float]] = None,
    b_max: float = 10.0,
    **kwargs: Any,
) -> BehaviourModel:
    preset = get_preset_kwargs(name, n_users=n_users, seed=seed, **kwargs)
    adversary = preset.pop("_adversary", None)

    if adversary is None:
        pop = build_population(
            n_users,
            seed=seed,
            participation_policy=preset.get("participation_policy"),
            belief_policy=preset.get("belief_policy"),
            reporting_policy=preset.get("reporting_policy"),
            staking_policy=preset.get("staking_policy"),
            identity_policy=preset.get("identity_policy"),
        )
        return CompositeBehaviourModel(pop, scoring_mode=scoring_mode, taus=taus, b_max=b_max)

    from onlinev2.behaviour.policies.identity import SingleAccountIdentity
    from onlinev2.behaviour.policies.participation import BaselineParticipation
    from onlinev2.behaviour.policies.reporting import TruthfulReporting
    from onlinev2.behaviour.policies.staking import FixedFractionStaking

    benign_count = max(0, n_users - 1)
    benign_pop = build_population(
        benign_count,
        seed=seed,
        participation_policy=BaselineParticipation(),
        reporting_policy=TruthfulReporting(),
        staking_policy=FixedFractionStaking(),
        identity_policy=SingleAccountIdentity(),
    )

    # Retained for backwards compatibility with tests and experiment logs.
    adv_traits = UserTraits(user_id="attacker_0", initial_wealth=10.0, noise_level=0.05, stake_fraction=0.3)

    if adversary == "arbitrage_seeking":
        from onlinev2.behaviour.adversaries.arbitrage_seeking import ArbitrageSeekingBehaviour
        adv = ArbitrageSeekingBehaviour(adv_traits, scoring_mode=scoring_mode, taus=taus, b_max=b_max)
        adv_key = adv_traits.user_id
    elif adversary == "strategic_influence":
        from onlinev2.behaviour.adversaries.strategic_influence import StrategicInfluenceBehaviour
        adv = StrategicInfluenceBehaviour(
            adv_traits,
            target=float(kwargs.get("target", 0.0)),
            scoring_mode=scoring_mode,
            taus=taus,
            b_max=b_max,
        )
        adv_key = adv_traits.user_id
    elif adversary == "detector_aware":
        from onlinev2.behaviour.adversaries.detector_aware import DetectorAwareBehaviour
        adv = DetectorAwareBehaviour(
            adv_traits,
            target=float(kwargs.get("target", 0.0)),
            scoring_mode=scoring_mode,
            taus=taus,
            b_max=b_max,
        )
        adv_key = adv_traits.user_id
    elif adversary == "privileged_information":
        from onlinev2.behaviour.adversaries.privileged_information import (
            PrivilegedInformationBehaviour,
        )
        adv = PrivilegedInformationBehaviour(
            adv_traits,
            scoring_mode=scoring_mode,
            taus=taus,
            b_max=b_max,
            y_sequence=kwargs.get("y_sequence"),
        )
        adv_key = adv_traits.user_id
    elif adversary == "coordinated_group":
        from onlinev2.behaviour.adversaries.coordinated_group import CoordinatedGroupBehaviour
        members = [
            UserTraits(user_id=f"group_member_{j}", initial_wealth=10.0, noise_level=0.05, stake_fraction=0.2)
            for j in range(int(kwargs.get("group_size", 3)))
        ]
        adv = CoordinatedGroupBehaviour(members, scoring_mode=scoring_mode, taus=taus, b_max=b_max)
        adv_key = "coordinated_group"
    elif adversary == "wash_trader":
        from onlinev2.behaviour.adversaries.wash_trader import WashTraderBehaviour
        adv = WashTraderBehaviour(
            adv_traits,
            k_accounts=int(kwargs.get("k_accounts", 3)),
            scoring_mode=scoring_mode,
            taus=taus,
            b_max=b_max,
        )
        adv_key = adv_traits.user_id
    elif adversary == "strategic_reporter":
        from onlinev2.behaviour.adversaries.strategic_reporter import StrategicReporterBehaviour
        adv = StrategicReporterBehaviour(
            adv_traits,
            target=float(kwargs.get("target", 0.5)),
            pull=float(kwargs.get("pull", 0.8)),
            scoring_mode=scoring_mode,
            taus=taus,
            b_max=b_max,
        )
        adv_key = adv_traits.user_id
    else:
        raise ValueError(f"Unknown adversary: {adversary}")

    return CompositeBehaviourModel(
        benign_pop,
        adversary_behaviours={adv_key: adv},
        scoring_mode=scoring_mode,
        taus=taus,
        b_max=b_max,
    )
