"""
Detector-aware behavioural variant.

Adversary that (i) pursues an underlying manipulation objective and
(ii) monitors a running detector statistic via ``observe_round_result``,
throttling or randomising its report to keep the detector score below a
budget. Captures the "adaptive evader" threat model in which an attacker
learns to mimic benign participation after repeated detection pressure.

Detector feedback is consumed from ``logs_t`` (keys
"detector_scores" if emitted, otherwise inferred from ``anomaly`` style
keys). When no detector feedback is available the adversary behaves as a
randomised strategic influencer.

Evasion mechanics:

  * tracks an EWMA estimate of the detector score attributed to itself;
  * when the EWMA exceeds ``suspicion_threshold``, mix in a benign
    anchor-based report (hedging toward the public aggregate) and reduce
    stake by ``quiet_cutback`` for the next round;
  * otherwise behave like :class:`StrategicInfluenceBehaviour` with added
    jitter controlled by ``jitter``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from onlinev2.behaviour.adversaries._utils import make_report
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState, clamp01
from onlinev2.behaviour.traits import UserTraits


@dataclass
class DetectorAwareBehaviour:
    """Adaptive evader that throttles based on a detector feedback signal."""

    traits: UserTraits
    target: float = 0.0
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    jitter: float = 0.08
    suspicion_threshold: float = 0.6
    ewma_beta: float = 0.3
    quiet_cutback: float = 0.4
    # Legacy kwarg; unused.
    kappa: float = 5.0

    _suspicion: float = field(default=0.0, init=False)
    _quiet_until: int = field(default=-1, init=False)

    def reset(self, seed: int) -> None:
        self.rng = np.random.default_rng(seed)
        self._suspicion = 0.0
        self._quiet_until = -1

    # -- interface ---------------------------------------------------------

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        wealth = max(0.0, float(state.wealth_prev.get(self.traits.user_id, self.traits.initial_wealth)))
        if wealth <= 0.0:
            return [
                AgentAction(
                    account_id=self.traits.user_id,
                    participate=False,
                    report=None,
                    deposit=0.0,
                    meta={"agent_type": "detector_aware"},
                )
            ]

        anchor = 0.5
        if state.agg_history:
            try:
                anchor = float(np.asarray(state.agg_history[-1]).mean())
            except Exception:
                anchor = 0.5

        quiet = (state.t <= self._quiet_until) or (self._suspicion >= self.suspicion_threshold)
        target = clamp01(self.target)

        if quiet:
            # Hedge toward the public aggregate to blend with the benign
            # population; minor jitter keeps reports from being constant.
            base = 0.7 * anchor + 0.3 * target
            scalar = clamp01(base + self.rng.normal(0.0, self.jitter))
            cutback = float(self.quiet_cutback)
        else:
            scalar = clamp01(target + self.rng.normal(0.0, self.jitter))
            cutback = 1.0

        report = make_report(scalar, self.scoring_mode, taus=self.taus,
                             sigma_q=max(0.03, self.jitter))

        frac = min(
            0.75,
            (0.08 + 0.35 * self.traits.manipulation_strength) * cutback,
        )
        deposit = float(np.clip(frac * wealth, 0.0, min(wealth, self.b_max)))

        return [
            AgentAction(
                account_id=self.traits.user_id,
                participate=True,
                report=report,
                deposit=deposit,
                meta={
                    "agent_type": "detector_aware",
                    "quiet": bool(quiet),
                    "suspicion": float(self._suspicion),
                },
            )
        ]

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        score = self._extract_detector_score(logs_t)
        if score is None:
            # Without feedback, decay suspicion slightly.
            self._suspicion *= 1.0 - self.ewma_beta
            return
        self._suspicion = (
            (1.0 - self.ewma_beta) * self._suspicion
            + self.ewma_beta * float(score)
        )
        if self._suspicion >= self.suspicion_threshold:
            self._quiet_until = max(self._quiet_until, int(t) + 3)

    def _extract_detector_score(self, logs_t: Dict[str, Any]) -> Optional[float]:
        for key in ("detector_scores", "detector_score", "anomaly_score"):
            val = logs_t.get(key)
            if val is None:
                continue
            if isinstance(val, dict):
                if self.traits.user_id in val:
                    try:
                        return float(val[self.traits.user_id])
                    except Exception:
                        continue
                # fallback: max over all scores
                try:
                    return float(max(val.values()))
                except Exception:
                    continue
            try:
                return float(val)
            except Exception:
                continue
        return None
