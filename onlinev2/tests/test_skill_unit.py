"""Unit tests for core/skill.py.

Covers EWMA convergence, loss-to-skill monotonicity, missingness decay
toward L0, and sigma clamping to [sigma_min, 1.0].

Requirements: 9.3
"""

import numpy as np
import pytest

from onlinev2.core.skill import (
    calibrate_gamma,
    default_initial_loss,
    loss_to_skill,
    missingness_L0,
    update_ewma_loss,
)

# ---------------------------------------------------------------------------
# EWMA convergence
# ---------------------------------------------------------------------------

class TestEWMAConvergence:
    """After many updates with constant loss, EWMA should converge to that loss."""

    def test_converges_to_constant_loss(self):
        """Feed constant loss=0.3 for 500 steps; L should converge to 0.3."""
        rho = 0.05
        L = np.array([0.0])
        true_loss = 0.3
        for _ in range(500):
            L = update_ewma_loss(
                L_prev=L,
                losses_t=np.array([true_loss]),
                alpha_t=np.array([0]),
                rho=rho,
            )
        np.testing.assert_allclose(L[0], true_loss, atol=1e-4)

    def test_converges_to_mean_loss(self):
        """Feed alternating losses 0.2 and 0.8; L should converge to ~0.5."""
        rho = 0.05
        L = np.array([0.0])
        for t in range(1000):
            loss = 0.2 if t % 2 == 0 else 0.8
            L = update_ewma_loss(
                L_prev=L,
                losses_t=np.array([loss]),
                alpha_t=np.array([0]),
                rho=rho,
            )
        np.testing.assert_allclose(L[0], 0.5, atol=0.05)

    def test_multiple_agents_converge_independently(self):
        """Two agents with different constant losses converge independently."""
        rho = 0.05
        L = np.array([0.0, 0.0])
        for _ in range(500):
            L = update_ewma_loss(
                L_prev=L,
                losses_t=np.array([0.1, 0.9]),
                alpha_t=np.array([0, 0]),
                rho=rho,
            )
        np.testing.assert_allclose(L[0], 0.1, atol=1e-4)
        np.testing.assert_allclose(L[1], 0.9, atol=1e-4)


# ---------------------------------------------------------------------------
# Loss-to-skill monotonicity
# ---------------------------------------------------------------------------

class TestLossToSkillMonotonicity:
    """Higher loss → lower sigma (skill). The mapping is monotonically decreasing."""

    def test_monotonically_decreasing(self):
        sigma_min = 0.1
        gamma = 5.0
        losses = np.array([0.0, 0.1, 0.2, 0.5, 1.0, 2.0])
        sigmas = loss_to_skill(losses, sigma_min, gamma)
        # Each subsequent sigma should be <= the previous
        for i in range(1, len(sigmas)):
            assert sigmas[i] <= sigmas[i - 1] + 1e-15, (
                f"Not monotone: sigma[{i}]={sigmas[i]} > sigma[{i-1}]={sigmas[i-1]}"
            )

    def test_zero_loss_gives_max_skill(self):
        """L=0 → sigma = sigma_min + (1 - sigma_min) * exp(0) = 1.0."""
        sigma = loss_to_skill(np.array([0.0]), sigma_min=0.1, gamma=5.0)
        np.testing.assert_allclose(sigma[0], 1.0, atol=1e-12)

    def test_high_loss_approaches_sigma_min(self):
        """Very high loss → sigma approaches sigma_min."""
        sigma = loss_to_skill(np.array([100.0]), sigma_min=0.1, gamma=5.0)
        np.testing.assert_allclose(sigma[0], 0.1, atol=1e-6)


# ---------------------------------------------------------------------------
# Missingness decay toward L0
# ---------------------------------------------------------------------------

class TestMissingnessDecay:
    """Absent agents (alpha=1) decay toward L0 when kappa > 0."""

    def test_decay_toward_L0(self):
        """Missing agent's L should converge to L0 over many steps."""
        kappa = 0.05
        L0 = 0.5
        L = np.array([0.0])  # start far from L0
        for _ in range(500):
            L = update_ewma_loss(
                L_prev=L,
                losses_t=np.array([0.0]),  # doesn't matter, agent is missing
                alpha_t=np.array([1]),
                rho=0.05,
                kappa=kappa,
                L0=L0,
            )
        np.testing.assert_allclose(L[0], L0, atol=1e-4)

    def test_no_decay_when_kappa_zero(self):
        """kappa=0 → missing agent's L stays unchanged."""
        L = np.array([0.3])
        L_new = update_ewma_loss(
            L_prev=L,
            losses_t=np.array([0.0]),
            alpha_t=np.array([1]),
            rho=0.05,
            kappa=0.0,
            L0=0.5,
        )
        np.testing.assert_allclose(L_new[0], 0.3, atol=1e-15)

    def test_present_agent_unaffected_by_kappa(self):
        """Present agent (alpha=0) uses normal EWMA, not kappa decay."""
        L = np.array([0.3])
        loss = 0.6
        rho = 0.1
        L_new = update_ewma_loss(
            L_prev=L,
            losses_t=np.array([loss]),
            alpha_t=np.array([0]),
            rho=rho,
            kappa=0.05,
            L0=0.5,
        )
        expected = (1 - rho) * 0.3 + rho * loss
        np.testing.assert_allclose(L_new[0], expected, atol=1e-12)


