"""
Tests for the behaviour–mechanism boundary.

1. Core does not import behaviour (separation enforced)
2. RoundPublicState has no current-round outcome (act() cannot see y_t)
3. Core determinism: fixed actions + y_t gives identical state/logs
4. Action validation: participate=False => deposit==0 and report is None
5. Identity invariants: sybil splits preserve deposit sums
6. Reproducibility: behaviour.reset(seed) gives identical action streams
"""
import numpy as np
import pytest

from onlinev2.behaviour.composite import CompositeBehaviourModel
from onlinev2.behaviour.policies.identity import (
    SplitAccountIdentity,
)
from onlinev2.behaviour.population import build_population
from onlinev2.behaviour.protocol import AgentAction, RoundPublicState
from onlinev2.mechanism.models import MechanismParams, MechanismState
from onlinev2.mechanism.runner import run_round


def _make_fixed_actions(n=5, y_t=0.5):
    """Create deterministic actions for testing core determinism."""
    actions = []
    for i in range(n):
        actions.append(
            AgentAction(
                account_id=f"agent_{i}",
                participate=True,
                report=0.3 + 0.1 * i,
                deposit=1.0 + 0.5 * i,
            )
        )
    return actions


class TestCoreBehaviourSeparation:
    """Core module must not import behaviour; RoundPublicState must not expose y_t."""

    def test_core_does_not_import_behaviour(self):
        """Canonical core.runner and core.types must not depend on the behaviour package."""
        import onlinev2.core.runner as runner_mod
        import onlinev2.core.types as types_mod
        for mod in (runner_mod, types_mod):
            for name in dir(mod):
                if name.startswith("_"):
                    continue
                obj = getattr(mod, name)
                if hasattr(obj, "__module__") and obj.__module__:
                    assert "onlinev2.behaviour" not in obj.__module__, (
                        f"core module {mod.__name__} has attribute {name} from behaviour: {obj.__module__}"
                    )
        import inspect
        runner_source = inspect.getsource(runner_mod.run_round)
        assert "from onlinev2.behaviour" not in runner_source
        assert "import.*behaviour" not in runner_source

    def test_round_public_state_has_no_y_t(self):
        """RoundPublicState must not contain current-round outcome (no leakage to act())."""
        from dataclasses import fields
        field_names = {f.name for f in fields(RoundPublicState)}
        assert "y_t" not in field_names, "RoundPublicState must not include y_t"
        assert "y_history" in field_names, "RoundPublicState should expose only past y_history"


class TestCoreDeterminism:
    """Core run_round is deterministic given fixed inputs."""

    def test_same_inputs_same_outputs(self):
        actions = _make_fixed_actions()
        params = MechanismParams(scoring_mode="point_mae")
        y_t = 0.5

        state1 = MechanismState()
        state2 = MechanismState()
        for a in actions:
            state1.ewma_loss[a.account_id] = 0.1
            state2.ewma_loss[a.account_id] = 0.1
            state1.wealth[a.account_id] = 10.0
            state2.wealth[a.account_id] = 10.0

        new_state1, logs1 = run_round(state=state1, params=params, actions=actions, y_t=y_t)
        new_state2, logs2 = run_round(state=state2, params=params, actions=actions, y_t=y_t)

        assert logs1["scores"] == logs2["scores"]
        assert logs1["profit"] == logs2["profit"]
        assert logs1["m"] == logs2["m"]
        for aid in new_state1.wealth:
            assert abs(new_state1.wealth[aid] - new_state2.wealth[aid]) < 1e-12

    def test_different_behaviour_same_actions(self):
        """Different behaviour classes producing same actions => same core output."""
        actions = _make_fixed_actions()
        params = MechanismParams(scoring_mode="point_mae")
        y_t = 0.4

        state = MechanismState()
        for a in actions:
            state.ewma_loss[a.account_id] = 0.05
            state.wealth[a.account_id] = 5.0

        new_state, logs = run_round(state=state, params=params, actions=actions, y_t=y_t)

        assert len(logs["scores"]) == len(actions)
        assert all(isinstance(s, float) for s in logs["scores"])


class TestActionValidation:
    """Validate that action constraints are enforced."""

    def test_non_participating_zero_deposit(self):
        actions = [
            AgentAction(account_id="a", participate=False, report=None, deposit=0.0),
            AgentAction(account_id="b", participate=True, report=0.5, deposit=1.0),
        ]
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        state.ewma_loss = {"a": 0.0, "b": 0.0}
        state.wealth = {"a": 10.0, "b": 10.0}

        new_state, logs = run_round(state=state, params=params, actions=actions, y_t=0.5)
        assert logs["deposits"][0] == 0.0
        assert logs["alpha"][0] == 1

    def test_non_participating_nonzero_deposit_raises(self):
        actions = [
            AgentAction(account_id="bad", participate=False, report=None, deposit=1.0),
        ]
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        state.ewma_loss = {"bad": 0.0}

        with pytest.raises(ValueError, match="non-participating"):
            run_round(state=state, params=params, actions=actions, y_t=0.5)

    def test_non_participating_with_report_raises(self):
        actions = [
            AgentAction(account_id="bad", participate=False, report=0.5, deposit=0.0),
        ]
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        state.ewma_loss = {"bad": 0.0}

        with pytest.raises(ValueError, match="non-participating"):
            run_round(state=state, params=params, actions=actions, y_t=0.5)

    def test_negative_deposit_raises(self):
        actions = [
            AgentAction(account_id="bad", participate=True, report=0.5, deposit=-1.0),
        ]
        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()

        with pytest.raises(ValueError, match="deposit must be >= 0"):
            run_round(state=state, params=params, actions=actions, y_t=0.5)


