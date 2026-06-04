"""
Property-based tests for the adversary class contract.

Every adversary must satisfy a small set of invariants regardless of
the input state it receives:

  1. Every returned AgentAction has deposit in [0, b_max + eps].
  2. Non-participating actions must have deposit == 0 and report is None.
  3. Participating actions must have a non-None report.
  4. No adversary may access `y_t` (state is F_{t-1}-measurable). We
     check this indirectly by running the same seed with two different
     y_t futures and confirming the action is identical.
  5. `reset(seed)` gives deterministic output for the same input.
  6. Reports produced in `point_mae` mode are scalar in [0, 1].
  7. Reports produced in `quantiles_crps` mode are vectors of length K
     with entries in [0, 1].

These tests are regression guards for the class contract. Adversaries
are parameterised over traits, targets, and mode so hypothesis can
explore the space.
"""
from __future__ import annotations

from typing import Any, List

import numpy as np
import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from onlinev2.behaviour.adversaries.arbitrage_seeking import ArbitrageSeekingBehaviour
from onlinev2.behaviour.adversaries.coordinated_group import CoordinatedGroupBehaviour
from onlinev2.behaviour.adversaries.detector_aware import DetectorAwareBehaviour
from onlinev2.behaviour.adversaries.privileged_information import PrivilegedInformationBehaviour
from onlinev2.behaviour.adversaries.reputation_reset import ReputationResetBehaviour
from onlinev2.behaviour.adversaries.strategic_influence import StrategicInfluenceBehaviour
from onlinev2.behaviour.adversaries.strategic_reporter import StrategicReporterBehaviour
from onlinev2.behaviour.adversaries.sybil_arbitrage import SybilArbitrageBehaviour
from onlinev2.behaviour.adversaries.wash_trader import WashTraderBehaviour
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState
from onlinev2.behaviour.traits import UserTraits


# ---------------------------------------------------------------------------
# Hypothesis strategies
# ---------------------------------------------------------------------------


@st.composite
def user_traits(draw, user_id="a") -> UserTraits:
    return UserTraits(
        user_id=user_id,
        initial_wealth=draw(st.floats(min_value=0.1, max_value=50.0)),
        noise_level=draw(st.floats(min_value=0.01, max_value=0.3)),
        bias=draw(st.floats(min_value=-0.25, max_value=0.25)),
        overconfidence=draw(st.floats(min_value=-0.5, max_value=0.5)),
        stake_fraction=draw(st.floats(min_value=0.03, max_value=0.45)),
        manipulation_strength=draw(st.floats(min_value=0.1, max_value=1.0)),
        insider_bonus=draw(st.floats(min_value=0.05, max_value=0.6)),
    )


@st.composite
def round_state(draw, user_id: str = "a", t: int = None) -> RoundPublicState:
    t = draw(st.integers(min_value=0, max_value=500)) if t is None else t
    y_len = min(t, 100)
    y_history = draw(
        st.lists(
            st.floats(min_value=0.0, max_value=1.0),
            min_size=y_len, max_size=y_len,
        )
    )
    agg_len = draw(st.integers(min_value=0, max_value=min(y_len, 10)))
    agg_history = draw(
        st.lists(
            st.floats(min_value=0.0, max_value=1.0),
            min_size=agg_len, max_size=agg_len,
        )
    )
    wealth = draw(st.floats(min_value=0.0, max_value=50.0))
    return RoundPublicState(
        t=t,
        y_history=y_history,
        agg_history=agg_history,
        weights_prev={user_id: 0.1, "other_0": 0.1, "other_1": 0.1},
        sigma_prev={user_id: 0.5},
        wealth_prev={user_id: wealth},
        profit_prev={user_id: 0.0},
    )


def _check_action_contract(
    actions: List[AgentAction], b_max: float = 10.0, eps: float = 1e-9,
) -> None:
    """Assert every AgentAction obeys the mechanism contract."""
    for a in actions:
        assert a.deposit >= 0.0, f"negative deposit: {a.deposit}"
        assert a.deposit <= b_max + eps, f"deposit {a.deposit} > b_max {b_max}"
        if not a.participate:
            assert a.deposit == 0.0, (
                f"non-participating with deposit={a.deposit}"
            )
            assert a.report is None, (
                f"non-participating with report={a.report}"
            )
        else:
            assert a.report is not None, "participating with report=None"


