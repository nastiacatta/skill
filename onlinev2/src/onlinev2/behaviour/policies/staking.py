from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np

from onlinev2.behaviour.protocol import RoundPublicState
from onlinev2.behaviour.traits import UserTraits


def _current_wealth(traits: UserTraits, state: RoundPublicState) -> float:
    return max(0.0, float(state.wealth_prev.get(traits.user_id, traits.initial_wealth)))


def _clip_deposit(value: float, wealth: float, b_max: float) -> float:
    return float(np.clip(value, 0.0, min(max(wealth, 0.0), b_max)))


@dataclass
class FixedFractionStaking:
    floor: float = 0.0

    def reset(self, seed: int) -> None:
        return None

    def choose_deposit(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        report,
        rng: np.random.Generator,
        *,
        b_max: float = 10.0,
    ) -> float:
        wealth = _current_wealth(traits, state)
        if wealth <= 0.0:
            return 0.0
        return _clip_deposit(max(self.floor, traits.stake_fraction * wealth), wealth, b_max)


@dataclass
class KellyLikeStaking:
    multiplier: float = 1.35

    def reset(self, seed: int) -> None:
        return None

    def choose_deposit(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        report,
        rng: np.random.Generator,
        *,
        b_max: float = 10.0,
    ) -> float:
        wealth = _current_wealth(traits, state)
        if wealth <= 0.0:
            return 0.0
        ref = 0.5
        if state.agg_history:
            try:
                ref = float(np.asarray(state.agg_history[-1]).mean())
            except Exception:
                ref = 0.5
        edge = abs(float(belief_mean) - ref)
        frac = min(0.75, self.multiplier * traits.stake_fraction * (0.25 + 2.5 * edge))
        return _clip_deposit(frac * wealth, wealth, b_max)


@dataclass
class HouseMoneyStaking:
    gain_boost: float = 0.35

    def reset(self, seed: int) -> None:
        return None

    def choose_deposit(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        report,
        rng: np.random.Generator,
        *,
        b_max: float = 10.0,
    ) -> float:
        wealth = _current_wealth(traits, state)
        if wealth <= 0.0:
            return 0.0
        prev_profit = float(state.profit_prev.get(traits.user_id, 0.0))
        boost = 1.0 + self.gain_boost * (1.0 if prev_profit > 0.0 else 0.0)
        frac = min(0.8, traits.stake_fraction * boost)
        return _clip_deposit(frac * wealth, wealth, b_max)


@dataclass
class LumpyTierStaking:
    """Tiered staking: deposit must be one of the predefined tiers."""
    tiers: Sequence[float] = (0.5, 1.0, 2.0, 5.0, 10.0)

    def reset(self, seed: int) -> None:
        return None

    def choose_deposit(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        report,
        rng: np.random.Generator,
        *,
        b_max: float = 10.0,
    ) -> float:
        wealth = _current_wealth(traits, state)
        if wealth <= 0.0:
            return 0.0
        raw = traits.stake_fraction * wealth
        feasible = [float(t) for t in self.tiers if float(t) <= min(wealth, b_max)]
        if not feasible:
            return 0.0
        idx = int(np.argmin(np.abs(np.asarray(feasible, dtype=float) - raw)))
        return float(feasible[idx])


@dataclass
class BreakEvenStaking:
    """Break-even staking: reduce stake when cumulative profit is negative."""
    base_fraction: float = 0.15
    cutback: float = 0.5

    def reset(self, seed: int) -> None:
        return None

    def choose_deposit(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        report,
        rng: np.random.Generator,
        *,
        b_max: float = 10.0,
    ) -> float:
        wealth = _current_wealth(traits, state)
        if wealth <= 0.0:
            return 0.0
        prev_profit = float(state.profit_prev.get(traits.user_id, 0.0))
        frac = self.base_fraction if prev_profit >= 0 else self.base_fraction * self.cutback
        return _clip_deposit(frac * wealth, wealth, b_max)


@dataclass
class AffordabilityCappedStaking:
    """Affordability-capped staking: cap at a fraction of wealth."""
    cap_fraction: float = 0.3

    def reset(self, seed: int) -> None:
        return None

    def choose_deposit(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        report,
        rng: np.random.Generator,
        *,
        b_max: float = 10.0,
    ) -> float:
        wealth = _current_wealth(traits, state)
        if wealth <= 0.0:
            return 0.0
        raw = traits.stake_fraction * wealth
        capped = min(raw, self.cap_fraction * wealth)
        return _clip_deposit(capped, wealth, b_max)


@dataclass
class VolatilitySensitiveStaking:
    """Reduces stake when uncertainty (sigma) is high."""
    base_fraction: float = 0.15
    volatility_penalty: float = 0.6

    def reset(self, seed: int) -> None:
        return None

    def choose_deposit(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        belief_mean: float,
        report,
        rng: np.random.Generator,
        *,
        b_max: float = 10.0,
    ) -> float:
        wealth = _current_wealth(traits, state)
        if wealth <= 0.0:
            return 0.0
        sigma = float(state.sigma_prev.get(traits.user_id, 1.0))
        damp = 1.0 - self.volatility_penalty * (1.0 - sigma)
        frac = max(0.03, self.base_fraction * damp)
        return _clip_deposit(frac * wealth, wealth, b_max)
