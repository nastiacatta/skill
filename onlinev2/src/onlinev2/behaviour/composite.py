from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from onlinev2.behaviour.population import UserConfig
from onlinev2.behaviour.protocol import AgentAction, BehaviourModel, RoundPublicState


@dataclass
class CompositeBehaviourModel(BehaviourModel):
    """
    Combines a population of baseline participants with optional
    strategic participant types (e.g. arbitrage-seeking, coordinated group).
    """
    population: Sequence[UserConfig]
    adversary_behaviours: Optional[Dict[str, BehaviourModel]] = None
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    _user_rngs: Dict[str, np.random.Generator] = field(default_factory=dict, init=False)

    def reset(self, seed: int) -> None:
        self._seed = int(seed)
        self._user_rngs = {}
        for idx, user in enumerate(self.population):
            local_seed = seed + 1009 * (idx + 1)
            self._user_rngs[user.traits.user_id] = np.random.default_rng(local_seed)
            for policy in (
                user.participation_policy,
                user.belief_policy,
                user.reporting_policy,
                user.staking_policy,
                user.identity_policy,
            ):
                if hasattr(policy, "reset"):
                    policy.reset(local_seed)

        for idx, adv in enumerate((self.adversary_behaviours or {}).values()):
            if hasattr(adv, "reset"):
                adv.reset(seed + 100_000 + idx)

    def _actions_for_user(self, user: UserConfig, state: RoundPublicState) -> List[AgentAction]:
        rng = self._user_rngs[user.traits.user_id]

        belief_mean = user.belief_policy.belief_mean(user.traits, state, rng)
        participate = bool(user.participation_policy.should_participate(user.traits, state, belief_mean, rng))

        if not participate:
            return user.identity_policy.map_user_action(
                user_id=user.traits.user_id,
                participate=False,
                report=None,
                deposit=0.0,
                meta={"user_id": user.traits.user_id, "agent_type": "benign"},
            )

        ref = 0.5
        if state.agg_history:
            try:
                ref = float(np.asarray(state.agg_history[-1]).mean())
            except Exception:
                pass
        report = user.reporting_policy.report(
            belief_mean,
            user.traits,
            rng,
            scoring_mode=self.scoring_mode,
            taus=self.taus,
            target=ref,
            state=state,
        )

        deposit = user.staking_policy.choose_deposit(
            user.traits,
            state,
            belief_mean,
            report,
            rng,
            b_max=self.b_max,
        )

        if deposit <= 0.0:
            return user.identity_policy.map_user_action(
                user_id=user.traits.user_id,
                participate=False,
                report=None,
                deposit=0.0,
                meta={"user_id": user.traits.user_id, "agent_type": "benign"},
            )

        return user.identity_policy.map_user_action(
            user_id=user.traits.user_id,
            participate=True,
            report=report,
            deposit=float(deposit),
            meta={
                "user_id": user.traits.user_id,
                "belief_mean": float(belief_mean),
                "agent_type": "benign",
            },
        )

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        actions: List[AgentAction] = []
        for user in self.population:
            actions.extend(self._actions_for_user(user, state))
        for adv in (self.adversary_behaviours or {}).values():
            actions.extend(adv.act(state))
        actions.sort(key=lambda a: a.account_id)
        return actions

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        for adv in (self.adversary_behaviours or {}).values():
            adv.observe_round_result(t=t, y_t=y_t, logs_t=logs_t)
        profit_by_account = {}
        if "ids" in logs_t and "profit" in logs_t:
            profit_by_account = dict(zip(logs_t["ids"], logs_t["profit"]))
        enriched = {**logs_t, "profit_by_account": profit_by_account}
        for user in self.population:
            user_id = user.traits.user_id
            for policy in (
                user.participation_policy,
                user.belief_policy,
                user.reporting_policy,
                user.staking_policy,
                user.identity_policy,
            ):
                if hasattr(policy, "observe_round_result"):
                    try:
                        policy.observe_round_result(t=t, y_t=y_t, logs_t=enriched, user_id=user_id)
                    except TypeError:
                        policy.observe_round_result(t=t, y_t=y_t, logs_t=enriched)
