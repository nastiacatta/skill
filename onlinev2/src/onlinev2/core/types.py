"""
Canonical mechanism types: parameters and mutable state for the deterministic round runner.

This module defines the public interface between the core mechanism and the rest of the
system. The core does not import behaviour; actions passed to run_round satisfy the
AgentInput protocol (account_id, participate, report, deposit, meta). The behaviour
layer produces AgentAction instances that conform to this interface.

Assumptions:
  - MechanismParams are immutable for a simulation run.
  - MechanismState is updated in-place only by the core runner; callers receive
    a new state from run_round.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Protocol

import numpy as np

Report = Any


class AgentInput(Protocol):
    """Protocol for per-account round input. Satisfied by behaviour.protocol.AgentAction."""

    account_id: str
    participate: bool
    report: Any
    deposit: float
    meta: Dict[str, Any]


@dataclass
class MechanismParams:
    """Immutable mechanism hyper-parameters (fixed across a simulation run)."""

    lam: float = 0.3
    eta: float = 1.0
    sigma_min: float = 0.1
    omega_max: Optional[float] = None
    rho: float = 0.1
    gamma: float = 4.0
    kappa: float = 0.0
    L0: float = 0.0
    U: float = 0.0
    scoring_mode: str = "point_mae"
    taus: Optional[np.ndarray] = None
    eps: float = 1e-12

    sigma_init: Optional[float] = None
    use_exposure_weighted_skill: bool = False
    m_ref: float = 1.0

    aggregation_mode: str = "wager"  # "wager" | "michael_robust_lr"
    allocation_mode: str = "raja"   # "raja" | "michael_split"
    # Michael allocation: in-sample vs out-of-sample reward split (\delta)
    delta_is: float = 0.5
    # Michael online learning rate
    michael_lr: float = 0.01
    # Quantile level for Michael when scoring_mode == "point_mae" (single-tau); unused in quantiles_crps
    michael_tau: Optional[float] = None
    # Michael historical Shapley forgetting factor (\lambda): phi_c = lambda*phi_c_prev + (1-lambda)*phi_s
    michael_lambda: float = 0.95
    # Number of Monte Carlo permutations for approximate Shapley
    michael_shapley_mc: int = 128
    # Base seed for the per-round deterministic RNG used by Shapley MC
    # when ``allocation_mode == "michael_split"``. A fresh
    # ``np.random.default_rng(shapley_seed + K * t + k)`` is constructed
    # per round and per quantile level so the result is reproducible
    # across runs with the same seed (see Shapley audit M1).
    shapley_seed: int = 2026


@dataclass
class MechanismState:
    """Mutable state that evolves from round to round."""

    t: int = 0
    wealth: Dict[str, float] = field(default_factory=dict)
    ewma_loss: Dict[str, float] = field(default_factory=dict)
    sigma: Dict[str, float] = field(default_factory=dict)
    weights_prev: Dict[str, float] = field(default_factory=dict)
    agg_prev: Optional[Report] = None
    profit_prev: Dict[str, float] = field(default_factory=dict)

    agg_state: Dict[str, Any] = field(default_factory=dict)
    allocation_state: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RoundInput:
    """
    Concrete implementation of AgentInput for tests and programmatic use.
    Satisfies the AgentInput protocol; use this when constructing actions
    outside the behaviour layer (e.g. in tests). Behaviour layer uses AgentAction.
    """
    account_id: str
    participate: bool
    report: Any
    deposit: float
    meta: Dict[str, Any] = field(default_factory=dict)
