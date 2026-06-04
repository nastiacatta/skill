"""
Privileged-information behavioural regime.

Theory context: proper-scoring-rule mechanisms reward better predictors in
expectation, so an agent with lower-variance or *earlier* access to a
signal about y_t can extract positive expected profit from truthful
reporting alone (Lambert et al. 2008; Johnstone 2007). In practice, the
"insider" archetype captures institutional forecasters, internal modellers,
or agents with side information.

Two F_{t-1}-compliant signal models are supported:

  * ``lagged_noisy``: reports y_{t-k} + N(0, sigma_priv) for some
    non-negative lag k. The canonical setting is k=1 (uses the most recent
    *published* outcome) with low sigma_priv. This faithfully models a
    forecaster that sees the outcome one round late but with higher
    precision than the general public.
  * ``leaked_future`` (audit-only, guarded): reports y_{t+k_leak} with low
    noise. This *deliberately* violates the F_{t-1} boundary and is intended
    only for stress testing leakage detection. It is disabled by default
    and raises a warning when used. Callers must set
    ``allow_leakage=True`` explicitly.

For audit and back-compat a ``y_sequence`` kwarg is retained; when passed
together with ``allow_leakage=True`` and ``mode="leaked_future"``, the
adversary uses y_{t + lookahead}. When ``allow_leakage=False`` (default)
and a ``y_sequence`` is given, the adversary is automatically switched to
``lagged_noisy`` and uses y_{t-1}, printing a soft warning; this preserves
existing experiments without silently violating the information boundary.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from onlinev2.behaviour.adversaries._utils import make_report
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState, clamp01
from onlinev2.behaviour.traits import UserTraits


@dataclass
class PrivilegedInformationBehaviour:
    """F_{t-1}-measurable insider with high-precision signal on y_{t-k}."""

    traits: UserTraits
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    y_sequence: Optional[Sequence[float]] = None
    mode: str = "lagged_noisy"  # "lagged_noisy" | "leaked_future"
    lag: int = 1
    lookahead: int = 0
    sigma_priv: float = 0.015
    allow_leakage: bool = False
    _warned: bool = field(default=False, init=False, repr=False)

    def reset(self, seed: int) -> None:
        self.rng = np.random.default_rng(seed)
        self._warned = False

    def _signal(self, state: RoundPublicState) -> float:
        """Return the insider's conditional estimate of y_t, F_{t-1}-measurable by default."""
        t = int(state.t)

        if self.mode == "leaked_future":
            if not self.allow_leakage:
                if not self._warned:
                    warnings.warn(
                        "PrivilegedInformationBehaviour: mode=leaked_future "
                        "requires allow_leakage=True. Falling back to lagged_noisy.",
                        RuntimeWarning,
                        stacklevel=2,
                    )
                    self._warned = True
                mode = "lagged_noisy"
            else:
                mode = "leaked_future"
        else:
            mode = "lagged_noisy"

        if mode == "leaked_future" and self.y_sequence is not None:
            idx = min(len(self.y_sequence) - 1, max(0, t + int(self.lookahead)))
            base = float(self.y_sequence[idx])
        else:
            # F_{t-1}-compliant: use y_{t - lag} from the public history.
            # Lag=1 means the outcome published one round ago.
            lag = max(1, int(self.lag))
            if state.y_history and len(state.y_history) >= lag:
                base = float(state.y_history[-lag])
            elif state.y_history:
                base = float(state.y_history[-1])
            else:
                base = 0.5

        noise = self.rng.normal(0.0, max(1e-4, self.sigma_priv))
        return clamp01(base + noise)

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        wealth = max(0.0, float(state.wealth_prev.get(self.traits.user_id, self.traits.initial_wealth)))
        if wealth <= 0.0:
            return [
                AgentAction(
                    account_id=self.traits.user_id,
                    participate=False,
                    report=None,
                    deposit=0.0,
                    meta={"agent_type": "privileged_information"},
                )
            ]

        report = make_report(
            self._signal(state),
            self.scoring_mode,
            taus=self.taus,
            sigma_q=max(0.02, self.sigma_priv * 2),
        )

        # Insider stakes at a higher fraction reflecting elevated precision.
        frac = min(0.85, self.traits.stake_fraction + self.traits.insider_bonus)
        deposit = float(np.clip(frac * wealth, 0.0, min(wealth, self.b_max)))

        return [
            AgentAction(
                account_id=self.traits.user_id,
                participate=True,
                report=report,
                deposit=deposit,
                meta={
                    "agent_type": "privileged_information",
                    "mode": self.mode if self.allow_leakage else "lagged_noisy",
                    "lag": int(self.lag),
                    "sigma_priv": float(self.sigma_priv),
                },
            )
        ]

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        return None
