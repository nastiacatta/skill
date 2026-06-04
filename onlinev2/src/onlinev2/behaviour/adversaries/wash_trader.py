"""
Wash / activity-gaming adversary.

Threat model: a single actor controls k linked accounts and submits
near-duplicate participation to inflate activity metrics (participation
rate, N_t, N_eff) without necessarily improving forecast accuracy. The
classic wash-trade outcome in a parimutuel is a zero net transfer between
the accounts (minus fees); in a self-financed WSWM it produces bounded
internal transfers that net to near-zero across the group while raising
the count-based activity signals.

This implementation parameterises:

  * ``k_accounts``: number of linked accounts.
  * ``sync_strength``: probability that accounts submit the same report
    (1.0 = perfectly synchronised; 0.0 = independent jitter).
  * ``wash_report_style``: "anchor" (report near the public aggregate so
    deposits lose little) or "split_bet" (half accounts report 0, half
    report 1 so the internal transfer is maximised).
  * ``per_account_stake``: optional absolute per-account deposit; when
    None the total budget is split evenly across accounts.
  * ``total_stake_fraction``: fraction of wealth spread across the k
    accounts. The per-account deposit is therefore
    total_stake_fraction * wealth / k_accounts (capped).

All accounts share a stable parent name prefix so downstream detectors
(see ``onlinev2.behaviour.detection``) can audit linkage.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from onlinev2.behaviour.adversaries._utils import make_report
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState, clamp01
from onlinev2.behaviour.traits import UserTraits


@dataclass
class WashTraderBehaviour:
    """Linked-account activity gamer."""
    traits: UserTraits
    k_accounts: int = 3
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    sync_strength: float = 1.0
    wash_report_style: str = "anchor"  # "anchor" | "split_bet"
    per_account_stake: Optional[float] = None
    total_stake_fraction: float = 0.3
    anchor_noise: float = 0.03

    def reset(self, seed: int) -> None:
        self.rng = np.random.default_rng(seed)

    def _anchor(self, state: RoundPublicState) -> float:
        if state.y_history:
            tail = state.y_history[-min(10, len(state.y_history)):]
            return float(np.mean(tail))
        return 0.5

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        wealth = max(0.0, float(state.wealth_prev.get(self.traits.user_id, self.traits.initial_wealth)))
        k = max(1, int(self.k_accounts))
        if wealth <= 0.0:
            return [
                AgentAction(
                    account_id=f"{self.traits.user_id}__wash_{j}",
                    participate=False,
                    report=None,
                    deposit=0.0,
                    meta={"agent_type": "wash_trader", "wash_parent": self.traits.user_id},
                )
                for j in range(k)
            ]

        if self.per_account_stake is not None:
            per_deposit = float(max(0.0, self.per_account_stake))
        else:
            total_budget = float(np.clip(self.total_stake_fraction * wealth, 0.0, wealth))
            per_deposit = total_budget / float(k)
        per_deposit = float(np.clip(per_deposit, 0.0, min(wealth / k, self.b_max)))

        anchor = self._anchor(state)

        if self.wash_report_style == "split_bet":
            # Half report 0, half 1 -- maximal internal transfer, small net impact
            # on r_hat when weights are balanced, but still raises N_eff count.
            base_reports = np.array(
                [0.0 if j < k // 2 else 1.0 for j in range(k)], dtype=float
            )
        else:
            shared = clamp01(anchor + self.rng.normal(0.0, self.anchor_noise))
            base_reports = np.full(k, shared, dtype=float)

        out: List[AgentAction] = []
        for j in range(k):
            if self.rng.random() > self.sync_strength:
                # Desynchronised: add extra jitter
                jitter = self.rng.normal(0.0, 0.05)
            else:
                jitter = 0.0
            scalar = clamp01(float(base_reports[j]) + jitter)
            report = make_report(scalar, self.scoring_mode, taus=self.taus,
                                 sigma_q=max(0.03, self.anchor_noise * 2))
            out.append(
                AgentAction(
                    account_id=f"{self.traits.user_id}__wash_{j}",
                    participate=True,
                    report=report,
                    deposit=per_deposit,
                    meta={
                        "agent_type": "wash_trader",
                        "wash_parent": self.traits.user_id,
                        "wash_style": self.wash_report_style,
                        "wash_index": j,
                        "wash_k": k,
                    },
                )
            )
        return out

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        return None
