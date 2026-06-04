# Backwards compatibility: prefer strategic_influence.
from onlinev2.behaviour.adversaries.strategic_influence import StrategicInfluenceBehaviour

ManipulatorBehaviour = StrategicInfluenceBehaviour

__all__ = ["ManipulatorBehaviour"]
