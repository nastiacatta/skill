/**
 * Mechanism response metrics interface.
 *
 * Quantifies how the core mechanism responds to each behaviour preset:
 * skill recovery, wealth penalty, aggregate contamination, concentration impact.
 */

export interface MechanismResponseMetrics {
  /** Rounds for attacker's σ to drop below 0.5 after attack onset. null if never drops. */
  skillRecoveryRounds: number | null;
  /** Attacker's final wealth minus honest baseline final wealth */
  wealthPenalty: number;
  /** Peak |Δ CRPS| during attack window vs baseline */
  aggregateContamination: number;
  /** Δ Gini vs baseline at end of simulation */
  concentrationImpact: number;
  /** EWMA half-life: ln(2)/ρ */
  ewmaHalfLife: number;
}
