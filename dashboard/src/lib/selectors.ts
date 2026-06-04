import type { SkillWagerPoint } from './types';

/** Points for a single round (reconstructed from timeseries). */
export function getRoundData(data: SkillWagerPoint[], round: number): SkillWagerPoint[] {
  return data.filter(d => d.t === round);
}

/** Maximum round index present in the timeseries. */
export function getMaxRound(data: SkillWagerPoint[], fallbackRounds = 0): number {
  if (data.length === 0) return Math.max(0, fallbackRounds - 1);
  return Math.max(...data.map(d => d.t));
}

/** Overall participation rate (active points / total points). */
export function getParticipationRate(data: SkillWagerPoint[]): number {
  if (data.length === 0) return 0;
  return data.filter(d => !d.missing).length / data.length;
}

/** Participation rate for a single round's data. */
export function participationRateForRound(roundData: SkillWagerPoint[]): number {
  if (roundData.length === 0) return 0;
  return roundData.filter(d => !d.missing).length / roundData.length;
}

/** Active count and rate per round. */
export interface ActivePerRoundPoint {
  t: number;
  activeCount: number;
  total: number;
  activeRate: number;
}

export function getActivePerRound(data: SkillWagerPoint[]): ActivePerRoundPoint[] {
  const rounds: Record<number, { total: number; active: number }> = {};
  for (const d of data) {
    if (!rounds[d.t]) rounds[d.t] = { total: 0, active: 0 };
    rounds[d.t].total++;
    if (!d.missing) rounds[d.t].active++;
  }
  return Object.entries(rounds).map(([t, v]) => ({
    t: Number(t),
    activeCount: v.active,
    total: v.total,
    activeRate: v.total > 0 ? v.active / v.total : 0,
  }));
}

/** Final cumulative profit per agent. */
export interface FinalWealthPoint {
  agent: string;
  wealth: number;
}

export function getFinalWealthByAgent(data: SkillWagerPoint[]): FinalWealthPoint[] {
  const agents = [...new Set(data.map(d => d.agent))];
  return agents.map(a => {
    const last = data.filter(d => d.agent === a).slice(-1)[0];
    return { agent: `A${a}`, wealth: last?.cumProfit ?? 0 };
  });
}

/** Participation frequency per agent (fraction of rounds active). */
export interface ParticipationFreqPoint {
  agent: string;
  frequency: number;
}

export function getParticipationFrequencyByAgent(data: SkillWagerPoint[]): ParticipationFreqPoint[] {
  const agents = [...new Set(data.map(d => d.agent))];
  return agents.map(a => {
    const agentRounds = data.filter(d => d.agent === a);
    const active = agentRounds.filter(d => !d.missing).length;
    return {
      agent: `A${a}`,
      frequency: agentRounds.length > 0 ? active / agentRounds.length : 0,
    };
  });
}

/** Round-level metrics for replay (active count, total wager, avg profit, participation %). */
export function getRoundMetrics(roundData: SkillWagerPoint[], nAgents: number) {
  const activeCount = roundData.filter(d => !d.missing).length;
  const totalWager = roundData.reduce((s, d) => s + (d.missing ? 0 : d.wager), 0);
  const avgProfit =
    roundData.length > 0
      ? roundData.reduce((s, d) => s + d.profit, 0) / roundData.length
      : 0;
  const participationPct =
    nAgents > 0 ? (activeCount / nAgents) * 100 : 0;
  return { activeCount, totalWager, avgProfit, participationPct };
}
