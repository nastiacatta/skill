"""
Coordinated group (coalition) behavioural regime.

Theory (Chun & Shachter 2011, Chen-Devanur-Pennock-Vaughan 2014):
in a WSWM with immutable, disagreeing beliefs, a coalition C that reports a
common value

    p_coalition = sum_{i in C} (w_i / W_C) * p_i         (*)

earns *strictly higher* total payoff under every outcome than everyone in
the coalition reporting truthfully, whenever members disagree. The extra
profit is extracted from non-coalition members who "leave money on the
table" by disagreeing.

With the bounded-MAE WSWM used here, the analogous coalition target is the
wager-weighted median of the *coalition* beliefs -- this is the MAE
arbitrage-free point in the convex hull of members' reports. We implement
(*) literally and fall back to the median for CRPS-hat / MAE equivalence.

Members still submit individual stakes (preserving sybilproofness audits),
but all members submit the same *report* p_coalition. When individual
beliefs disagree across members, this strictly improves the coalition's
aggregate payoff against a benign population.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from onlinev2.behaviour.adversaries._utils import make_report
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState, clamp01
from onlinev2.behaviour.traits import UserTraits


def _coalition_beliefs(
    members: Sequence[UserTraits],
    state: RoundPublicState,
    rng: np.random.Generator,
    history_window: int = 20,
) -> np.ndarray:
    """Private belief of each member -- lagged public anchor + trait bias/noise."""
    anchor = 0.5
    if state.y_history:
        tail = state.y_history[-history_window:]
        anchor = float(np.mean(tail))
    beliefs = []
    for tr in members:
        b = anchor + tr.bias + rng.normal(0.0, max(1e-4, tr.noise_level))
        beliefs.append(clamp01(b))
    return np.asarray(beliefs, dtype=float)


@dataclass
class CoordinatedGroupBehaviour:
    """
    Coalition attack: members share a common report computed as the
    wager-weighted mean (Chun-Shachter) or the wager-weighted median.

    Parameters
    ----------
    members
        Coalition member traits.
    aggregation
        ``"weighted_mean"`` (Chun-Shachter 2011 arbitrage-free target for
        differentiable proper scoring rules), ``"weighted_median"`` (the
        analogous interior-of-hull MAE target), or ``"auto"`` (default).
        ``"auto"`` picks ``"weighted_median"`` when
        ``scoring_mode == "point_mae"`` and ``"weighted_mean"``
        otherwise. An explicit choice overrides the auto-selection.

        Why the auto-select matters. Before this default changed, the
        factory call path in :mod:`onlinev2.behaviour.factory`
        (``make_behaviour("COORDINATED_GROUP", scoring_mode="point_mae")``)
        fell through to ``"weighted_mean"`` unconditionally, playing
        the Chun-Shachter target against an MAE mechanism. Empirically
        on the headline collusion stress test both variants profit, but
        caller-unaware paths now default to the MAE-analogue target
        rather than the always-weighted-mean default. See
        behaviour-audit F1 (May 2026).
    belief_history_window
        How far back to look when forming individual beliefs.
    """
    members: Sequence[UserTraits]
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    aggregation: str = "auto"
    belief_history_window: int = 20
    # Optional jitter on the shared report to avoid trivial fake_activity_loop
    # detection while retaining the arbitrage. Keep small.
    camouflage: float = 0.0
    coalition_log: List[Dict[str, Any]] = field(default_factory=list)

    def reset(self, seed: int) -> None:
        self.rng = np.random.default_rng(seed)
        self.coalition_log = []

    def _resolve_aggregation(self) -> str:
        """Resolve the ``"auto"`` aggregation mode into a concrete choice.

        MAE scoring → weighted median; anything else → weighted mean.
        Concrete choices (``"weighted_mean"`` / ``"weighted_median"``)
        pass through unchanged, so a caller who wants to force a
        sub-optimal aggregation (e.g., for an ablation) can still do so.
        """
        mode = self.aggregation
        if mode == "auto":
            return (
                "weighted_median" if self.scoring_mode == "point_mae"
                else "weighted_mean"
            )
        return mode

    def _aggregate_report(self, beliefs: np.ndarray, wagers: np.ndarray) -> float:
        wagers = np.clip(wagers, 0.0, None)
        total = float(wagers.sum())
        if total <= 0.0 or beliefs.size == 0:
            return 0.5
        mode = self._resolve_aggregation()
        if mode == "weighted_median":
            order = np.argsort(beliefs)
            b_sorted = beliefs[order]
            w_sorted = wagers[order]
            cdf = np.cumsum(w_sorted)
            idx = int(np.searchsorted(cdf, 0.5 * total, side="left"))
            idx = max(0, min(idx, beliefs.size - 1))
            return float(b_sorted[idx])
        # Default: weighted mean (Chun-Shachter arbitrage-free point for
        # differentiable proper scoring rules with identity f-norm).
        return float(np.dot(beliefs, wagers) / total)

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        if not self.members:
            return []

        # Members' wagers (pre-skill) — use each trait's stake_fraction * wealth
        wealth = np.array([
            max(0.0, float(state.wealth_prev.get(tr.user_id, tr.initial_wealth)))
            for tr in self.members
        ], dtype=float)
        stake_frac = np.array([float(tr.stake_fraction) for tr in self.members], dtype=float)
        intended_b = np.clip(stake_frac * wealth, 0.0, self.b_max)
        intended_b = np.minimum(intended_b, wealth)  # cannot exceed wealth

        beliefs = _coalition_beliefs(
            self.members, state, self.rng, self.belief_history_window
        )

        scalar_report = self._aggregate_report(beliefs, intended_b)
        if self.camouflage > 0.0:
            scalar_report = clamp01(scalar_report + self.rng.normal(0.0, self.camouflage))
        scalar_report = clamp01(scalar_report)
        report = make_report(scalar_report, self.scoring_mode, taus=self.taus,
                             sigma_q=max(0.03, float(np.std(beliefs)) if beliefs.size else 0.05))

        self.coalition_log.append({
            "t": int(state.t),
            "report": float(scalar_report),
            "beliefs": beliefs.tolist(),
            "wagers": intended_b.tolist(),
            "spread": float(np.max(beliefs) - np.min(beliefs)) if beliefs.size else 0.0,
        })

        out: List[AgentAction] = []
        for tr, b_i in zip(self.members, intended_b):
            if b_i <= 0.0:
                out.append(
                    AgentAction(
                        account_id=tr.user_id,
                        participate=False,
                        report=None,
                        deposit=0.0,
                        meta={"agent_type": "coordinated_group"},
                    )
                )
                continue
            out.append(
                AgentAction(
                    account_id=tr.user_id,
                    participate=True,
                    report=report,
                    deposit=float(b_i),
                    meta={
                        "agent_type": "coordinated_group",
                        "coordinated": True,
                        "aggregation": self.aggregation,
                    },
                )
            )
        return out

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        return None
