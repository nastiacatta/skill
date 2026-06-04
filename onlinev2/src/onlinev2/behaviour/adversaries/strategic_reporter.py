"""
Strategic reporter adversary.

Closely related to StrategicInfluenceBehaviour but models the agent as
willing to pay *ongoing* score-rule losses in exchange for shifting the
aggregate (e.g. a market maker with an off-mechanism payoff that depends
on r_hat, such as a downstream decision-maker fee).

Given target mu and a weighted-mean aggregate

    r_hat = sum_i (m_i * r_i) / sum_i m_i,

a single account shifts r_hat toward mu by reporting r_i closer to mu.
The "pull" parameter mixes the truthful belief with mu. For mu = target
and pull = 1 this reduces to strategic influence; intermediate pulls
trade aggregate impact against score-rule loss.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from onlinev2.behaviour.adversaries._utils import make_report
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState, clamp01
from onlinev2.behaviour.traits import UserTraits


@dataclass
class StrategicReporterBehaviour:
    """
    Aggregate-shifting reporter. Reports

        r_i = (1 - pull) * anchor + pull * target

    where ``anchor`` is the most recent public aggregate (proxy for the
    truthful belief on lagged information).
    """
    traits: UserTraits
    target: float = 0.5
    pull: float = 0.8
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    stake_boost: float = 0.2
    base_stake_fraction: float = 0.1

    def reset(self, seed: int) -> None:
        self.rng = np.random.default_rng(seed)

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        wealth = max(0.0, float(state.wealth_prev.get(self.traits.user_id, self.traits.initial_wealth)))
        if wealth <= 0.0:
            return [
                AgentAction(
                    account_id=self.traits.user_id,
                    participate=False,
                    report=None,
                    deposit=0.0,
                    meta={"agent_type": "strategic_reporter"},
                )
            ]

        anchor = 0.5
        if state.agg_history:
            try:
                anchor = float(np.asarray(state.agg_history[-1]).mean())
            except Exception:
                anchor = 0.5

        pull = float(np.clip(self.pull, 0.0, 1.0))
        scalar = clamp01((1.0 - pull) * anchor + pull * float(self.target))
        report = make_report(scalar, self.scoring_mode, taus=self.taus,
                             sigma_q=0.05)

        frac = float(np.clip(
            self.base_stake_fraction + self.stake_boost * self.traits.manipulation_strength,
            0.0,
            0.85,
        ))
        deposit = float(np.clip(frac * wealth, 0.0, min(wealth, self.b_max)))
        return [
            AgentAction(
                account_id=self.traits.user_id,
                participate=True,
                report=report,
                deposit=deposit,
                meta={
                    "agent_type": "strategic_reporter",
                    "target": float(self.target),
                    "pull": pull,
                },
            )
        ]

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        return None
