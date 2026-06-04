"""Compatibility shim: use onlinev2.core.scoring for new code."""
from onlinev2.core.scoring import (
    crps_hat_from_quantiles,
    mae_loss,
    mae_score,
    normalised_loss,
    pinball_loss,
    score_crps_hat,
    score_from_loss,
    score_mae,
)

__all__ = [
    "mae_loss", "mae_score", "score_mae", "pinball_loss",
    "crps_hat_from_quantiles", "score_crps_hat", "score_from_loss", "normalised_loss",
]
