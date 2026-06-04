"""
Behaviour preset configurations.

Preset names use neutral research language. Legacy preset names are
accepted and normalised to the canonical names below.
"""
from __future__ import annotations

from typing import Any, Dict

# Canonical preset names (academic / professional).
PRESET_NAMES = frozenset(
    {
        "BENIGN_BASELINE",
        "CLUSTERED_PARTICIPATION",
        "PREFERENCE_SENSITIVE_HEDGING",
        "COORDINATED_GROUP",
        "MULTI_ACCOUNT_SPLIT_K",
        "STRATEGIC_INFLUENCE",
        "DETECTOR_AWARE",
        "PRIVILEGED_INFORMATION",
        "ARBITRAGE_SEEKING",
        "WASH_TRADER",
        "STRATEGIC_REPORTER",
        "EDGE_THRESHOLD",
        "AVOID_SKILL_DECAY",
        "WEALTH_SHOCK_SENSITIVE",
        "ADAPTIVE_PARTICIPATION",
        "STRATEGIC_EXTERNALITY",
        "REPUTATION_PROTECTION",
        "BREAK_EVEN_STAKING",
        "AFFORDABILITY_CAPPED",
        "VOLATILITY_SENSITIVE",
        "COLLUSIVE_MULTI_ACCOUNT",
        "FAKE_ACTIVITY",
    }
)

# Legacy names accepted for backwards compatibility; normalised to canonical.
PRESET_ALIASES = {
    "BURSTY_REALISTIC": "CLUSTERED_PARTICIPATION",
    "HEDGED_RISK_AVERSE": "PREFERENCE_SENSITIVE_HEDGING",
    "COLLUSION_GROUP": "COORDINATED_GROUP",
    "SYBIL_SPLIT_K": "MULTI_ACCOUNT_SPLIT_K",
    "MANIPULATOR": "STRATEGIC_INFLUENCE",
    "EVADER": "DETECTOR_AWARE",
    "INSIDER": "PRIVILEGED_INFORMATION",
    "ARBITRAGEUR": "ARBITRAGE_SEEKING",
}


def get_preset_kwargs(name: str, **overrides: Any) -> Dict[str, Any]:
    """Return kwargs for building a behaviour model from a preset name.
    Accepts both canonical and legacy preset names; normalises to canonical.
    """
    name = PRESET_ALIASES.get(name, name)

    from onlinev2.behaviour.policies.identity import (
        CollusiveMultiAccountIdentity,
        FakeActivityIdentity,
        SingleAccountIdentity,
        SplitAccountIdentity,
    )
    from onlinev2.behaviour.policies.participation import (
        AdaptiveParticipation,
        AvoidSkillDecayParticipation,
        BaselineParticipation,
        BurstyParticipation,
        EdgeThresholdParticipation,
        WealthShockSensitiveParticipation,
    )
    from onlinev2.behaviour.policies.reporting import (
        HedgedReporting,
        ReputationProtectionReporting,
        StrategicExternalityReporting,
        TruthfulReporting,
    )
    from onlinev2.behaviour.policies.staking import (
        AffordabilityCappedStaking,
        BreakEvenStaking,
        FixedFractionStaking,
        HouseMoneyStaking,
        KellyLikeStaking,
        VolatilitySensitiveStaking,
    )

    base: Dict[str, Any] = {
        "participation_policy": BaselineParticipation(),
        "reporting_policy": TruthfulReporting(),
        "staking_policy": FixedFractionStaking(),
        "identity_policy": SingleAccountIdentity(),
    }

    if name == "BENIGN_BASELINE":
        pass
    elif name == "CLUSTERED_PARTICIPATION":
        base["participation_policy"] = BurstyParticipation()
        base["staking_policy"] = KellyLikeStaking()
    elif name == "PREFERENCE_SENSITIVE_HEDGING":
        base["reporting_policy"] = HedgedReporting()
        base["staking_policy"] = HouseMoneyStaking()
    elif name == "COORDINATED_GROUP":
        base["_adversary"] = "coordinated_group"
    elif name == "MULTI_ACCOUNT_SPLIT_K":
        k = int(overrides.pop("k", 3))
        base["identity_policy"] = SplitAccountIdentity(k=k)
    elif name == "STRATEGIC_INFLUENCE":
        base["_adversary"] = "strategic_influence"
    elif name == "DETECTOR_AWARE":
        base["_adversary"] = "detector_aware"
    elif name == "PRIVILEGED_INFORMATION":
        base["_adversary"] = "privileged_information"
    elif name == "ARBITRAGE_SEEKING":
        base["_adversary"] = "arbitrage_seeking"
    elif name == "WASH_TRADER":
        base["_adversary"] = "wash_trader"
    elif name == "STRATEGIC_REPORTER":
        base["_adversary"] = "strategic_reporter"
    elif name == "EDGE_THRESHOLD":
        base["participation_policy"] = EdgeThresholdParticipation()
    elif name == "AVOID_SKILL_DECAY":
        base["participation_policy"] = AvoidSkillDecayParticipation()
    elif name == "WEALTH_SHOCK_SENSITIVE":
        base["participation_policy"] = WealthShockSensitiveParticipation()
    elif name == "ADAPTIVE_PARTICIPATION":
        base["participation_policy"] = AdaptiveParticipation()
    elif name == "STRATEGIC_EXTERNALITY":
        base["reporting_policy"] = StrategicExternalityReporting()
    elif name == "REPUTATION_PROTECTION":
        base["reporting_policy"] = ReputationProtectionReporting()
    elif name == "BREAK_EVEN_STAKING":
        base["staking_policy"] = BreakEvenStaking()
    elif name == "AFFORDABILITY_CAPPED":
        base["staking_policy"] = AffordabilityCappedStaking()
    elif name == "VOLATILITY_SENSITIVE":
        base["staking_policy"] = VolatilitySensitiveStaking()
    elif name == "COLLUSIVE_MULTI_ACCOUNT":
        k = int(overrides.pop("k", 3))
        base["identity_policy"] = CollusiveMultiAccountIdentity(k=k)
    elif name == "FAKE_ACTIVITY":
        base["identity_policy"] = FakeActivityIdentity()
    else:
        raise ValueError(f"Unknown preset: {name}. Known: {sorted(PRESET_NAMES)}")

    base.update(overrides)
    return base
