from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict

import numpy as np

from onlinev2.behaviour.protocol import RoundPublicState
from onlinev2.behaviour.traits import UserTraits


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + float(np.exp(-x)))


@dataclass
class BaselineParticipation:
    base_shift: float = 0.0

    def reset(self, seed: int) -> None:
        return None

    def should_participate(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        rng: np.random.Generator,
    ) -> bool:
        wealth = float(state.wealth_prev.get(traits.user_id, traits.initial_wealth))
        if wealth <= 0.0:
            return False
        p = _sigmoid(traits.participation_logit + self.base_shift)
        return bool(rng.random() < p)


@dataclass
class BurstyParticipation:
    p_enter: float = 0.22
    p_stay: float = 0.82
    active: Dict[str, bool] = field(default_factory=dict)

    def reset(self, seed: int) -> None:
        self.active = {}

    def should_participate(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        rng: np.random.Generator,
    ) -> bool:
        wealth = float(state.wealth_prev.get(traits.user_id, traits.initial_wealth))
        if wealth <= 0.0:
            self.active[traits.user_id] = False
            return False
        was_active = self.active.get(traits.user_id, False)
        if was_active:
            is_active = bool(rng.random() < max(self.p_stay, traits.burstiness))
        else:
            enter_p = max(self.p_enter, 0.15 * (1.0 + traits.burstiness))
            is_active = bool(rng.random() < min(0.95, enter_p))
        self.active[traits.user_id] = is_active
        return is_active


@dataclass
class EdgeThresholdParticipation:
    min_edge: float = 0.06

    def reset(self, seed: int) -> None:
        return None

    def should_participate(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        rng: np.random.Generator,
    ) -> bool:
        wealth = float(state.wealth_prev.get(traits.user_id, traits.initial_wealth))
        if wealth <= 0.0:
            return False
        ref = 0.5
        if state.agg_history:
            try:
                ref = float(np.asarray(state.agg_history[-1]).mean())
            except Exception:
                ref = 0.5
        edge = abs(float(belief_mean) - ref)
        threshold = max(0.0, min(0.5, 0.5 * self.min_edge + 0.5 * traits.edge_threshold))
        return bool(edge >= threshold)


@dataclass
class AvoidSkillDecayParticipation:
    """Participate only when edge is large and skill estimate is not too decayed."""
    min_edge: float = 0.04
    sigma_floor: float = 0.2

    def reset(self, seed: int) -> None:
        return None

    def should_participate(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        rng: np.random.Generator,
    ) -> bool:
        wealth = float(state.wealth_prev.get(traits.user_id, traits.initial_wealth))
        if wealth <= 0.0:
            return False
        sigma = float(state.sigma_prev.get(traits.user_id, 1.0))
        ref = 0.5
        if state.agg_history:
            try:
                ref = float(np.asarray(state.agg_history[-1]).mean())
            except Exception:
                ref = 0.5
        edge = abs(float(belief_mean) - ref)
        return bool((edge >= self.min_edge) and (sigma >= self.sigma_floor))


@dataclass
class WealthShockSensitiveParticipation:
    """Reduce participation when recent profit is negative (wealth shock)."""
    shock_threshold: float = -0.5

    def reset(self, seed: int) -> None:
        return None

    def should_participate(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        rng: np.random.Generator,
    ) -> bool:
        wealth = float(state.wealth_prev.get(traits.user_id, traits.initial_wealth))
        if wealth <= 0.0:
            return False
        prev_profit = float(state.profit_prev.get(traits.user_id, 0.0))
        if prev_profit < self.shock_threshold:
            damp = 1.0 - traits.wealth_shock_sensitivity * min(1.0, 2.0 * abs(prev_profit))
            if rng.random() >= damp:
                return False
        p = _sigmoid(traits.participation_logit)
        return bool(rng.random() < p)


@dataclass
class AdaptiveParticipation:
    """Update entry propensity based on recent profit and recent score via observe_round_result."""
    base_logit: float = 0.25
    profit_decay: float = 0.9
    active: Dict[str, bool] = field(default_factory=dict)
    _propensity: Dict[str, float] = field(default_factory=dict)


    def reset(self, seed: int) -> None:
        self.active = {}
        self._propensity = {}

    def should_participate(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        rng: np.random.Generator,
    ) -> bool:
        wealth = float(state.wealth_prev.get(traits.user_id, traits.initial_wealth))
        if wealth <= 0.0:
            self.active[traits.user_id] = False
            return False
        prop = self._propensity.get(traits.user_id, self.base_logit)
        p = _sigmoid(prop)
        is_active = bool(rng.random() < p)
        self.active[traits.user_id] = is_active
        return is_active

    def observe_round_result(
        self, *, t: int, y_t: float, logs_t: Dict[str, Any], user_id: str = None, **kwargs: Any
    ) -> None:
        if user_id is None:
            return
        pba = logs_t.get("profit_by_account", {})
        profit_for_user = 0.0
        for aid, prof in pba.items():
            if aid == user_id or (isinstance(aid, str) and aid.startswith(user_id + "__")):
                profit_for_user += float(prof)
        if user_id not in self._propensity:
            self._propensity[user_id] = self.base_logit
        decay = self.profit_decay
        update = 2.0 * (profit_for_user if profit_for_user > 0 else -0.5)
        self._propensity[user_id] = decay * self._propensity[user_id] + (1.0 - decay) * update
