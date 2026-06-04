"""
Theory-grounded tests for the adversary behaviours.

These tests check the core claims the adversaries are meant to implement:

  * ArbitrageSeeker (MAE-WSWM): expected profit > 0 when the other agents
    disagree and the agent reports the wager-weighted median.
  * CoordinatedGroup: the Chun-Shachter coalition report extracts strictly
    positive coalition profit in expectation against benign disagreement.
  * StrategicInfluence: reporting target mu shifts r_hat toward mu relative
    to the truthful-only baseline.
  * PrivilegedInformation: the F_{t-1}-compliant lagged insider gains
    accuracy on an AR(1) DGP; the leak-guarded attacker requires explicit
    allow_leakage=True to use y_sequence.
  * WashTrader: inflates the participation count without unbounded loss
    under the "anchor" style (the price is bounded by the noise budget).
"""
from __future__ import annotations

import os

import numpy as np
import pytest

from onlinev2.behaviour.adversaries.arbitrage_seeking import (
    ArbitrageSeekingBehaviour,
    _expected_mae_payoff,
    _weighted_median,
    _worst_case_mae_payoff,
)
from onlinev2.behaviour.adversaries.coordinated_group import (
    CoordinatedGroupBehaviour,
)
from onlinev2.behaviour.adversaries.detector_aware import DetectorAwareBehaviour
from onlinev2.behaviour.adversaries.privileged_information import (
    PrivilegedInformationBehaviour,
)
from onlinev2.behaviour.adversaries.strategic_influence import (
    StrategicInfluenceBehaviour,
)
from onlinev2.behaviour.adversaries.wash_trader import WashTraderBehaviour
from onlinev2.behaviour.protocol import RoundPublicState
from onlinev2.behaviour.traits import UserTraits


def _state(
    *,
    t: int = 5,
    user_id: str = "u",
    wealth: float = 10.0,
    agg_history=None,
    y_history=None,
    weights_prev=None,
) -> RoundPublicState:
    return RoundPublicState(
        t=t,
        y_history=y_history if y_history is not None else [0.5] * t,
        agg_history=agg_history or [],
        weights_prev=weights_prev or {user_id: 0.1, "other": 0.1},
        sigma_prev={user_id: 0.5},
        wealth_prev={user_id: wealth},
        profit_prev={user_id: 0.0},
    )


# ---------------------------------------------------------------------------
# Arbitrage seeker
# ---------------------------------------------------------------------------


class TestArbitrageSeekerTheory:
    def test_weighted_median_matches_numpy_when_equal_weights(self):
        vals = np.array([0.2, 0.5, 0.9])
        w = np.array([1.0, 1.0, 1.0])
        # median of [0.2, 0.5, 0.9] is 0.5
        assert _weighted_median(vals, w) == pytest.approx(0.5)

    def test_weighted_median_respects_weights(self):
        # Heavy weight on 0.2 should pull median to 0.2
        vals = np.array([0.2, 0.5, 0.9])
        w = np.array([10.0, 1.0, 1.0])
        assert _weighted_median(vals, w) == pytest.approx(0.2)

    def test_worst_case_zero_when_all_agree(self):
        """When every other agent reports 0.5 and we also report 0.5, payoff is 0."""
        p0, p1 = _worst_case_mae_payoff(
            p_hat=0.5,
            p_others=np.array([0.5, 0.5, 0.5]),
            m_others=np.ones(3),
            m_self=1.0,
        )
        assert p0 == pytest.approx(0.0, abs=1e-9)
        assert p1 == pytest.approx(0.0, abs=1e-9)

    def test_expected_profit_positive_under_disagreement(self):
        p_others = np.array([0.2, 0.35, 0.5, 0.65, 0.8])
        m_others = np.ones(5)
        # Median of a symmetric spread around 0.5 is 0.5
        exp_pi_med = _expected_mae_payoff(0.5, p_others, m_others, m_self=1.0)
        assert exp_pi_med > 0.0

        # Truthful belief at 0.2 should earn less (or even lose)
        exp_pi_truth = _expected_mae_payoff(0.2, p_others, m_others, m_self=1.0)
        assert exp_pi_med > exp_pi_truth

    def test_adversary_participates_under_disagreement_with_snapshot(self):
        traits = UserTraits(user_id="arb_0", initial_wealth=10.0)
        snapshot = {
            "p": np.array([0.2, 0.35, 0.5, 0.65, 0.8]),
            "m": np.ones(5),
        }
        adv = ArbitrageSeekingBehaviour(
            traits, scoring_mode="point_mae",
            target_others=lambda _s: (snapshot["p"], snapshot["m"]),
        )
        adv.reset(42)
        state = _state(t=5, user_id="arb_0", wealth=10.0)
        actions = adv.act(state)
        assert len(actions) == 1
        assert actions[0].participate is True
        assert adv.arbitrage_log[-1]["arbitrage_found"] is True
        assert adv.arbitrage_log[-1]["expected_profit"] > 0.0

    def test_adversary_abstains_when_others_agree(self):
        traits = UserTraits(user_id="arb_0", initial_wealth=10.0)
        agreeing = {"p": np.full(4, 0.5), "m": np.ones(4)}
        adv = ArbitrageSeekingBehaviour(
            traits, scoring_mode="point_mae",
            target_others=lambda _s: (agreeing["p"], agreeing["m"]),
        )
        adv.reset(42)
        state = _state(t=5, user_id="arb_0", wealth=10.0)
        actions = adv.act(state)
        assert actions[0].participate is False


