"""Bankroll ablation interpretation module.

Reads a bankroll ablation CSV and produces a structured interpretation
identifying which pipeline steps contribute most to accuracy and whether
the skill gate is redundant.

Requirements: 1.1–1.8, 12.1–12.3
"""

from __future__ import annotations

import csv
import json
import os
from dataclasses import asdict, dataclass

from onlinev2.analysis.stats import sanitise_json

# ---------------------------------------------------------------------------
# Step-to-label / complexity mapping
# ---------------------------------------------------------------------------

STEP_LABELS: dict[str, str] = {
    "A-": "Confidence proxy",
    "B-": "Deposit",
    "C-": "Skill gate",
    "D-": "Weight cap",
    "E-": "Wealth update",
}

STEP_COMPLEXITY: dict[str, str] = {
    "A-": "low",
    "B-": "medium",
    "C-": "high",
    "D-": "medium",
    "E-": "low",
}


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class AblationStep:
    """A single ablation step with its contribution and classification."""

    variant: str
    label: str
    delta_crps_contribution: float
    is_negligible: bool
    complexity_level: str


@dataclass
class AblationInterpretation:
    """Full ablation interpretation result."""

    steps: list[AblationStep]
    dominant_step: str
    conclusion: str
    skill_gate_threat: bool


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------


def interpret_ablation(csv_path: str) -> AblationInterpretation | dict:
    """Parse bankroll ablation CSV and produce an interpretation.

    Parameters
    ----------
    csv_path : str
        Path to the bankroll ablation CSV.  Expected columns include at
        least ``variant``, ``seed``, and ``mean_crps``.

    Returns
    -------
    AblationInterpretation | dict
        Structured interpretation on success, or an error dict
        ``{"error": "...", "detail": "..."}`` on failure.
    """
    # --- Guard: file exists ---
    if not os.path.isfile(csv_path):
        return {"error": "missing_csv", "detail": f"CSV file not found: {csv_path}"}

    # --- Read CSV ---
    try:
        with open(csv_path, newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as exc:
        return {"error": "csv_read_error", "detail": str(exc)}

    if not rows:
        return {"error": "empty_csv", "detail": "CSV file contains no data rows"}

    # --- Collect per-variant per-seed CRPS ---
    variant_seed_crps: dict[str, list[float]] = {}
    for row in rows:
        variant = row.get("variant", "").strip()
        try:
            crps_val = float(row["mean_crps"])
        except (KeyError, ValueError, TypeError):
            continue
        variant_seed_crps.setdefault(variant, []).append(crps_val)

    variants = set(variant_seed_crps.keys())

    if len(variants) < 2:
        return {
            "error": "insufficient_variants",
            "detail": f"Need at least 2 variants, found {len(variants)}: {sorted(variants)}",
        }

    if "Full" not in variants:
        return {
            "error": "missing_full_variant",
            "detail": "CSV must contain a 'Full' variant as the baseline",
        }

    # --- Compute Full baseline mean CRPS ---
    full_crps_values = variant_seed_crps["Full"]
    full_mean = sum(full_crps_values) / len(full_crps_values)

    # --- Compute per-step contributions ---
    steps: list[AblationStep] = []
    for variant in sorted(variant_seed_crps.keys()):
        if variant == "Full":
            continue
        variant_values = variant_seed_crps[variant]
        variant_mean = sum(variant_values) / len(variant_values)
        contribution = variant_mean - full_mean

        label = STEP_LABELS.get(variant, variant)
        complexity = STEP_COMPLEXITY.get(variant, "unknown")

        negligible_threshold = 0.01 * full_mean if full_mean != 0 else 0.0
        is_negligible = abs(contribution) < negligible_threshold

        steps.append(
            AblationStep(
                variant=variant,
                label=label,
                delta_crps_contribution=contribution,
                is_negligible=is_negligible,
                complexity_level=complexity,
            )
        )

    # --- Sort by descending |contribution| ---
    steps.sort(key=lambda s: abs(s.delta_crps_contribution), reverse=True)

    # --- Dominant step ---
    dominant_step = steps[0].variant if steps else ""

    # --- Skill gate threat ---
    skill_gate_threat = False
    for step in steps:
        if step.variant == "C-" and step.is_negligible:
            skill_gate_threat = True
            break

    # --- Conclusion sentence ---
    if steps:
        top = steps[0]
        total_abs = sum(abs(s.delta_crps_contribution) for s in steps)
        pct = (abs(top.delta_crps_contribution) / total_abs * 100) if total_abs > 0 else 0
        conclusion = (
            f"The {top.label.lower()} (step {top.variant.rstrip('-')}) contributes "
            f"{pct:.0f}% of the accuracy gain; removing it increases CRPS by "
            f"{top.delta_crps_contribution:.4f}."
        )
    else:
        conclusion = "No ablation steps found."

    return AblationInterpretation(
        steps=steps,
        dominant_step=dominant_step,
        conclusion=conclusion,
        skill_gate_threat=skill_gate_threat,
    )


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------


def write_interpretation(interp: AblationInterpretation, out_path: str) -> None:
    """Serialise an :class:`AblationInterpretation` to JSON.

    Applies :func:`sanitise_json` to replace NaN/Inf with ``None``
    before writing.

    Parameters
    ----------
    interp : AblationInterpretation
        The interpretation to serialise.
    out_path : str
        Destination file path.
    """
    raw = asdict(interp)
    sanitised = sanitise_json(raw)
    os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(sanitised, f, indent=2)
