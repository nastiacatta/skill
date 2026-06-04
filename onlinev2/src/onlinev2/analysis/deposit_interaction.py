"""Deposit policy interaction analysis module.

Cross-references master_comparison results across deposit policies to
quantify how deposit policy interacts with the skill layer.

Requirements: 7.1–7.5
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass

import numpy as np

from onlinev2.analysis.stats import compute_ci, compute_se, sanitise_json

# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class PolicyMethodResult:
    """Statistics for a single (deposit_policy, method) combination."""

    deposit_policy: str
    method: str
    mean_delta_crps: float
    se: float
    ci_low: float
    ci_high: float


@dataclass
class InteractionAnalysis:
    """Full deposit policy interaction analysis result."""

    per_policy: list[PolicyMethodResult]
    interaction_effect: float
    interaction_se: float
    interaction_ci_low: float
    interaction_ci_high: float
    interpretation: str
    warning: str | None = None


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------


def analyse_deposit_interaction(
    results_by_policy: dict[str, list[dict]],
) -> InteractionAnalysis | dict:
    """Cross-reference master_comparison results across deposit policies.

    Parameters
    ----------
    results_by_policy : dict[str, list[dict]]
        Mapping from policy name (e.g. ``"fixed"``, ``"bankroll"``) to a
        list of master_comparison row dicts.  Each dict must contain keys:
        ``method``, ``seed``, ``mean_crps``, ``delta_crps_vs_equal``.

    Returns
    -------
    InteractionAnalysis | dict
        Structured interaction analysis on success, or an error dict
        ``{"error": "...", "detail": "..."}`` on failure.
    """
    # --- Guard: empty input ---
    if not results_by_policy:
        return {"error": "empty_input", "detail": "No policy results provided"}

    # --- Compute per-(policy, method) statistics ---
    per_policy: list[PolicyMethodResult] = []
    # Also collect blended deltas keyed by policy for interaction computation
    blended_deltas_by_policy: dict[str, np.ndarray] = {}

    for policy, rows in results_by_policy.items():
        if not rows:
            continue
        # Group rows by method
        method_deltas: dict[str, list[float]] = {}
        for row in rows:
            method = row.get("method", "")
            try:
                delta = float(row["delta_crps_vs_equal"])
            except (KeyError, ValueError, TypeError):
                continue
            method_deltas.setdefault(method, []).append(delta)

        for method, deltas_list in sorted(method_deltas.items()):
            arr = np.array(deltas_list, dtype=np.float64)
            mean_val = float(np.mean(arr))
            se_val = compute_se(arr)
            ci_low, ci_high = compute_ci(mean_val, se_val)
            per_policy.append(
                PolicyMethodResult(
                    deposit_policy=policy,
                    method=method,
                    mean_delta_crps=mean_val,
                    se=se_val,
                    ci_low=ci_low,
                    ci_high=ci_high,
                )
            )
            if method == "blended":
                blended_deltas_by_policy[policy] = arr

    # --- Handle single-policy input ---
    policies = list(results_by_policy.keys())
    if len(policies) < 2:
        # Return partial result with warning
        return InteractionAnalysis(
            per_policy=per_policy,
            interaction_effect=float("nan"),
            interaction_se=float("nan"),
            interaction_ci_low=float("nan"),
            interaction_ci_high=float("nan"),
            interpretation="Interaction analysis requires at least two policies.",
            warning="interaction requires ≥ 2 policies",
        )

    # --- Compute interaction effect ---
    # Interaction = ΔCRPS_blended_fixed - ΔCRPS_blended_bankroll
    # where ΔCRPS is already vs equal (so no need to subtract equal again)
    # Find the two policies: prefer "fixed" and "bankroll", else use first two
    if "fixed" in blended_deltas_by_policy and "bankroll" in blended_deltas_by_policy:
        policy_a, policy_b = "fixed", "bankroll"
    else:
        # Use the first two policies that have blended data
        available = sorted(blended_deltas_by_policy.keys())
        if len(available) < 2:
            # Not enough blended data across policies
            return InteractionAnalysis(
                per_policy=per_policy,
                interaction_effect=float("nan"),
                interaction_se=float("nan"),
                interaction_ci_low=float("nan"),
                interaction_ci_high=float("nan"),
                interpretation="Insufficient blended method data across policies.",
                warning="blended method data missing for ≥ 2 policies",
            )
        policy_a, policy_b = available[0], available[1]

    deltas_a = blended_deltas_by_policy[policy_a]
    deltas_b = blended_deltas_by_policy[policy_b]

    mean_a = float(np.mean(deltas_a))
    mean_b = float(np.mean(deltas_b))
    se_a = compute_se(deltas_a)
    se_b = compute_se(deltas_b)

    interaction_effect = mean_a - mean_b
    interaction_se = float(np.sqrt(se_a**2 + se_b**2))
    interaction_ci_low, interaction_ci_high = compute_ci(interaction_effect, interaction_se)

    # --- Generate interpretation ---
    if interaction_effect < 0:
        direction = f"{policy_a} deposits amplify the skill advantage"
        magnitude = abs(interaction_effect)
    elif interaction_effect > 0:
        direction = f"{policy_b} deposits amplify the skill advantage"
        magnitude = abs(interaction_effect)
    else:
        direction = "Neither deposit policy amplifies the skill advantage"
        magnitude = 0.0

    interpretation = (
        f"{direction} by {magnitude:.4f} ΔCRPS compared to {policy_b if interaction_effect < 0 else policy_a} deposits."
    )

    return InteractionAnalysis(
        per_policy=per_policy,
        interaction_effect=interaction_effect,
        interaction_se=interaction_se,
        interaction_ci_low=interaction_ci_low,
        interaction_ci_high=interaction_ci_high,
        interpretation=interpretation,
    )


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------


def write_interaction_analysis(analysis: InteractionAnalysis, out_path: str) -> None:
    """Serialise an :class:`InteractionAnalysis` to JSON.

    Applies :func:`sanitise_json` to replace NaN/Inf with ``None``
    before writing.

    Parameters
    ----------
    analysis : InteractionAnalysis
        The interaction analysis to serialise.
    out_path : str
        Destination file path.
    """
    raw = asdict(analysis)
    sanitised = sanitise_json(raw)
    os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(sanitised, f, indent=2)
