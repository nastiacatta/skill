"""
Strategic-influence regime (aggregate manipulator).

Theory: in a wager-weighted aggregation
    r_hat_t = sum_i m_i * r_i / sum_i m_i
a single account's marginal influence on r_hat_t is

    d r_hat / d r_i = m_i / M_t,

so influence scales linearly with m_i (effective wager). A rational
"manipulator" that values moving r_hat towards some target mu in [0,1]
and pays score-rule losses proportional to |mu - y_t| solves

    max_{r_i, m_i} lambda_infl * (r_i - r_i^*) * m_i / M_t
                   - E[ m_i * (s(y, r_i^*) - s(y, r_i)) ],

where r_i^* is the agent's truthful report. For the bounded-MAE rule the
optimiser is a corner solution: set r_i = mu (or the boundary nearest mu)
and raise m_i to the wealth-respecting cap. We implement that policy here.

This makes the "target" parameter mu the external-objective target of the
manipulator, and the stake a function of a ``manipulation_strength`` trait
that encodes how much score-rule loss the manipulator is willing to pay
to shift r_hat.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from onlinev2.behaviour.adversaries._utils import make_report
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState, clamp01
from onlinev2.behaviour.traits import UserTraits


@dataclass
class StrategicInfluenceBehaviour:
    """
    Aggregate manipulator targeting report ``target`` with stake scaled by
    ``manipulation_strength`` trait.

    Parameters
    ----------
    traits
        Single-account traits.
    target
        Desired value of the aggregate r_hat_t (in [0, 1]).
    snap_to_boundary
        If True, snap the report to 0 or 1 whenever target is not in the
        open interval (0, 1). Corresponds to the corner solution of the
        MAE-utility optimisation above.
    aggressiveness
        Multiplier on trait.manipulation_strength used for stake sizing.
    """
    traits: UserTraits
    target: float = 0.0
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    snap_to_boundary: bool = False
    aggressiveness: float = 1.0
    # Retained for backwards compatibility; unused (legacy parameter).
    kappa: float = 5.0

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
                    meta={"agent_type": "strategic_influence"},
                )
            ]

        target = clamp01(self.target)
        if self.snap_to_boundary:
            ref = 0.5
            if state.agg_history:
                try:
                    ref = float(np.asarray(state.agg_history[-1]).mean())
                except Exception:
                    ref = 0.5
            target = 0.0 if target < ref else 1.0

        report = make_report(target, self.scoring_mode, taus=self.taus,
                             sigma_q=0.04)

        strength = float(np.clip(
            self.aggressiveness * self.traits.manipulation_strength, 0.0, 1.5
        ))
        frac = float(np.clip(0.15 + 0.55 * strength, 0.0, 0.85))
        deposit = float(np.clip(frac * wealth, 0.0, min(wealth, self.b_max)))

        return [
            AgentAction(
                account_id=self.traits.user_id,
                participate=True,
                report=report,
                deposit=deposit,
                meta={
                    "agent_type": "strategic_influence",
                    "target": float(target),
                    "strength": strength,
                },
            )
        ]

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        return None
