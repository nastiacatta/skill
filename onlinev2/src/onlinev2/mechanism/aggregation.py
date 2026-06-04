"""Compatibility shim: use onlinev2.core.aggregation for new code."""
from onlinev2.core.aggregation import aggregate_forecast

__all__ = ["aggregate_forecast"]
