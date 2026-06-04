# Backwards compatibility: prefer privileged_information.
from onlinev2.behaviour.adversaries.privileged_information import PrivilegedInformationBehaviour

InsiderBehaviour = PrivilegedInformationBehaviour

__all__ = ["InsiderBehaviour"]
