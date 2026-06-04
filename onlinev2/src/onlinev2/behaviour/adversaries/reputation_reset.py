"""
Reputation-reset (whitewashing) adversary.

Threat model: in an online skill system, once an agent accumulates a
poor EWMA loss its σ falls and its effective wager shrinks. A rational
attacker can instead *destroy* a low-σ identity and create a new one
from scratch, resetting L_t and σ_t back to the neutral prior. This is
the "whitewashing" threat catalogued in reputation-system literature
(Feldman & Chuang 2004; Marti & Garcia-Molina 2006) and is distinct
from sybil-splitting: the attacker does not operate multiple identities
in parallel, it sequentially abandons and re-creates a single active
identity.

Design.  The adversary plays a manipulation strategy (large target
offset from truth) while its "reputation stock" is high. Each round it
measures a reputation proxy (its cumulative profit over the current
identity window). When the proxy falls below ``reset_threshold``, it
abandons the current account -- the next ``act`` call uses a fresh
`account_id` suffix. Each fresh identity starts with the mechanism's
default prior σ via the standard `run_round` initialisation path.

Metric of interest: attacker profit aggregated across *all* identities
under its control. If the mechanism penalises reset effectively (e.g.
via a newcomer hold-out period or κ > 0 staleness decay that discounts
newcomers), aggregate profit stays bounded.  If not, the attacker can
rebuild reputation cheaply after each reset.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from onlinev2.behaviour.adversaries._utils import make_report
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState, clamp01
from onlinev2.behaviour.traits import UserTraits


@dataclass
class ReputationResetBehaviour:
    """Whitewashing attacker that resets identity when reputation drops.

    Parameters
    ----------
    traits
        Base traits; `user_id` is used as the parent prefix.
    target
        Manipulation target (aggregate shift value).
    reset_threshold
        If cumulative profit since last reset falls below this number
        the agent adopts a new identity. Lower (more negative) threshold
        = more patient attacker.
    cooldown
        Minimum number of rounds between resets. Prevents pathological
        reset-every-round loops when the attack is badly calibrated.
    warmup
        First ``warmup`` rounds of every fresh identity are played with
        a benign anchor-based report ("honeymoon") so the identity
        accrues a positive reputation stock before the manipulation
        begins.
    """
    traits: UserTraits
    target: float = 0.9
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    reset_threshold: float = -5.0
    cooldown: int = 50
    warmup: int = 20
    jitter: float = 0.04

    _identity_idx: int = field(default=0, init=False)
    _last_reset_round: int = field(default=-10_000, init=False)
    _round_in_identity: int = field(default=0, init=False)
    _cum_profit_identity: float = field(default=0.0, init=False)
    _reset_log: List[Dict[str, float]] = field(default_factory=list, init=False)

    def reset(self, seed: int) -> None:
        self.rng = np.random.default_rng(seed)
        self._identity_idx = 0
        self._last_reset_round = -10_000
        self._round_in_identity = 0
        self._cum_profit_identity = 0.0
        self._reset_log = []

    # -- helpers ---------------------------------------------------------

    def _current_account(self) -> str:
        if self._identity_idx == 0:
            return self.traits.user_id
        return f"{self.traits.user_id}__reset_{self._identity_idx}"

    def _maybe_reset(self, t: int) -> None:
        """Trigger a reset if cumulative profit dropped below threshold
        and cooldown has elapsed."""
        if (t - self._last_reset_round) < self.cooldown:
            return
        if self._cum_profit_identity <= self.reset_threshold:
            self._identity_idx += 1
            self._last_reset_round = t
            self._round_in_identity = 0
            self._reset_log.append({
                "t": int(t),
                "new_identity_idx": int(self._identity_idx),
                "cum_profit_at_reset": float(self._cum_profit_identity),
            })
            self._cum_profit_identity = 0.0

    # -- interface -------------------------------------------------------

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        self._maybe_reset(int(state.t))

        acc = self._current_account()
        # Wealth attribution: the mechanism sees each fresh account as
        # a new unseen identity. We track wealth under the parent.
        wealth = max(0.0, float(state.wealth_prev.get(acc, self.traits.initial_wealth)))
        if wealth <= 0.0:
            return [
                AgentAction(
                    account_id=acc,
                    participate=False,
                    report=None,
                    deposit=0.0,
                    meta={
                        "agent_type": "reputation_reset",
                        "identity_idx": int(self._identity_idx),
                        "parent": self.traits.user_id,
                    },
                )
            ]

        # Warmup: play benign until reputation stock is built.
        if self._round_in_identity < self.warmup:
            anchor = 0.5
            if state.agg_history:
                try:
                    anchor = float(np.asarray(state.agg_history[-1]).mean())
                except Exception:
                    anchor = 0.5
            scalar = clamp01(anchor + self.rng.normal(0.0, self.jitter))
            mode = "warmup"
        else:
            scalar = clamp01(self.target + self.rng.normal(0.0, self.jitter))
            mode = "manipulate"

        report = make_report(scalar, self.scoring_mode, taus=self.taus,
                             sigma_q=max(0.03, self.jitter))

        stake_frac = 0.25 if mode == "warmup" else min(
            0.8, 0.2 + 0.6 * self.traits.manipulation_strength
        )
        deposit = float(np.clip(stake_frac * wealth, 0.0, min(wealth, self.b_max)))

        self._round_in_identity += 1
        return [
            AgentAction(
                account_id=acc,
                participate=True,
                report=report,
                deposit=deposit,
                meta={
                    "agent_type": "reputation_reset",
                    "identity_idx": int(self._identity_idx),
                    "parent": self.traits.user_id,
                    "mode": mode,
                },
            )
        ]

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        # Track this identity's cumulative profit.
        acc = self._current_account()
        if "profit_by_account" in logs_t:
            profit = float(logs_t["profit_by_account"].get(acc, 0.0))
        elif "ids" in logs_t and "profit" in logs_t:
            try:
                idx = list(logs_t["ids"]).index(acc)
                profit = float(logs_t["profit"][idx])
            except (ValueError, IndexError):
                profit = 0.0
        else:
            profit = 0.0
        self._cum_profit_identity += profit

    @property
    def reset_log(self) -> List[Dict[str, float]]:
        """History of reset events for post-hoc analysis."""
        return list(self._reset_log)

    @property
    def num_resets(self) -> int:
        return self._identity_idx
