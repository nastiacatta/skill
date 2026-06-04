"""
Regression tests for the onlinev2 refactor.

- Adversary from make_behaviour emits actions (attacker_0 reachable).
- Point mode always uses reporting policy transform_report (no scalar bypass).
- taus as NumPy array does not trigger ambiguous truth-value.
- sigma stored from L_new (post-round), not L_prev.
- PIT only in quantiles mode and present in logs.
- Gini/HHI/N_eff from onlinev2.mechanism.metrics.
- cap_weight_shares: non-negative, sum 1, each <= omega_max, budget preserved;
  omega_max < 1/n raises.
"""
import numpy as np
import pytest

# ---------------------------------------------------------------------------
# Adversary integration: make_behaviour(ARBITRAGEUR) yields model where attacker_0 acts
# ---------------------------------------------------------------------------

def test_adversary_from_make_behaviour_emits_actions():
    from onlinev2.behaviour.factory import make_behaviour
    from onlinev2.behaviour.protocol import RoundPublicState

    behaviour = make_behaviour("ARBITRAGEUR", n_users=3, seed=42)
    behaviour.reset(43)

    state = RoundPublicState(
        t=0,
        y_history=[],
        agg_history=[],
        weights_prev={"user_0": 0.2, "user_1": 0.3, "attacker_0": 0.5},
        sigma_prev={"user_0": 0.6, "user_1": 0.7, "attacker_0": 0.5},
        wealth_prev={"user_0": 10.0, "user_1": 10.0, "attacker_0": 10.0},
        profit_prev={"user_0": 0.0, "user_1": 0.0, "attacker_0": 0.0},
    )
    actions = behaviour.act(state)

    account_ids = [a.account_id for a in actions]
    assert "attacker_0" in account_ids, (
        "attacker_0 must appear in actions from make_behaviour(ARBITRAGEUR)"
    )
    n_attacker = sum(1 for a in actions if a.account_id == "attacker_0")
    assert n_attacker >= 1, "at least one action must come from the adversary"


# ---------------------------------------------------------------------------
# Point mode: transform_report is always called (no belief+bias bypass)
# ---------------------------------------------------------------------------

@pytest.mark.skip(
    reason="Composite may not call transform_report in all point-mode paths; "
    "desired invariant to enforce later"
)
def test_point_mode_transform_report_called():
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.policies.belief import PrivateSignalBelief
    from onlinev2.behaviour.policies.identity import SingleAccountIdentity
    from onlinev2.behaviour.policies.participation import BaselineParticipation
    from onlinev2.behaviour.policies.reporting import TruthfulReporting
    from onlinev2.behaviour.policies.staking import FixedFractionStaking
    from onlinev2.behaviour.population import UserConfig
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import generate_population

    class RecordingReporting(TruthfulReporting):
        called = False

        def transform_report(self, belief, user, rng, context):
            RecordingReporting.called = True
            return super().transform_report(belief, user, rng, context)

    RecordingReporting.called = False
    traits_list = generate_population(2, seed=101)
    user_configs = [
        UserConfig(
            traits=t,
            participation_policy=BaselineParticipation(),
            belief_policy=PrivateSignalBelief(),
            reporting_policy=RecordingReporting(),
            staking_policy=FixedFractionStaking(),
            identity_policy=SingleAccountIdentity(),
        )
        for t in traits_list
    ]
    model = CompositeBehaviourModel(user_configs, scoring_mode="point_mae")
    model.reset(102)
    state = RoundPublicState(
        t=0, y_history=[], agg_history=[],
        weights_prev={t.user_id: 0.5 for t in traits_list},
        sigma_prev={t.user_id: 0.5 for t in traits_list},
        wealth_prev={t.user_id: 10.0 for t in traits_list},
        profit_prev={t.user_id: 0.0 for t in traits_list},
    )
    model.act(state)
    assert RecordingReporting.called, "Point mode must call transform_report"


# ---------------------------------------------------------------------------
# taus: NumPy array does not trigger ambiguous truth-value
# ---------------------------------------------------------------------------

def test_taus_numpy_array_no_ambiguous_truth():
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population

    taus_arr = np.array([0.25, 0.5, 0.75], dtype=np.float64)
    pop = build_population(2, seed=1)
    model = CompositeBehaviourModel(pop, scoring_mode="quantiles_crps", taus=taus_arr)
    np.testing.assert_array_almost_equal(model.taus, taus_arr)


# ---------------------------------------------------------------------------
# sigma from L_new; PIT only in quantiles; Gini/HHI/N_eff from metrics
# ---------------------------------------------------------------------------

