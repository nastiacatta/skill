from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np

from onlinev2.behaviour.protocol import RoundPublicState, clamp01
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


def _anchor_from_history(state: RoundPublicState, window: int) -> float:
    if len(state.y_history) == 0:
        return 0.5
    y = np.asarray(state.y_history[-window:], dtype=float)
    return float(np.mean(y))


@dataclass
class GaussianBeliefModel:
    """Truthful signal: belief anchored to public y history with trait noise and bias."""
    history_window: int = 20

    def reset(self, seed: int) -> None:
        return None

    def belief_mean(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        rng: np.random.Generator,
    ) -> float:
        anchor = _anchor_from_history(state, self.history_window)
        noisy = anchor + traits.bias + rng.normal(0.0, traits.noise_level)
        return clamp01(noisy)

    def belief_quantiles(
        self,
        mean: float,
        traits: UserTraits,
        taus: Sequence[float],
    ) -> np.ndarray:
        scale = max(0.03, traits.noise_level * (1.0 - 0.5 * traits.overconfidence))
        qs = [clamp01(mean + scale * _normal_ppf(float(tau))) for tau in taus]
        return np.asarray(qs, dtype=float)


# Alias for tests/configs that refer to "private signal" belief
PrivateSignalBelief = GaussianBeliefModel


@dataclass
class BiasedBeliefModel:
    """Biased signal: adds systematic bias to the anchor."""
    history_window: int = 20
    bias_shift: float = 0.1

    def reset(self, seed: int) -> None:
        return None

    def belief_mean(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        rng: np.random.Generator,
    ) -> float:
        anchor = _anchor_from_history(state, self.history_window)
        biased = anchor + traits.bias + self.bias_shift + rng.normal(0.0, traits.noise_level)
        return clamp01(biased)

    def belief_quantiles(
        self,
        mean: float,
        traits: UserTraits,
        taus: Sequence[float],
    ) -> np.ndarray:
        scale = max(0.03, traits.noise_level)
        qs = [clamp01(mean + scale * _normal_ppf(float(tau))) for tau in taus]
        return np.asarray(qs, dtype=float)


@dataclass
class OverconfidentBeliefModel:
    """Overconfident signal: narrower belief distribution than warranted."""
    history_window: int = 20
    narrow_factor: float = 0.5

    def reset(self, seed: int) -> None:
        return None

    def belief_mean(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        rng: np.random.Generator,
    ) -> float:
        anchor = _anchor_from_history(state, self.history_window)
        noise_scale = max(0.02, traits.noise_level * (1.0 - self.narrow_factor * (0.5 + traits.overconfidence)))
        noisy = anchor + traits.bias + rng.normal(0.0, noise_scale)
        return clamp01(noisy)

    def belief_quantiles(
        self,
        mean: float,
        traits: UserTraits,
        taus: Sequence[float],
    ) -> np.ndarray:
        scale = max(0.02, traits.noise_level * (1.0 - 0.6 * traits.overconfidence))
        qs = [clamp01(mean + scale * _normal_ppf(float(tau))) for tau in taus]
        return np.asarray(qs, dtype=float)


@dataclass
class UnderconfidentBeliefModel:
    """Underconfident signal: wider belief distribution than warranted."""
    history_window: int = 20
    widen_factor: float = 1.5

    def reset(self, seed: int) -> None:
        return None

    def belief_mean(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        rng: np.random.Generator,
    ) -> float:
        anchor = _anchor_from_history(state, self.history_window)
        noise_scale = traits.noise_level * self.widen_factor
        noisy = anchor + traits.bias + rng.normal(0.0, noise_scale)
        return clamp01(noisy)

    def belief_quantiles(
        self,
        mean: float,
        traits: UserTraits,
        taus: Sequence[float],
    ) -> np.ndarray:
        scale = max(0.05, traits.noise_level * self.widen_factor)
        qs = [clamp01(mean + scale * _normal_ppf(float(tau))) for tau in taus]
        return np.asarray(qs, dtype=float)


