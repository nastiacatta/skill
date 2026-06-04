# Backwards compatibility: prefer arbitrage_seeking.
from onlinev2.behaviour.adversaries.arbitrage_seeking import ArbitrageSeekingBehaviour

ArbitrageurBehaviour = ArbitrageSeekingBehaviour

__all__ = ["ArbitrageurBehaviour"]
