from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, List, Optional, Sequence

from onlinev2.behaviour.policies.belief import GaussianBeliefModel
from onlinev2.behaviour.policies.identity import SingleAccountIdentity
from onlinev2.behaviour.policies.participation import BaselineParticipation
from onlinev2.behaviour.policies.reporting import TruthfulReporting
from onlinev2.behaviour.policies.staking import FixedFractionStaking
from onlinev2.behaviour.traits import UserTraits, generate_population


@dataclass
class UserConfig:
    traits: UserTraits
    participation_policy: Any
    belief_policy: Any
    reporting_policy: Any
    staking_policy: Any
    identity_policy: Any


def _clone_policy(obj: Any) -> Any:
    return copy.deepcopy(obj)


def build_population(
    n_users: int,
    *,
    seed: int = 42,
    traits: Optional[Sequence[UserTraits]] = None,
    participation_policy: Optional[Any] = None,
    belief_policy: Optional[Any] = None,
    reporting_policy: Optional[Any] = None,
    staking_policy: Optional[Any] = None,
    identity_policy: Optional[Any] = None,
) -> List[UserConfig]:
    traits_list = list(traits) if traits is not None else generate_population(n_users, seed=seed)
    if len(traits_list) != n_users:
        raise ValueError(f"Expected {n_users} traits, got {len(traits_list)}")

    part = participation_policy if participation_policy is not None else BaselineParticipation()
    belief = belief_policy if belief_policy is not None else GaussianBeliefModel()
    report = reporting_policy if reporting_policy is not None else TruthfulReporting()
    stake = staking_policy if staking_policy is not None else FixedFractionStaking()
    identity = identity_policy if identity_policy is not None else SingleAccountIdentity()

    out: List[UserConfig] = []
    for tr in traits_list:
        out.append(
            UserConfig(
                traits=tr,
                participation_policy=_clone_policy(part),
                belief_policy=_clone_policy(belief),
                reporting_policy=_clone_policy(report),
                staking_policy=_clone_policy(stake),
                identity_policy=_clone_policy(identity),
            )
        )
    return out
