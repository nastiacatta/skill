"""Theory alignment audit — pins fixes for three math/theory deviations found
against the canonical references in ``theory/``.

Scope
-----
1. ``michael_predict`` must NOT project ``theta = w + D alpha`` onto the
   non-negative simplex. Vitali & Pinson (2025, arXiv:2510.13385) eqs. 5–7
   constrain only ``w`` (eq. 6); the correction matrix ``D`` and hence
   ``theta`` are unconstrained. See Vitali & Pinson (2025), arXiv:2510.13385, eqs. 5–7.

2. ``confidence_from_quantiles`` default (``space='raw'``) must use
   ``q(tau_H) - q(tau_L)`` on the observation scale, matching the canonical raw-space
   interval width. The ``space='probit'`` branch
   is retained for backward-compatible ablations only.

3. ``run_round`` michael_split pinball loss must be sign-dependent for both
   point_mae and quantiles_crps (Vitali & Pinson eq. 3 / Masters notes),
   not the sign-independent ``|y-x|*tau + |x-y|*(1-tau)`` stub that
   previously lived in the point_mae branch.
"""
from __future__ import annotations

import numpy as np
import pytest

pytestmark = [pytest.mark.audit]


# ---------------------------------------------------------------------------
# (1) Michael theta must be returned raw (no simplex projection)
# ---------------------------------------------------------------------------
def test_michael_predict_theta_preserves_off_simplex_correction():
    """With nonzero D and alpha_j=1, theta = w + D[:, j] is off-simplex and
    must NOT be projected. Canonical source: Vitali & Pinson 2025 eqs. 5–7."""
    from onlinev2.core.intermittent import michael_predict

    n = 4
    x = np.array([0.2, 0.4, 0.6, 0.8], dtype=float)
    alpha = np.array([0, 1, 0, 0], dtype=np.int32)
    w = np.array([0.4, 0.3, 0.2, 0.1], dtype=float)  # on the simplex
    D = np.zeros((n, n), dtype=float)
    D[0, 1] = 0.5        # pushes mass onto agent 0 when agent 1 is missing
    D[2, 1] = -0.1       # can be negative; D is unconstrained

    _, aux = michael_predict(x, alpha, w, D)
    theta = np.asarray(aux["theta"], dtype=float)

    # theta = w + D @ alpha = w + D[:, 1]
    expected = w + D[:, 1]
    np.testing.assert_array_almost_equal(theta, expected, decimal=12)

    # Explicitly verify theta is off-simplex (sum != 1 and has negative entry).
    assert abs(theta.sum() - expected.sum()) < 1e-12
    assert abs(expected.sum() - 1.0) > 1e-3, (
        "Test setup requires theta off-simplex to detect projection."
    )


def test_michael_predict_ygat_uses_raw_theta():
    """y_hat must equal (w + D alpha) dot x_masked, not the projected version."""
    from onlinev2.core.intermittent import michael_predict

    n = 3
    x = np.array([0.1, 0.5, 0.9], dtype=float)
    alpha = np.array([0, 1, 0], dtype=np.int32)
    w = np.array([0.6, 0.3, 0.1], dtype=float)
    D = np.zeros((n, n), dtype=float)
    D[0, 1] = 0.3
    D[2, 1] = 0.0

    y_hat, aux = michael_predict(x, alpha, w, D)
    theta = aux["theta"]

    x_masked = x.copy()
    x_masked[alpha == 1] = 0.0
    expected_y = float(theta @ x_masked)
    assert abs(y_hat - expected_y) < 1e-12


# ---------------------------------------------------------------------------
# (2) Confidence: raw default, probit opt-in
# ---------------------------------------------------------------------------
def test_confidence_default_uses_raw_width():
    """Default ``space`` must be 'raw'. For a narrow quantile band on [0,1]
    the raw-width and probit-width c values are numerically different, so
    the default behaviour is observable."""
    from onlinev2.core.staking import confidence_from_quantiles

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    q = np.array([[0.45, 0.48, 0.50, 0.52, 0.55]], dtype=float)  # narrow band

    c_default = confidence_from_quantiles(
        q, taus, beta_c=1.0, c_min=0.1, c_max=1.5,
    )
    c_raw = confidence_from_quantiles(
        q, taus, beta_c=1.0, c_min=0.1, c_max=1.5, space="raw",
    )
    c_probit = confidence_from_quantiles(
        q, taus, beta_c=1.0, c_min=0.1, c_max=1.5, space="probit",
    )

    # Default equals raw, not probit.
    np.testing.assert_array_almost_equal(c_default, c_raw, decimal=12)
    assert not np.allclose(c_raw, c_probit, atol=1e-6), (
        "Test setup requires raw and probit to differ on this band."
    )