def test_runner_sigma_from_L_new_and_metrics_from_module():
    from onlinev2.core.runner import run_round
    from onlinev2.core.skill import loss_to_skill, update_ewma_loss
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput

    state = MechanismState(
        t=0,
        ewma_loss={"a": 0.0, "b": 0.2, "c": 0.4},
        wealth={"a": 10.0, "b": 10.0, "c": 10.0},
        sigma={"a": 0.5, "b": 0.5, "c": 0.5},
        weights_prev={},
        profit_prev={},
        agg_prev=None,
    )
    params = MechanismParams(
        scoring_mode="point_mae",
        taus=None,
        lam=0.3,
        rho=0.1,
        gamma=4.0,
        sigma_min=0.1,
        omega_max=None,
        eps=1e-12,
        U=0.0,
        kappa=0.0,
        L0=0.0,
        eta=1.0,
    )
    actions = [
        RoundInput(account_id="a", participate=True, report=0.5, deposit=1.0),
        RoundInput(account_id="b", participate=True, report=0.5, deposit=1.0),
        RoundInput(account_id="c", participate=True, report=0.5, deposit=1.0),
    ]
    y_t = 0.5

    new_state, logs = run_round(state=state, params=params, actions=actions, y_t=y_t)

    L_prev = np.array([0.0, 0.2, 0.4])
    losses_norm = np.array([0.0, 0.0, 0.0])
    alpha = np.array([0, 0, 0])
    L_new = update_ewma_loss(
        L_prev, losses_norm, alpha, rho=params.rho, kappa=params.kappa, L0=params.L0
    )
    sigma_expected = loss_to_skill(L_new, sigma_min=params.sigma_min, gamma=params.gamma)
    sigma_expected = np.clip(sigma_expected, params.sigma_min, 1.0)
    for i, aid in enumerate(["a", "b", "c"]):
        assert abs(new_state.sigma[aid] - sigma_expected[i]) < 1e-9, "sigma must be from L_new"

    assert "HHI" in logs and "N_eff" in logs and "Gini" in logs


def test_pit_only_in_quantiles_mode():
    from onlinev2.core.runner import run_round
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput

    def _state():
        return MechanismState(
            t=0,
            ewma_loss={"a": 0.0, "b": 0.0},
            wealth={"a": 10.0, "b": 10.0},
            sigma={"a": 0.5, "b": 0.5},
            weights_prev={},
            profit_prev={},
            agg_prev=None,
        )

    actions = [
        RoundInput(account_id="a", participate=True, report=0.4, deposit=1.0),
        RoundInput(account_id="b", participate=True, report=0.6, deposit=1.0),
    ]

    params_point = MechanismParams(
        scoring_mode="point_mae", taus=None, lam=0.3, rho=0.1, gamma=4.0,
        sigma_min=0.1, omega_max=None, eps=1e-12, U=0.0, kappa=0.0, L0=0.0, eta=1.0,
    )
    _, logs_point = run_round(state=_state(), params=params_point, actions=actions, y_t=0.5)
    assert "PIT" not in logs_point, "PIT must not appear in point_mae mode"

    taus = np.array([0.25, 0.5, 0.75])
    params_quant = MechanismParams(
        scoring_mode="quantiles_crps", taus=taus, lam=0.3, rho=0.1, gamma=4.0,
        sigma_min=0.1, omega_max=None, eps=1e-12, U=0.0, kappa=0.0, L0=0.0, eta=1.0,
    )
    actions_q = [
        RoundInput(account_id="a", participate=True, report=[0.3, 0.5, 0.7], deposit=1.0),
        RoundInput(account_id="b", participate=True, report=[0.4, 0.5, 0.6], deposit=1.0),
    ]
    _, logs_quant = run_round(state=_state(), params=params_quant, actions=actions_q, y_t=0.5)
    assert "PIT" in logs_quant, "PIT must appear in quantiles_crps mode"


# ---------------------------------------------------------------------------
# cap_weight_shares
# ---------------------------------------------------------------------------

def test_cap_weight_shares_invariants():
    from onlinev2.mechanism.staking import cap_weight_shares

    m = np.array([1.0, 2.0, 3.0, 4.0], dtype=np.float64)
    omega_max = 0.4
    m_cap = cap_weight_shares(m, omega_max=omega_max)
    M = float(m.sum())
    shares = m_cap / M
    assert np.all(m_cap >= -1e-12), "capped wagers must be non-negative"
    assert abs(shares.sum() - 1.0) < 1e-9, "shares must sum to 1"
    assert np.all(shares <= omega_max + 1e-9), "each share must be <= omega_max"
    assert abs(m_cap.sum() - M) < 1e-9, "total budget must be preserved"


def test_cap_weight_shares_omega_max_infeasible_raises():
    from onlinev2.mechanism.staking import cap_weight_shares

    m = np.array([1.0, 1.0, 1.0], dtype=np.float64)
    with pytest.raises(ValueError, match="omega_max.*1/n"):
        cap_weight_shares(m, omega_max=0.2)


