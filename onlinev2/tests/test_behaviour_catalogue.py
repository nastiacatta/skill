"""
Tests for the full behaviour catalogue.

- Deterministic seeding for new policies
- No positive deposit when not participating
- Factory can instantiate all presets
- Sybil split preserves total user bankroll
- CollusiveMultiAccountIdentity and FakeActivityIdentity
"""
import pytest

from onlinev2.behaviour.composite import CompositeBehaviourModel
from onlinev2.behaviour.factory import make_behaviour
from onlinev2.behaviour.policies.identity import (
    CollusiveMultiAccountIdentity,
    FakeActivityIdentity,
    SplitAccountIdentity,
)
from onlinev2.behaviour.policies.staking import BreakEvenStaking
from onlinev2.behaviour.population import build_population
from onlinev2.behaviour.protocol import RoundPublicState


def _make_pub_state(t=0, n_users=3):
    return RoundPublicState(
        t=t,
        y_history=[0.4, 0.5, 0.6][:t],
        agg_history=[],
        weights_prev={},
        sigma_prev={f"user_{i}": 0.5 for i in range(n_users)},
        wealth_prev={f"user_{i}": 10.0 for i in range(n_users)},
        profit_prev={f"user_{i}": 0.0 for i in range(n_users)},
    )


class TestNoPositiveDepositWhenNotParticipating:
    """No behaviour may submit positive deposit when participate=False."""

    def test_composite_never_positive_deposit_when_not_participating(self):
        pop = build_population(3, seed=42)
        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        behaviour.reset(42)
        for _ in range(20):
            pub = _make_pub_state(t=0, n_users=3)
            actions = behaviour.act(pub)
            for a in actions:
                if not a.participate:
                    assert a.deposit == 0.0, f"Non-participating {a.account_id} had deposit={a.deposit}"
                    assert a.report is None


class TestFactoryPresets:
    """Factory can instantiate all listed presets."""

    @pytest.mark.parametrize("preset", [
        "BENIGN_BASELINE",
        "CLUSTERED_PARTICIPATION",
        "EDGE_THRESHOLD",
        "AVOID_SKILL_DECAY",
        "STRATEGIC_EXTERNALITY",
        "REPUTATION_PROTECTION",
        "BREAK_EVEN_STAKING",
        "VOLATILITY_SENSITIVE",
        "COLLUSIVE_MULTI_ACCOUNT",
        "FAKE_ACTIVITY",
    ])
    def test_preset_instantiates(self, preset):
        b = make_behaviour(preset, n_users=3, seed=42)
        b.reset(42)
        pub = _make_pub_state(n_users=3)
        actions = b.act(pub)
        assert len(actions) >= 1
        for a in actions:
            assert a.deposit >= 0.0


class TestSybilSplitBankroll:
    """Sybil split preserves total user bankroll constraints."""

    def test_split_deposit_sum_equals_original(self):
        identity = SplitAccountIdentity(k=4)
        total = 8.0
        actions = identity.map_user_action(
            user_id="user_0",
            participate=True,
            report=0.5,
            deposit=total,
            meta={},
        )
        assert len(actions) == 4
        assert abs(sum(a.deposit for a in actions) - total) < 1e-12


class TestCollusiveIdentity:
    """CollusiveMultiAccountIdentity splits deposit across k accounts."""

    def test_collusive_deposit_sum(self):
        identity = CollusiveMultiAccountIdentity(k=3)
        total = 6.0
        actions = identity.map_user_action(
            user_id="user_0",
            participate=True,
            report=0.5,
            deposit=total,
            meta={},
        )
        assert len(actions) == 3
        assert abs(sum(a.deposit for a in actions) - total) < 1e-12
        for a in actions:
            assert a.participate
            assert a.report == 0.5


class TestFakeActivityIdentity:
    """FakeActivityIdentity creates wash-style split."""

    def test_fake_activity_not_participating(self):
        identity = FakeActivityIdentity(k=2)
        actions = identity.map_user_action(
            user_id="user_0",
            participate=False,
            report=None,
            deposit=0.0,
            meta={},
        )
        assert len(actions) == 1
        assert not actions[0].participate
        assert actions[0].deposit == 0.0

    def test_fake_activity_participating_splits(self):
        identity = FakeActivityIdentity(k=2)
        actions = identity.map_user_action(
            user_id="user_0",
            participate=True,
            report=0.5,
            deposit=4.0,
            meta={},
        )
        assert len(actions) == 2
        assert abs(sum(a.deposit for a in actions) - 4.0) < 1e-12


class TestDeterminism:
    """New policies produce deterministic results with fixed seed."""

    def test_break_even_staking_deterministic(self):
        pop = build_population(3, seed=42, staking_policy=BreakEvenStaking())
        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")
        behaviour.reset(100)
        pub = _make_pub_state(n_users=3)
        actions1 = behaviour.act(pub)
        behaviour.reset(100)
        actions2 = behaviour.act(pub)
        assert len(actions1) == len(actions2)
        for a1, a2 in zip(actions1, actions2):
            assert a1.account_id == a2.account_id
            assert a1.participate == a2.participate
            assert abs((a1.deposit or 0) - (a2.deposit or 0)) < 1e-12
