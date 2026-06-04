"""
Compatibility shim: canonical mechanism implementation is onlinev2.core.

New code should import from onlinev2.core (types, runner, scoring, settlement, etc.).
This package re-exports the same API for backward compatibility.
"""

from onlinev2.core.runner import run_round
from onlinev2.core.types import (
    AgentInput,
    MechanismParams,
    MechanismState,
    Report,
)

__all__ = [
    "AgentInput",
    "MechanismParams",
    "MechanismState",
    "Report",
    "run_round",
]
