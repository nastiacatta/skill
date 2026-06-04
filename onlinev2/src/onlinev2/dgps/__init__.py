"""
Data-generating processes (DGPs).

Use DGP_REGISTRY to discover available generators.
"""
from .aggregation import DGP_AGGREGATION_METHOD1, DGP_AGGREGATION_METHOD2, DGP_AGGREGATION_METHOD3
from .baseline import DGP_BASELINE
from .latent_fixed import DGP_LATENT_FIXED
from .protocol import DGP, DGPOutput
from .registry import DGP_REGISTRY, get_dgp

__all__ = [
    "DGP",
    "DGPOutput",
    "DGP_REGISTRY",
    "get_dgp",
    "DGP_LATENT_FIXED",
    "DGP_AGGREGATION_METHOD1",
    "DGP_AGGREGATION_METHOD2",
    "DGP_AGGREGATION_METHOD3",
    "DGP_BASELINE",
]
