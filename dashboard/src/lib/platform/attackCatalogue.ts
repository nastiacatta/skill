/**
 * Curated attack catalogue for the platform stress view.
 *
 * A small, legible subset of the draft's nine-class adversary catalogue
 * (writing/80_robustness.md), using the draft's canonical names and framing.
 * This is NOT the full nineteen-preset behaviour bank; the dense research
 * tabs live on the /robustness page and this view links to them.
 *
 * Each entry drives the SAME synthetic panel twice through the real simulator
 * (runPipeline): once with the matching behaviour preset and once on the
 * baseline, so the visitor sees the difference the attack makes. Every claim
 * cites the robustness chapter and follows the do-not-claim list in
 * draft_match_contract.md §5: no sybil-proofness, no defeat of arbitrage, no
 * unconditional incentive compatibility.
 */
import type { BehaviourPresetId } from '@/lib/behaviour/hiddenAttributes';

/**
 * The draft splits the catalogue into closed surfaces (the attacker earns
 * zero, makes a loss, or bankrupts) and open Lambert surfaces (positive
 * expected profit survives). The sybil class is mixed: the narrow
 * identical-report case is closed, the diversified-report case is open.
 */
export type AttackSurface = 'closed' | 'open' | 'mixed';

/** Which round-by-round signal the view emphasises for this attack. */
export type AttackSignal = 'profit' | 'weight' | 'conservation';

export interface AttackDef {
  id: string;
  /** Canonical name from the robustness chapter and writing-style guide. */
  name: string;
  /** Behaviour preset that drives the with-attack run. */
  preset: BehaviourPresetId;
  /** Closed / open / mixed, matching the draft's split. */
  surface: AttackSurface;
  /** One short tag line under the name. */
  family: string;
  /** Plain English: what the attacker tries to do. No maths. */
  tries: string;
  /** Plain English: what the mechanism does about it. No maths. */
  response: string;
  /** Plain English, honest limit: what the mechanism does NOT do. */
  limit: string;
  /** The draft's stated result for this attack, quoted with its citation. */
  draftResult: string;
  /** Which per-round signal to plot. */
  signal: AttackSignal;
  /** Seats the attacker controls, given panel size n. */
  attackerSeats: (n: number) => number[];
  /** One-line caption shown while the attack is engaging. */
  engageCaption: string;
}

