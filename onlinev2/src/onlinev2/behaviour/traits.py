from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np


@dataclass(frozen=True)
class UserTraits:
    user_id: str
    initial_wealth: float = 10.0
    noise_level: float = 0.12
    bias: float = 0.0
    overconfidence: float = 0.0
    stake_fraction: float = 0.15
    participation_logit: float = 0.25
    burstiness: float = 0.65
    edge_threshold: float = 0.08
    risk_aversion: float = 0.5
    skill_decay_sensitivity: float = 0.5
    manipulation_strength: float = 0.75
    insider_bonus: float = 0.35
    wealth_shock_sensitivity: float = 0.5
    adaptive_propensity_decay: float = 0.9


def generate_population(n_users: int, seed: int = 42, prefix: str = "user") -> List[UserTraits]:
    rng = np.random.default_rng(seed)
    traits: List[UserTraits] = []
    for i in range(n_users):
        wealth = float(np.clip(rng.lognormal(mean=2.0, sigma=0.45), 2.0, 50.0))
        noise = float(np.clip(rng.normal(0.12, 0.05), 0.02, 0.35))
        bias = float(np.clip(rng.normal(0.0, 0.08), -0.25, 0.25))
        overconfidence = float(np.clip(rng.normal(0.0, 0.18), -0.5, 0.5))
        stake_fraction = float(np.clip(rng.beta(2.0, 10.0), 0.03, 0.45))
        participation_logit = float(rng.normal(0.25, 0.65))
        burstiness = float(np.clip(rng.beta(3.0, 2.0), 0.05, 0.98))
        edge_threshold = float(np.clip(rng.normal(0.08, 0.05), 0.0, 0.25))
        risk_aversion = float(np.clip(rng.gamma(shape=2.0, scale=0.4), 0.05, 3.0))
        skill_decay_sensitivity = float(np.clip(rng.beta(2.0, 2.5), 0.05, 0.95))
        manipulation_strength = float(np.clip(rng.beta(2.0, 2.0), 0.1, 0.95))
        insider_bonus = float(np.clip(rng.beta(2.0, 6.0), 0.05, 0.6))
        wealth_shock_sensitivity = float(np.clip(rng.beta(2.0, 2.0), 0.1, 0.9))
        adaptive_propensity_decay = float(np.clip(rng.beta(8.0, 2.0), 0.7, 0.99))
        traits.append(
            UserTraits(
                user_id=f"{prefix}_{i}",
                initial_wealth=wealth,
                noise_level=noise,
                bias=bias,
                overconfidence=overconfidence,
                stake_fraction=stake_fraction,
                participation_logit=participation_logit,
                burstiness=burstiness,
                edge_threshold=edge_threshold,
                risk_aversion=risk_aversion,
                skill_decay_sensitivity=skill_decay_sensitivity,
                manipulation_strength=manipulation_strength,
                insider_bonus=insider_bonus,
                wealth_shock_sensitivity=wealth_shock_sensitivity,
                adaptive_propensity_decay=adaptive_propensity_decay,
            )
        )
    return traits
