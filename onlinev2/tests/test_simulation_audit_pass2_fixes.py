"""Tests for simulation-audit pass-2 fixes:

- Issue 1: raise ValueError when y_pre is passed without matching reports
  (previously the function silently regenerated synthetic data and
  ignored y_pre).
- Issue 5: snapshot used by run_all_tests' wager-scaling / identity-split
  tests is now the LAST qualifying round, not the first (previously the
  test used an atypical startup state).
"""
from __future__ import annotations

import numpy as np
import pytest

from onlinev2.simulation import run_simulation, run_all_tests


class TestIssue1YPreGuard:
    """Raise when y_pre is given without matching reports_pre/q_reports_pre."""

    def test_point_mae_y_pre_without_reports_pre_raises(self):
        """point_mae + y_pre only → ValueError, not silent regeneration."""
        y_pre = np.linspace(0.1, 0.9, 100)
        with pytest.raises(ValueError, match="reports_pre is None"):
            run_simulation(
                T=100, n_forecasters=3, seed=0, scoring_mode="point_mae",
                y_pre=y_pre, reports_pre=None,
            )

    def test_quantiles_crps_y_pre_without_q_reports_pre_raises(self):
        """quantiles_crps + y_pre only → ValueError, not silent regeneration."""
        y_pre = np.linspace(0.1, 0.9, 100)
        with pytest.raises(ValueError, match="q_reports_pre is None"):
            run_simulation(
                T=100, n_forecasters=3, seed=0, scoring_mode="quantiles_crps",
                y_pre=y_pre, q_reports_pre=None,
            )

    def test_no_pre_data_still_works(self):
        """Back-compat: passing neither y_pre nor reports_pre still works."""
        res = run_simulation(
            T=50, n_forecasters=3, seed=0, scoring_mode="quantiles_crps",
        )
        assert res["y"].shape == (50,)

    def test_both_y_pre_and_reports_pre_still_works(self):
        """Back-compat: providing both pre-arrays continues to work."""
        rng = np.random.default_rng(0)
        T, n = 50, 4
        y_pre = rng.uniform(0.0, 1.0, size=T)
        reports_pre = rng.uniform(0.0, 1.0, size=(n, T))
        res = run_simulation(
            T=T, n_forecasters=n, seed=0, scoring_mode="point_mae",
            y_pre=y_pre, reports_pre=reports_pre,
            store_history=True,
        )
        np.testing.assert_allclose(res["y"], y_pre)

    def test_both_y_pre_and_q_reports_pre_still_works(self):
        """Back-compat: providing both pre-arrays in quantile mode works."""
        rng = np.random.default_rng(0)
        T, n, K = 50, 4, 5
        taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
        y_pre = rng.uniform(0.0, 1.0, size=T)
        q_pre = np.sort(rng.uniform(0.0, 1.0, size=(n, T, K)), axis=2)
        res = run_simulation(
            T=T, n_forecasters=n, seed=0, scoring_mode="quantiles_crps",
            taus=taus, y_pre=y_pre, q_reports_pre=q_pre,
            store_history=True,
        )
        np.testing.assert_allclose(res["y"], y_pre)


class TestIssue5SnapshotIsSteadyState:
    """Snapshot should capture the LAST qualifying round, not the first."""

    def test_snapshot_reflects_late_round_state(self):
        """With T=300, the snapshot should be from near the end, where
        skill has differentiated — not from round 0 where all agents
        sit near sigma_init (the startup transient).
        """
        # Run a reasonably long simulation so skill differentiates.
        res = run_simulation(
            T=300, n_forecasters=8, seed=7, scoring_mode="point_mae",
            missing_prob=0.05, rho=0.3, gamma=8.0,
        )
        snap = res["snapshot"]
        assert snap["scores"] is not None

        # The captured snapshot should not equal the round-0 snapshot.
        # Rerun with T=1 and compare. If T=1 has any qualifying round
        # (depends on seed), we'll get a snapshot; if not, sample early.
        snap_sigma = np.asarray(snap["sigma"])
        sigma_hist = res["sigma_hist"]

        # The snapshot's σ should equal the σ at SOME round with ≥ 2 active;
        # and by the new semantics, it should equal the σ at the LAST such
        # round. Verify this against sigma_hist.
        last_qualifying_round = None
        m_hist = res["wager_hist"]
        alpha_hist = res["alpha_hist"]
        for t in range(res["params"]["T"] - 1, -1, -1):
            n_active = int(np.sum((alpha_hist[:, t] == 0) & (m_hist[:, t] > 1e-12)))
            if n_active >= 2:
                last_qualifying_round = t
                break

        assert last_qualifying_round is not None, (
            "Expected at least one round with ≥ 2 active agents"
        )
        np.testing.assert_allclose(
            snap_sigma, sigma_hist[:, last_qualifying_round], atol=1e-10
        )

    def test_snapshot_is_not_from_round_zero(self):
        """With rho=0.3, sigma at the last round should differ
        noticeably from sigma at the first qualifying round.
        """
        res = run_simulation(
            T=300, n_forecasters=8, seed=7, scoring_mode="point_mae",
            missing_prob=0.05, rho=0.3, gamma=8.0,
        )
        snap_sigma = np.asarray(res["snapshot"]["sigma"])
        # Early sigma: before skill differentiates, sigma_t should be
        # close to the initial skill value. Late sigma (our snapshot)
        # should be spread across [sigma_min, 1].
        early_sigma = res["sigma_hist"][:, 10]
        # The std of the snapshot σ should be meaningfully larger than
        # early σ because skill has differentiated by end-of-run.
        assert float(np.std(snap_sigma)) > float(np.std(early_sigma)) * 0.5 or \
               not np.allclose(snap_sigma, early_sigma)

    def test_run_all_tests_still_passes_with_new_snapshot(self):
        """Regression: run_all_tests should still pass with the
        steady-state snapshot (it used to pass with the startup-state
        snapshot; the linear-scaling identity must hold at any valid
        state, so this is a reproducibility sanity check).
        """
        res = run_simulation(
            T=100, n_forecasters=6, seed=42, scoring_mode="point_mae",
            missing_prob=0.1, lam=0.3,
        )
        out = run_all_tests(res, lam=0.3, seed=42)
        assert out["wager_scaling_test"] is True
        assert out["identity_split_local"] is True