export const ATTACKS: AttackDef[] = [
  {
    id: 'arbitrage_seeker',
    name: 'Arbitrage seeker',
    preset: 'arbitrageur',
    surface: 'open',
    family: 'Open Lambert surface (Chen et al. 2014)',
    tries:
      'An arbitrage seeker copies a blend of the other reports rather than forecasting. It aims to earn a positive expected payoff at no truthful effort.',
    response:
      'The skill gate scales the size of the opening, so a lower gate floor narrows it. The wager-weighted settlement still clears and honest reporting still pays.',
    limit:
      'This is an open surface inherited from the Lambert family. The mechanism does not defeat arbitrage. The opening widens as the gate floor rises, so raising the floor makes the leak larger, not smaller.',
    draftResult:
      'The draft reports the arbitrage seeker earning +11.68 per 1,000 rounds at gate floor 0, rising to +24.22 at floor 1, and firing on 75 to 77 per cent of rounds (robustness chapter, C21).',
    signal: 'profit',
    attackerSeats: (n) => [Math.max(0, n - 1)],
    engageCaption: 'The arbitrage seeker copies the blend of the other reports and books a positive expected payoff.',
  },
  {
    id: 'coordinated_coalition',
    name: 'Coordinated coalition',
    preset: 'collusion',
    surface: 'open',
    family: 'Open Lambert surface (Chun et al. 2011)',
    tries:
      'A coordinated coalition submits a joint report from several identities and times its participation together, pulling the aggregate towards a shared target.',
    response:
      'Budget balance and the per-round score still hold by construction. The coalition cannot break the pool, only profit from the weighted-score payoff.',
    limit:
      'This is an open Lambert surface. The mechanism does not close coalition profit. Closing it needs the no-arbitrage family, which trades away budget balance.',
    draftResult:
      'The draft lists the coordinated coalition among the six open surfaces that leak positive expected profit at every gate-floor value (robustness chapter, open attacks).',
    signal: 'profit',
    attackerSeats: () => [0, 1],
    engageCaption: 'The coalition submits a joint report and concentrates its stake to pull the aggregate.',
  },
  {
    id: 'sybil_arbitrageur',
    name: 'Sybil arbitrageur',
    preset: 'sybil',
    surface: 'mixed',
    family: 'Narrow invariance closed, diversified case open',
    tries:
      'A sybil attacker splits one identity into clones. Identical clones that conserve the combined deposit are the narrow sybil case. Clones that vary their reports are the sybil arbitrageur.',
    response:
      'Conservation of the effective wager blocks identical-report clones outright: the clone pair splits one deposit into halves, so its combined wager is conserved and splitting earns no more than a single identity would.',
    limit:
      'Only narrow sybil invariance holds, for identical reports with a conserved deposit. Diversified-report clones break it and reach the open arbitrage surface. The mechanism is not sybil-proof.',
    draftResult:
      'The draft blocks identical-report clones by conservation of the effective wager (closed), and reports the diversified-report variant reaching the same open arbitrage surface (robustness chapter, closed and open attacks).',
    signal: 'conservation',
    attackerSeats: () => [0, 1],
    engageCaption: 'One identity splits into two clones, each posting half the deposit. The combined wager is conserved.',
  },
  {
    id: 'strategic_reporter',
    name: 'Strategic reporter',
    preset: 'biased',
    surface: 'open',
    family: 'Open Lambert surface (anchor-pull reporting)',
    tries:
      'A strategic reporter pulls its report away from the consensus to bias the aggregate in its favour.',
    response:
      'Each round the report is scored against the realised outcome. A report far from the outcome scores poorly, the skill estimate falls, and the skill gate shrinks the reporter weight in later rounds.',
    limit:
      'Anchor-pull reporting is an open surface. The skill gate reduces the reporter weight, but the per-round settlement is myopic, so the mechanism does not remove the opening entirely.',
    draftResult:
      'The draft lists the strategic reporter among the six open surfaces, biasing the aggregate through anchor-pull magnitude reporting (robustness chapter, open attacks).',
    signal: 'weight',
    attackerSeats: () => [0],
    engageCaption: 'The strategic reporter pulls its report off the consensus, scores poorly, and loses weight.',
  },
  {
    id: 'reputation_reset',
    name: 'Reputation-reset / whitewashing',
    preset: 'reputation_reset',
    surface: 'closed',
    family: 'Closed surface, partially absorbed (Feldman 2004)',
    tries:
      'A reputation-reset attacker plays honestly to build a good skill estimate, then exploits it. Whitewashing abandons a damaged identity for a fresh one to escape accumulated losses.',
    response:
      'Staleness decay and the non-unit newcomer prior absorb most of the reset, so a fresh identity does not start trusted and the exploit pays little.',
    limit:
      'The reset is partially absorbed, not eliminated. The attacker still makes a loss, just a smaller one. The surface is closed in the sense that profit stays negative.',
    draftResult:
      'The draft reports the reset cutting the attacker loss from -20.00 to -3.49 plus or minus 0.14 per 1,000 rounds, an 83 per cent reduction, with profit never turning positive (robustness chapter, C23).',
    signal: 'profit',
    attackerSeats: () => [0],
    engageCaption: 'After grooming a skill estimate, the attacker degrades. The skill gate pulls its weight back down.',
  },
];

export const DEFAULT_ATTACK = ATTACKS[0];

export function findAttack(id: string): AttackDef {
  return ATTACKS.find((a) => a.id === id) ?? DEFAULT_ATTACK;
}