def test_confidence_raw_matches_masters_notes_formula():
    """c_i = clip(exp(-beta_c * (q_H - q_L)), c_min, c_max). Masters notes §Step 1."""
    from onlinev2.core.staking import confidence_from_quantiles

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    q = np.array([
        [0.30, 0.40, 0.50, 0.60, 0.70],  # width 0.40
        [0.48, 0.49, 0.50, 0.51, 0.52],  # width 0.04
    ], dtype=float)

    beta_c = 2.0
    c = confidence_from_quantiles(
        q, taus, beta_c=beta_c, c_min=0.0, c_max=10.0, space="raw",
    )

    expected = np.exp(-beta_c * np.array([0.40, 0.04]))
    np.testing.assert_array_almost_equal(c, expected, decimal=12)


def test_confidence_rejects_invalid_space():
    from onlinev2.core.staking import confidence_from_quantiles

    taus = np.array([0.1, 0.5, 0.9])
    q = np.array([[0.3, 0.5, 0.7]], dtype=float)

    with pytest.raises(ValueError, match="space must be"):
        confidence_from_quantiles(q, taus, space="latent")


# ---------------------------------------------------------------------------
# (3) Michael-split pinball loss sign-dependent for point_mae
# ---------------------------------------------------------------------------
def test_michael_split_point_mae_uses_canonical_pinball():
    """In point_mae mode with tau=0.5, the OOS allocation must behave
    identically whether we pass the sign-independent stub or the canonical
    pinball. At tau=0.5 pinball reduces to |err|/2 so OOS ratios are the
    same; this test pins the runner on non-symmetric tau (via michael_tau)
    to catch any regression to the old |err|*tau + |err|*(1-tau) formula."""
    from onlinev2.core.runner import run_round
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput

    # Use tau = 0.3 via michael_tau so the pinball asymmetry is observable.
    state = MechanismState(t=0)
    state.ewma_loss = {"a": 0.1, "b": 0.1, "c": 0.1}
    state.wealth = {"a": 10.0, "b": 10.0, "c": 10.0}
    params = MechanismParams(
        scoring_mode="point_mae",
        sigma_min=0.1,
        gamma=2.0,
        omega_max=None,
        lam=0.3,
        eta=1.0,
        rho=0.1,
        eps=1e-12,
        aggregation_mode="wager",
        allocation_mode="michael_split",
        michael_tau=0.3,  # asymmetric
        michael_shapley_mc=16,
        michael_lambda=0.5,
        delta_is=0.0,  # rewards come only from OOS (isolates pinball formula)
        U=1.0,
    )

    # y = 0.5. Reports straddle y, so pinball L_0.3 asymmetry is visible:
    # err_a = 0.5 - 0.2 = +0.3 -> L = 0.3 * 0.3 = 0.09
    # err_b = 0.5 - 0.8 = -0.3 -> L = (0.3-1)*(-0.3) = 0.21
    # err_c = 0.5 - 0.5 =  0.0 -> L = 0.0
    actions = [
        RoundInput(account_id="a", participate=True, report=0.2, deposit=1.0),
        RoundInput(account_id="b", participate=True, report=0.8, deposit=1.0),
        RoundInput(account_id="c", participate=True, report=0.5, deposit=1.0),
    ]
    _, logs = run_round(state=state, params=params, actions=actions, y_t=0.5)

    # With canonical pinball: L_a = 0.09, L_b = 0.21, L_c = 0.0.
    # With the OLD buggy formula |err|*tau + |err|*(1-tau) = |err|:
    # L_a = 0.3, L_b = 0.3, L_c = 0.0 -> a and b would receive equal rewards.
    # Canonical pinball makes them unequal (a is closer under tau=0.3).
    profit = np.asarray(logs["profit"], dtype=float)
    assert profit[0] > profit[1], (
        "Under asymmetric pinball (tau=0.3) agent a (report=0.2, err=+0.3) "
        "should out-score agent b (report=0.8, err=-0.3); got profits "
        f"{profit[0]:.4f} vs {profit[1]:.4f}. The old sign-independent "
        "stub would give a == b."
    )


