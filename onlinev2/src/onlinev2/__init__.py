"""Online forecasting aggregation and wagering."""

__version__ = "0.1.0"

from onlinev2.core.runner import run_round

__all__ = [
    "run_round",
    "BehaviourModel",
    "AgentAction",
    "RoundPublicState",
    "make_behaviour",
]


def __getattr__(name: str):
    """Lazy import of behaviour layer to avoid pulling it for core-only consumers."""
    if name in ("BehaviourModel", "AgentAction", "RoundPublicState"):
        from onlinev2.behaviour.protocol import (
            AgentAction,
            BehaviourModel,
            RoundPublicState,
        )
        return {"BehaviourModel": BehaviourModel, "AgentAction": AgentAction, "RoundPublicState": RoundPublicState}[name]
    if name == "make_behaviour":
        from onlinev2.behaviour.factory import make_behaviour
        return make_behaviour
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