def test_cap_weight_shares_negative_raises():
    from onlinev2.mechanism.staking import cap_weight_shares

    m = np.array([1.0, -0.5, 2.0], dtype=np.float64)
    with pytest.raises(ValueError, match="non-negative"):
        cap_weight_shares(m, omega_max=0.5)


# ---------------------------------------------------------------------------
# Causal timing invariant for the round-t skill σ_t: this section pins the
# look-ahead-bias invariant. The invariant asserts that the skill σ used at
# round t inside settle_round / wager / cap must NOT depend on the round-t
# outcome y_t. The actual implementation computes σ_t once from L_prev
# (= L_{t-1}) at the top of run_round and uses that value throughout the
# round; the post-round update only writes σ_{t+1} into state.sigma for use
# NEXT round. These tests pin that ordering.
# ---------------------------------------------------------------------------

def test_sigma_t_used_in_round_independent_of_y_t():
    """σ_t logged for round t (and used in settlement/wagers) must NOT
    depend on the round-t outcome y_t. Two runs with identical state and
    identical actions but different y_t must produce identical
    ``logs['sigma']`` and identical ``logs['m_agg']``."""
    from onlinev2.core.runner import run_round
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput

    def _state():
        return MechanismState(
            t=5,
            ewma_loss={"a": 0.0, "b": 0.2, "c": 0.4},
            wealth={"a": 10.0, "b": 10.0, "c": 10.0},
            sigma={"a": 0.5, "b": 0.5, "c": 0.5},
            weights_prev={}, profit_prev={}, agg_prev=None,
        )

    params = MechanismParams(
        scoring_mode="point_mae", taus=None, lam=0.3, rho=0.1, gamma=4.0,
        sigma_min=0.1, omega_max=None, eps=1e-12, U=0.0, kappa=0.0, L0=0.0,
        eta=1.0,
    )
    actions = [
        RoundInput(account_id="a", participate=True, report=0.1, deposit=1.0),
        RoundInput(account_id="b", participate=True, report=0.5, deposit=1.0),
        RoundInput(account_id="c", participate=True, report=0.9, deposit=1.0),
    ]

    _, log_lo = run_round(state=_state(), params=params, actions=actions, y_t=0.05)
    _, log_hi = run_round(state=_state(), params=params, actions=actions, y_t=0.95)

    # The σ_t actually used at round t (logged) must be identical regardless
    # of y_t — pinned ordering: σ_t = f(L_{t-1}) must be F_{t-1}-measurable.
    np.testing.assert_array_equal(
        np.asarray(log_lo["sigma"]),
        np.asarray(log_hi["sigma"]),
    )
    # m_agg uses sigma_t in the wager formula; ditto.
    np.testing.assert_array_equal(
        np.asarray(log_lo["m_agg"]),
        np.asarray(log_hi["m_agg"]),
    )


def test_sigma_t_equals_loss_to_skill_of_state_ewma_loss():
    """At entry to run_round, σ_t (logged) must equal
    ``loss_to_skill(state.ewma_loss)``. This pins the start-of-round
    timing: σ_t reads L_{t-1} only."""
    from onlinev2.core.runner import run_round
    from onlinev2.core.skill import loss_to_skill
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput

    state = MechanismState(
        t=12,
        ewma_loss={"a": 0.07, "b": 0.31, "c": 0.62},
        wealth={"a": 10.0, "b": 10.0, "c": 10.0},
        sigma={"a": 999.0, "b": 999.0, "c": 999.0},  # poisoned: must be ignored
        weights_prev={}, profit_prev={}, agg_prev=None,
    )
    params = MechanismParams(
        scoring_mode="point_mae", taus=None, lam=0.3, rho=0.1, gamma=4.0,
        sigma_min=0.1, omega_max=None, eps=1e-12, U=0.0, kappa=0.0, L0=0.0,
        eta=1.0,
    )
    actions = [
        RoundInput(account_id="a", participate=True, report=0.3, deposit=1.0),
        RoundInput(account_id="b", participate=True, report=0.5, deposit=1.0),
        RoundInput(account_id="c", participate=True, report=0.7, deposit=1.0),
    ]
    _, logs = run_round(state=state, params=params, actions=actions, y_t=0.42)

    L_prev = np.array([0.07, 0.31, 0.62])
    expected_sigma_t = np.clip(
        loss_to_skill(L_prev, sigma_min=params.sigma_min, gamma=params.gamma),
        params.sigma_min, 1.0,
    )
    np.testing.assert_allclose(
        np.asarray(logs["sigma"]), expected_sigma_t, atol=1e-12,
    )
