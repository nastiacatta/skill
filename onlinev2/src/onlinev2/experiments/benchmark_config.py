"""
Canonical benchmark configuration for comparable experiments.

Same seeds, DGPs, horizon, participation pattern, and agent panel across
all methods in a batch. Used by master_comparison and bankroll_ablation.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

import numpy as np

# Default canonical config (NEXT_STEPS.md)
CANONICAL_SEEDS: List[int] = list(range(42, 1042))  # 1000 matched seeds
CANONICAL_T = 20000
CANONICAL_N_FORECASTERS = 10
CANONICAL_MISSING_PROB = 0.2
CANONICAL_TAU_I = [0.15, 0.22, 0.32, 0.46, 0.68, 0.75, 0.82, 0.88, 0.93, 1.0]  # first n_forecasters used
CANONICAL_TAUS = [0.1, 0.25, 0.5, 0.75, 0.9]
CANONICAL_TAUS_FINE = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

# Minimum enforced values
MIN_SEEDS = 20
MIN_T_SYNTHETIC = 1000


@dataclass
class BenchmarkConfig:
    """Fixed controls for a comparison batch."""
    seeds: List[int] = field(default_factory=lambda: list(CANONICAL_SEEDS))
    T: int = CANONICAL_T
    n_forecasters: int = CANONICAL_N_FORECASTERS
    missing_prob: float = CANONICAL_MISSING_PROB
    dgp_name: str = "latent_fixed"
    sigma_z: float = 1.0

    def tau_i(self):
        """First n_forecasters entries of canonical tau_i."""
        tau = CANONICAL_TAU_I if len(CANONICAL_TAU_I) >= self.n_forecasters else [
            0.15 + (0.85 * i / max(1, self.n_forecasters - 1)) for i in range(self.n_forecasters)
        ]
        return np.array(tau[: self.n_forecasters], dtype=np.float64)

    def taus(self):
        """Quantile levels for CRPS (coarse 5-level grid)."""
        return np.array(CANONICAL_TAUS, dtype=np.float64)

    def taus_fine(self):
        """Quantile levels for CRPS (fine 9-level equidistant grid).

        Equidistant tau levels make the trapezoidal rule in CRPS_hat exact
        *over the covered interval* ``[0.1, 0.9]``, so on-grid approximation
        error is lower than with the coarse non-equidistant grid. Neither
        grid covers ``[0, 0.1) u (0.9, 1]``; that 20% of the classical CRPS
        integration range is silently dropped by any finite grid of this
        form. Report results as ``CRPS-hat``, not ``CRPS``.
        """
        return np.array(CANONICAL_TAUS_FINE, dtype=np.float64)

    @property
    def nSeeds(self) -> int:
        """Number of seeds in this configuration."""
        return len(self.seeds)


def get_canonical_config(seeds=None, T=None, n_forecasters=None):
    """Return BenchmarkConfig with optional overrides."""
    return BenchmarkConfig(
        seeds=seeds or CANONICAL_SEEDS,
        T=T or CANONICAL_T,
        n_forecasters=n_forecasters or CANONICAL_N_FORECASTERS,
    )


# ---------------------------------------------------------------------------
# Per-experiment configuration registry
# ---------------------------------------------------------------------------

# Experiments that explicitly use the baseline DGP (behaviour experiments)
_BASELINE_DGP_EXPERIMENTS = frozenset({
    "behaviour_matrix",
    "preference_stress_test",
    "detection_adaptation",
    "selective_participation",
    "sybil",
})

# Per-experiment overrides: keys are experiment names, values are dicts of
# BenchmarkConfig field overrides.
_EXPERIMENT_OVERRIDES = {
    # Core experiments — use latent_fixed DGP (default)
    "forecast_aggregation": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "calibration": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "master_comparison": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "bankroll_ablation": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "aggregation_skill_effect": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "skill_recovery": {
        "T": 2000,
        "n_forecasters": 10,
    },
    "parameter_sweep": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "weight_learning": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "weight_learning_comparison": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "weight_rule_comparison": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "dgp_comparison": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "scoring_validation": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "settlement_sanity": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "skill_wager": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "fixed_deposit": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "intermittency_stress_test": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "arbitrage_scan": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "deposit_policy_comparison": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "aggregation_dgp": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "latent_fixed_dgp": {
        "T": 1000,
        "n_forecasters": 10,
    },
    "baseline_dgp": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },

    # Behaviour experiments — keep baseline DGP explicitly
    "behaviour_matrix": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "preference_stress_test": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "detection_adaptation": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "selective_participation": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "sybil": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "collusion_stress": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "insider_advantage": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "wash_activity_gaming": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "strategic_reporting": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "identity_attack_matrix": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "drift_adaptation": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
    "stake_policy_matrix": {
        "T": 1000,
        "n_forecasters": 10,
        "dgp_name": "baseline",
    },
}


def get_experiment_config(experiment_name: str) -> BenchmarkConfig:
    """Return experiment-specific config with enforced minimums.

    Parameters
    ----------
    experiment_name : str
        Registered experiment name (e.g. ``"forecast_aggregation"``).

    Returns
    -------
    BenchmarkConfig
        Configuration with at least 20 seeds, T >= 1000 for synthetic
        experiments (T >= 2000 for ``skill_recovery``), and
        ``dgp_name = "latent_fixed"`` unless the experiment has an
        explicit override.

    Raises
    ------
    ValueError
        If the resulting configuration has fewer than 20 seeds.
    """
    overrides = _EXPERIMENT_OVERRIDES.get(experiment_name, {})

    # Start with defaults
    seeds = list(range(MIN_SEEDS))  # [0, 1, ..., 19]
    T = overrides.get("T", MIN_T_SYNTHETIC)
    n_forecasters = overrides.get("n_forecasters", CANONICAL_N_FORECASTERS)
    missing_prob = overrides.get("missing_prob", CANONICAL_MISSING_PROB)
    dgp_name = overrides.get("dgp_name", "latent_fixed")
    sigma_z = overrides.get("sigma_z", 1.0)

    # Enforce minimum T for synthetic experiments
    if T < MIN_T_SYNTHETIC:
        T = MIN_T_SYNTHETIC

    # Enforce T >= 2000 for skill_recovery
    if experiment_name == "skill_recovery" and T < 2000:
        T = 2000

    config = BenchmarkConfig(
        seeds=seeds,
        T=T,
        n_forecasters=n_forecasters,
        missing_prob=missing_prob,
        dgp_name=dgp_name,
        sigma_z=sigma_z,
    )

    # Enforce minimum seeds
    if len(config.seeds) < MIN_SEEDS:
        raise ValueError(
            f"Experiment '{experiment_name}' requires at least {MIN_SEEDS} seeds, "
            f"got {len(config.seeds)}."
        )

    return config