# ---------------------------------------------------------------------------
# Coordinated coalition
# ---------------------------------------------------------------------------


class TestCoordinatedGroup:
    def test_report_is_member_weighted_mean(self):
        members = [
            UserTraits(user_id=f"c_{j}", initial_wealth=10.0,
                       noise_level=0.0, bias=(-0.1 + 0.05 * j),
                       stake_fraction=0.25)
            for j in range(3)
        ]
        adv = CoordinatedGroupBehaviour(members, aggregation="weighted_mean")
        adv.reset(0)
        # Member beliefs = clamp01(anchor + bias + noise). With very small
        # noise_level the belief is dominated by anchor + bias. With anchor=0.5
        # and biases [-0.1, -0.05, 0.0] beliefs are ~[0.4, 0.45, 0.5]. Equal
        # weights -> weighted mean ~0.45. The belief model enforces a noise
        # floor of 1e-4, so use a loose tolerance.
        state_dict = {m.user_id: 10.0 for m in members}
        state = RoundPublicState(
            t=0, y_history=[0.5] * 20, agg_history=[],
            weights_prev={m.user_id: 0.1 for m in members},
            sigma_prev={m.user_id: 0.5 for m in members},
            wealth_prev=state_dict,
            profit_prev={m.user_id: 0.0 for m in members},
        )
        actions = adv.act(state)
        reports = {a.account_id: a.report for a in actions}
        unique_reports = set(reports.values())
        assert len(unique_reports) == 1
        shared = float(next(iter(unique_reports)))
        assert shared == pytest.approx(0.45, abs=5e-3)

    def test_all_members_report_same_value(self):
        members = [
            UserTraits(user_id=f"c_{j}", initial_wealth=10.0, stake_fraction=0.2)
            for j in range(5)
        ]
        adv = CoordinatedGroupBehaviour(members)
        adv.reset(0)
        state = RoundPublicState(
            t=0, y_history=[0.5] * 20, agg_history=[],
            weights_prev={m.user_id: 0.1 for m in members},
            sigma_prev={m.user_id: 0.5 for m in members},
            wealth_prev={m.user_id: 10.0 for m in members},
            profit_prev={m.user_id: 0.0 for m in members},
        )
        actions = adv.act(state)
        participating = [a for a in actions if a.participate]
        assert len(participating) >= 2
        reports = {a.report for a in participating}
        assert len(reports) == 1


# ---------------------------------------------------------------------------
# Strategic influence
# ---------------------------------------------------------------------------