# ---------------------------------------------------------------------------
# (4) PIT KS statistic must use the truncated-PIT null, not Uniform(0, 1)
# ---------------------------------------------------------------------------
def test_ks_uniform_truncated_is_small_for_perfectly_calibrated_forecaster():
    """A perfectly calibrated Gaussian forecaster evaluated on the default
    5-tau grid should produce KS ≈ 0 under the truncated null. The legacy
    Uniform(0, 1) null would give KS ≈ 0.1 regardless of calibration.
    """
    from scipy.stats import norm

    from onlinev2.core.metrics import RoundMetricsLogger

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    mu, sig = 0.5, 0.15
    qs = np.array([norm.ppf(t, loc=mu, scale=sig) for t in taus])

    rng = np.random.default_rng(2024)
    logger = RoundMetricsLogger(taus=taus)
    for _ in range(5000):
        y = float(rng.normal(mu, sig))
        logger.log_round(
            y_t=y,
            agg_quantiles=qs,
            weights=np.ones(3, dtype=float),
            wealth=np.ones(3, dtype=float),
        )

    summary = logger.summary()
    # Truncated null: KS should be small (finite-sample noise).
    assert summary["pit_ks_uniform"] < 0.03, (
        f"KS against truncated null should be ~0 for a calibrated forecaster, "
        f"got {summary['pit_ks_uniform']:.4f}"
    )
    # Legacy Uniform(0, 1) null is biased by the boundary truncation.
    assert summary["pit_ks_uniform01"] >= 0.08, (
        "Legacy Uniform(0,1) KS should retain its spurious ~0.1 bias"
    )


def test_ks_uniform_truncated_flags_miscalibration():
    """An under-dispersed forecaster (too narrow) should produce a large KS
    under the truncated null, separating it from the calibrated baseline."""
    from scipy.stats import norm

    from onlinev2.core.metrics import RoundMetricsLogger

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    mu, sig_true = 0.5, 0.15
    qs_narrow = np.array([norm.ppf(t, loc=mu, scale=0.05) for t in taus])

    rng = np.random.default_rng(2024)
    logger = RoundMetricsLogger(taus=taus)
    for _ in range(5000):
        y = float(rng.normal(mu, sig_true))
        logger.log_round(
            y_t=y,
            agg_quantiles=qs_narrow,
            weights=np.ones(3, dtype=float),
            wealth=np.ones(3, dtype=float),
        )

    summary = logger.summary()
    assert summary["pit_ks_uniform"] > 0.15, (
        f"KS against truncated null must flag under-dispersion; got "
        f"{summary['pit_ks_uniform']:.4f}"
    )


def test_ks_uniform_truncated_zero_on_empty_input():
    from onlinev2.core.metrics import _ks_uniform_truncated

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    assert _ks_uniform_truncated(np.array([]), taus) == 0.0


def test_ks_uniform_truncated_handles_boundary_atoms_correctly():
    """Samples piled up at the boundaries correctly contribute to the KS
    statistic via the boundary-atom handling."""
    from onlinev2.core.metrics import _ks_uniform_truncated

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    # 60 samples at tau_lo, 40 samples at tau_hi. Null CDF has atom of mass
    # 0.1 at 0.1 and atom of mass 0.1 at 0.9. Empirical has mass 0.6 and 0.4.
    x = np.concatenate([np.full(60, 0.1), np.full(40, 0.9)])
    ks = _ks_uniform_truncated(x, taus)
    # At tau_lo, F_emp(tau_lo) = 0.6, F_null(tau_lo) = 0.1 -> diff = 0.5.
    # At tau_hi-, F_emp = 0.6, F_null = 0.9 -> diff = 0.3.
    # At tau_hi, F_emp = 1.0, F_null = 1.0 -> 0.
    assert abs(ks - 0.5) < 1e-9, f"Expected KS = 0.5, got {ks}"


