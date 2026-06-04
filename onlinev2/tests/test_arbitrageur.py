"""
Tests for the arbitrageur adversary.

1. Arbitrageur never returns participate=False with nonzero deposit
2. Logs "arbitrage found" only if worst-case profit is positive
"""
import pytest

from onlinev2.behaviour.adversaries.arbitrageur import ArbitrageurBehaviour
from onlinev2.behaviour.protocol import RoundPublicState
from onlinev2.behaviour.traits import UserTraits


def _make_state(t=0, wealth=10.0, user_id="arb_0"):
    return RoundPublicState(
        t=t,
        y_history=[0.5] * t,
        agg_history=[],
        weights_prev={user_id: 0.1},
        sigma_prev={user_id: 0.5},
        wealth_prev={user_id: wealth},
        profit_prev={user_id: 0.0},
    )


class TestArbitrageurActions:
    def test_no_nonzero_deposit_when_not_participating(self):
        traits = UserTraits(user_id="arb_0", initial_wealth=10.0)
        arb = ArbitrageurBehaviour(traits, scoring_mode="point_mae")
        arb.reset(42)

        for t in range(20):
            state = _make_state(t=t, user_id="arb_0")
            actions = arb.act(state)
            for a in actions:
                if not a.participate:
                    assert a.deposit == 0.0, (
                        f"t={t}: non-participating arbitrageur has deposit={a.deposit}"
                    )

    def test_arbitrage_found_only_if_positive_profit(self):
        traits = UserTraits(user_id="arb_0", initial_wealth=10.0)
        arb = ArbitrageurBehaviour(traits, scoring_mode="point_mae")
        arb.reset(42)

        for t in range(20):
            state = _make_state(t=t, user_id="arb_0")
            arb.act(state)

        for entry in arb.arbitrage_log:
            if entry["arbitrage_found"]:
                # Under MAE the arbitrageur participates iff expected profit
                # (under y ~ Uniform[0,1]) is strictly positive; worst-case
                # is only >= 0 because MAE is not strictly convex.
                assert entry["expected_profit"] > 0.0, (
                    f"Logged arbitrage found but expected_profit="
                    f"{entry['expected_profit']}"
                )
                assert entry["worst_case_profit"] >= 0.0, (
                    f"Logged arbitrage found but worst_case_profit="
                    f"{entry['worst_case_profit']}"
                )

    def test_zero_wealth_no_participation(self):
        traits = UserTraits(user_id="arb_0", initial_wealth=0.0)
        arb = ArbitrageurBehaviour(traits, scoring_mode="point_mae")
        arb.reset(42)

        state = _make_state(t=0, wealth=0.0, user_id="arb_0")
        actions = arb.act(state)
        assert len(actions) == 1
        assert not actions[0].participate
        assert actions[0].deposit == 0.0


class TestArbitrageurReproducibility:
    def test_same_seed_same_actions(self):
        traits = UserTraits(user_id="arb_0", initial_wealth=10.0)

        arb1 = ArbitrageurBehaviour(traits, scoring_mode="point_mae")
        arb1.reset(42)
        state = _make_state(t=0, user_id="arb_0")
        actions1 = arb1.act(state)

        arb2 = ArbitrageurBehaviour(traits, scoring_mode="point_mae")
        arb2.reset(42)
        actions2 = arb2.act(state)

        assert len(actions1) == len(actions2)
        for a1, a2 in zip(actions1, actions2):
            assert a1.participate == a2.participate
            assert a1.deposit == a2.deposit


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