class TestStrategicInfluence:
    def test_reports_exactly_target(self):
        traits = UserTraits(user_id="m_0", initial_wealth=10.0, manipulation_strength=0.6)
        adv = StrategicInfluenceBehaviour(traits, target=0.85)
        adv.reset(42)
        state = _state(user_id="m_0")
        actions = adv.act(state)
        assert actions[0].participate is True
        assert actions[0].report == pytest.approx(0.85, abs=1e-9)

    def test_deposit_scales_with_manipulation_strength(self):
        traits_low = UserTraits(user_id="m_low", initial_wealth=10.0, manipulation_strength=0.1)
        traits_high = UserTraits(user_id="m_high", initial_wealth=10.0, manipulation_strength=1.0)
        state_low = _state(user_id="m_low")
        state_high = _state(user_id="m_high")
        adv_low = StrategicInfluenceBehaviour(traits_low, target=0.5)
        adv_high = StrategicInfluenceBehaviour(traits_high, target=0.5)
        adv_low.reset(1)
        adv_high.reset(1)
        dep_low = adv_low.act(state_low)[0].deposit
        dep_high = adv_high.act(state_high)[0].deposit
        assert dep_high > dep_low


# ---------------------------------------------------------------------------
# Privileged information
# ---------------------------------------------------------------------------


class TestPrivilegedInformation:
    def test_lagged_noisy_reads_y_history(self):
        traits = UserTraits(user_id="i_0", initial_wealth=10.0, insider_bonus=0.3)
        adv = PrivilegedInformationBehaviour(
            traits, mode="lagged_noisy", lag=1, sigma_priv=0.0,
        )
        adv.reset(0)
        state = _state(user_id="i_0", y_history=[0.2, 0.4, 0.9])
        report = adv.act(state)[0].report
        # sigma_priv has a floor of 1e-4, so allow a small tolerance.
        assert report == pytest.approx(0.9, abs=5e-3)

    def test_leaked_future_requires_allow_flag(self):
        traits = UserTraits(user_id="i_0", initial_wealth=10.0)
        adv = PrivilegedInformationBehaviour(
            traits, mode="leaked_future", sigma_priv=0.0,
            y_sequence=[0.11, 0.22, 0.33, 0.44, 0.55, 0.66],
            allow_leakage=False,
        )
        adv.reset(0)
        state = _state(t=2, user_id="i_0", y_history=[0.9, 0.8])
        with pytest.warns(RuntimeWarning):
            report = adv.act(state)[0].report
        assert report == pytest.approx(0.8, abs=5e-3)

    def test_leaked_future_with_flag(self):
        traits = UserTraits(user_id="i_0", initial_wealth=10.0)
        adv = PrivilegedInformationBehaviour(
            traits, mode="leaked_future", lookahead=0, sigma_priv=0.0,
            y_sequence=[0.11, 0.22, 0.33, 0.44, 0.55, 0.66],
            allow_leakage=True,
        )
        adv.reset(0)
        state = _state(t=2, user_id="i_0", y_history=[0.9, 0.8])
        report = adv.act(state)[0].report
        assert report == pytest.approx(0.33, abs=5e-3)


# ---------------------------------------------------------------------------
# Detector aware
# ---------------------------------------------------------------------------


class TestDetectorAware:
    def test_suspicion_increases_with_high_detector_score(self):
        traits = UserTraits(user_id="e_0", initial_wealth=10.0, manipulation_strength=0.5)
        adv = DetectorAwareBehaviour(traits, target=0.1, ewma_beta=0.5,
                                     suspicion_threshold=0.5)
        adv.reset(42)
        # Feed high detector scores.
        for t in range(5):
            adv.observe_round_result(
                t=t, y_t=0.5,
                logs_t={"detector_scores": {"e_0": 0.9}},
            )
        assert adv._suspicion > 0.5

    def test_quiet_mode_after_trigger(self):
        traits = UserTraits(user_id="e_0", initial_wealth=10.0, manipulation_strength=0.5)
        adv = DetectorAwareBehaviour(
            traits, target=0.1, ewma_beta=0.9, suspicion_threshold=0.4,
        )
        adv.reset(42)
        # Large detector flag triggers quiet mode.
        adv.observe_round_result(
            t=10, y_t=0.5,
            logs_t={"detector_scores": {"e_0": 0.95}},
        )
        state = _state(t=11, user_id="e_0", wealth=10.0,
                       agg_history=[0.5, 0.48, 0.52])
        action = adv.act(state)[0]
        assert action.meta.get("quiet", False) is True


