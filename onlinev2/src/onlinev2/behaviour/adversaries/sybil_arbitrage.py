"""
Combined sybil + arbitrage-seeking adversary.

Motivation: Chen-Devanur-Pennock-Vaughan (2014) show the no-arbitrage
wagering family is sybilproof under the `f`-norm construction
(Theorem 5.8). The weighted-score wagering mechanism used by this project
is the non-arbitrage-free variant (MAE-WSWM). A natural robustness check
is whether an attacker who already exploits the weighted-median
arbitrage can *amplify* its profit by splitting the same total stake
across k sybil accounts.

This adversary wraps :class:`ArbitrageSeekingBehaviour` and redirects
its single AgentAction into k identically reporting sybil accounts. The
total deposit is split evenly; all sybils report the same arbitrage
point, so the coalition mimics a single-account arbitrage but with an
inflated N_eff and a different wager distribution.

Tests in the experiment suite compare

    profit_total(k=1) vs profit_total(k=3) vs profit_total(k=5)

to check sybil-proofness empirically. Under the MAE-WSWM this should
produce near-identical totals (the mechanism is Lambert-sybilproof);
any k-dependent pattern is a stress-test finding worth reporting.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from onlinev2.behaviour.adversaries.arbitrage_seeking import ArbitrageSeekingBehaviour
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState
from onlinev2.behaviour.traits import UserTraits


@dataclass
class SybilArbitrageBehaviour:
    """Split-account arbitrageur.

    Parameters
    ----------
    traits
        Parent traits; wealth and stake are shared across all k sybils.
    k_accounts
        Number of sybil accounts to fan out across.
    target_others
        Optional callback supplying the lagged (p_{-i}, w_{-i}) snapshot
        (see ``ArbitrageSeekingBehaviour``).
    report_epsilon
        When zero the clones report identically (narrow Lambert scope).
        When positive each clone's report is perturbed by an i.i.d.
        Gaussian draw with standard deviation ``report_epsilon``, so
        the diversified-report regime outside the Lambert invariance
        can be measured empirically.
    epsilon_rng_seed
        Seed for the per-run report-perturbation RNG. Deterministic so
        paired comparisons across ``k`` share the same perturbation
        draws and so across-seed variance reflects only panel draws.
    """
    traits: UserTraits
    k_accounts: int = 3
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    target_others: Optional[Any] = None
    expected_profit_threshold: float = 1e-4
    report_epsilon: float = 0.0
    epsilon_rng_seed: int = 0
    _arb: ArbitrageSeekingBehaviour = field(init=False, repr=False)
    _eps_rng: np.random.Generator = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._arb = ArbitrageSeekingBehaviour(
            traits=self.traits,
            scoring_mode=self.scoring_mode,
            taus=self.taus,
            b_max=self.b_max,
            target_others=self.target_others,
            expected_profit_threshold=self.expected_profit_threshold,
        )
        self._eps_rng = np.random.default_rng(int(self.epsilon_rng_seed))

    @property
    def arbitrage_log(self) -> List[Dict[str, float]]:
        return self._arb.arbitrage_log

    def reset(self, seed: int) -> None:
        self._arb.reset(seed)
        self._eps_rng = np.random.default_rng(
            int(self.epsilon_rng_seed) + int(seed)
        )

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        # Delegate to the underlying arbitrage seeker. It returns one
        # AgentAction against the parent user_id; we fan it out into
        # k evenly sized sybil accounts that all submit the same report.
        inner = self._arb.act(state)
        if not inner:
            return []
        parent = inner[0]
        k = max(1, int(self.k_accounts))

        if not parent.participate:
            # Emit k non-participating placeholders so downstream
            # detectors still see the linked-account layout.
            return [
                AgentAction(
                    account_id=f"{self.traits.user_id}__sybil_{j}",
                    participate=False,
                    report=None,
                    deposit=0.0,
                    meta={
                        "agent_type": "sybil_arbitrage",
                        "sybil_parent": self.traits.user_id,
                        "sybil_index": j,
                        "sybil_k": k,
                    },
                )
                for j in range(k)
            ]

        per_deposit = float(parent.deposit) / float(k)
        report = parent.report
        eps = float(self.report_epsilon)
        out: List[AgentAction] = []
        for j in range(k):
            # Diversify the clone report by a small i.i.d. Gaussian
            # perturbation. The first clone uses the parent report
            # unchanged so the ``epsilon = 0`` case is byte-identical
            # to the legacy identical-clone regime.
            if eps > 0.0 and j > 0 and report is not None:
                if isinstance(report, (list, tuple, np.ndarray)):
                    r_arr = np.asarray(report, dtype=float)
                    r_arr = r_arr + self._eps_rng.normal(0.0, eps, size=r_arr.shape)
                    r_arr = np.clip(r_arr, 0.0, 1.0)
                    clone_report: Any = r_arr.tolist()
                else:
                    clone_report = float(
                        np.clip(float(report) + self._eps_rng.normal(0.0, eps), 0.0, 1.0)
                    )
            else:
                clone_report = report
            out.append(
                AgentAction(
                    account_id=f"{self.traits.user_id}__sybil_{j}",
                    participate=True,
                    report=clone_report,
                    deposit=per_deposit,
                    meta={
                        **dict(parent.meta),
                        "agent_type": "sybil_arbitrage",
                        "sybil_parent": self.traits.user_id,
                        "sybil_index": j,
                        "sybil_k": k,
                        "report_epsilon": eps,
                    },
                )
            )
        return out

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        self._arb.observe_round_result(t=t, y_t=y_t, logs_t=logs_t)
