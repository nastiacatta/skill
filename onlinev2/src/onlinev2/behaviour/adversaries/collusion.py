# Backwards compatibility: prefer coordinated_group.
from onlinev2.behaviour.adversaries.coordinated_group import CoordinatedGroupBehaviour

CollusionGroupBehaviour = CoordinatedGroupBehaviour

__all__ = ["CollusionGroupBehaviour"]