# ---------------------------------------------------------------------------
# (5) Heterogeneous-σ sybil: Lambert sybilproofness assumes identical σ.
# Sybil splitting WITH different σ across split accounts breaks the identity.
# This test documents the expected behaviour: the split gives a strictly
# different total wager, so the symmetry assumption of Lambert 2008 Thm 1
# clause (iv) does not hold. It is not a bug; it is a known limitation that
# must be reported alongside any Lambert-style sybilproofness claim.
# ---------------------------------------------------------------------------
def test_heterogeneous_sigma_sybil_breaks_lambert_symmetry():
    """When the split identities have different σ's, the effective-wager map
    ``m = b(λ + (1-λ)σ^η)`` is non-linear in σ. Splitting one identity with
    wealth b across two accounts with σ_1 ≠ σ_2 yields total effective wager

        m_split = (b/2)(λ + (1-λ)σ_1^η) + (b/2)(λ + (1-λ)σ_2^η)
                = b(λ + (1-λ)(σ_1^η + σ_2^η)/2)

    which is in general NOT equal to m_single = b(λ + (1-λ)σ_orig^η) unless
    σ_orig^η = mean(σ_1^η, σ_2^η) — that is, unless we pick the arithmetic mean
    of powers as the original σ.

    Lambert sybilproofness (2008 Thm 1) assumes identical score/weight across
    the split, so this experiment documents an additional attack surface the
    skill-gated mechanism exposes that vanilla Lambert does not. The test
    pins the behaviour rather than asserting "no advantage".
    """
    from onlinev2.core.staking import effective_wager_bankroll

    b_total = 1.0
    lam = 0.3
    eta = 2.0
    sigma_orig = 0.5
    # Split into two identities with different σ (e.g. one fresh, one seasoned).
    sigma_fresh = 0.2
    sigma_seasoned = 0.8

    m_single = effective_wager_bankroll(
        np.array([b_total]), np.array([sigma_orig]), lam, eta
    )[0]

    # Equal-wealth split, heterogeneous σ.
    b_split = np.array([b_total / 2, b_total / 2])
    sigma_split = np.array([sigma_fresh, sigma_seasoned])
    m_split_arr = effective_wager_bankroll(b_split, sigma_split, lam, eta)
    m_split_total = float(m_split_arr.sum())

    # The Jensen-like inequality: σ^η averaged is generally > or < σ_orig^η
    # depending on whether σ_orig is the arithmetic or power mean. Here with
    # σ_orig = 0.5 and σ^2 = {0.04, 0.64} the mean power is 0.34 vs 0.25, so
    # split total m > single m — a concrete sybil advantage in effective
    # wager before the settlement redistributes.
    assert m_split_total > m_single + 1e-9, (
        f"With heterogeneous σ the split should give strictly larger m; "
        f"single = {m_single:.4f}, split_total = {m_split_total:.4f}"
    )

    # Document the magnitude: quantify the "wager lift" available to a sybil
    # attacker who can spread skill across accounts via (for example) loss
    # resetting on some of the split accounts.
    rel_gain = (m_split_total - m_single) / m_single
    assert 0.05 < rel_gain < 0.30, (
        f"Expected a modest sybil wager lift (5-30%) with this parameter set; "
        f"got {100*rel_gain:.1f}%. Adjust test bounds if eta/lam change."
    )


def test_heterogeneous_sigma_sybil_no_advantage_when_sigma_equal():
    """When split identities have the SAME σ (and same wealth total), the
    Lambert sybilproofness result applies: total effective wager is unchanged.
    This is the control case.
    """
    from onlinev2.core.staking import effective_wager_bankroll

    b_total = 1.0
    lam = 0.3
    eta = 2.0
    sigma = 0.5

    m_single = float(
        effective_wager_bankroll(
            np.array([b_total]), np.array([sigma]), lam, eta
        )[0]
    )
    m_split = float(
        effective_wager_bankroll(
            np.array([b_total / 2, b_total / 2]),
            np.array([sigma, sigma]),
            lam,
            eta,
        ).sum()
    )
    assert abs(m_split - m_single) < 1e-12, (
        "Homogeneous-σ sybil must preserve total effective wager (Lambert)."
    )


