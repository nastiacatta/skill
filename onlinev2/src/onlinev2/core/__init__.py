"""
Core: deterministic platform logic for the online wagering mechanism.

This is the single source of truth for scoring, aggregation, settlement, skill
updates, and the round runner. The core does not import behaviour; it consumes
actions via the AgentInput protocol. No plotting, no CSV writing, no
subprocess or R calls.
"""

from onlinev2.core.runner import run_round
from onlinev2.core.types import (
    AgentInput,
    MechanismParams,
    MechanismState,
    Report,
    RoundInput,
)

__all__ = [
    "AgentInput",
    "MechanismParams",
    "MechanismState",
    "Report",
    "RoundInput",
    "run_round",
]
