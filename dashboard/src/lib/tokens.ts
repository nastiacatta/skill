/**
 * Semantic colour and symbol tokens used across the whole dashboard.
 * One colour per conceptual object — reuse everywhere.
 *
 * Anchored on the slide palette (`presentationConstants.ts`) via
 * `@/lib/palette` so the same concept has the same hue in the main app,
 * the slide deck, and every R/Python-generated PNG.
 */
import { PALETTE, ORANGE } from './palette';

/** Tailwind-compatible rgba helper. */
function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Soft tint helper — a very light background derived from a base colour. */
function tint(hex: string): string {
  return alpha(hex, 0.12);
}

export const SEM = {
  deposit:   { main: PALETTE.coral,    light: tint(PALETTE.coral),    ring: alpha(PALETTE.coral, 0.25),    sym: 'b', label: 'Deposit' },
  skill:     { main: PALETTE.purple,   light: tint(PALETTE.purple),   ring: alpha(PALETTE.purple, 0.25),   sym: 'σ', label: 'Skill' },
  wager:     { main: PALETTE.teal,     light: tint(PALETTE.teal),     ring: alpha(PALETTE.teal, 0.25),     sym: 'm', label: 'Eff. wager' },
  aggregate: { main: PALETTE.imperial, light: tint(PALETTE.imperial), ring: alpha(PALETTE.imperial, 0.25), sym: 'r̂', label: 'Aggregate' },
  score:     { main: ORANGE,          light: tint(ORANGE),          ring: alpha(ORANGE, 0.25),          sym: 's', label: 'Score' },
  payoff:    { main: PALETTE.teal,     light: tint(PALETTE.teal),     ring: alpha(PALETTE.teal, 0.25),     sym: 'Π', label: 'Payoff' },
  outcome:   { main: PALETTE.coral,    light: tint(PALETTE.coral),    ring: alpha(PALETTE.coral, 0.25),    sym: 'y', label: 'Outcome' },
  wealth:    { main: PALETTE.navy,     light: tint(PALETTE.navy),     ring: alpha(PALETTE.navy, 0.25),     sym: 'W', label: 'Wealth' },
} as const;

export const METHOD = {
  equal:      { color: PALETTE.slate,    label: 'Equal weight',  id: 'uniform'      as const, dash: undefined, strokeWidth: 2 },
  skill_only: { color: PALETTE.purple,   label: 'Skill-only',    id: 'skill_only'   as const, dash: '6 3',     strokeWidth: 2 },
  blended:    { color: PALETTE.teal,     label: 'Skill × stake', id: 'skill_stake'  as const, dash: undefined, strokeWidth: 3 },
  stake_only: { color: PALETTE.coral,    label: 'Stake-only',    id: 'deposit_only' as const, dash: '2 3',     strokeWidth: 2 },
} as const;

export const METHOD_EXTRA = {
  best_single: { color: PALETTE.navy, label: 'Best single', id: 'best_single' as const, dash: '8 3 2 3', strokeWidth: 2 },
} as const;

export const GLOSSARY_ENTRIES = [
  { symbol: 'bᵢ',  meaning: 'Deposit — amount agent i puts at risk' },
  { symbol: 'σᵢ',  meaning: 'Skill — online estimate of forecasting quality, ∈ [σ_min, 1]' },
  { symbol: 'mᵢ',  meaning: 'Effective wager — deposit filtered through skill: bᵢ(λ + (1−λ)σᵢ)' },
  { symbol: 'r̂',   meaning: 'Aggregate forecast — weighted combination of individual reports' },
  { symbol: 'sᵢ',  meaning: 'Score — how close agent i\u2019s report was to the realised outcome' },
  { symbol: 'Πᵢ',  meaning: 'Payoff — total payout to agent i after settlement' },
  { symbol: 'πᵢ',  meaning: 'Profit — payoff minus deposit: Πᵢ − bᵢ' },
  { symbol: 'λ',   meaning: 'Stake weight — interpolates between pure skill (λ=0) and pure stake (λ=1) inside the effective wager' },
  { symbol: 'γ',   meaning: 'Skill sharpness — controls how steeply σ falls as the running loss L rises: σ = σ_min + (1−σ_min)·exp(−γL). Larger γ = sharper separation of good and bad forecasters.' },
  { symbol: 'ρ',   meaning: 'EWMA decay — how fast the running loss L adapts to new observations: L ← (1−ρ)·L + ρ·loss' },
  // User-facing chart terms (shared across pages)
  { symbol: 'Forecast error', meaning: 'Distance between realised outcome y and aggregate forecast r̂; e_t = |y_t − r̂_t|. Smaller is better.' },
  { symbol: 'CRPS', meaning: 'Continuous Ranked Probability Score — a proper score for probabilistic forecasts. Measures how far the predicted distribution is from the realised outcome. Lower is better; rewards both calibration and sharpness.' },
  { symbol: 'Calibration', meaning: 'A forecast is calibrated when realised outcomes look like draws from the forecast distribution. Ideal PIT: uniform; ideal reliability curve: the 45° diagonal.' },
  { symbol: 'Gini', meaning: 'Inequality / concentration of a weight or wealth vector. 0 = perfectly equal; larger values = more concentration in a few agents.' },
  { symbol: 'HHI', meaning: 'Herfindahl\u2013Hirschman Index — sum of squared weights, Σ wᵢ². Higher values mean a few agents carry most of the weight; N_eff = 1 / HHI.' },
  { symbol: 'N_eff', meaning: 'Effective number of active agents: 1 / Σ wᵢ². Equals N when weights are uniform and shrinks when a few agents dominate.' },
  { symbol: 'm/b', meaning: 'Effective wager divided by deposit; equals λ + (1−λ)σ. With fixed deposits this isolates the effect of skill on weight.' },
] as const;
