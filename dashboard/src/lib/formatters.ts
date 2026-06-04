export function fmtNum(v: number | null | undefined, decimals = 4): string {
  if (v == null || isNaN(v)) return '—';
  if (Math.abs(v) < 1e-10) return '0';
  return v.toFixed(decimals);
}

export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || isNaN(v)) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}

export function fmtSci(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  if (Math.abs(v) < 1e-10) return '0';
  return v.toExponential(2);
}

export function scenarioLabel(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Human-readable label for task type (no internal codes in UI). */
export function taskTypeLabel(code: string): string {
  const labels: Record<string, string> = {
    point: 'Point forecast',
    distribution: 'Distribution (CRPS)',
  };
  return labels[code] ?? scenarioLabel(code);
}

/** Human-readable label for scoring rule (no internal codes in UI). */
export function scoringRuleLabel(code: string): string {
  const labels: Record<string, string> = {
    CRPS: 'CRPS (Continuous Ranked Probability Score)',
    MAE: 'MAE (Mean Absolute Error)',
  };
  return labels[code] ?? code;
}

/** Display name for an agent (1-based "Agent 1", "Agent 2", … instead of raw id/code). */
export function agentDisplayName(agentId: string | number): string {
  const num = typeof agentId === 'string' ? parseInt(agentId.replace(/^A/, ''), 10) : agentId;
  if (!isNaN(num) && num >= 0) return `Agent ${num + 1}`;
  return `Agent ${agentId}`;
}

export function metricLabel(key: string): string {
  const labels: Record<string, string> = {
    crpsUniform: 'CRPS (Equal)',
    crpsDeposit: 'CRPS (Stake)',
    crpsSkill: 'CRPS (Skill)',
    crpsMechanism: 'CRPS (Skill × stake)',
    crpsBestSingle: 'CRPS (Best Single)',
    crpsUniformCum: 'Cumulative CRPS (Equal)',
    crpsDepositCum: 'Cumulative CRPS (Stake)',
    crpsSkillCum: 'Cumulative CRPS (Skill)',
    crpsMechanismCum: 'Cumulative CRPS (Skill × stake)',
    crpsBestSingleCum: 'Cumulative CRPS (Best Single)',
  };
  return labels[key] || key;
}

/** Labels for sweep/heatmap metric keys (avoid showing raw codes in tooltips). */
export function sweepMetricLabel(key: string): string {
  const labels: Record<string, string> = {
    meanCrps: 'Mean CRPS',
    gini: 'Gini coefficient',
  };
  return labels[key] ?? key;
}

// ── Palette re-exports ──────────────────────────────────────────
// `AGENT_COLORS`, `ACCENT`, `MUTED`, and `WEIGHTING_COLORS` live in
// `lib/palette.ts` now, but are re-exported here so existing imports
// from `@/lib/formatters` keep working. Palette is anchored on the
// slide deck constants so the main app, the presentation, and every
// R/Python-generated PNG share the same colours for the same concept.
export { AGENT_COLORS, ACCENT, MUTED, WEIGHTING_COLORS } from './palette';