# ---------------------------------------------------------------------------
# Sigma clamping to [sigma_min, 1.0]
# ---------------------------------------------------------------------------

class TestSigmaClamping:
    """loss_to_skill output must always be in [sigma_min, 1.0]."""

    def test_clamped_at_sigma_min(self):
        sigma_min = 0.2
        sigma = loss_to_skill(np.array([1e6]), sigma_min, gamma=5.0)
        assert sigma[0] >= sigma_min - 1e-15

    def test_clamped_at_one(self):
        sigma = loss_to_skill(np.array([-1.0]), sigma_min=0.1, gamma=5.0)
        assert sigma[0] <= 1.0 + 1e-15

    def test_range_for_many_losses(self):
        sigma_min = 0.15
        losses = np.linspace(-1, 10, 100)
        sigmas = loss_to_skill(losses, sigma_min, gamma=3.0)
        assert np.all(sigmas >= sigma_min - 1e-15)
        assert np.all(sigmas <= 1.0 + 1e-15)


# ---------------------------------------------------------------------------
# Calibrate gamma and missingness_L0 round-trip
# ---------------------------------------------------------------------------

class TestCalibration:
    """calibrate_gamma and missingness_L0 should be consistent with loss_to_skill."""

    def test_calibrate_gamma_roundtrip(self):
        """calibrate_gamma(sigma_ref, sigma_min, L_ref) → gamma such that
        loss_to_skill(L_ref) == sigma_ref."""
        sigma_min = 0.1
        sigma_ref = 0.5
        L_ref = 0.3
        gamma = calibrate_gamma(sigma_ref, sigma_min, L_ref)
        sigma_check = loss_to_skill(np.array([L_ref]), sigma_min, gamma)
        np.testing.assert_allclose(sigma_check[0], sigma_ref, atol=1e-10)

    def test_missingness_L0_roundtrip(self):
        """missingness_L0(sigma_0, sigma_min, gamma) → L0 such that
        loss_to_skill(L0) == sigma_0."""
        sigma_min = 0.1
        gamma = 5.0
        sigma_0 = 0.4
        L0 = missingness_L0(sigma_0, sigma_min, gamma)
        sigma_check = loss_to_skill(np.array([L0]), sigma_min, gamma)
        np.testing.assert_allclose(sigma_check[0], sigma_0, atol=1e-10)


# ---------------------------------------------------------------------------
# Exposure weighting
# ---------------------------------------------------------------------------

class TestExposureWeighting:
    """When use_exposure_weighting=True, rho_eff = rho * min(1, m/m_ref)."""

    def test_low_wager_slows_learning(self):
        """Agent with m < m_ref should learn slower (smaller effective rho)."""
        rho = 0.1
        L = np.array([0.5])
        loss = 0.0

        # Without exposure weighting
        L_normal = update_ewma_loss(L, np.array([loss]), np.array([0]), rho)

        # With exposure weighting, m=0.5, m_ref=1.0 → rho_eff = 0.05
        L_slow = update_ewma_loss(
            L, np.array([loss]), np.array([0]), rho,
            m_t=np.array([0.5]), m_ref=1.0, use_exposure_weighting=True,
        )

        # L_slow should be closer to L_prev (less update)
        assert abs(L_slow[0] - 0.5) < abs(L_normal[0] - 0.5)

    def test_high_wager_caps_at_rho(self):
        """Agent with m >= m_ref should have rho_eff = rho (capped at 1)."""
        rho = 0.1
        L = np.array([0.5])
        loss = 0.0

        L_normal = update_ewma_loss(L, np.array([loss]), np.array([0]), rho)
        L_capped = update_ewma_loss(
            L, np.array([loss]), np.array([0]), rho,
            m_t=np.array([2.0]), m_ref=1.0, use_exposure_weighting=True,
        )

        np.testing.assert_allclose(L_capped[0], L_normal[0], atol=1e-12)
