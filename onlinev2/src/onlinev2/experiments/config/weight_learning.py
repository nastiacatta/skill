"""Weight learning experiment config."""
from __future__ import annotations

from dataclasses import dataclass

from .base import ExperimentConfig


@dataclass
class WeightLearningConfig(ExperimentConfig):
    name: str = "weight_learning"
    T: int = 20000
    n_forecasters: int = 3
    seed: int = 42
    dgp: str = "aggregation_method1"
    true_w: list[float] | None = None  # e.g. [0.8, 0.1, 0.5]
    normalise_w: bool = False
    sigma_mu_noise: float = 1.0  # for method 3
    eta: float = 0.015
    eta_decay: float = 2e-5
    smooth_window: int = 800
    methods: tuple[int, ...] = (1, 2, 3)
