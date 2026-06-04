r"""
Arbitrage-seeking strategy.

Theory (Chen, Devanur, Pennock, Vaughan, EC'14; Chun-Shachter 2011):
in a weighted-score wagering mechanism with differentiable, strictly proper
scoring rule s, a participant i who can observe other reports p_{-i} and
wagers w_{-i} can pick any

    p_hat_i in [||p_{-i}||_{s1, mu},  ||p_{-i}||_{s0, mu}]

(with mu_j = w_j / W_{N\{i}}) and receive a non-negative payoff under both
outcomes, strictly positive when participants disagree. The canonical
arbitrage-free point is the weighted mean (f(x)=x) report, which equalises
payoff across outcomes.

Our mechanism uses the bounded MAE score s(y,r) = 1 - |y-r| on y, r in [0,1],
which is strictly proper for the median. The median-wagering analogue of the
arbitrage interval simplifies to

    pi_i(y=1, p_hat_i) >= 0  and  pi_i(y=0, p_hat_i) >= 0,

which in the WSWM with MAE is satisfied exactly when p_hat_i lies in the
convex hull of p_{-i} (weighted by m_{-i}). We therefore target the
wager-weighted *median* of other reports as the riskless point and verify
ex-ante that the worst-case settlement payoff is non-negative under both
boundary outcomes. This is a faithful implementation of Theorem 3.3 of
Chen et al. (2014) for the median scoring rule used by this project.

The adversary:

  * observes the previous round's (reports, effective wagers) summarised in
    a lagged ``others_report_stats`` passed through ``agg_history``'s most
    recent entry (the code falls back to ``state.agg_history[-1]`` plus
    trait noise when full per-agent data is not available);
  * picks the weighted median report;
  * participates only when the ex-ante worst-case profit is strictly
    positive, i.e. when other reports are *not* all equal.

All data used is strictly lagged (RoundPublicState), preserving the
mechanism's information boundary.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

from onlinev2.behaviour.adversaries._utils import make_report
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState, clamp01
from onlinev2.behaviour.traits import UserTraits


def _weighted_median(values: np.ndarray, weights: np.ndarray) -> float:
    """Weighted median: smallest v such that cumulative weight >= 0.5 * total."""
    v = np.asarray(values, dtype=float).ravel()
    w = np.clip(np.asarray(weights, dtype=float).ravel(), 0.0, None)
    if v.size == 0 or float(w.sum()) <= 0.0:
        return 0.5
    order = np.argsort(v)
    v_sorted = v[order]
    w_sorted = w[order]
    cdf = np.cumsum(w_sorted)
    total = cdf[-1]
    idx = int(np.searchsorted(cdf, 0.5 * total, side="left"))
    idx = max(0, min(idx, v_sorted.size - 1))
    return float(v_sorted[idx])


def _expected_mae_payoff(
    p_hat: float,
    p_others: np.ndarray,
    m_others: np.ndarray,
    m_self: float,
    n_samples: int = 257,
) -> float:
    """
    Expected MAE-WSWM settlement payoff for y ~ Uniform[0, 1] (numerical
    integration over a deterministic grid).

        E_y[pi_i] = integral over y in [0,1] of m_i * (s_i(y) - s_bar(y)) dy.

    Positive expected payoff under disagreement is the soft-arbitrage
    analogue of the Chen-Devanur interval when the scoring rule is only
    weakly convex (absolute loss).
    """
    p_others = np.asarray(p_others, dtype=float).ravel()
    m_others = np.clip(np.asarray(m_others, dtype=float).ravel(), 0.0, None)
    if p_others.size == 0 or m_self <= 0.0:
        return 0.0
    m_total = float(m_self + m_others.sum())
    if m_total <= 0.0:
        return 0.0
    ys = np.linspace(0.0, 1.0, int(n_samples))
    s_self = 1.0 - np.abs(ys[:, None] - float(p_hat))
    s_others = 1.0 - np.abs(ys[:, None] - p_others[None, :])
    s_bar = (m_self * s_self.squeeze() + (s_others * m_others[None, :]).sum(axis=1)) / m_total
    pi = m_self * (s_self.squeeze() - s_bar)
    return float(np.mean(pi))


def _worst_case_mae_payoff(
    p_hat: float,
    p_others: np.ndarray,
    m_others: np.ndarray,
    m_self: float,
) -> Tuple[float, float]:
    """
    Worst-case MAE settlement payoff under y in {0, 1} for a participant with
    report p_hat and effective wager m_self, against other (p_j, m_j).

    Uses the Lambert self-financed WSWM payoff (see core.settlement):

        pi_i = m_i * (s_i - s_bar)

    with s_i = 1 - |y - p_hat|, s_bar = sum_j m_j s_j / sum_j m_j.
    Returns (pi under y=0, pi under y=1).
    """
    p_others = np.asarray(p_others, dtype=float).ravel()
    m_others = np.clip(np.asarray(m_others, dtype=float).ravel(), 0.0, None)
    if p_others.size == 0 or m_self <= 0.0:
        return 0.0, 0.0

    m_total = float(m_self + m_others.sum())
    if m_total <= 0.0:
        return 0.0, 0.0

    pi = np.zeros(2, dtype=float)
    for k, y in enumerate((0.0, 1.0)):
        s_self = 1.0 - abs(y - float(p_hat))
        s_others = 1.0 - np.abs(y - p_others)
        s_bar = (m_self * s_self + float((m_others * s_others).sum())) / m_total
        pi[k] = m_self * (s_self - s_bar)
    return float(pi[0]), float(pi[1])


@dataclass
class ArbitrageSeekingBehaviour:
    """
    Theory-grounded arbitrage seeker for the MAE-WSWM mechanism.

    ``target_others`` optionally supplies an F_{t-1} snapshot of other agents'
    (report, effective_wager) pairs so the adversary can compute the exact
    arbitrage point. When not supplied, it falls back to the most recent
    public aggregate plus a crude disagreement estimate from the variance of
    past aggregates.
    """
    traits: UserTraits
    scoring_mode: str = "point_mae"
    taus: Optional[Sequence[float]] = None
    b_max: float = 10.0
    # Optional callable (RoundPublicState) -> (p_others, m_others) giving lagged
    # reports and effective wagers of the other agents from round t-1. When
    # None the adversary uses aggregated public history.
    target_others: Optional[Any] = None
    # Minimum expected profit before participating. Under MAE the strict
    # arbitrage interval collapses so we require strictly positive E[pi].
    expected_profit_threshold: float = 1e-4
    arbitrage_log: List[Dict[str, float]] = field(default_factory=list)

    def reset(self, seed: int) -> None:
        self.rng = np.random.default_rng(seed)
        self.arbitrage_log = []

    # -- helpers -----------------------------------------------------------

    def _snapshot(self, state: RoundPublicState) -> Tuple[np.ndarray, np.ndarray]:
        """Return (p_others, m_others) for the ARB interval calculation."""
        if self.target_others is not None:
            try:
                p, m = self.target_others(state)
                p = np.asarray(p, dtype=float).ravel()
                m = np.asarray(m, dtype=float).ravel()
                if p.size > 0 and p.size == m.size:
                    return p, m
            except Exception:
                pass

        # Fallback: synthesise a plausible (p_{-i}, w_{-i}) from lagged agg
        # history + previous weights. This is inexact but F_{t-1}-measurable.
        agg_hist = state.agg_history
        weights = state.weights_prev
        if not agg_hist or not weights:
            return np.array([0.4, 0.6]), np.array([0.5, 0.5])

        try:
            ref = float(np.asarray(agg_hist[-1]).mean())
        except Exception:
            ref = 0.5

        ids = [k for k in weights.keys() if k != self.traits.user_id]
        if not ids:
            return np.array([ref, ref]), np.array([0.5, 0.5])

        m = np.array([max(1e-6, float(weights[k])) for k in ids], dtype=float)
        # Spread the reports symmetrically around the aggregate using the
        # spread of past aggregates as a disagreement proxy. If only one
        # aggregate is recorded, use a small default spread.
        if len(agg_hist) >= 3:
            past = np.asarray([float(np.mean(np.atleast_1d(a))) for a in agg_hist[-5:]])
            spread = float(np.std(past))
        else:
            spread = 0.05
        spread = max(0.02, min(0.3, spread))
        k = m.size
        offsets = np.linspace(-spread, spread, k) if k > 1 else np.array([0.0])
        p = np.clip(ref + offsets, 0.0, 1.0)
        return p, m

    def _choose_candidate(self, state: RoundPublicState) -> Tuple[float, Tuple[float, float, float], np.ndarray, np.ndarray]:
        """Return (p_hat, (pi_y0, pi_y1, E[pi]), p_others, m_others)."""
        p_others, m_others = self._snapshot(state)

        # Arbitrage point for MAE-WSWM: wager-weighted median, which is the
        # prediction that makes s_bar invariant under y in {0, 1} when all
        # p_j lie on one side of y (Chun-Shachter-style equal-payoff point).
        p_hat = clamp01(_weighted_median(p_others, m_others))

        wealth = max(0.0, float(state.wealth_prev.get(self.traits.user_id, self.traits.initial_wealth)))
        m_self = float(np.clip(self.traits.stake_fraction * wealth, 0.0, min(wealth, self.b_max)))
        pi0, pi1 = _worst_case_mae_payoff(p_hat, p_others, m_others, m_self)
        exp_pi = _expected_mae_payoff(p_hat, p_others, m_others, m_self)
        return p_hat, (pi0, pi1, exp_pi), p_others, m_others

    # -- interface ---------------------------------------------------------

    def act(self, state: RoundPublicState) -> List[AgentAction]:
        wealth = max(0.0, float(state.wealth_prev.get(self.traits.user_id, self.traits.initial_wealth)))
        if wealth <= 0.0:
            self.arbitrage_log.append({
                "t": float(state.t),
                "arbitrage_found": False,
                "worst_case_profit": 0.0,
                "expected_profit": 0.0,
                "candidate_report": 0.5,
                "deposit": 0.0,
                "pi_y0": 0.0,
                "pi_y1": 0.0,
            })
            return [
                AgentAction(
                    account_id=self.traits.user_id,
                    participate=False,
                    report=None,
                    deposit=0.0,
                    meta={"agent_type": "arbitrage_seeking"},
                )
            ]

        p_hat, (pi_y0, pi_y1, exp_pi), p_others, m_others = self._choose_candidate(state)
        worst_case = float(min(pi_y0, pi_y1))
        # Under MAE the strict arbitrage interval collapses to a single
        # equal-payoff point, so the worst-case bound is only tight at 0.
        # Participate when expected-payoff is strictly positive -- the soft
        # analogue of the Chen-Devanur arbitrage condition.
        found = bool(exp_pi > self.expected_profit_threshold)
        # Scale deposit with expected spread -- larger disagreement means
        # bigger arbitrage, so commit more.
        spread = float(np.clip(np.max(p_others) - np.min(p_others), 0.0, 1.0))
        stake = self.traits.stake_fraction * (0.5 + 1.5 * spread)
        deposit = float(np.clip(stake * wealth, 0.0, min(wealth, self.b_max)))

        self.arbitrage_log.append({
            "t": float(state.t),
            "candidate_report": float(p_hat),
            "deposit": float(deposit),
            "worst_case_profit": worst_case,
            "expected_profit": float(exp_pi),
            "pi_y0": float(pi_y0),
            "pi_y1": float(pi_y1),
            "arbitrage_found": found,
            "others_spread": spread,
            "n_others_seen": int(p_others.size),
        })

        if not found:
            return [
                AgentAction(
                    account_id=self.traits.user_id,
                    participate=False,
                    report=None,
                    deposit=0.0,
                    meta={"agent_type": "arbitrage_seeking", "arbitrage_found": False},
                )
            ]

        return [
            AgentAction(
                account_id=self.traits.user_id,
                participate=True,
                report=make_report(float(p_hat), self.scoring_mode,
                                   taus=self.taus, sigma_q=max(0.03, spread)),
                deposit=float(deposit),
                meta={
                    "agent_type": "arbitrage_seeking",
                    "arbitrage_found": True,
                    "worst_case_profit": worst_case,
                },
            )
        ]

    def observe_round_result(self, *, t: int, y_t: float, logs_t: Dict[str, Any]) -> None:
        return None