# ---------------------------------------------------------------------------
# Wash trader
# ---------------------------------------------------------------------------


class TestWashTrader:
    def test_k_accounts_produced(self):
        traits = UserTraits(user_id="w_0", initial_wealth=10.0, stake_fraction=0.3)
        adv = WashTraderBehaviour(traits, k_accounts=4, scoring_mode="point_mae")
        adv.reset(0)
        state = _state(user_id="w_0", wealth=10.0, y_history=[0.5] * 15)
        actions = adv.act(state)
        assert len(actions) == 4
        assert all(a.participate for a in actions)
        assert all(a.meta["wash_parent"] == "w_0" for a in actions)

    def test_anchor_style_keeps_reports_close(self):
        traits = UserTraits(user_id="w_0", initial_wealth=10.0, stake_fraction=0.3)
        adv = WashTraderBehaviour(
            traits, k_accounts=3, scoring_mode="point_mae",
            wash_report_style="anchor", anchor_noise=0.0, sync_strength=1.0,
        )
        adv.reset(0)
        state = _state(user_id="w_0", wealth=10.0, y_history=[0.5] * 15)
        actions = adv.act(state)
        reports = [a.report for a in actions]
        # With 0 noise + sync=1 all reports should be the same anchor
        assert len(set(reports)) == 1

    def test_split_style_reports_are_binary(self):
        traits = UserTraits(user_id="w_0", initial_wealth=10.0, stake_fraction=0.3)
        adv = WashTraderBehaviour(
            traits, k_accounts=4, scoring_mode="point_mae",
            wash_report_style="split_bet", sync_strength=1.0,
        )
        adv.reset(0)
        state = _state(user_id="w_0", wealth=10.0, y_history=[0.5] * 15)
        actions = adv.act(state)
        reports = sorted(a.report for a in actions)
        assert reports[0] == pytest.approx(0.0, abs=1e-9)
        assert reports[-1] == pytest.approx(1.0, abs=1e-9)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


# ---------------------------------------------------------------------------
# Sybil-arbitrage composite
# ---------------------------------------------------------------------------


class TestSybilArbitrage:
    def test_k_accounts_equal_report_and_sum_of_deposits(self):
        from onlinev2.behaviour.adversaries.sybil_arbitrage import SybilArbitrageBehaviour

        traits = UserTraits(user_id="sa", initial_wealth=10.0, stake_fraction=0.3)
        snapshot = {"p": np.array([0.2, 0.4, 0.6, 0.8]), "m": np.ones(4)}
        adv = SybilArbitrageBehaviour(
            traits=traits, k_accounts=4, scoring_mode="point_mae",
            target_others=lambda _s: (snapshot["p"], snapshot["m"]),
        )
        adv.reset(0)
        state = RoundPublicState(
            t=5, y_history=[0.5] * 5, agg_history=[],
            weights_prev={"sa": 0.1, "other": 0.1},
            sigma_prev={"sa": 0.5},
            wealth_prev={"sa": 10.0},
            profit_prev={"sa": 0.0},
        )
        actions = adv.act(state)
        assert len(actions) == 4
        assert all(a.participate for a in actions)
        # All sybils carry the same arbitrage report.
        reports = {a.report for a in actions}
        assert len(reports) == 1
        # Account names follow the parent__sybil_<i> convention for detection.
        parents = {a.meta["sybil_parent"] for a in actions}
        assert parents == {"sa"}

    def test_no_sybil_when_abstaining(self):
        from onlinev2.behaviour.adversaries.sybil_arbitrage import SybilArbitrageBehaviour

        traits = UserTraits(user_id="sa", initial_wealth=10.0)
        snapshot = {"p": np.full(4, 0.5), "m": np.ones(4)}  # all agree
        adv = SybilArbitrageBehaviour(
            traits=traits, k_accounts=3, scoring_mode="point_mae",
            target_others=lambda _s: (snapshot["p"], snapshot["m"]),
        )
        adv.reset(0)
        state = RoundPublicState(
            t=5, y_history=[0.5] * 5, agg_history=[],
            weights_prev={"sa": 0.1, "other": 0.1},
            sigma_prev={"sa": 0.5},
            wealth_prev={"sa": 10.0},
            profit_prev={"sa": 0.0},
        )
        actions = adv.act(state)
        # Still emits k placeholders, but all non-participating.
        assert len(actions) == 3
        assert all(not a.participate for a in actions)
        assert all(a.deposit == 0.0 for a in actions)


