from onlinev2.behaviour.adversaries.arbitrage_seeking import ArbitrageSeekingBehaviour
from onlinev2.behaviour.adversaries.coordinated_group import CoordinatedGroupBehaviour
from onlinev2.behaviour.adversaries.detector_aware import DetectorAwareBehaviour
from onlinev2.behaviour.adversaries.privileged_information import PrivilegedInformationBehaviour
from onlinev2.behaviour.adversaries.reputation_reset import ReputationResetBehaviour
from onlinev2.behaviour.adversaries.strategic_influence import StrategicInfluenceBehaviour
from onlinev2.behaviour.adversaries.sybil_arbitrage import SybilArbitrageBehaviour

# Backwards-compatible aliases for existing experiments and tests.
ArbitrageurBehaviour = ArbitrageSeekingBehaviour
ManipulatorBehaviour = StrategicInfluenceBehaviour
AdaptiveEvaderBehaviour = DetectorAwareBehaviour
InsiderBehaviour = PrivilegedInformationBehaviour
CollusionGroupBehaviour = CoordinatedGroupBehaviour

__all__ = [
    "ArbitrageSeekingBehaviour",
    "StrategicInfluenceBehaviour",
    "DetectorAwareBehaviour",
    "PrivilegedInformationBehaviour",
    "CoordinatedGroupBehaviour",
    "ReputationResetBehaviour",
    "SybilArbitrageBehaviour",
    "ArbitrageurBehaviour",
    "ManipulatorBehaviour",
    "AdaptiveEvaderBehaviour",
    "InsiderBehaviour",
    "CollusionGroupBehaviour",
]
