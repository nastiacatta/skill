"""Compatibility shim: use onlinev2.core.skill for new code."""
from onlinev2.core.skill import (
    calibrate_gamma,
    default_initial_loss,
    loss_to_skill,
    missingness_L0,
    update_ewma_loss,
)

__all__ = [
    "update_ewma_loss", "loss_to_skill", "calibrate_gamma", "missingness_L0",
    "default_initial_loss",
]
