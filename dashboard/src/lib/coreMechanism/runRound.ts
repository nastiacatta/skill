/**
 * One-round mechanism (point/MAE scoring).
 * Aligned with onlinev2.core: scoring.score_mae, weights.effective_wager,
 * aggregation.aggregate_forecast, settlement.skill_payoff / settle_round.
 * Skill update (L, sigma from loss) is dashboard-specific; onlinev2 uses core.skill.
 */
const EPS = 1e-12;

/** How reports are combined: uniform, deposit-only, skill-only, or full skill × stake. */
export type WeightingMode = 'uniform' | 'deposit' | 'skill' | 'full';

export interface MechanismParams {
  lam: number;
  sigma_min: number;
  gamma: number;
  rho: number;
  eta?: number;
  U?: number;
  s_client?: number;
  kappa?: number;
  L0?: number;
  /** Weighting rule for aggregation. Default 'full' (skill × stake). */
  weightingMode?: WeightingMode;
}

export interface AgentState {
  accountId: number;
  L: number;   // EWMA loss
  sigma: number;
  wealth: number;
}

export interface AgentAction {
  accountId: number;
  participate: boolean;
  report: number | null;
  deposit: number;
}

export interface StepOutputs {
  // Step 1: pre-round (input)
  L_prev: number[];
  sigma_t: number[];
  wealth: number[];
  // Step 2: actions (input)
  reports: number[];
  deposits: number[];
  alpha: number[]; // 1 = absent
  // Step 3: outcome (input)
  y_t: number;
  // Step 4: scores and effective wager
  losses: number[];
  scores: number[];
  m: number[];
  // Step 5: aggregation
  m_agg: number[];
  r_hat: number;
  // Step 6: settlement
  skill_payoff: number[];
  profit: number[];
  // Step 7: wealth update
  wealth_new: number[];
  // Step 8: skill update
  L_new: number[];
  sigma_new: number[];
}

function maeLoss(y: number, r: number): number {
  return Math.abs(r - y);
}

function scoreMae(y: number, r: number): number {
  return 1 - Math.abs(y - r);
}

function lossToSkill(L: number, sigmaMin: number, gamma: number): number {
  const s = sigmaMin + (1 - sigmaMin) * Math.exp(-gamma * L);
  return Math.max(sigmaMin, Math.min(1, s));
}

function updateEwmaLoss(
  L_prev: number,
  loss: number,
  alpha: number,
  rho: number,
  kappa: number = 0,
  L0: number = 0
): number {
  if (alpha === 0) return (1 - rho) * L_prev + rho * loss;
  if (kappa !== 0) return (1 - kappa) * L_prev + kappa * L0;
  return L_prev;
}

/** Run one round and return all step outputs. */
export function runRound(
  state: AgentState[],
  actions: AgentAction[],
  y_t: number,
  params: MechanismParams
): StepOutputs {
  const L_prev = state.map(s => s.L);
  const wealth = state.map(s => s.wealth);
  const sigma_t = L_prev.map(L => lossToSkill(L, params.sigma_min, params.gamma));
  const reports = actions.map(a => (a.participate && a.report != null ? a.report : 0));
  const deposits = actions.map(a => (a.participate ? a.deposit : 0));
  const alpha = actions.map(a => (a.participate ? 0 : 1));

  const losses = actions.map((a) =>
    a.participate && a.report != null ? maeLoss(y_t, a.report) : 0
  );
  const scores = actions.map((a) =>
    a.participate && a.report != null ? scoreMae(y_t, a.report) : 0
  );

  const g = sigma_t.map(s =>
    params.lam + (1 - params.lam) * Math.pow(Math.max(0, Math.min(1, s)), params.eta ?? 1)
  );
  const mode = params.weightingMode ?? 'full';
  let m: number[];
  if (mode === 'uniform') {
    m = alpha.map((a) => (a === 0 ? 1 : 0));
  } else if (mode === 'deposit') {
    m = deposits.map((b, i) => (alpha[i] === 0 ? b : 0));
  } else if (mode === 'skill') {
    m = g.map((gi, i) => (alpha[i] === 0 ? gi : 0));
  } else {
    m = deposits.map((b, i) => (alpha[i] === 1 ? 0 : b * g[i]));
  }

  const M = m.reduce((a, b) => a + b, 0);
  const s_bar = M > EPS ? m.reduce((sum, mi, i) => sum + mi * scores[i], 0) / M : 0;
  const skill_payoff = M > EPS ? m.map((mi, idx) => mi * (1 + Math.max(0, Math.min(1, scores[idx])) - s_bar)) : m.map(() => 0);
  const profit = skill_payoff.map((pi, idx) => pi - m[idx]);
  const refund = deposits.map((d, idx) => Math.max(0, d - m[idx]));
  const wealth_new = wealth.map((w, idx) => Math.max(0, w - deposits[idx] + skill_payoff[idx] + refund[idx]));

  const kappa = params.kappa ?? 0;
  const L0 = params.L0 ?? 0;
  const L_new = state.map((_, i) =>
    updateEwmaLoss(L_prev[i], losses[i], alpha[i], params.rho, kappa, L0)
  );
  const sigma_new = L_new.map(L => lossToSkill(L, params.sigma_min, params.gamma));

  const m_agg = m.slice();
  const r_hat = M > EPS
    ? m.reduce((sum, mi, i) => sum + (mi / M) * (alpha[i] === 0 ? reports[i] : 0), 0)
    : 0;

  return {
    L_prev,
    sigma_t,
    wealth,
    reports,
    deposits,
    alpha,
    y_t,
    losses,
    scores,
    m,
    m_agg,
    r_hat,
    skill_payoff,
    profit,
    wealth_new,
    L_new,
    sigma_new,
  };
}

/** Build initial state and fixed deposits for demo (all participate, deposit=1). */
export function buildInitialStateAndActions(
  n: number,
  depositPerAgent: number = 1
): { state: AgentState[]; actionsTemplate: (reports: number[]) => AgentAction[] } {
  const state: AgentState[] = Array.from({ length: n }, (_, i) => ({
    accountId: i,
    L: 0.5,
    sigma: 0.5,
    wealth: 0,
  }));
  const actionsTemplate = (reports: number[]): AgentAction[] =>
    reports.map((r, i) => ({
      accountId: i,
      participate: true,
      report: r,
      deposit: depositPerAgent,
    }));
  return { state, actionsTemplate };
}

/** Run mechanism from round 0 through round (t-1); return state at start of round t. */
export function stateAfterRounds(
  initialState: AgentState[],
  roundsData: { y: number; reports: number[] }[],
  params: MechanismParams,
  depositPerAgent: number,
  upToRound: number
): AgentState[] {
  let state = initialState.map(s => ({ ...s }));
  const actionsTemplate = (reports: number[]): AgentAction[] =>
    reports.map((r, i) => ({
      accountId: i,
      participate: true,
      report: r,
      deposit: depositPerAgent,
    }));
  for (let t = 0; t < upToRound && t < roundsData.length; t++) {
    const { y, reports } = roundsData[t];
    const actions = actionsTemplate(reports);
    const out = runRound(state, actions, y, params);
    state = out.wealth_new.map((wealth, i) => ({
      accountId: i,
      L: out.L_new[i],
      sigma: out.sigma_new[i],
      wealth,
    }));
  }
  return state;
}