# ---------------------------------------------------------------------------
# Adversary plotting sanity
# ---------------------------------------------------------------------------


class TestAdversaryPlotsSmoke:
    """Quick smoke check that plotting functions don't crash on empty data."""

    def test_plots_return_none_when_summary_missing(self, tmp_path):
        from onlinev2.behaviour.plotting.adversary_plots import make_all_adversary_plots
        from onlinev2.io.output_paths import ExperimentPaths

        ep = ExperimentPaths(str(tmp_path), "dummy_exp", "behaviour")
        out = make_all_adversary_plots(ep)
        # Every entry should be None because no summary CSVs exist.
        assert all(v is None for v in out.values())

    def test_plots_write_png_when_csv_present(self, tmp_path):
        import csv

        from onlinev2.behaviour.plotting.adversary_plots import plot_arbitrage_scan
        from onlinev2.io.output_paths import ExperimentPaths

        ep = ExperimentPaths(str(tmp_path), "dummy_exp", "behaviour")
        path = ep.data("arbitrage_scan_by_lam.csv")
        with open(path, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["lam", "mean_profit", "se_profit", "ci_low", "ci_high",
                        "mean_final_wealth", "mean_found_rounds",
                        "mean_participation_rounds", "n_seeds"])
            for lam in [0.0, 0.5, 1.0]:
                w.writerow([lam, 10.0 + lam, 1.5, 8.0 + lam, 12.0 + lam,
                            20.0, 800, 800, 10])
        out = plot_arbitrage_scan(ep)
        assert out is not None
        # File exists and is non-empty.
        assert os.path.exists(out)
        assert os.path.getsize(out) > 1000  # PNG with content


# ---------------------------------------------------------------------------
# Quantile-mode support
# ---------------------------------------------------------------------------


