from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, Sequence

import numpy as np

Report = Any


@dataclass(frozen=True)
class RoundPublicState:
    """
    Observable state at the start of round t.

    This is intentionally lagged information only.
    The realised current-round outcome y_t must never appear here.
    """
    t: int
    y_history: Sequence[float]
    agg_history: Sequence[Report]
    weights_prev: Dict[str, float]
    sigma_prev: Dict[str, float]
    wealth_prev: Dict[str, float]
    profit_prev: Dict[str, float]


@dataclass(frozen=True)
class AgentAction:
    """
    One account-level submission to the mechanism.
    """
    account_id: str
    participate: bool
    report: Optional[Report] = None
    deposit: float = 0.0
    meta: Dict[str, Any] = field(default_factory=dict)


class BehaviourModel(Protocol):
    def reset(self, seed: int) -> None:
        ...

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        ...

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        ...


def clamp01(x: float) -> float:
    return float(np.clip(float(x), 0.0, 1.0))
