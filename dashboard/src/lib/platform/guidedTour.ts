/**
 * Guided tour content: the ordered presenter sequence that threads a viewer
 * through the project's contribution in the thesis draft's own narrative order
 * (motivation and gap, the contribution, the mechanism round, the skill
 * signal, synthetic validation, real-data evidence, robustness, conclusion).
 *
 * Each step pins to the live dashboard surface that evidences it, so the
 * dashboard doubles as a self-guided tour and a live demo aid.
 *
 * SOURCE OF TRUTH. Every word, number, claim, and scope statement below is
 * drawn from the thesis draft. Each step carries its draft source (chapter
 * and section) and the verified claim it names, so the copy is auditable line
 * by line. Terminology follows the thesis draft: no banned synonyms, no
 * do-not-claim assertions, the electricity result framed as a predicted null
 * rather than a failure, and the live market labelled synthetic.
 *
 * Prose rules: plain English in the draft's vocabulary, no maths, no symbols,
 * British spelling, no em-dashes, no semicolons.
 */

export interface TourStep {
  /** Stable id, used as a React key and in tests. */
  id: string;
  /** Short step title. */
  title: string;
  /**
   * One or two plain-English sentences in the draft's vocabulary. No maths,
   * no symbols, no banned filler.
   */
  blurb: string;
  /** Canonical route this step pins to (hash path, no leading '#'). */
  to: string;
  /** Action label for the link to this step's target view. */
  linkLabel: string;
  /** Draft chapter / section the step's framing derives from. */
  draftSource: string;
  /**
   * The verified claim (and value, where the step names one) this step rests
   * on, taken from the currency re-check. "No figure named" where the step is
   * framing only.
   */
  claim: string;
}

/**
 * The tour, in the thesis draft's narrative order. The interactive platform
 * surfaces carry the live demo (the gap, the round, the skill signal, the
 * market, the attacks); the research surfaces carry the verified evidence
 * (real-data results, the closing scope statement).
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'gap',
    title: 'Pay for forecast quality, not data',
    blurb:
      'Good forecasts often sit behind private data their owners will not share. A self-financed prediction market pays for forecast quality instead, but on its own it settles each round in isolation, so a forecaster who has been right for months earns no more than a newcomer who matches them this round.',
    to: '/platform',
    linkLabel: 'Open the explainer',
    draftSource: 'Introduction (10_intro_and_background, the gap) and Abstract',
    claim: 'No figure named. The cross-round memory gap motivates the contribution.',
  },
  {
    id: 'contribution',
    title: 'The contribution: an online skill layer',
    blurb:
      'This project adds a skill layer that remembers how well each forecaster has done before and rescales their deposit through a skill gate at the start of each round. Better past forecasts earn more weight in the aggregate and more exposure at settlement, and on the wind panel the skill gate alone delivers about three-quarters of the headline gain.',
    to: '/explainer',
    linkLabel: 'Walk the five steps',
    draftSource: 'Introduction (Contributions) and Mechanism design (30_mechanism_design)',
    claim: 'Skill-gate alone on wind cuts error by 5.15%, about three-quarters of the 7.1% headline.',
  },
  {
    id: 'round',
    title: 'A round, step by step',
    blurb:
      'Play a forecaster for one round: post a forecast and a deposit, watch the skill gate set your effective wager, see the reports combine into a wager-weighted aggregate, then settle once the outcome lands. The skill memory updates at the close of the round and carries into the next one.',
    to: '/platform/forecast',
    linkLabel: 'Be a forecaster',
    draftSource: 'Mechanism design (30_mechanism_design, the five within-round steps)',
    claim: 'No figure named. Submit, gate, aggregate, score and settle, then update.',
  },
  {
    id: 'skill-signal',
    title: 'Skill weighting lifts the better forecasters',
    blurb:
      'The panel is ranked by skill, wealth and share of the aggregate, so you can watch weight move towards the forecasters who have been accurate before. On the synthetic panel with known quality the skill estimate recovers the true accuracy ordering exactly across twenty seeds.',
    to: '/platform/leaderboard',
    linkLabel: 'See the ranked panel',
    draftSource: 'Synthetic validation (50_results_synthetic, skill recovery)',
    claim: 'Skill recovery Spearman rank correlation +1.00 across all twenty seeds.',
  },
  {
    id: 'market',
    title: 'Watch the market, and when skill weighting matters',
    blurb:
      'The live market is a synthetic sandbox, shown only to illustrate the mechanism rather than to report a result. Switch between a varied panel and a near-identical one to see the rule lean on skill when forecasters genuinely differ and stay close to a plain average when they do not.',
    to: '/platform/market',
    linkLabel: 'Watch the market',
    draftSource: 'Synthetic validation (50_results_synthetic) and the conditional framing (99_conclusion)',
    claim: 'Live market is synthetic and illustrative. The gain is conditional on panel quality spread.',
  },
  {
    id: 'evidence',
    title: 'Real-data evidence: wind and electricity',
    blurb:
      'On the Elia offshore-wind panel, where forecasters differ in quality, the mechanism cuts the aggregate forecast error by 7.1% against a plain average over 17,344 rounds, and the difference is statistically clear. On the near-identical electricity-imbalance panel it ties the plain average with no measurable difference, the predicted result when a panel has no quality spread, not a failure.',
    to: '/evidence',
    linkLabel: 'Read the evidence',
    draftSource: 'Real-data validation (60_results_real_data, wind headline and electricity null)',
    claim:
      'Wind -7.1% over 17,344 rounds, Diebold-Mariano t = 22.35. Electricity null, both 0.0905, p = 0.994.',
  },
  {
    id: 'attacks',
    title: 'Stress tests and attacks',
    blurb:
      'Pick an attack and watch the same panel run with and without it. Budget balance holds and identical-clone copying is blocked, but the adversary catalogue is honest that a privileged insider still tops the list at about 57 in profit per thousand rounds and that arbitrage profit rises, not falls, as the skill-gate floor is raised.',
    to: '/platform/stress',
    linkLabel: 'Run an attack',
    draftSource: 'Robustness (80_robustness, the adversary catalogue)',
    claim:
      'Insider +57.1 profit per 1,000 rounds (top of catalogue). Arbitrage +11.68 to +24.22 as the floor rises.',
  },
  {
    id: 'conclusion',
    title: 'What it shows, and what it does not',
    blurb:
      'The gain is real but conditional: skill weighting repays its cost only when the panel holds genuine quality differences. It does not beat the single best forecaster, which is 17.0% more accurate on the operational benchmark, and arbitrage and collusion and identity management stay open for future work. The optional recalibration step sits outside the settlement rule.',
    to: '/research',
    linkLabel: 'See where the evidence sits',
    draftSource: 'Conclusion (99_conclusion, findings and future work)',
    claim:
      'Conditional gain. Best single forecaster (XGBoost) beats the mechanism by 17.0% on the operational benchmark.',
  },
];

export const TOUR_LENGTH = TOUR_STEPS.length;
