from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class ExponentialDepositAdapter:
    gamma: float = 2.0

    def __call__(self, sigma: float, wealth: float, b_max: float = 10.0) -> float:
        value = float(wealth) * (1.0 - np.exp(-self.gamma * max(0.0, float(sigma))))
        return float(np.clip(value, 0.0, min(float(wealth), float(b_max))))


@dataclass
class FixedDepositAdapter:
    amount: float = 1.0

    def __call__(self, sigma: float, wealth: float, b_max: float = 10.0) -> float:
        return float(np.clip(self.amount, 0.0, min(float(wealth), float(b_max))))


@dataclass
class BankrollFractionAdapter:
    fraction: float = 0.1

    def __call__(self, sigma: float, wealth: float, b_max: float = 10.0) -> float:
        value = self.fraction * float(wealth)
        return float(np.clip(value, 0.0, min(float(wealth), float(b_max))))
