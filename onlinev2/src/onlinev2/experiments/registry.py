"""
Experiment registry: core and behaviour experiment names and callables.

Callables are provided by onlinev2.experiments.runners.runner_module.
The CLI imports that module from the package; no sys.path or PYTHONPATH required.
"""
from __future__ import annotations

from typing import Callable, List, Tuple


def get_core_experiments(runner_module) -> List[Tuple[str, Callable]]:
    """Return [(name, thunk), ...] for core experiments. runner_module must have run_*."""
    return [
        ("settlement", lambda: runner_module.run_settlement_sanity(outdir=_outdir(), block="core")),
        ("skill_wager", lambda: runner_module.run_skill_wager_intermittency(outdir=_outdir(), block="core")),
        ("aggregation", lambda: runner_module.run_forecast_aggregation(
            T=_T() if _T() is not None else 20000,
            outdir=_outdir(),
            block="core",
        )),
        ("calibration", lambda: runner_module.run_calibration_diagnostics(
            T=_T() if _T() is not None else 20000,
            outdir=_outdir(),
            block="core",
        )),
        ("parameter_sweep", lambda: runner_module.run_parameter_sweep(outdir=_outdir(), block="core")),
        ("sybil", lambda: runner_module.run_sybil_experiment(outdir=_outdir(), block="core")),
        ("scoring", lambda: runner_module.run_scoring_validation(outdir=_outdir(), block="core")),
        ("fixed_deposit", lambda: runner_module.run_fixed_deposit_skill_effect(outdir=_outdir(), block="core")),
        ("skill_recovery", lambda: runner_module.run_skill_recovery_benchmark_latent(
            T=_T() if _T() is not None else 20000,
            T0=_T0() if _T0() is not None else 5000,
            n_seeds=_n_seeds() if _n_seeds() is not None else 20,
            outdir=_outdir(),
            block="core",
        )),
        ("baseline_dgp", lambda: runner_module.run_baseline_dgp_diagnostic(outdir=_outdir(), block="core")),
        ("latent_fixed_dgp", lambda: runner_module.run_latent_fixed_dgp_diagnostic(outdir=_outdir(), block="core")),
        ("aggregation_dgp", lambda: runner_module.run_aggregation_dgp_diagnostic(outdir=_outdir(), block="core")),
        ("dgp_comparison", lambda: runner_module.run_dgp_comparison(outdir=_outdir(), block="core")),
        ("weight_comparison", lambda: runner_module.run_weight_learning_comparison(outdir=_outdir(), block="core")),
        ("weight_rules", lambda: runner_module.run_weight_rule_comparison(outdir=_outdir(), block="core")),
        ("deposit_policies", lambda: runner_module.run_deposit_policy_comparison(outdir=_outdir(), block="core")),
        ("selective_participation", lambda: runner_module.run_selective_participation(outdir=_outdir(), block="core")),
        ("master_comparison", lambda: runner_module.run_master_comparison(outdir=_outdir(), block="core")),
        ("bankroll_ablation", lambda: runner_module.run_bankroll_ablation(outdir=_outdir(), block="core")),
    ]


def get_behaviour_experiments(runner_module, write_summary: bool = None) -> List[Tuple[str, Callable]]:
    """Return [(name, thunk), ...] for behaviour experiments. write_summary defaults to _write_summary_val."""
    ws = _write_summary_val if write_summary is None else write_summary
    return [
        ("behaviour_matrix", lambda: runner_module.run_behaviour_matrix(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("preference_stress", lambda: runner_module.run_preference_stress_test(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("intermittency_stress", lambda: runner_module.run_intermittency_stress_test(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("arbitrage_scan", lambda: runner_module.run_arbitrage_scan(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("arbitrage_crowd_size", lambda: runner_module.run_arbitrage_crowd_size(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("detection_adaptation", lambda: runner_module.run_detection_adaptation(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("collusion_stress", lambda: runner_module.run_collusion_stress(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("informed_collusion", lambda: runner_module.run_informed_collusion(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("insider_advantage", lambda: runner_module.run_insider_advantage(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("wash_activity_gaming", lambda: runner_module.run_wash_activity_gaming(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("strategic_reporting", lambda: runner_module.run_strategic_reporting(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("sybil_arbitrage", lambda: runner_module.run_sybil_arbitrage(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("reputation_reset", lambda: runner_module.run_reputation_reset(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("identity_attack_matrix", lambda: runner_module.run_identity_attack_matrix(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("drift_adaptation", lambda: runner_module.run_drift_adaptation(outdir=_outdir(), block="behaviour", write_summary=ws)),
        ("stake_policy_matrix", lambda: runner_module.run_stake_policy_matrix(outdir=_outdir(), block="behaviour", write_summary=ws)),
    ]


# Set by CLI before calling get_*_experiments so lambdas see current outdir/write_summary
_outdir_val = "outputs"
_write_summary_val = True
_T_val = None
_T0_val = None
_n_seeds_val = None


def _outdir() -> str:
    return _outdir_val


def _T():
    return _T_val


def _T0():
    return _T0_val


def _n_seeds():
    return _n_seeds_val


def set_cli_args(
    outdir: str,
    write_summary: bool,
    T: int | None = None,
    T0: int | None = None,
    n_seeds: int | None = None,
) -> None:
    global _outdir_val, _write_summary_val, _T_val, _T0_val, _n_seeds_val
    _outdir_val = outdir
    _write_summary_val = write_summary
    _T_val = T
    _T0_val = T0
    _n_seeds_val = n_seeds
