# Backwards compatibility: prefer detector_aware.
from onlinev2.behaviour.adversaries.detector_aware import DetectorAwareBehaviour

AdaptiveEvaderBehaviour = DetectorAwareBehaviour

__all__ = ["AdaptiveEvaderBehaviour"]
