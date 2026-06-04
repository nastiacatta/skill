"""Unit tests for core/settlement.py.

Covers budget balance (sum of payouts = sum of wagers), non-negative cashout,
equal scores → zero profit, and skill payoff symmetry.

Requirements: 9.4
"""

import numpy as np
import pytest

from onlinev2.core.settlement import (
    profit,
    raja_competitive_payout,
    settle_round,
    skill_payoff,
    utility_payoff,
)

# ---------------------------------------------------------------------------
# Budget balance: sum(skill_payoff) == sum(m)
# ---------------------------------------------------------------------------

class TestBudgetBalance:
    """The skill pool is self-financed: sum of payouts equals sum of wagers."""

    def test_skill_payoff_budget_balance(self):
        """sum(Pi_i) == sum(m_i) for arbitrary scores and wagers."""
        scores = np.array([0.8, 0.5, 0.3, 0.9])
        m = np.array([10.0, 5.0, 3.0, 7.0])
        payouts = skill_payoff(scores, m)
        np.testing.assert_allclose(payouts.sum(), m.sum(), atol=1e-10)

    def test_budget_balance_with_missingness(self):
        """Budget balance holds even with missing agents (alpha=1)."""
        scores = np.array([0.8, 0.5, 0.3, 0.9])
        m = np.array([10.0, 5.0, 3.0, 7.0])
        alpha = np.array([0, 1, 0, 0])
        payouts = skill_payoff(scores, m, alpha=alpha)
        # Missing agent's m is zeroed, so budget is sum of active m
        m_active = m.copy()
        m_active[alpha == 1] = 0.0
        np.testing.assert_allclose(payouts.sum(), m_active.sum(), atol=1e-10)

    def test_settle_round_budget_balance(self):
        """Full settlement: sum(cashout) == sum(b) + U."""
        b = np.array([10.0, 5.0, 8.0])
        sigma = np.array([0.9, 0.5, 0.7])
        scores = np.array([0.8, 0.6, 0.4])
        U = 2.0
        result = settle_round(b, sigma, lam=0.3, scores=scores, U=U, s_client=0.5)
        # cashout = refund + total_payoff
        # sum(cashout) = sum(b - m) + sum(skill_payoff) + sum(utility_payoff)
        #              = sum(b) - sum(m) + sum(m) + U = sum(b) + U
        np.testing.assert_allclose(result["cashout"].sum(), b.sum() + U, atol=1e-10)

    def test_settle_round_no_utility_budget(self):
        """Without utility (U=0): sum(cashout) == sum(b)."""
        b = np.array([10.0, 5.0, 8.0])
        sigma = np.array([0.9, 0.5, 0.7])
        scores = np.array([0.8, 0.6, 0.4])
        result = settle_round(b, sigma, lam=0.3, scores=scores, U=0.0)
        np.testing.assert_allclose(result["cashout"].sum(), b.sum(), atol=1e-10)


# ---------------------------------------------------------------------------
# Non-negative cashout
# ---------------------------------------------------------------------------

class TestNonNegativeCashout:
    """All cashout values should be >= 0 (agents cannot lose more than deposit)."""

    def test_cashout_non_negative_uniform_scores(self):
        b = np.array([10.0, 10.0, 10.0])
        sigma = np.ones(3)
        scores = np.array([0.5, 0.5, 0.5])
        result = settle_round(b, sigma, lam=0.0, scores=scores)
        assert np.all(result["cashout"] >= -1e-12)

    def test_cashout_non_negative_varied_scores(self):
        """Even with varied scores, cashout should be non-negative.
        Pi_i = m_i * (1 + s_i - s_bar). Since s_i in [0,1] and s_bar in [0,1],
        the worst case is s_i=0, s_bar=1 → Pi_i = m_i * 0 = 0.
        cashout_i = (b_i - m_i) + Pi_i >= 0 since refund >= 0 and Pi_i >= 0.
        """
        b = np.array([10.0, 5.0, 8.0])
        sigma = np.array([1.0, 1.0, 1.0])
        scores = np.array([0.0, 0.5, 1.0])
        result = settle_round(b, sigma, lam=0.0, scores=scores)
        assert np.all(result["cashout"] >= -1e-12)

    def test_cashout_non_negative_with_skill_gate(self):
        """With lam > 0, m_i < b_i so refund > 0, further ensuring non-negativity."""
        b = np.array([10.0, 5.0, 8.0])
        sigma = np.array([0.5, 0.8, 0.3])
        scores = np.array([0.2, 0.9, 0.1])
        result = settle_round(b, sigma, lam=0.5, scores=scores)
        assert np.all(result["cashout"] >= -1e-12)


