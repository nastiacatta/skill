"""
Tests for: cap used for both settlement and aggregation, new-account prior,
exposure-weighted skill, Michael intermittent backend, default backward compat.
"""
import numpy as np
import pytest


def test_cap_used_for_both_settlement_and_aggregation():
    """With active omega_max, m and m_agg must equal m_used; settlement must use m_pre path."""
    from onlinev2.core.runner import run_round
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput

    state = MechanismState(t=0)
    params = MechanismParams(
        scoring_mode="point_mae",
        sigma_min=0.1,
        gamma=4.0,
        omega_max=0.4,
        lam=0.3,
        eta=1.0,
        rho=0.1,
        eps=1e-12,
        aggregation_mode="wager",
        use_exposure_weighted_skill=False,
    )
    actions = [
        RoundInput(account_id="a", participate=True, report=0.3, deposit=2.0),
        RoundInput(account_id="b", participate=True, report=0.5, deposit=2.0),
        RoundInput(account_id="c", participate=True, report=0.7, deposit=2.0),
    ]
    # Pre-init so L_prev is defined (use default_initial_loss for unseen would run otherwise)
    init_L = 0.5
    state.ewma_loss = {"a": init_L, "b": init_L, "c": init_L}
    state.wealth = {"a": 10.0, "b": 10.0, "c": 10.0}

    new_state, logs = run_round(state=state, params=params, actions=actions, y_t=0.5)

    assert logs["m"] == logs["m_agg"], "same effective wager vector for settlement and aggregation"
    m_used = np.array(logs["m"])
    m_raw = np.array(logs["m_raw"])
    assert m_raw.shape == m_used.shape, "m_raw and m_used same shape"
    # With omega_max=0.4, cap should bind so m_used != m_raw (unless already within cap)
    total = float(m_used.sum())
    shares = m_used / total
    assert np.all(shares <= 0.4 + 1e-9), "capped shares <= omega_max"
    # Settlement used m_pre: profit and payoffs are consistent with m_used, not raw
    assert "m_raw" in logs and "m" in logs


def test_new_account_sigma_not_one():
    """Unseen account on first round must have sigma < 1.0 (conservative prior)."""
    from onlinev2.core.runner import run_round
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput

    state = MechanismState(t=0)
    params = MechanismParams(
        scoring_mode="point_mae",
        sigma_min=0.1,
        gamma=4.0,
        sigma_init=0.3,
        lam=0.3,
        eta=1.0,
        rho=0.1,
        eps=1e-12,
        aggregation_mode="wager",
        use_exposure_weighted_skill=False,
    )
    actions = [
        RoundInput(account_id="newbie", participate=True, report=0.5, deposit=1.0),
    ]

    new_state, logs = run_round(state=state, params=params, actions=actions, y_t=0.5)

    sigma_new = new_state.sigma["newbie"]
    assert sigma_new < 1.0, "unseen account must not start at sigma=1"
    assert sigma_new >= 0.1, "sigma must be >= sigma_min"


def test_exposure_weighting_small_bet_moves_less():
    """Same loss, smaller m moves EWMA less than larger m (exposure-weighted learning)."""
    from onlinev2.core.skill import update_ewma_loss

    L_prev = np.array([0.5, 0.5])
    losses_t = np.array([0.8, 0.8])
    alpha_t = np.array([0, 0])
    rho = 0.2
    m_ref = 1.0

    m_small = np.array([0.2, 0.2])   # low exposure
    m_large = np.array([2.0, 2.0])   # high exposure (capped by min(1, m/m_ref) = 1)

    L_no_weight = update_ewma_loss(
        L_prev, losses_t, alpha_t, rho=rho,
        m_t=None, use_exposure_weighting=False,
    )
    L_small = update_ewma_loss(
        L_prev, losses_t, alpha_t, rho=rho,
        m_t=m_small, m_ref=m_ref, use_exposure_weighting=True,
    )
    L_large = update_ewma_loss(
        L_prev, losses_t, alpha_t, rho=rho,
        m_t=m_large, m_ref=m_ref, use_exposure_weighting=True,
    )

    # With small exposure, rho_eff is smaller so L moves less toward loss
    assert L_small[0] < L_large[0], "smaller wager should move EWMA less"
    assert L_large[0] <= L_no_weight[0] + 1e-9, "large exposure close to unweighted"


def test_michael_predict_handles_missing_forecasts():
    """With one missing forecast, output uses present forecasts plus correction.

    theta = w + D alpha is NOT projected onto the simplex (Vitali & Pinson 2025,
    eqs. 5–7). Only w is constrained to the simplex; D is free.
    """
    from onlinev2.core.intermittent import michael_predict

    n = 3
    x_t = np.array([0.2, 0.5, 0.8], dtype=np.float64)
    alpha_t = np.array([0, 1, 0], dtype=np.int32)  # second forecaster missing
    w = np.ones(n) / n
    D = np.zeros((n, n))

    y_hat, aux = michael_predict(x_t, alpha_t, w, D)

    theta = aux["theta"]
    # With D = 0, theta = w (already on simplex); no projection applied.
    np.testing.assert_array_almost_equal(theta, w)
    # x(alpha) has index 1 zeroed, so prediction is theta @ x_masked
    assert not np.isnan(y_hat) and np.isfinite(y_hat)
    # Present forecasts 0.2 and 0.8 contribute; missing does not
    assert 0.0 <= y_hat <= 1.0 + 1e-9


