from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np

from onlinev2.behaviour.protocol import clamp01
from onlinev2.behaviour.traits import UserTraits

try:
    from scipy.stats import norm as _norm
except Exception:
    _norm = None


def _normal_ppf(p: float) -> float:
    if _norm is not None:
        return float(_norm.ppf(p))
    grid_p = np.array([0.001, 0.01, 0.05, 0.5, 0.95, 0.99, 0.999], dtype=float)
    grid_z = np.array([-3.09, -2.33, -1.645, 0.0, 1.645, 2.33, 3.09], dtype=float)
    return float(np.interp(float(p), grid_p, grid_z))


def _quantiles_from_mean(mean: float, scale: float, taus: Sequence[float]) -> np.ndarray:
    return np.asarray([clamp01(mean + scale * _normal_ppf(float(t))) for t in taus], dtype=float)


@dataclass
class TruthfulReporting:
    """Report belief truthfully without strategic distortion."""
    def reset(self, seed: int) -> None:
        return None

    def report(
        self,
        belief_mean: float,
        traits: UserTraits,
        rng: np.random.Generator,
        *,
        scoring_mode: str = "point_mae",
        taus: Optional[Sequence[float]] = None,
        target: Optional[float] = None,
        state=None,
        **kwargs,
    ):
        if scoring_mode == "quantiles_crps":
            taus = [0.1, 0.5, 0.9] if taus is None else taus
            return _quantiles_from_mean(belief_mean, max(0.03, traits.noise_level), taus)
        return clamp01(belief_mean)


@dataclass
class MiscalibratedReporting:
    """Report with systematic miscalibration (over/underconfidence)."""
    strength: float = 0.35

    def reset(self, seed: int) -> None:
        return None

    def report(
        self,
        belief_mean: float,
        traits: UserTraits,
        rng: np.random.Generator,
        *,
        scoring_mode: str = "point_mae",
        taus: Optional[Sequence[float]] = None,
        target: Optional[float] = None,
        state=None,
        **kwargs,
    ):
        shifted = 0.5 + (belief_mean - 0.5) * (1.0 + self.strength * traits.overconfidence)
        shifted = clamp01(shifted + 0.5 * traits.bias)
        if scoring_mode == "quantiles_crps":
            taus = [0.1, 0.5, 0.9] if taus is None else taus
            scale = max(0.02, traits.noise_level * (1.0 - 0.35 * traits.overconfidence))
            return _quantiles_from_mean(shifted, scale, taus)
        return shifted


@dataclass
class HedgedReporting:
    """Hedged reporting for risk aversion: pull reports toward 0.5."""
    hedge_strength: float = 0.45

    def reset(self, seed: int) -> None:
        return None

    def report(
        self,
        belief_mean: float,
        traits: UserTraits,
        rng: np.random.Generator,
        *,
        scoring_mode: str = "point_mae",
        taus: Optional[Sequence[float]] = None,
        target: Optional[float] = None,
        state=None,
        **kwargs,
    ):
        lam = 1.0 / (1.0 + self.hedge_strength * max(0.0, traits.risk_aversion))
        hedged = clamp01(0.5 + lam * (belief_mean - 0.5))
        if scoring_mode == "quantiles_crps":
            taus = [0.1, 0.5, 0.9] if taus is None else taus
            scale = max(0.04, traits.noise_level * (1.0 + 0.4 * traits.risk_aversion))
            return _quantiles_from_mean(hedged, scale, taus)
        return hedged


@dataclass
class StrategicReporting:
    """Strategic reporting toward a target (e.g. to move the aggregate)."""
    pull: float = 0.75

    def reset(self, seed: int) -> None:
        return None

    def report(
        self,
        belief_mean: float,
        traits: UserTraits,
        rng: np.random.Generator,
        *,
        scoring_mode: str = "point_mae",
        taus: Optional[Sequence[float]] = None,
        target: Optional[float] = None,
        state=None,
        **kwargs,
    ):
        if target is None:
            target = 1.0 if belief_mean >= 0.5 else 0.0
        reported = clamp01((1.0 - self.pull) * belief_mean + self.pull * float(target))
        if scoring_mode == "quantiles_crps":
            taus = [0.1, 0.5, 0.9] if taus is None else taus
            return _quantiles_from_mean(reported, max(0.03, traits.noise_level), taus)
        return reported


@dataclass
class StrategicExternalityReporting:
    """Pushes the aggregate rather than maximising immediate score; uses target=aggregate."""
    pull: float = 0.6

    def reset(self, seed: int) -> None:
        return None

    def report(
        self,
        belief_mean: float,
        traits: UserTraits,
        rng: np.random.Generator,
        *,
        scoring_mode: str = "point_mae",
        taus: Optional[Sequence[float]] = None,
        target: Optional[float] = None,
        state=None,
        **kwargs,
    ):
        agg = 0.5 if target is None else float(target)
        reported = clamp01((1.0 - self.pull) * belief_mean + self.pull * agg)
        if scoring_mode == "quantiles_crps":
            taus = [0.1, 0.5, 0.9] if taus is None else taus
            return _quantiles_from_mean(reported, max(0.03, traits.noise_level), taus)
        return reported


@dataclass
class ReputationProtectionReporting:
    """Avoids extreme reports when skill estimate (sigma) is at risk (low sigma)."""
    sigma_floor: float = 0.25
    damp_strength: float = 0.7

    def reset(self, seed: int) -> None:
        return None

    def report(
        self,
        belief_mean: float,
        traits: UserTraits,
        rng: np.random.Generator,
        *,
        scoring_mode: str = "point_mae",
        taus: Optional[Sequence[float]] = None,
        target: Optional[float] = None,
        state=None,
        **kwargs,
    ):
        sigma = 1.0
        if state is not None and hasattr(state, "sigma_prev"):
            sigma = float(state.sigma_prev.get(traits.user_id, 1.0))
        if sigma >= self.sigma_floor:
            base = belief_mean
        else:
            damp = self.damp_strength * (1.0 - sigma / self.sigma_floor)
            base = clamp01(0.5 + (1.0 - damp) * (belief_mean - 0.5))
        if scoring_mode == "quantiles_crps":
            taus = [0.1, 0.5, 0.9] if taus is None else taus
            return _quantiles_from_mean(base, max(0.03, traits.noise_level), taus)
        return base