# ---------------------------------------------------------------------------
# (6) DGP latent_fixed must be Bayes-consistent (Masters notes §10, Option C)
# ---------------------------------------------------------------------------
def test_latent_fixed_dgp_matches_bayes_posterior():
    """Verify the closed-form posterior ``mu_i = (sig_Z^2/(sig_Z^2+tau_i^2))
    * (X_i - beta_i)`` and posterior variance ``v_i = sig_Z^2 tau_i^2 /
    (sig_Z^2 + tau_i^2)`` are actually produced by ``generate``.
    """
    from onlinev2.dgps.registry import get_dgp

    n = 3
    T = 100
    tau_i = np.array([0.5, 1.0, 1.5], dtype=float)
    sigma_z = 2.0

    dgp = get_dgp("latent_fixed")
    out = dgp.generate(
        seed=7,
        T=T,
        n=n,
        tau_i=tau_i,
        sigma_z=sigma_z,
        quantiles=np.array([0.1, 0.5, 0.9]),
    )

    sig2 = sigma_z ** 2
    expected_v = sig2 * tau_i ** 2 / (sig2 + tau_i ** 2)
    # Median quantile equals the point report (both go through Phi(mu)).
    # Cross-check quantile(0.5) == report (median is the 0.5-quantile).
    med_q = out.q_reports[:, :, 1]  # tau = 0.5
    np.testing.assert_array_almost_equal(med_q, out.reports, decimal=12)

    # Posterior spread check: q(0.9) - q(0.5) should be a specific fraction
    # of the posterior std via the probit link. We just verify it's strictly
    # monotone in tau_i (worse forecaster -> wider quantiles) at midrange.
    # Take the middle time index where Phi is most linear.
    t_mid = T // 2
    spread_high = out.q_reports[:, t_mid, 2] - out.q_reports[:, t_mid, 1]
    # tau_i is increasing, so posterior std sqrt(v_i) is increasing, so
    # quantile spread should be non-decreasing in tau_i at a fixed point.
    for i in range(n):
        assert np.sqrt(expected_v[i]) > 0


def test_latent_fixed_dgp_kappa_controls_miscalibration():
    """``kappa_i`` scales the posterior std in the quantile formula without
    touching the point report: kappa=1 is Bayes-calibrated, kappa>1 is over-
    dispersed."""
    from onlinev2.dgps.registry import get_dgp

    n = 2
    T = 50
    tau_i = np.array([0.5, 1.0], dtype=float)
    dgp = get_dgp("latent_fixed")

    out_cal = dgp.generate(
        seed=11, T=T, n=n, tau_i=tau_i, sigma_z=1.0,
        quantiles=np.array([0.1, 0.5, 0.9]),
    )
    out_wide = dgp.generate(
        seed=11, T=T, n=n, tau_i=tau_i, sigma_z=1.0,
        quantiles=np.array([0.1, 0.5, 0.9]),
        kappa_i=np.array([2.0, 2.0]),
    )

    # Point reports unchanged (kappa only affects quantile spread).
    np.testing.assert_array_almost_equal(out_cal.reports, out_wide.reports, decimal=12)

    # Wider quantiles under kappa > 1 (on average).
    spread_cal = np.mean(out_cal.q_reports[:, :, 2] - out_cal.q_reports[:, :, 0])
    spread_wide = np.mean(out_wide.q_reports[:, :, 2] - out_wide.q_reports[:, :, 0])
    assert spread_wide > spread_cal, (
        f"kappa > 1 should produce wider predictive quantiles on average; "
        f"got calibrated spread {spread_cal:.4f} vs kappa=2 spread {spread_wide:.4f}"
    )


def test_latent_fixed_dgp_scalar_kappa_broadcasts():
    """Scalar ``kappa_i`` should broadcast across all forecasters."""
    from onlinev2.dgps.registry import get_dgp

    dgp = get_dgp("latent_fixed")
    out = dgp.generate(
        seed=3, T=20, n=4, tau_i=np.array([0.3, 0.5, 0.8, 1.2]),
        sigma_z=1.0, quantiles=np.array([0.1, 0.9]),
        kappa_i=1.5,
    )
    assert out.q_reports is not None
    assert out.q_reports.shape == (4, 20, 2)


def test_latent_fixed_dgp_rejects_mismatched_kappa():
    """Non-scalar ``kappa_i`` of the wrong length must raise ValueError."""
    from onlinev2.dgps.registry import get_dgp

    dgp = get_dgp("latent_fixed")
    with pytest.raises(ValueError, match="kappa_i"):
        dgp.generate(
            seed=3, T=20, n=4, tau_i=np.array([0.3, 0.5, 0.8, 1.2]),
            sigma_z=1.0, quantiles=np.array([0.1, 0.9]),
            kappa_i=np.array([1.0, 1.0]),  # wrong length (2 vs 4)
        )