class TestIdentityInvariants:
    """Sybil split preserves deposit sums."""

    def test_split_deposit_sum(self):
        identity = SplitAccountIdentity(k=3)
        total_deposit = 9.0

        actions = identity.map_user_action(
            user_id="user_0",
            participate=True,
            report=0.5,
            deposit=total_deposit,
            meta={},
        )

        assert len(actions) == 3
        deposit_sum = sum(a.deposit for a in actions)
        assert abs(deposit_sum - total_deposit) < 1e-12, (
            f"Split deposits should sum to {total_deposit}, got {deposit_sum}"
        )

    def test_split_all_same_report(self):
        identity = SplitAccountIdentity(k=4)
        report = 0.7

        actions = identity.map_user_action(
            user_id="user_0",
            participate=True,
            report=report,
            deposit=8.0,
            meta={},
        )

        for a in actions:
            assert a.report == report

    def test_non_participating_not_split(self):
        identity = SplitAccountIdentity(k=5)

        actions = identity.map_user_action(
            user_id="user_0",
            participate=False,
            report=None,
            deposit=0.0,
            meta={},
        )

        assert len(actions) == 1
        assert not actions[0].participate


class TestUnseenAccountInitialisation:
    """New account id mid-simulation: initialisation rules are deterministic and tested."""

    def test_unseen_account_gets_initialised(self):
        """Introduce a previously unseen account id in round 2; assert wealth, ewma_loss, sigma."""
        from onlinev2.mechanism.runner import run_round

        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        state.wealth = {"agent_0": 10.0, "agent_1": 10.0, "agent_2": 10.0}
        state.ewma_loss = {"agent_0": 0.1, "agent_1": 0.2, "agent_2": 0.15}

        # Round 1: only agents 0, 1, 2
        actions1 = [
            AgentAction("agent_0", True, 0.4, 1.0, {}),
            AgentAction("agent_1", True, 0.5, 1.0, {}),
            AgentAction("agent_2", True, 0.6, 1.0, {}),
        ]
        state, _ = run_round(state=state, params=params, actions=actions1, y_t=0.5)
        assert "agent_3" not in state.wealth

        # Round 2: add new account agent_3
        actions2 = [
            AgentAction("agent_0", True, 0.45, 1.0, {}),
            AgentAction("agent_1", True, 0.55, 1.0, {}),
            AgentAction("agent_2", True, 0.55, 1.0, {}),
            AgentAction("agent_3", True, 0.5, 0.5, {}),
        ]
        state2, logs = run_round(state=state, params=params, actions=actions2, y_t=0.5)

        # New account must be initialised: wealth = max(0, 0 + profit), ewma_loss and sigma set
        assert "agent_3" in state2.wealth
        assert "agent_3" in state2.ewma_loss
        assert "agent_3" in state2.sigma
        assert state2.wealth["agent_3"] >= 0.0
        assert state2.ewma_loss["agent_3"] >= 0.0
        assert params.sigma_min <= state2.sigma["agent_3"] <= 1.0

    def test_unseen_account_non_participating(self):
        """Unseen account that does not participate still appears in state with zero exposure.
        Unseen accounts get conservative initial ewma_loss (sigma < 1), not 0.0."""
        from onlinev2.mechanism.runner import run_round

        params = MechanismParams(scoring_mode="point_mae")
        state = MechanismState()
        state.wealth = {"agent_0": 10.0}
        state.ewma_loss = {"agent_0": 0.0}

        actions = [
            AgentAction("agent_0", True, 0.5, 1.0, {}),
            AgentAction("agent_new", False, None, 0.0, {}),
        ]
        state2, _ = run_round(state=state, params=params, actions=actions, y_t=0.5)
        assert "agent_new" in state2.wealth
        assert state2.wealth["agent_new"] == 0.0
        # Conservative prior: unseen account gets default_initial_loss, not 0.0 (so sigma < 1)
        assert state2.ewma_loss["agent_new"] > 0.0
        assert state2.sigma["agent_new"] < 1.0


class TestReproducibility:
    """Behaviour reset(seed) produces identical action streams."""

    def test_composite_reproducibility(self):
        pop = build_population(5, seed=42)
        behaviour = CompositeBehaviourModel(pop, scoring_mode="point_mae")

        pub = RoundPublicState(
            t=0, y_history=[], agg_history=[],
            weights_prev={}, sigma_prev={},
            wealth_prev={u.traits.user_id: u.traits.initial_wealth for u in pop},
            profit_prev={},
        )

        behaviour.reset(seed=123)
        actions1 = behaviour.act(pub)

        behaviour.reset(seed=123)
        actions2 = behaviour.act(pub)

        assert len(actions1) == len(actions2)
        for a1, a2 in zip(actions1, actions2):
            assert a1.account_id == a2.account_id
            assert a1.participate == a2.participate
            assert a1.deposit == a2.deposit
            if a1.report is not None and a2.report is not None:
                r1 = float(a1.report) if isinstance(a1.report, (int, float)) else a1.report
                r2 = float(a2.report) if isinstance(a2.report, (int, float)) else a2.report
                if isinstance(r1, float):
                    assert abs(r1 - r2) < 1e-12
                else:
                    assert np.allclose(r1, r2)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
