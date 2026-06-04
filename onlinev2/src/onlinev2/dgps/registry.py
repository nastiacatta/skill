"""DGP registry: discover and retrieve generators by name."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .protocol import DGP

DGP_REGISTRY: dict[str, "DGP"] = {}


def register_dgp(dgp: "DGP") -> "DGP":
    """Register a DGP; returns it for chaining."""
    DGP_REGISTRY[dgp.info.name] = dgp
    return dgp


def get_dgp(name: str) -> "DGP":
    """Get a DGP by name."""
    if name not in DGP_REGISTRY:
        raise KeyError(f"Unknown DGP: {name}. Available: {list(DGP_REGISTRY.keys())}")
    return DGP_REGISTRY[name]
