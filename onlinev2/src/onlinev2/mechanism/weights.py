"""Compatibility shim: use onlinev2.core.weights for new code."""
from onlinev2.core.weights import effective_wager, refund

__all__ = ["effective_wager", "refund"]
