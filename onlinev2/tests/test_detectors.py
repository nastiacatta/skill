"""
Unit tests for the baseline detectors.

Cover: NaN safety on zero-variance inputs, empty inputs, and basic
correctness on constructed cases.
"""
from __future__ import annotations

import numpy as np
import pytest

from onlinev2.behaviour.detection.detectors import (
    anomaly_timing_stake_score,
    correlated_reporting_score,
    fake_activity_loop_score,
    run_all_detectors,
    synchronised_participation_score,
)


class _FakeAction:
    def __init__(self, account_id: str, participate: bool, report, deposit: float):
        self.account_id = account_id
        self.participate = participate
        self.report = report
        self.deposit = deposit


class TestSynchronisedParticipation:
    def test_empty_input_returns_zero(self):
        assert synchronised_participation_score([], []) == 0.0

    def test_single_account_returns_zero(self):
        # Correlation with itself is 1 but we filter n_acc < 2.
        assert synchronised_participation_score([[1], [1], [0]], ["a"]) == 0.0

    def test_perfectly_synchronised_returns_high(self):
        # Two accounts that are active in the same rounds.
        part = [[1, 1], [0, 0], [1, 1], [1, 1], [0, 0]]
        s = synchronised_participation_score(part, ["a", "b"])
        # Perfectly synchronised gives corrcoef 1 off-diag; with diagonal
        # zeroed and averaged over 4 cells: (1+0+0+1)/4 = 0.5, score = 0.75.
        assert s > 0.7

    def test_perfectly_anti_synchronised_is_low(self):
        part = [[1, 0], [0, 1], [1, 0], [0, 1]]
        s = synchronised_participation_score(part, ["a", "b"])
        # Perfectly anti-synchronised: corrcoef -1 off-diag; with diagonal
        # zeroed and averaged: (-1+0+0-1)/4 = -0.5, score = 0.25.
        assert s < 0.3

    def test_constant_column_does_not_produce_nan(self):
        """Previously np.corrcoef on zero-variance columns returned NaN."""
        # "a" participates always; "b" is random.
        part = [[1, 1], [1, 0], [1, 1], [1, 0]]
        s = synchronised_participation_score(part, ["a", "b"])
        # Score is some number in [0, 1], and not NaN.
        assert 0.0 <= s <= 1.0
        assert not np.isnan(s)


class TestCorrelatedReporting:
    def test_empty_returns_zero(self):
        assert correlated_reporting_score([]) == 0.0

    def test_constant_reports_no_nan(self):
        # All accounts always report 0.5 across rounds.
        reports = [{"a": 0.5, "b": 0.5}] * 4
        s = correlated_reporting_score(reports)
        assert 0.0 <= s <= 1.0
        assert not np.isnan(s)


class TestFakeActivityLoop:
    def test_no_linked_accounts_returns_zero(self):
        part = [[1, 0, 1], [0, 1, 0], [1, 1, 1]]
        s = fake_activity_loop_score(["a", "b", "c"], part)
        assert s == 0.0

    def test_linked_accounts_always_participate_not_nan(self):
        """Was previously returning NaN because corrcoef of constant columns."""
        part = [[1, 1, 1, 1] for _ in range(10)]
        s = fake_activity_loop_score(
            ["u__wash_0", "u__wash_1", "u__wash_2", "other"], part
        )
        assert 0.0 <= s <= 1.0
        assert not np.isnan(s)

    def test_linked_accounts_perfectly_synchronised(self):
        # Three linked accounts that participate in rounds 0 and 2 only.
        part = [[1, 1, 1, 0], [0, 0, 0, 1], [1, 1, 1, 0]]
        s = fake_activity_loop_score(
            ["u__wash_0", "u__wash_1", "u__wash_2", "other"], part
        )
        # Not NaN; >= 0.5 (perfect correlation mapped to 1.0).
        assert 0.0 <= s <= 1.0
        assert s >= 0.5


class TestAnomalyTimingStake:
    def test_empty_inputs_return_zero(self):
        assert anomaly_timing_stake_score([], []) == 0.0

    def test_very_discrete_stakes_high_score(self):
        deposits = [[1.0, 1.0]] * 10
        part = [[1, 1]] * 10
        s = anomaly_timing_stake_score(deposits, part)
        # All stakes equal -> high discreteness
        assert s >= 0.7


class TestRunAllDetectors:
    def test_empty_history(self):
        out = run_all_detectors([], [])
        assert out == {}

    def test_never_returns_nan(self):
        actions_hist = [
            [_FakeAction("a", True, 0.5, 1.0), _FakeAction("b", True, 0.5, 1.0)],
            [_FakeAction("a", True, 0.5, 1.0), _FakeAction("b", True, 0.5, 1.0)],
        ]
        out = run_all_detectors(actions_hist, [0, 1])
        assert set(out.keys()) == {
            "synchronised_participation",
            "correlated_reporting",
            "fake_activity_loop",
            "anomaly_timing_stake",
        }
        for name, val in out.items():
            assert not np.isnan(val), f"Detector {name} returned NaN"
            assert 0.0 <= val <= 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