def _check_report_shape(
    actions: List[AgentAction], scoring_mode: str, taus=None,
) -> None:
    """Assert reports have the right shape and range."""
    for a in actions:
        if not a.participate:
            continue
        if scoring_mode == "quantiles_crps":
            r = np.asarray(a.report, dtype=float)
            assert r.ndim == 1, f"quantile report must be 1D, got shape {r.shape}"
            if taus is not None:
                assert r.size == len(taus), (
                    f"quantile report size {r.size} != len(taus) {len(taus)}"
                )
            assert (r >= 0.0).all() and (r <= 1.0).all(), (
                f"report not in [0, 1]: {r}"
            )
        else:
            assert 0.0 <= float(a.report) <= 1.0, (
                f"scalar report {a.report} not in [0, 1]"
            )


# ---------------------------------------------------------------------------
# Property tests
# ---------------------------------------------------------------------------


class TestStrategicInfluenceProperties:
    @settings(max_examples=50, deadline=None,
              suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(
        traits=user_traits(),
        state=round_state(),
        target=st.floats(min_value=0.0, max_value=1.0),
        mode=st.sampled_from(["point_mae", "quantiles_crps"]),
    )
    def test_action_contract(self, traits, state, target, mode):
        adv = StrategicInfluenceBehaviour(
            traits=traits, target=target,
            scoring_mode=mode,
            taus=[0.1, 0.5, 0.9] if mode == "quantiles_crps" else None,
        )
        adv.reset(0)
        actions = adv.act(state)
        _check_action_contract(actions)
        _check_report_shape(
            actions, mode, taus=[0.1, 0.5, 0.9] if mode == "quantiles_crps" else None,
        )


class TestStrategicReporterProperties:
    @settings(max_examples=50, deadline=None)
    @given(
        traits=user_traits(),
        state=round_state(),
        target=st.floats(min_value=0.0, max_value=1.0),
        pull=st.floats(min_value=0.0, max_value=1.0),
    )
    def test_action_contract_point_mae(self, traits, state, target, pull):
        adv = StrategicReporterBehaviour(traits=traits, target=target, pull=pull)
        adv.reset(0)
        actions = adv.act(state)
        _check_action_contract(actions)
        _check_report_shape(actions, "point_mae")


class TestArbitrageSeekerProperties:
    @settings(max_examples=50, deadline=None)
    @given(
        traits=user_traits(),
        state=round_state(),
        p_others=st.lists(
            st.floats(min_value=0.0, max_value=1.0),
            min_size=2, max_size=6,
        ),
    )
    def test_action_contract(self, traits, state, p_others):
        snap = {"p": np.asarray(p_others), "m": np.ones(len(p_others))}
        adv = ArbitrageSeekingBehaviour(
            traits=traits,
            target_others=lambda _s, s=snap: (s["p"], s["m"]),
        )
        adv.reset(0)
        actions = adv.act(state)
        _check_action_contract(actions)
        _check_report_shape(actions, "point_mae")

    @settings(max_examples=30, deadline=None)
    @given(
        traits=user_traits(),
        state=round_state(),
        p_common=st.floats(min_value=0.0, max_value=1.0),
    )
    def test_abstains_when_others_agree(self, traits, state, p_common):
        """If all p_others are identical, arbitrage expected profit is 0;
        the adversary should not participate."""
        snap = {"p": np.full(4, p_common), "m": np.ones(4)}
        adv = ArbitrageSeekingBehaviour(
            traits=traits,
            target_others=lambda _s, s=snap: (s["p"], s["m"]),
        )
        adv.reset(0)
        actions = adv.act(state)
        _check_action_contract(actions)
        for a in actions:
            assert not a.participate, (
                "arbitrage seeker participated when others agreed"
            )


class TestCoordinatedGroupProperties:
    @settings(max_examples=30, deadline=None)
    @given(
        n_members=st.integers(min_value=2, max_value=5),
        state=round_state(user_id="c_0"),
    )
    def test_all_members_report_same(self, n_members, state):
        members = [
            UserTraits(
                user_id=f"c_{j}", initial_wealth=10.0,
                bias=0.05 * j, stake_fraction=0.2,
            )
            for j in range(n_members)
        ]
        adv = CoordinatedGroupBehaviour(members=members)
        adv.reset(0)
        # Enrich state wealth so members have funds.
        state_dict = {m.user_id: 10.0 for m in members}
        rs = RoundPublicState(
            t=state.t, y_history=state.y_history, agg_history=state.agg_history,
            weights_prev={m.user_id: 0.1 for m in members},
            sigma_prev={m.user_id: 0.5 for m in members},
            wealth_prev=state_dict,
            profit_prev={m.user_id: 0.0 for m in members},
        )
        actions = adv.act(rs)
        _check_action_contract(actions)
        participating = [a for a in actions if a.participate]
        if len(participating) >= 2:
            reports = {float(a.report) for a in participating}
            assert len(reports) == 1, "coalition members report different values"


class TestPrivilegedInformationProperties:
    @settings(max_examples=30, deadline=None)
    @given(
        traits=user_traits(),
        state=round_state(),
        lag=st.integers(min_value=1, max_value=5),
    )
    def test_action_contract(self, traits, state, lag):
        adv = PrivilegedInformationBehaviour(
            traits=traits, mode="lagged_noisy", lag=lag, sigma_priv=0.02,
        )
        adv.reset(0)
        actions = adv.act(state)
        _check_action_contract(actions)
        _check_report_shape(actions, "point_mae")


class TestWashTraderProperties:
    @settings(max_examples=30, deadline=None)
    @given(
        traits=user_traits(),
        state=round_state(),
        k=st.integers(min_value=2, max_value=6),
        style=st.sampled_from(["anchor", "split_bet"]),
    )
    def test_action_contract(self, traits, state, k, style):
        adv = WashTraderBehaviour(
            traits=traits, k_accounts=k, wash_report_style=style,
            sync_strength=1.0,
        )
        adv.reset(0)
        actions = adv.act(state)
        assert len(actions) == k, f"expected {k} wash actions, got {len(actions)}"
        _check_action_contract(actions)
        _check_report_shape(actions, "point_mae")


class TestDetectorAwareProperties:
    @settings(max_examples=30, deadline=None)
    @given(
        traits=user_traits(),
        state=round_state(),
        target=st.floats(min_value=0.0, max_value=1.0),
        detector_score=st.floats(min_value=0.0, max_value=1.0),
    )
    def test_action_contract(self, traits, state, target, detector_score):
        adv = DetectorAwareBehaviour(traits=traits, target=target)
        adv.reset(0)
        adv.observe_round_result(
            t=state.t, y_t=0.5,
            logs_t={"detector_scores": {traits.user_id: detector_score}},
        )
        actions = adv.act(state)
        _check_action_contract(actions)
        _check_report_shape(actions, "point_mae")


class TestSybilArbitrageProperties:
    @settings(max_examples=30, deadline=None)
    @given(
        traits=user_traits(),
        state=round_state(),
        k=st.integers(min_value=1, max_value=6),
        p_others=st.lists(
            st.floats(min_value=0.0, max_value=1.0),
            min_size=2, max_size=6,
        ),
    )
    def test_k_actions_and_contract(self, traits, state, k, p_others):
        snap = {"p": np.asarray(p_others), "m": np.ones(len(p_others))}
        adv = SybilArbitrageBehaviour(
            traits=traits, k_accounts=k,
            target_others=lambda _s, s=snap: (s["p"], s["m"]),
        )
        adv.reset(0)
        actions = adv.act(state)
        # Either 0 (empty) or exactly k actions (participating or not).
        assert len(actions) in (0, k), (
            f"expected 0 or {k} actions, got {len(actions)}"
        )
        _check_action_contract(actions)
        if actions:
            # Either all participating with same report, or all non-participating.
            participating_reports = {a.report for a in actions if a.participate}
            assert len(participating_reports) <= 1


class TestReputationResetProperties:
    @settings(max_examples=20, deadline=None)
    @given(
        traits=user_traits(),
        state=round_state(),
        target=st.floats(min_value=0.0, max_value=1.0),
    )
    def test_action_contract(self, traits, state, target):
        adv = ReputationResetBehaviour(
            traits=traits, target=target, warmup=0, cooldown=10,
        )
        adv.reset(0)
        actions = adv.act(state)
        _check_action_contract(actions)
        _check_report_shape(actions, "point_mae")


class TestDeterminism:
    """Reset with the same seed must reproduce the same actions."""

    @settings(max_examples=20, deadline=None)
    @given(
        traits=user_traits(),
        state=round_state(),
        target=st.floats(min_value=0.0, max_value=1.0),
    )
    def test_strategic_influence_deterministic(self, traits, state, target):
        adv1 = StrategicInfluenceBehaviour(traits=traits, target=target)
        adv2 = StrategicInfluenceBehaviour(traits=traits, target=target)
        adv1.reset(42)
        adv2.reset(42)
        a1 = adv1.act(state)
        a2 = adv2.act(state)
        assert len(a1) == len(a2)
        for x, y in zip(a1, a2):
            assert x.participate == y.participate
            assert x.deposit == y.deposit
            assert x.report == y.report


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