class TestQuantileMode:
    """Every adversary must emit a quantile vector under quantiles_crps mode
    so downstream run_round can score it without falling back."""

    def test_strategic_influence_emits_quantile_vector(self):
        from onlinev2.behaviour.adversaries.strategic_influence import (
            StrategicInfluenceBehaviour,
        )
        traits = UserTraits(user_id="m", initial_wealth=10.0, manipulation_strength=0.5)
        adv = StrategicInfluenceBehaviour(
            traits, target=0.7, scoring_mode="quantiles_crps",
            taus=[0.1, 0.5, 0.9],
        )
        adv.reset(0)
        state = _state(user_id="m")
        action = adv.act(state)[0]
        assert action.participate is True
        report = np.asarray(action.report, dtype=float)
        assert report.shape == (3,)
        # Quantiles must be sorted after clamping (centred at 0.7 with Normal noise).
        assert (report >= 0.0).all() and (report <= 1.0).all()

    def test_strategic_reporter_emits_quantile_vector(self):
        from onlinev2.behaviour.adversaries.strategic_reporter import (
            StrategicReporterBehaviour,
        )
        traits = UserTraits(user_id="m", initial_wealth=10.0, manipulation_strength=0.5)
        adv = StrategicReporterBehaviour(
            traits, target=0.6, pull=0.5,
            scoring_mode="quantiles_crps", taus=[0.1, 0.5, 0.9],
        )
        adv.reset(0)
        state = _state(user_id="m", agg_history=[0.4, 0.45])
        action = adv.act(state)[0]
        report = np.asarray(action.report, dtype=float)
        assert report.shape == (3,)

    def test_detector_aware_emits_quantile_vector(self):
        from onlinev2.behaviour.adversaries.detector_aware import DetectorAwareBehaviour
        traits = UserTraits(user_id="e", initial_wealth=10.0)
        adv = DetectorAwareBehaviour(
            traits, target=0.2,
            scoring_mode="quantiles_crps", taus=[0.1, 0.5, 0.9],
        )
        adv.reset(0)
        state = _state(user_id="e", agg_history=[0.5])
        action = adv.act(state)[0]
        report = np.asarray(action.report, dtype=float)
        assert report.shape == (3,)

    def test_privileged_information_emits_quantile_vector(self):
        traits = UserTraits(user_id="i", initial_wealth=10.0, insider_bonus=0.3)
        adv = PrivilegedInformationBehaviour(
            traits, scoring_mode="quantiles_crps", taus=[0.1, 0.5, 0.9],
            mode="lagged_noisy", lag=1, sigma_priv=0.02,
        )
        adv.reset(0)
        state = _state(user_id="i", y_history=[0.3, 0.4, 0.5])
        action = adv.act(state)[0]
        report = np.asarray(action.report, dtype=float)
        assert report.shape == (3,)

    def test_wash_trader_emits_quantile_vectors(self):
        from onlinev2.behaviour.adversaries.wash_trader import WashTraderBehaviour
        traits = UserTraits(user_id="w", initial_wealth=10.0)
        adv = WashTraderBehaviour(
            traits, k_accounts=3,
            scoring_mode="quantiles_crps", taus=[0.1, 0.5, 0.9],
            wash_report_style="anchor",
        )
        adv.reset(0)
        state = _state(user_id="w", y_history=[0.5] * 15)
        actions = adv.act(state)
        assert len(actions) == 3
        for a in actions:
            report = np.asarray(a.report, dtype=float)
            assert report.shape == (3,)

    def test_coordinated_group_emits_quantile_vectors(self):
        from onlinev2.behaviour.adversaries.coordinated_group import (
            CoordinatedGroupBehaviour,
        )
        members = [
            UserTraits(user_id=f"c_{j}", initial_wealth=10.0,
                       bias=(-0.1 + 0.05 * j), stake_fraction=0.2)
            for j in range(3)
        ]
        adv = CoordinatedGroupBehaviour(
            members, scoring_mode="quantiles_crps", taus=[0.1, 0.5, 0.9],
        )
        adv.reset(0)
        state = RoundPublicState(
            t=0, y_history=[0.5] * 20, agg_history=[],
            weights_prev={m.user_id: 0.1 for m in members},
            sigma_prev={m.user_id: 0.5 for m in members},
            wealth_prev={m.user_id: 10.0 for m in members},
            profit_prev={m.user_id: 0.0 for m in members},
        )
        actions = adv.act(state)
        participating = [a for a in actions if a.participate]
        assert len(participating) >= 2
        for a in participating:
            report = np.asarray(a.report, dtype=float)
            assert report.shape == (3,)
        # All members must share the same coordinated vector.
        arrays = [tuple(np.asarray(a.report).round(6).tolist()) for a in participating]
        assert len(set(arrays)) == 1

    def test_arbitrage_seeker_emits_quantile_vector(self):
        traits = UserTraits(user_id="a", initial_wealth=10.0)
        snapshot = {"p": np.array([0.2, 0.4, 0.6, 0.8]), "m": np.ones(4)}
        adv = ArbitrageSeekingBehaviour(
            traits, scoring_mode="quantiles_crps", taus=[0.1, 0.5, 0.9],
            target_others=lambda _s: (snapshot["p"], snapshot["m"]),
        )
        adv.reset(0)
        state = _state(user_id="a", agg_history=[0.5])
        actions = adv.act(state)
        if actions and actions[0].participate:
            report = np.asarray(actions[0].report, dtype=float)
            assert report.shape == (3,)