@dataclass
class CorrelatedBeliefModel:
    """Correlated signal source: beliefs share a common factor (deterministic per round)."""
    history_window: int = 20
    common_weight: float = 0.6

    def reset(self, seed: int) -> None:
        return None

    def belief_mean(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        rng: np.random.Generator,
    ) -> float:
        anchor = _anchor_from_history(state, self.history_window)
        common = self.common_weight * 0.15 * (np.sin(state.t * 0.7) + np.cos(state.t * 0.3))
        idiosyncratic = (1.0 - self.common_weight) * rng.normal(0.0, traits.noise_level)
        noisy = anchor + traits.bias + common + idiosyncratic
        return clamp01(noisy)

    def belief_quantiles(
        self,
        mean: float,
        traits: UserTraits,
        taus: Sequence[float],
    ) -> np.ndarray:
        scale = max(0.03, traits.noise_level)
        qs = [clamp01(mean + scale * _normal_ppf(float(tau))) for tau in taus]
        return np.asarray(qs, dtype=float)


@dataclass
class FastAdaptorBeliefModel:
    """Fast adaptor to drift: short history window, quick to react to regime changes."""
    history_window: int = 5

    def reset(self, seed: int) -> None:
        return None

    def belief_mean(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        rng: np.random.Generator,
    ) -> float:
        anchor = _anchor_from_history(state, self.history_window)
        noisy = anchor + rng.normal(0.0, traits.noise_level)
        return clamp01(noisy)

    def belief_quantiles(
        self,
        mean: float,
        traits: UserTraits,
        taus: Sequence[float],
    ) -> np.ndarray:
        scale = max(0.03, traits.noise_level)
        qs = [clamp01(mean + scale * _normal_ppf(float(tau))) for tau in taus]
        return np.asarray(qs, dtype=float)


@dataclass
class SlowAdaptorBeliefModel:
    """Slow adaptor to drift: long history window, slow to react to regime changes."""
    history_window: int = 50

    def reset(self, seed: int) -> None:
        return None

    def belief_mean(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        rng: np.random.Generator,
    ) -> float:
        anchor = _anchor_from_history(state, min(self.history_window, len(state.y_history) or 1))
        noisy = anchor + rng.normal(0.0, traits.noise_level)
        return clamp01(noisy)

    def belief_quantiles(
        self,
        mean: float,
        traits: UserTraits,
        taus: Sequence[float],
    ) -> np.ndarray:
        scale = max(0.03, traits.noise_level)
        qs = [clamp01(mean + scale * _normal_ppf(float(tau))) for tau in taus]
        return np.asarray(qs, dtype=float)


@dataclass
class InsiderBeliefModel:
    """Insider signal: higher precision and earlier access (lower effective noise)."""
    history_window: int = 20
    precision_bonus: float = 0.5

    def reset(self, seed: int) -> None:
        return None

    def belief_mean(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        rng: np.random.Generator,
    ) -> float:
        anchor = _anchor_from_history(state, self.history_window)
        noise = max(0.02, traits.noise_level * (1.0 - self.precision_bonus) * (1.0 - 0.3 * traits.insider_bonus))
        noisy = anchor + traits.bias + rng.normal(0.0, noise)
        return clamp01(noisy)

    def belief_quantiles(
        self,
        mean: float,
        traits: UserTraits,
        taus: Sequence[float],
    ) -> np.ndarray:
        scale = max(0.02, traits.noise_level * (1.0 - 0.5 * traits.insider_bonus))
        qs = [clamp01(mean + scale * _normal_ppf(float(tau))) for tau in taus]
        return np.asarray(qs, dtype=float)


@dataclass
class ConceptDriftExposedBeliefModel:
    """Concept drift exposed: signal degrades under regime shift (higher noise when recent variance is high)."""
    history_window: int = 20
    drift_window: int = 10
    degradation: float = 0.5

    def reset(self, seed: int) -> None:
        return None

    def belief_mean(
        self,
        traits: UserTraits,
        state: RoundPublicState,
        rng: np.random.Generator,
    ) -> float:
        anchor = _anchor_from_history(state, self.history_window)
        recent = state.y_history[-self.drift_window:] if len(state.y_history) >= self.drift_window else state.y_history
        var_recent = float(np.var(recent)) if len(recent) > 1 else 0.0
        extra_noise = self.degradation * min(1.0, var_recent * 4.0)
        noise_scale = traits.noise_level * (1.0 + extra_noise)
        noisy = anchor + traits.bias + rng.normal(0.0, noise_scale)
        return clamp01(noisy)

    def belief_quantiles(
        self,
        mean: float,
        traits: UserTraits,
        taus: Sequence[float],
    ) -> np.ndarray:
        scale = max(0.03, traits.noise_level)
        qs = [clamp01(mean + scale * _normal_ppf(float(tau))) for tau in taus]
        return np.asarray(qs, dtype=float)