# ---------------------------------------------------------------------------
# Equal scores → zero profit
# ---------------------------------------------------------------------------

class TestEqualScoresZeroProfit:
    """When all agents have the same score, s_bar == s_i, so profit == 0."""

    def test_equal_scores_zero_profit(self):
        scores = np.array([0.7, 0.7, 0.7])
        m = np.array([10.0, 5.0, 3.0])
        payouts = skill_payoff(scores, m)
        profits = payouts - m
        np.testing.assert_allclose(profits, 0.0, atol=1e-10)

    def test_equal_scores_settle_round_zero_profit(self):
        """Full settlement with equal scores and no utility → zero profit."""
        b = np.array([10.0, 5.0, 8.0])
        sigma = np.array([0.9, 0.5, 0.7])
        scores = np.array([0.6, 0.6, 0.6])
        result = settle_round(b, sigma, lam=0.3, scores=scores, U=0.0)
        np.testing.assert_allclose(result["profit"], 0.0, atol=1e-10)


# ---------------------------------------------------------------------------
# Skill payoff symmetry
# ---------------------------------------------------------------------------

class TestSkillPayoffSymmetry:
    """Agents with the same score and same wager get the same payoff."""

    def test_same_score_same_wager_same_payoff(self):
        scores = np.array([0.8, 0.8, 0.3])
        m = np.array([5.0, 5.0, 5.0])
        payouts = skill_payoff(scores, m)
        # Agents 0 and 1 have same score and same wager → same payoff
        np.testing.assert_allclose(payouts[0], payouts[1], atol=1e-12)

    def test_higher_score_higher_payoff(self):
        """With equal wagers, higher score → higher payoff."""
        scores = np.array([0.9, 0.5, 0.1])
        m = np.array([5.0, 5.0, 5.0])
        payouts = skill_payoff(scores, m)
        assert payouts[0] > payouts[1]
        assert payouts[1] > payouts[2]

    def test_profit_sums_to_zero(self):
        """Sum of profits (payoff - wager) is zero (zero-sum skill pool)."""
        scores = np.array([0.9, 0.5, 0.1, 0.7])
        m = np.array([10.0, 5.0, 3.0, 7.0])
        payouts = skill_payoff(scores, m)
        profits = payouts - m
        np.testing.assert_allclose(profits.sum(), 0.0, atol=1e-10)


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Edge cases: zero wagers, single agent, all missing."""

    def test_zero_wagers_returns_zeros(self):
        scores = np.array([0.5, 0.5])
        m = np.zeros(2)
        payouts = skill_payoff(scores, m)
        np.testing.assert_allclose(payouts, 0.0, atol=1e-15)

    def test_single_agent_gets_own_wager_back(self):
        """Single agent: s_bar = s_i, so Pi_i = m_i * 1 = m_i."""
        scores = np.array([0.8])
        m = np.array([10.0])
        payouts = skill_payoff(scores, m)
        np.testing.assert_allclose(payouts[0], m[0], atol=1e-12)

    def test_utility_payoff_zero_when_U_zero(self):
        scores = np.array([0.8, 0.5])
        m = np.array([5.0, 5.0])
        u_pay = utility_payoff(scores, m, s_client=0.3, U=0.0)
        np.testing.assert_allclose(u_pay, 0.0, atol=1e-15)

    def test_utility_payoff_sums_to_U(self):
        """When U > 0 and some agents beat s_client, utility payouts sum to U."""
        scores = np.array([0.8, 0.6, 0.2])
        m = np.array([5.0, 5.0, 5.0])
        U = 10.0
        u_pay = utility_payoff(scores, m, s_client=0.3, U=U)
        np.testing.assert_allclose(u_pay.sum(), U, atol=1e-10)
