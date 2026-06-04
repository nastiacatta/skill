"""
Baseline detectors for manipulation, collusion, wash-style activity, and adaptive evasion.

All detectors operate only on observables (participation, reports, deposits, timing).
Hidden real-user to account mappings are logged only for offline evaluation.
"""
from onlinev2.behaviour.detection.detectors import (
    anomaly_timing_stake_score,
    correlated_reporting_score,
    fake_activity_loop_score,
    run_all_detectors,
    synchronised_participation_score,
)

__all__ = [
    "synchronised_participation_score",
    "correlated_reporting_score",
    "fake_activity_loop_score",
    "anomaly_timing_stake_score",
    "run_all_detectors",
]
