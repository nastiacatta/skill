/**
 * Ablation interpreter — rank bankroll pipeline steps by their
 * ΔCRPS contribution and flag negligible / threatening results.
 *
 * Pure function — no side effects.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

import type {
  AblationStep,
  AblationInterpretation,
  BankrollAblationRow,
} from './types';

// ── Step metadata ────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  'A-': 'Confidence proxy',
  'B-': 'Deposit',
  'C-': 'Skill gate',
  'D-': 'Weight cap',
  'E-': 'Wealth update',
};

const STEP_COMPLEXITY: Record<string, 'low' | 'medium' | 'high'> = {
  'A-': 'low',
  'B-': 'medium',
  'C-': 'medium',
  'D-': 'low',
  'E-': 'high',
};

const REMOVAL_VARIANTS = ['A-', 'B-', 'C-', 'D-', 'E-'];

// ── Public API ───────────────────────────────────────────────────────

/**
 * Interpret bankroll ablation results.
 *
 * For each removal variant (A- through E-), computes:
 *   contribution = CRPS_variant − CRPS_full
 *   (positive ⇒ the removed step was helping)
 *
 * Flags negligible steps: |contribution| < 0.01 × fullCrps.
 * Sets skillGateThreat = true when C- removal is negligible.
 * Sorts steps by |contribution| descending.
 * Generates a conclusion string identifying the dominant step.
 */
export function interpretAblation(
  rows: BankrollAblationRow[],
  fullCrps: number,
): AblationInterpretation {
  const rowByVariant = new Map<string, BankrollAblationRow>();
  for (const row of rows) {
    rowByVariant.set(row.variant, row);
  }

  const steps: AblationStep[] = REMOVAL_VARIANTS.map((variant) => {
    const row = rowByVariant.get(variant);
    const variantCrps = row?.mean_crps ?? fullCrps;
    const contribution = variantCrps - fullCrps;
    const isNegligible = Math.abs(contribution) < 0.01 * fullCrps;

    return {
      variant,
      label: STEP_LABELS[variant] ?? variant,
      deltaCrpsContribution: contribution,
      isNegligible,
      complexityLevel: STEP_COMPLEXITY[variant] ?? 'medium',
    };
  });

  // Sort by |contribution| descending
  steps.sort(
    (a, b) =>
      Math.abs(b.deltaCrpsContribution) - Math.abs(a.deltaCrpsContribution),
  );

  // Identify dominant step (largest |contribution|)
  const dominantStep =
    steps.length > 0 ? steps[0].label : 'None';

  // Skill gate threat: C- removal is negligible
  const cStep = steps.find((s) => s.variant === 'C-');
  const skillGateThreat = cStep?.isNegligible ?? false;

  // Generate conclusion
  const conclusion = generateConclusion(steps, dominantStep, skillGateThreat);

  return {
    steps,
    dominantStep,
    conclusion,
    skillGateThreat,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function generateConclusion(
  steps: AblationStep[],
  dominantStep: string,
  skillGateThreat: boolean,
): string {
  if (steps.length === 0) {
    return 'No ablation data available.';
  }

  const allNegligible = steps.every((s) => s.isNegligible);
  if (allNegligible) {
    return 'No single pipeline step has a measurable contribution to accuracy.';
  }

  let conclusion = `The dominant step is "${dominantStep}", contributing the largest share of the accuracy gain.`;

  if (skillGateThreat) {
    conclusion +=
      ' Warning: removing the skill gate (step C) has negligible effect, which threatens the claim that skill improves accuracy.';
  }

  return conclusion;
}
