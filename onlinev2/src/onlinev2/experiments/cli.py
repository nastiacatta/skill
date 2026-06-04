"""
Thin CLI for running experiments: argparse, dispatch to runner module, unit tests.

The runner module (run_* functions) lives at project root as experiments.py so that
"python experiments.py" continues to work. This module adds the project root to
sys.path only when loading that runner, then dispatches by name.
"""
from __future__ import annotations

import argparse
import os

from onlinev2.experiments.helpers import unit_latent_generator_determinism
from onlinev2.experiments.registry import (
    get_behaviour_experiments,
    get_core_experiments,
    set_cli_args,
)
from onlinev2.experiments.runners import runner_module
from onlinev2.simulation import (
    unit_crps_bound,
    unit_crps_nonneg,
    unit_crps_perfect_better,
    unit_pinball_nonneg,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run onlinev2 experiments")
    parser.add_argument(
        "--exp",
        choices=[
            "settlement",
            "skill_wager",
            "aggregation",
            "calibration",
            "parameter_sweep",
            "sybil",
            "scoring",
            "fixed_deposit",
            "skill_recovery",
            "baseline_dgp",
            "latent_fixed_dgp",
            "aggregation_dgp",
            "dgp_comparison",
            "weight_comparison",
            "weight_rules",
            "deposit_policies",
            "selective_participation",
            "master_comparison",
            "bankroll_ablation",
            "behaviour_matrix",
            "preference_stress",
            "intermittency_stress",
            "arbitrage_scan",
            "arbitrage_crowd_size",
            "detection_adaptation",
            "collusion_stress",
            "informed_collusion",
            "insider_advantage",
            "wash_activity_gaming",
            "strategic_reporting",
            "sybil_arbitrage",
            "reputation_reset",
            "identity_attack_matrix",
            "drift_adaptation",
            "stake_policy_matrix",
            "all",
        ],
        default="all",
    )
    parser.add_argument(
        "--block",
        choices=["core", "behaviour", "all"],
        default="all",
        help="Run core experiments, behaviour experiments, or both (separate output roots)",
    )
    parser.add_argument(
        "--outdir",
        default="outputs",
        help="Base output directory (core -> outdir/core/experiments/, behaviour -> outdir/behaviour/experiments/)",
    )
    parser.add_argument(
        "--T",
        type=int,
        default=None,
        help="Override round horizon for supported experiments",
    )
    parser.add_argument(
        "--T0",
        type=int,
        default=None,
        help="Override burn-in horizon for supported experiments",
    )
    parser.add_argument(
        "--n_seeds",
        type=int,
        default=None,
        help="Override number of seeds for supported experiments",
    )
    parser.add_argument(
        "--write_summary",
        type=str,
        default="true",
        choices=("true", "false"),
        help="Write summary.md and summary.json in behaviour experiment folders (default true)",
    )
    args = parser.parse_args()

    outdir = args.outdir
    write_summary = args.write_summary.lower() == "true"
    set_cli_args(outdir, write_summary, T=args.T, T0=args.T0, n_seeds=args.n_seeds)

    runner = runner_module

    if args.block in ("core", "all"):
        for name, fn in get_core_experiments(runner):
            if args.exp in (name, "all"):
                fn()
                print(f"{name} done")
    if args.block in ("behaviour", "all"):
        for name, fn in get_behaviour_experiments(runner, write_summary=write_summary):
            if args.exp in (name, "all"):
                fn()
                print(f"{name} done")

    # Unit tests
    tests_dir = os.path.join(args.outdir, "tests")
    os.makedirs(tests_dir, exist_ok=True)
    test_results = [
        ("pinball_nonneg", unit_pinball_nonneg()),
        ("crps_nonneg", unit_crps_nonneg()),
        ("crps_perfect_better", unit_crps_perfect_better()),
        ("crps_bound", unit_crps_bound()),
        ("latent_generator_determinism", unit_latent_generator_determinism()),
    ]
    for name, ok in test_results:
        print(f"{name}: {ok}")
    with open(os.path.join(tests_dir, "test_results.txt"), "w") as f:
        f.write("Unit tests\n==========\n")
        for name, ok in test_results:
            f.write(f"{name}: {'PASS' if ok else 'FAIL'}\n")


if __name__ == "__main__":
    main()