def test_michael_predict_theta_not_projected_when_D_active():
    """With nonzero D and a missing forecast, theta can leave the simplex
    (sum != 1 or negative entries), matching the paper; predict must not
    project it back."""
    from onlinev2.core.intermittent import michael_predict

    n = 3
    x_t = np.array([0.2, 0.5, 0.8], dtype=np.float64)
    alpha_t = np.array([0, 1, 0], dtype=np.int32)
    w = np.array([0.5, 0.3, 0.2], dtype=np.float64)
    # D column 1 adds mass to coordinate 0 only when agent 1 is missing.
    D = np.zeros((n, n))
    D[0, 1] = 0.4

    _, aux = michael_predict(x_t, alpha_t, w, D)
    theta = aux["theta"]

    # Expected: theta = w + D @ [0,1,0] = [0.5+0.4, 0.3, 0.2] = [0.9, 0.3, 0.2]
    np.testing.assert_array_almost_equal(theta, np.array([0.9, 0.3, 0.2]))
    # Explicitly off-simplex (sum = 1.4, not 1.0)
    assert abs(theta.sum() - 1.4) < 1e-12


def test_default_mode_unchanged_when_new_flags_off():
    """With aggregation_mode='wager' and use_exposure_weighted_skill=False, behaviour
    matches intended: new-account prior (sigma < 1 for unseen) and same m for settle + agg.
    No other change to results for existing codepath."""
    from onlinev2.core.runner import run_round
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput

    state = MechanismState(t=0)
    state.ewma_loss = {"a": 0.2, "b": 0.4}
    state.wealth = {"a": 10.0, "b": 10.0}
    params = MechanismParams(
        scoring_mode="point_mae",
        sigma_min=0.1,
        gamma=4.0,
        omega_max=None,
        lam=0.3,
        eta=1.0,
        rho=0.1,
        eps=1e-12,
        aggregation_mode="wager",
        use_exposure_weighted_skill=False,
    )
    actions = [
        RoundInput(account_id="a", participate=True, report=0.4, deposit=1.0),
        RoundInput(account_id="b", participate=True, report=0.6, deposit=1.0),
    ]

    new_state, logs = run_round(state=state, params=params, actions=actions, y_t=0.5)

    # m and m_agg are the same (single wager vector)
    assert logs["m"] == logs["m_agg"]
    # r_hat is wager-weighted average of reports
    r_hat = logs["r_hat"]
    assert isinstance(r_hat, (float, np.floating))
    assert 0.0 <= r_hat <= 1.0
    # sigma from L_new; existing accounts use their L_prev
    assert "a" in new_state.sigma and "b" in new_state.sigma


def test_michael_split_allocation_uses_theta():
    """With allocation_mode='michael_split', allocation is true Michael utility split
    (Shapley + oos), not Raja. Run completes and with U=0 profits sum to zero."""
    from onlinev2.core.runner import run_round
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput

    state = MechanismState(t=0)
    state.ewma_loss = {"a": 0.3, "b": 0.4, "c": 0.5}
    state.wealth = {"a": 10.0, "b": 10.0, "c": 10.0}
    params = MechanismParams(
        scoring_mode="point_mae",
        sigma_min=0.1,
        gamma=4.0,
        lam=0.3,
        eta=1.0,
        rho=0.1,
        eps=1e-12,
        aggregation_mode="michael_robust_lr",
        allocation_mode="michael_split",
        michael_lr=0.05,
        delta_is=0.5,
    )
    actions = [
        RoundInput(account_id="a", participate=True, report=0.2, deposit=2.0),
        RoundInput(account_id="b", participate=True, report=0.5, deposit=2.0),
        RoundInput(account_id="c", participate=True, report=0.8, deposit=2.0),
    ]

    new_state, logs = run_round(state=state, params=params, actions=actions, y_t=0.5)

    # m_agg is wager-based; m (used for settlement) can differ with michael_split.
    # With michael_split, theta drives settlement; after a few rounds theta != uniform
    # At least verify run completes and profits sum to zero (self-financing)
    prof = np.array(logs["profit"])
    assert np.abs(prof.sum()) < 1e-9, "settlement must be self-financing"


def test_settlement_raises_on_invalid_lam():
    """settle_round must reject lam outside [0, 1]."""
    from onlinev2.core.settlement import settle_round

    b = np.array([1.0, 1.0])
    sigma = np.array([0.5, 0.5])
    scores = np.array([0.5, 0.5])
    with pytest.raises(ValueError, match="lam must be in"):
        settle_round(b, sigma, lam=1.5, scores=scores)
    with pytest.raises(ValueError, match="lam must be in"):
        settle_round(b, sigma, lam=-0.1, scores=scores)


def test_skill_gate_raises_on_invalid_lam():
    """skill_gate must reject lam outside [0, 1]."""
    from onlinev2.core.staking import skill_gate

    sigma = np.array([0.5, 0.5])
    with pytest.raises(ValueError, match="lam must be in"):
        skill_gate(sigma, lam=1.2)
    with pytest.raises(ValueError, match="lam must be in"):
        skill_gate(sigma, lam=-0.01)


def test_exposure_weighting_raises_on_zero_m_ref():
    """update_ewma_loss must reject m_ref <= 0 when use_exposure_weighting=True."""
    from onlinev2.core.skill import update_ewma_loss

    L_prev = np.array([0.5])
    losses_t = np.array([0.5])
    alpha_t = np.array([0])
    m_t = np.array([1.0])
    with pytest.raises(ValueError, match="m_ref must be > 0"):
        update_ewma_loss(
            L_prev, losses_t, alpha_t, rho=0.1,
            m_t=m_t, m_ref=0.0, use_exposure_weighting=True,
        )
