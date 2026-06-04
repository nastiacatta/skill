"""Compatibility shim: use onlinev2.core.staking for new code."""
from onlinev2.core.staking import (
    cap_weight_shares,
    choose_deposits,
    confidence_from_quantiles,
    effective_wager_bankroll,
    effective_wager_capped,
    skill_gate,
    update_wealth,
)

__all__ = [
    "confidence_from_quantiles", "choose_deposits", "skill_gate",
    "effective_wager_bankroll", "effective_wager_capped", "cap_weight_shares",
    "update_wealth",
]
