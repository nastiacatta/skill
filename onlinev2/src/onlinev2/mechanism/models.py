"""
Compatibility shim: use onlinev2.core.types for new code.

This module re-exports the canonical mechanism types from core.
"""

from onlinev2.core.types import (
    AgentInput,
    MechanismParams,
    MechanismState,
    Report,
)

__all__ = ["Report", "AgentInput", "MechanismParams", "MechanismState"]