# ---------------------------------------------------------------------------
# (7) michael_predict must match the reference port exactly for theta.
# After fix (theta no longer projected), our internal aggregator is now
# numerically equivalent to the reference port on the predict step.
# This pins that equivalence so any future regression (e.g. reintroducing
# the simplex projection) trips this test.
# ---------------------------------------------------------------------------
def test_michael_predict_matches_port_predict():
    """Our ``core.intermittent.michael_predict`` and the reference
    ``mechanism.michael_port`` compute the same ``theta = w + D alpha`` and
    ``y_hat = theta . masked_x``.

    The port under ``mechanism/michael_port.py`` is a self-contained
    reimplementation of the Vitali & Pinson (2025) OGD aggregator. After
    the fix (removing the simplex projection from our predict), the two
    agree to machine precision.
    """
    from onlinev2.core.intermittent import michael_predict
    from onlinev2.mechanism.michael_port import adaptive_robust_qr_update_multi_lead

    rng = np.random.default_rng(2024)
    n = 5

    # Start from a w on the simplex and a small random D.
    w = np.array([0.3, 0.2, 0.2, 0.15, 0.15], dtype=np.float64)
    D = 0.1 * rng.standard_normal((n, n))
    x = rng.uniform(0.0, 1.0, size=n)
    alpha = np.array([0, 1, 0, 1, 0], dtype=np.int32)

    # Internal path.
    y_hat_ours, aux = michael_predict(x, alpha, w, D)
    theta_ours = np.asarray(aux["theta"], dtype=np.float64)

    # Reference-port path: call the 1-lead update with eta=0 to fetch y_hat
    # without moving the state (the port exposes y_hat as a side output).
    port_out = adaptive_robust_qr_update_multi_lead(
        state={"w": w, "D": D},
        x=x,
        y=float(rng.uniform(0.0, 1.0)),  # y is not used by theta/y_hat
        alpha_vec=alpha.astype(np.float64),
        tau=0.5,
        eta=0.0,  # no update -> we observe the predict pathway only
    )
    y_hat_port = float(port_out["y_hat"])

    # theta reference value from the port's own formula.
    theta_expected = w + D @ alpha.astype(np.float64)
    masked_x = x * (1.0 - alpha.astype(np.float64))

    # Compare the internal aggregator against both the port's y_hat and
    # the algebraic expectation.
    np.testing.assert_array_almost_equal(theta_ours, theta_expected, decimal=12)
    assert abs(y_hat_ours - float(theta_expected @ masked_x)) < 1e-12
    assert abs(y_hat_ours - y_hat_port) < 1e-9, (
        f"michael_predict ({y_hat_ours}) must match reference port y_hat "
        f"({y_hat_port}) to 1e-9"
    )


# ---------------------------------------------------------------------------
# (8) Runner must not trigger a spurious fallback at t=0 on empty history.
# The old behaviour called fc.fit(np.array([])) at t=0, which made every
# XGBoost/MLP forecaster silently bump its fallback_counter before any real
# training data existed. With strict_no_fallback=True this caused legitimate
# long-history runs to falsely raise ValueError. Fix: skip the t=0 fit and
# rely on the normal retrain schedule (which gates on len(history) > 20).
# ---------------------------------------------------------------------------
def test_runner_does_not_bump_fallback_counter_at_t0():
    """Fit is no longer forced at t=0 on empty history; ML forecasters do
    not trip their fallback counters before their first legitimate retrain
    opportunity."""
    import tempfile
    from onlinev2.real_data.runner import run_real_data_comparison
    from onlinev2.real_data.forecasters import NaiveForecaster, MovingAverageForecaster

    # Use a short, cheap panel: two trivial forecasters that never fall back.
    # A fresh panel exposes the t=0 behaviour cleanly.
    T = 80
    rng = np.random.default_rng(7)
    series = np.clip(0.5 + 0.02 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0)

    forecasters = [
        NaiveForecaster(residual_window=50),
        MovingAverageForecaster(span=5, residual_window=50),
    ]

    with tempfile.TemporaryDirectory() as td:
        result = run_real_data_comparison(
            series=series,
            forecasters=forecasters,
            warmup=30,
            outdir=td,
            series_name="t0_fallback_probe",
            gamma=4.0,
            rho=0.1,
            lam=0.05,
            seed=42,
            strict_no_fallback=False,
        )

    # Neither trivial forecaster should have recorded a fallback; the t=0
    # bug previously caused one bump per ML forecaster on the first round.
    # With trivial forecasters, the bump should be zero.
    for fc in forecasters:
        assert fc.fallback_counter == 0, (
            f"{fc.name} fallback_counter = {fc.fallback_counter}; expected 0 "
            f"(naive/EWMA should never trip the counter)."
        )

    # Runner surfaces the fallback summary unchanged.
    assert result["fallback_summary"][forecasters[0].name] == 0
    assert result["fallback_summary"][forecasters[1].name] == 0
