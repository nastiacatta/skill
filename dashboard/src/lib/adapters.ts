import Papa from 'papaparse';
import type {
  ExperimentMeta,
  RunSummary,
  SkillWagerPoint,
  ForecastSeriesPoint,
  CalibrationPoint,
  BehaviourScenario,
  SweepPoint,
  RoundSeries,
  FixedDepositPoint,
  PreferenceStressRow,
  IntermittencyStressRow,
  ArbitrageScanRow,
  DetectionAdaptationRow,
  CollusionStressRow,
  InsiderAdvantageRow,
  WashActivityRow,
  StrategicReportingRow,
  IdentityAttackRow,
  DriftAdaptationRow,
  StakePolicyRow,
  SybilArbitrageRow,
  ArbitrageCrowdSizeRow,
  InformedCollusionRow,
  ReputationResetRow,
  DetectionMetricsRow,
  MasterComparisonRow,
  BankrollAblationRow,
  WeightRecoveryRow,
} from './types';
import type { FailureMode, AnalysisGap, EnrichedThesisClaim, AblationInterpretation, RegimeStats, InteractionAnalysis, PanelSweepResult } from './analysis/types';

type RawRow = Record<string, unknown>;

async function fetchCSV<T extends RawRow>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) {
    const msg = `Failed to fetch ${url}: ${res.status}`;
    if (import.meta.env.DEV) console.error(msg);
    throw new Error(msg);
  }
  const text = await res.text();
  const parsed = Papa.parse<T>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return parsed.data ?? [];
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const msg = `Failed to fetch ${url}: ${res.status}`;
    if (import.meta.env.DEV) console.error(msg);
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

function expPath(exp: Pick<ExperimentMeta, 'block' | 'name'>): string {
  // All experiment data lives under experiments 2/ (canonical location)
  return `${DATA_BASE}/experiments%202/${exp.name}`;
}

function dataFile(exp: ExperimentMeta, key: string, fallback: string): string {
  return exp.dataFiles?.[key] ?? fallback;
}

export async function loadExperimentList(): Promise<ExperimentMeta[]> {
  const index = await fetchJSON<ExperimentMeta[]>(`${DATA_BASE}/index.json`);
  return index ?? [];
}

export async function loadSummary(exp: ExperimentMeta): Promise<RunSummary | null> {
  const raw = await fetchJSON<{
    experiment_name: string;
    headline_results: Record<string, unknown>;
  }>(`${expPath(exp)}/summary.json`);

  if (!raw) return null;

  return {
    experimentName: raw.experiment_name,
    finalCRPS: Number(raw.headline_results?.final_crps ?? NaN),
    finalGini: Number(raw.headline_results?.final_gini ?? NaN),
    finalNEff: Number(
      raw.headline_results?.final_n_eff ?? raw.headline_results?.mean_N_eff ?? NaN,
    ),
    meanHHI: Number(raw.headline_results?.mean_HHI ?? NaN),
    meanNt: Number(raw.headline_results?.mean_N_t ?? NaN),
    finalRuinRate: Number(raw.headline_results?.final_ruin_rate ?? NaN),
    headlineResults: raw.headline_results ?? {},
  };
}

export async function loadSkillWagerData(
  exp: ExperimentMeta,
  file = 'timeseries.csv',
): Promise<SkillWagerPoint[]> {
  const raw = await fetchCSV<{
    agent: number;
    t: number;
    wager: number;
    sigma: number;
    m_over_b: number | null;
    profit: number;
    cum_profit: number;
    missing: number;
  }>(`${expPath(exp)}/data/${file}`);

  return raw.map((r) => ({
    agent: Number(r.agent),
    t: Number(r.t),
    wager: Number(r.wager ?? 0),
    sigma: Number(r.sigma),
    mOverB: r.m_over_b == null ? null : Number(r.m_over_b),
    profit: Number(r.profit ?? 0),
    cumProfit: Number(r.cum_profit ?? 0),
    missing: Number(r.missing ?? 0) === 1,
  }));
}

export async function loadForecastSeries(
  exp: ExperimentMeta,
  file = 'crps_timeseries.csv',
): Promise<ForecastSeriesPoint[]> {
  const raw = await fetchCSV<{
    t: number;
    crps_uniform: number;
    crps_uniform_cum: number;
    crps_deposit: number;
    crps_deposit_cum: number;
    crps_skill: number;
    crps_skill_cum: number;
    crps_mechanism: number;
    crps_mechanism_cum: number;
    crps_best_single: number;
    crps_best_single_cum: number;
  }>(`${expPath(exp)}/data/${file}`);

  return raw.map((r) => ({
    t: Number(r.t),
    crpsUniform: Number(r.crps_uniform),
    crpsDeposit: Number(r.crps_deposit),
    crpsSkill: Number(r.crps_skill),
    crpsMechanism: Number(r.crps_mechanism),
    crpsBestSingle: Number(r.crps_best_single),
    crpsUniformCum: Number(r.crps_uniform_cum),
    crpsDepositCum: Number(r.crps_deposit_cum),
    crpsSkillCum: Number(r.crps_skill_cum),
    crpsMechanismCum: Number(r.crps_mechanism_cum),
    crpsBestSingleCum: Number(r.crps_best_single_cum),
  }));
}

export async function loadCalibration(exp: ExperimentMeta): Promise<CalibrationPoint[]> {
  const raw = await fetchCSV<{
    tau: number;
    p_hat: number;
    n_valid: number;
  }>(`${expPath(exp)}/data/${dataFile(exp, 'reliability', 'reliability.csv')}`);

  return raw.map((r) => ({
    tau: Number(r.tau),
    pHat: Number(r.p_hat),
    nValid: Number(r.n_valid),
  }));
}

/** Load Method 1 endogenous weight recovery table (target vs learned). */
export async function loadWeightRecoveryMethod1(): Promise<WeightRecoveryRow[]> {
  const raw = await fetchCSV<{
    forecaster: number;
    w_target: number;
    w_learned: number;
    abs_error: number;
  }>(`${DATA_BASE}/experiments%202/weight_learning_comparison/data/aggregation_weights.csv`);

  return raw.map((r) => ({
    forecaster: Number(r.forecaster),
    wTarget: Number(r.w_target),
    wLearned: Number(r.w_learned),
    absError: Number(r.abs_error),
  }));
}

export async function loadBehaviourMatrix(exp: ExperimentMeta): Promise<BehaviourScenario[]> {
  const raw = await fetchCSV<{
    scenario: string;
    total_profit: number;
    mean_round_profit: number;
    final_gini: number;
    final_n_eff: number;
  }>(`${expPath(exp)}/data/${dataFile(exp, 'behaviour_matrix', 'behaviour_matrix.csv')}`);

  return raw.map((r) => ({
    scenario: String(r.scenario),
    totalProfit: Number(r.total_profit),
    meanRoundProfit: Number(r.mean_round_profit),
    finalGini: Number(r.final_gini),
    finalNEff: Number(r.final_n_eff),
  }));
}

export async function loadPreferenceStress(
  exp: ExperimentMeta,
): Promise<PreferenceStressRow[]> {
  const raw = await fetchCSV<{
    scenario: string;
    total_profit: number;
    mean_profit: number;
    final_gini: number;
  }>(`${expPath(exp)}/data/${dataFile(exp, 'preference_stress', 'preference_stress.csv')}`);

  return raw.map((r) => ({
    scenario: String(r.scenario),
    totalProfit: Number(r.total_profit),
    meanProfit: Number(r.mean_profit),
    finalGini: Number(r.final_gini),
  }));
}

export async function loadIntermittencyStress(
  exp: ExperimentMeta,
): Promise<IntermittencyStressRow[]> {
  const raw = await fetchCSV<{
    mode: string;
    total_profit: number;
    participation_rate: number;
    final_n_eff: number;
  }>(
    `${expPath(exp)}/data/${dataFile(exp, 'intermittency_stress', 'intermittency_stress.csv')}`,
  );

  return raw.map((r) => ({
    mode: String(r.mode),
    totalProfit: Number(r.total_profit),
    participationRate: Number(r.participation_rate),
    finalNEff: Number(r.final_n_eff),
  }));
}

export async function loadArbitrageScan(
  exp: ExperimentMeta,
): Promise<ArbitrageScanRow[]> {
  // Prefer the aggregated-by-lam summary if available (multi-seed runs);
  // fall back to the per-seed/per-lam flat file for single-seed runs.
  try {
    const summary = await fetchCSV<{
      lam: number;
      mean_profit: number;
      mean_final_wealth: number;
      mean_found_rounds: number;
      mean_participation_rounds?: number;
      se_profit?: number;
      ci_low?: number;
      ci_high?: number;
    }>(`${expPath(exp)}/data/${dataFile(exp, 'arbitrage_scan', 'arbitrage_scan_by_lam.csv')}`);
    if (summary.length > 0) {
      return summary.map((r) => ({
        lam: Number(r.lam),
        arbTotalProfit: Number(r.mean_profit),
        arbFinalWealth: Number(r.mean_final_wealth),
        arbitrageFoundRounds: Number(r.mean_found_rounds),
        participationRounds:
          r.mean_participation_rounds != null
            ? Number(r.mean_participation_rounds)
            : undefined,
      }));
    }
  } catch {
    // Fall through to the per-seed CSV below.
  }

  const raw = await fetchCSV<{
    lam: number;
    arb_total_profit: number;
    arb_final_wealth: number;
    arbitrage_found_rounds: number;
    participation_rounds?: number;
  }>(`${expPath(exp)}/data/${dataFile(exp, 'arbitrage_scan', 'arbitrage_scan.csv')}`);

  // Group per-seed rows into per-lam means (works for both single- and
  // multi-seed flat files).
  const byLam: Map<number, { profits: number[]; wealths: number[]; founds: number[]; parts: number[] }> = new Map();
  for (const r of raw) {
    const lam = Number(r.lam);
    const entry = byLam.get(lam) ?? { profits: [], wealths: [], founds: [], parts: [] };
    entry.profits.push(Number(r.arb_total_profit));
    entry.wealths.push(Number(r.arb_final_wealth));
    entry.founds.push(Number(r.arbitrage_found_rounds));
    if (r.participation_rounds != null) entry.parts.push(Number(r.participation_rounds));
    byLam.set(lam, entry);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return [...byLam.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lam, e]) => ({
      lam,
      arbTotalProfit: mean(e.profits),
      arbFinalWealth: mean(e.wealths),
      arbitrageFoundRounds: mean(e.founds),
      participationRounds: e.parts.length ? mean(e.parts) : undefined,
    }));
}

export async function loadDetectionAdaptation(
  exp: ExperimentMeta,
): Promise<DetectionAdaptationRow[]> {
  const raw = await fetchCSV<{
    attacker: string;
    total_profit: number;
    final_wealth: number;
    detector_mean_score?: number;
    detector_flag_rate?: number;
    detector_eval_rounds?: number;
  }>(
    `${expPath(exp)}/data/${dataFile(
      exp,
      'detection_adaptation',
      'detection_adaptation.csv',
    )}`,
  );

  return raw.map((r) => ({
    attacker: String(r.attacker),
    totalProfit: Number(r.total_profit),
    finalWealth: Number(r.final_wealth),
    detectorMeanScore: r.detector_mean_score != null ? Number(r.detector_mean_score) : undefined,
    detectorFlagRate: r.detector_flag_rate != null ? Number(r.detector_flag_rate) : undefined,
    detectorEvalRounds: r.detector_eval_rounds != null ? Number(r.detector_eval_rounds) : undefined,
  }));
}

export async function loadSweepData(exp: ExperimentMeta): Promise<SweepPoint[]> {
  const raw = await fetchCSV<{
    lam: number;
    sigma_min: number;
    mean_crps: number;
    gini: number;
    frac_meaningful: number;
  }>(`${expPath(exp)}/data/${dataFile(exp, 'sweep', 'sweep.csv')}`);

  return raw.map((r) => ({
    lam: Number(r.lam),
    sigmaMin: Number(r.sigma_min),
    meanCrps: Number(r.mean_crps),
    gini: Number(r.gini),
    fracMeaningful: Number(r.frac_meaningful),
  }));
}

export async function loadSettlementSeries(exp: ExperimentMeta): Promise<RoundSeries[]> {
  const raw = await fetchCSV<{
    round: number;
    budget_gap: number;
    min_payout_active: number;
  }>(`${expPath(exp)}/data/${dataFile(exp, 'series', 'series.csv')}`);

  return raw.map((r) => ({
    round: Number(r.round),
    budgetGap: Number(r.budget_gap),
    minPayoutActive: Number(r.min_payout_active),
  }));
}

export async function loadFixedDeposit(
  exp: ExperimentMeta,
): Promise<FixedDepositPoint[]> {
  const raw = await fetchCSV<{
    agent: number;
    t: number;
    sigma: number;
    wager: number;
    m_over_b: number;
  }>(`${expPath(exp)}/data/${dataFile(exp, 'timeseries', 'timeseries.csv')}`);

  return raw.map((r) => ({
    agent: Number(r.agent),
    t: Number(r.t),
    sigma: Number(r.sigma),
    wager: Number(r.wager),
    mOverB: Number(r.m_over_b),
  }));
}

export async function loadCollusionStress(exp: ExperimentMeta): Promise<CollusionStressRow[]> {
  // Prefer per-scenario summary produced by multi-seed runs.
  try {
    const summary = await fetchCSV<{
      scenario: string;
      mean_coalition_profit: number;
      se_coalition_profit?: number;
      mean_final_gini: number;
    }>(
      `${expPath(exp)}/data/${dataFile(exp, 'collusion_stress', 'collusion_stress_summary.csv')}`,
    );
    if (summary.length > 0) {
      return summary.map((r) => ({
        scenario: String(r.scenario),
        totalProfit: Number(r.mean_coalition_profit),
        meanProfit: Number(r.mean_coalition_profit),
        finalGini: Number(r.mean_final_gini),
        participationRate: 0,
      }));
    }
  } catch {
    // Fall through.
  }

  const raw = await fetchCSV<{
    scenario: string;
    total_profit?: number;
    coalition_profit?: number;
    mean_profit: number;
    final_gini: number;
    participation_rate: number;
  }>(
    `${expPath(exp)}/data/${dataFile(exp, 'collusion_stress', 'collusion_stress.csv')}`,
  );
  // Group by scenario for per-seed flat file.
  const byScenario = new Map<string, { profits: number[]; coalition: number[]; gini: number[]; part: number[] }>();
  for (const r of raw) {
    const key = String(r.scenario);
    const entry = byScenario.get(key) ?? { profits: [], coalition: [], gini: [], part: [] };
    entry.profits.push(Number(r.total_profit ?? r.coalition_profit ?? 0));
    if (r.coalition_profit != null) entry.coalition.push(Number(r.coalition_profit));
    entry.gini.push(Number(r.final_gini));
    entry.part.push(Number(r.participation_rate));
    byScenario.set(key, entry);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return [...byScenario.entries()].map(([scenario, e]) => ({
    scenario,
    totalProfit: e.coalition.length ? mean(e.coalition) : mean(e.profits),
    meanProfit: mean(e.profits),
    finalGini: mean(e.gini),
    participationRate: mean(e.part),
  }));
}

export async function loadInsiderAdvantage(exp: ExperimentMeta): Promise<InsiderAdvantageRow[]> {
  try {
    const summary = await fetchCSV<{
      scenario: string;
      mean_insider_profit: number;
    }>(
      `${expPath(exp)}/data/${dataFile(exp, 'insider_advantage', 'insider_advantage_summary.csv')}`,
    );
    if (summary.length > 0) {
      return summary.map((r) => ({
        scenario: String(r.scenario),
        insiderProfit: Number(r.mean_insider_profit),
        finalGini: 0,
      }));
    }
  } catch {
    // Fall through.
  }
  const raw = await fetchCSV<{ scenario: string; insider_profit: number; final_gini: number }>(
    `${expPath(exp)}/data/${dataFile(exp, 'insider_advantage', 'insider_advantage.csv')}`,
  );
  const byScenario = new Map<string, { profits: number[]; gini: number[] }>();
  for (const r of raw) {
    const key = String(r.scenario);
    const entry = byScenario.get(key) ?? { profits: [], gini: [] };
    entry.profits.push(Number(r.insider_profit));
    entry.gini.push(Number(r.final_gini));
    byScenario.set(key, entry);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return [...byScenario.entries()].map(([scenario, e]) => ({
    scenario,
    insiderProfit: mean(e.profits),
    finalGini: mean(e.gini),
  }));
}

export async function loadWashActivity(exp: ExperimentMeta): Promise<WashActivityRow[]> {
  try {
    const summary = await fetchCSV<{
      scenario: string;
      mean_inflation_rate: number;
    }>(
      `${expPath(exp)}/data/${dataFile(exp, 'wash_activity_gaming', 'wash_activity_gaming_summary.csv')}`,
    );
    if (summary.length > 0) {
      // inflation_rate is relative; multiply by a nominal baseline (1000) so
      // downstream components that expect total_activity have a sensible
      // absolute number. Dashboard components should prefer the summary row.
      return summary.map((r) => ({
        scenario: String(r.scenario),
        totalActivity: Math.round(Number(r.mean_inflation_rate) * 1000),
        nRounds: 1000,
      }));
    }
  } catch {
    // Fall through.
  }
  const raw = await fetchCSV<{ scenario: string; total_activity: number; n_rounds: number }>(
    `${expPath(exp)}/data/${dataFile(exp, 'wash_activity_gaming', 'wash_activity_gaming.csv')}`,
  );
  const byScenario = new Map<string, { act: number[]; rounds: number[] }>();
  for (const r of raw) {
    const key = String(r.scenario);
    const entry = byScenario.get(key) ?? { act: [], rounds: [] };
    entry.act.push(Number(r.total_activity));
    entry.rounds.push(Number(r.n_rounds));
    byScenario.set(key, entry);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return [...byScenario.entries()].map(([scenario, e]) => ({
    scenario,
    totalActivity: mean(e.act),
    nRounds: mean(e.rounds),
  }));
}

export async function loadStrategicReporting(exp: ExperimentMeta): Promise<StrategicReportingRow[]> {
  try {
    const summary = await fetchCSV<{
      scenario: string;
      mean_agg_error: number;
    }>(
      `${expPath(exp)}/data/${dataFile(exp, 'strategic_reporting', 'strategic_reporting_summary.csv')}`,
    );
    if (summary.length > 0) {
      return summary.map((r) => ({
        scenario: String(r.scenario),
        meanAggError: Number(r.mean_agg_error),
        finalGini: 0,
      }));
    }
  } catch {
    // Fall through.
  }
  const raw = await fetchCSV<{ scenario: string; mean_agg_error: number; final_gini?: number }>(
    `${expPath(exp)}/data/${dataFile(exp, 'strategic_reporting', 'strategic_reporting.csv')}`,
  );
  const byScenario = new Map<string, { err: number[]; gini: number[] }>();
  for (const r of raw) {
    const key = String(r.scenario);
    const entry = byScenario.get(key) ?? { err: [], gini: [] };
    entry.err.push(Number(r.mean_agg_error));
    if (r.final_gini != null) entry.gini.push(Number(r.final_gini));
    byScenario.set(key, entry);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return [...byScenario.entries()].map(([scenario, e]) => ({
    scenario,
    meanAggError: mean(e.err),
    finalGini: e.gini.length ? mean(e.gini) : 0,
  }));
}

export async function loadIdentityAttack(exp: ExperimentMeta): Promise<IdentityAttackRow[]> {
  const raw = await fetchCSV<{ identity: string; total_profit: number; final_n_eff: number; final_gini: number }>(
    `${expPath(exp)}/data/${dataFile(exp, 'identity_attack_matrix', 'identity_attack_matrix.csv')}`,
  );
  return raw.map((r) => ({
    identity: String(r.identity),
    totalProfit: Number(r.total_profit),
    finalNEff: Number(r.final_n_eff),
    finalGini: Number(r.final_gini),
  }));
}

export async function loadDriftAdaptation(exp: ExperimentMeta): Promise<DriftAdaptationRow[]> {
  const raw = await fetchCSV<{ belief: string; mean_mae: number; final_gini: number }>(
    `${expPath(exp)}/data/${dataFile(exp, 'drift_adaptation', 'drift_adaptation.csv')}`,
  );
  return raw.map((r) => ({
    belief: String(r.belief),
    meanMae: Number(r.mean_mae),
    finalGini: Number(r.final_gini),
  }));
}

export async function loadStakePolicy(exp: ExperimentMeta): Promise<StakePolicyRow[]> {
  const raw = await fetchCSV<{ staking: string; total_profit: number; mean_deposit: number; final_gini: number }>(
    `${expPath(exp)}/data/${dataFile(exp, 'stake_policy_matrix', 'stake_policy_matrix.csv')}`,
  );
  return raw.map((r) => ({
    staking: String(r.staking),
    totalProfit: Number(r.total_profit),
    meanDeposit: Number(r.mean_deposit),
    finalGini: Number(r.final_gini),
  }));
}

export async function loadDetectionMetrics(exp: ExperimentMeta): Promise<DetectionMetricsRow[]> {
  const raw = await fetchCSV<{ detector: string; score: number }>(
    `${expPath(exp)}/data/${dataFile(exp, 'detection_metrics', 'detection_metrics.csv')}`,
  );
  return raw.map((r) => ({
    detector: String(r.detector),
    score: Number(r.score),
  }));
}

// ---------------------------------------------------------------------------
// Theory-grounded adversary adapters (multi-seed summaries with 95% CIs)
// ---------------------------------------------------------------------------

export async function loadSybilArbitrage(exp: ExperimentMeta): Promise<SybilArbitrageRow[]> {
  const raw = await fetchCSV<{
    k: number;
    mean_profit: number;
    se_profit: number;
    ci_low: number;
    ci_high: number;
    mean_n_eff: number;
    se_n_eff: number;
    n_seeds: number;
  }>(
    `${expPath(exp)}/data/${dataFile(exp, 'sybil_arbitrage', 'sybil_arbitrage_summary.csv')}`,
  );
  return raw.map((r) => ({
    k: Number(r.k),
    meanProfit: Number(r.mean_profit),
    seProfit: Number(r.se_profit),
    ciLow: Number(r.ci_low),
    ciHigh: Number(r.ci_high),
    meanNEff: Number(r.mean_n_eff),
    seNEff: Number(r.se_n_eff),
    nSeeds: Number(r.n_seeds),
  }));
}

export async function loadArbitrageCrowdSize(exp: ExperimentMeta): Promise<ArbitrageCrowdSizeRow[]> {
  const raw = await fetchCSV<{
    lam: number;
    n_benign: number;
    mean_profit: number;
    se_profit: number;
    ci_low: number;
    ci_high: number;
    n_seeds: number;
  }>(
    `${expPath(exp)}/data/${dataFile(exp, 'arbitrage_crowd_size', 'arbitrage_crowd_size_summary.csv')}`,
  );
  return raw.map((r) => ({
    lam: Number(r.lam),
    nBenign: Number(r.n_benign),
    meanProfit: Number(r.mean_profit),
    seProfit: Number(r.se_profit),
    ciLow: Number(r.ci_low),
    ciHigh: Number(r.ci_high),
    nSeeds: Number(r.n_seeds),
  }));
}

export async function loadInformedCollusion(exp: ExperimentMeta): Promise<InformedCollusionRow[]> {
  const raw = await fetchCSV<{
    scenario: string;
    mean_coalition_profit: number;
    se_coalition_profit: number;
    ci_low: number;
    ci_high: number;
    n_seeds: number;
  }>(
    `${expPath(exp)}/data/${dataFile(exp, 'informed_collusion', 'informed_collusion_summary.csv')}`,
  );
  return raw.map((r) => ({
    scenario: String(r.scenario),
    meanCoalitionProfit: Number(r.mean_coalition_profit),
    seCoalitionProfit: Number(r.se_coalition_profit),
    ciLow: Number(r.ci_low),
    ciHigh: Number(r.ci_high),
    nSeeds: Number(r.n_seeds),
  }));
}

export async function loadReputationReset(exp: ExperimentMeta): Promise<ReputationResetRow[]> {
  const raw = await fetchCSV<{
    scenario: string;
    mean_attacker_profit: number;
    se_attacker_profit: number;
    ci_low: number;
    ci_high: number;
    mean_n_resets: number;
    n_seeds: number;
  }>(
    `${expPath(exp)}/data/${dataFile(exp, 'reputation_reset', 'reputation_reset_summary.csv')}`,
  );
  return raw.map((r) => ({
    scenario: String(r.scenario),
    meanAttackerProfit: Number(r.mean_attacker_profit),
    seAttackerProfit: Number(r.se_attacker_profit),
    ciLow: Number(r.ci_low),
    ciHigh: Number(r.ci_high),
    meanNResets: Number(r.mean_n_resets),
    nSeeds: Number(r.n_seeds),
  }));
}

/** Load master comparison (all methods on same panel, paired deltas). */
export async function loadMasterComparison(): Promise<{
  config: { T: number; n_forecasters: number; seeds: number[]; warm_start?: number };
  rows: MasterComparisonRow[];
} | null> {
  const url = `${expPath({ block: 'core', name: 'master_comparison' })}/data/master_comparison.json`;

  try {
    const raw = await fetchJSON<{ config: unknown; rows: MasterComparisonRow[] }>(url);
    if (raw?.rows?.length) {
      return {
        config: raw.config as { T: number; n_forecasters: number; seeds: number[]; warm_start?: number },
        rows: raw.rows,
      };
    }
  } catch {
    // Data not available.
  }

  return null;
}

/** Load bankroll ablation (Full vs A-, B-, C-, D-, E-). */
export async function loadBankrollAblation(): Promise<{ config: unknown; rows: BankrollAblationRow[] } | null> {
  try {
    const raw = await fetchJSON<{ experiment_name: string; config: unknown; rows: BankrollAblationRow[] }>(
      `${expPath({ block: 'core', name: 'bankroll_ablation' })}/data/summary.json`,
    );
    if (!raw?.rows?.length) return null;
    return { config: raw.config, rows: raw.rows };
  } catch {
    return null;
  }
}

/** Real-data comparison result (e.g., Elia wind). */
export interface RealDataResult {
  config: {
    T: number;
    n_forecasters: number;
    warmup: number;
    series_name: string;
    forecasters: string[];
    // Mechanism parameters (present in comparison.json since the runner
    // emits them). Optional on the type because earlier exports may
    // predate this field.
    gamma?: number;
    rho?: number;
    lam?: number;
    series_min?: number;
    series_max?: number;
  };
  rows: Array<{
    experiment: string;
    method: string;
    seed: number;
    DGP: string;
    preset: string;
    mean_crps: number;
    delta_crps_vs_equal: number;
    // Added in audit pass 1 (C1): 95% stationary circular
    // block-bootstrap CIs on the paired delta vs uniform.
    delta_ci_lower?: number;
    delta_ci_upper?: number;
    delta_bootstrap_se?: number;
  }>;
  per_round: Array<{
    t: number;
    y: number;
    crps_uniform: number;
    crps_skill: number;
    crps_mechanism: number;
    crps_best_single: number;
  }>;
  // Per-agent skill history (downsampled)
  skill_history?: Array<Record<string, number>>;
  // Steady-state skill ranking (sorted by mean_sigma descending)
  steady_state?: Array<{
    forecaster: string;
    index: number;
    mean_sigma: number;
    mean_weight: number;
    mean_score: number | null;
  }>;
  // Forecaster names in order
  forecaster_names?: string[];

  // Diebold-Mariano test results
  dm_test?: {
    statistic: number;
    p_value: number;
    significant_at_001: boolean;
    significant_at_005: boolean;
    comparison: string;
    // Added in audit pass 1 (B1): Andrews (1991) data-driven HAC bandwidth
    // is the new default. The legacy horizon-1 statistic is preserved
    // under statistic_legacy_horizon1 for back-compat diff.
    hac_lag?: number;
    hac_bandwidth_mode?: string;
    statistic_legacy_horizon1?: number;
    // Added in audit pass 6 (D2): merged from ``audit_post_hoc.json``
    // when available. These are the Andrews-auto-HAC Diebold-Mariano
    // statistic and its p-value for the paired Δ CRPS vs uniform, with
    // hac_lag selected by Andrews (1991). See ``RealDataAuditPostHoc``.
    statistic_auto_hac?: number;
    p_value_auto_hac?: number;
  };
  dm_test_skill?: {
    statistic: number;
    p_value: number;
    significant_at_001: boolean;
    significant_at_005: boolean;
    comparison: string;
    hac_lag?: number;
    hac_bandwidth_mode?: string;
    statistic_legacy_horizon1?: number;
  };
  // Per-agent CRPS over time (downsampled ~600 points)
  per_agent_crps?: Array<Record<string, number>>;
  // Rolling window improvement (mechanism vs uniform, ~200 points)
  rolling_improvement?: Array<{
    t_start: number;
    t_end: number;
    pct_improvement: number;
  }>;
  // Sensitivity analysis
  sensitivity?: {
    default_params: Record<string, number>;
    optimal_params: Record<string, number>;
    optimal_improvement_pct: number;
    default_improvement_pct: number;
  };
  // Aggregate calibration (PIT coverage)
  calibration?: Array<{
    tau: number;
    nominal: number;
    empirical: number;
    gap: number;
  }>;
  // Train/test split validation
  train_test_split?: {
    train_rounds: number;
    test_rounds: number;
    methods: Record<string, {
      train_crps: number;
      test_crps: number;
      train_delta_vs_uniform: number;
      test_delta_vs_uniform: number;
    }>;
  };
  // Post-hoc audit sidecar (Andrews-auto HAC DM stats and 95% block-
  // bootstrap CIs on the paired Δ CRPS vs uniform). Populated by
  // ``loadRealDataComparison`` when ``audit_post_hoc.json`` is present
  // alongside ``comparison.json``. Audit pass 6 (D1).
  audit_post_hoc?: RealDataAuditPostHoc;
}

export async function loadRealDataComparison(seriesName: string = 'elia_wind'): Promise<RealDataResult | null> {
  try {
    const raw = await fetchJSON<RealDataResult>(
      `${DATA_BASE}/real_data/${seriesName}/data/comparison.json`,
    );
    if (raw?.rows?.length) {
      // Best-effort merge of post-hoc audit stats (Andrews (1991) auto-HAC DM
      // statistic + 95% block-bootstrap CIs on Δ CRPS) when available. The
      // sidecar is produced by the post-fix audit pipeline alongside
      // comparison.json. Audit pass 6 (D1/D2/D3).
      try {
        const posthoc = await loadRealDataAuditPostHoc(seriesName);
        if (posthoc) {
          const mech = posthoc.rules.mechanism;
          if (mech) {
            raw.audit_post_hoc = posthoc;
            // Augment the DM badge with the Andrews stat so existing
            // renderers can show "p < 0.001 ***" based on the more
            // conservative statistic without changing their shape.
            if (raw.dm_test && mech.dm_uniform_vs_method_auto_hac) {
              raw.dm_test.hac_lag = mech.dm_uniform_vs_method_auto_hac.hac_lag;
              raw.dm_test.hac_bandwidth_mode = mech.dm_uniform_vs_method_auto_hac.hac_mode;
              raw.dm_test.statistic_auto_hac = mech.dm_uniform_vs_method_auto_hac.statistic;
              raw.dm_test.p_value_auto_hac = mech.dm_uniform_vs_method_auto_hac.p_value;
            }
          }
        }
      } catch {
        // Sidecar absent is not an error — older comparison.json files
        // predate the post-hoc pipeline.
      }
      return raw;
    }
  } catch {
    // Not available.
  }
  return null;
}


/** One rule row in ``audit_post_hoc.json`` (Andrews-auto HAC DM + block-
 *  bootstrap CIs on the paired Δ CRPS vs uniform). Audit pass 6 (D1). */
export interface RealDataAuditPostHocRule {
  n: number;
  mean_crps: number;
  mean_crps_uniform_aligned: number;
  delta_crps_vs_uniform: number;
  dm_uniform_vs_method_auto_hac: {
    statistic: number;
    p_value: number;
    hac_lag: number;
    hac_mode: string;
  };
  dm_uniform_vs_method_legacy_horizon1: {
    statistic: number;
    p_value: number;
    hac_lag: number;
  };
  delta_95pct_bootstrap_ci: {
    lower: number;
    upper: number;
    se: number;
  };
}

/** Shape of ``audit_post_hoc.json`` as written by the post-fix pipeline. */
export interface RealDataAuditPostHoc {
  series_name: string;
  T_eval: number;
  block_size: number;
  rules: Record<string, RealDataAuditPostHocRule>;
}

/** Load the post-hoc audit sidecar for a real-data series. Returns ``null``
 *  when the file is absent (older or bespoke runs). */
export async function loadRealDataAuditPostHoc(
  seriesName: string = 'elia_wind',
): Promise<RealDataAuditPostHoc | null> {
  try {
    const raw = await fetchJSON<RealDataAuditPostHoc>(
      `${DATA_BASE}/real_data/${seriesName}/data/audit_post_hoc.json`,
    );
    if (raw?.rules) return raw;
  } catch {
    // Sidecar absent.
  }
  return null;
}


// ── New adapter functions for analysis data files ───────────────────

/** Load failure_modes.json for the Limitations & Failure Modes panel. */
export async function loadFailureModes(): Promise<FailureMode[]> {
  return fetchJSON<FailureMode[]>(`${DATA_BASE}/failure_modes.json`);
}

/** Load analysis_gaps.json for the Missing Analysis Checklist. */
export async function loadAnalysisGaps(): Promise<AnalysisGap[]> {
  return fetchJSON<AnalysisGap[]>(`${DATA_BASE}/analysis_gaps.json`);
}

/** Load enriched thesis_results.json with conditions, evidence, and limitations. */
export async function loadEnrichedThesisResults(): Promise<EnrichedThesisClaim[]> {
  return fetchJSON<EnrichedThesisClaim[]>(`${DATA_BASE}/thesis_results.json`);
}

/** Load ablation interpretation JSON for the AblationInterpretPanel. */
export async function loadAblationInterpretation(): Promise<AblationInterpretation | null> {
  try {
    return await fetchJSON<AblationInterpretation>(
      `${DATA_BASE}/core/experiments/bankroll_ablation/data/ablation_interpretation.json`,
    );
  } catch {
    return null;
  }
}

/** Load regime breakdown JSON for the RegimeBreakdownTable. */
export async function loadRegimeBreakdown(): Promise<RegimeStats[]> {
  try {
    return await fetchJSON<RegimeStats[]>(
      `${DATA_BASE}/core/experiments/master_comparison/data/regime_breakdown.json`,
    );
  } catch {
    return [];
  }
}

/** Load deposit interaction analysis JSON. */
export async function loadDepositInteraction(): Promise<InteractionAnalysis | null> {
  try {
    return await fetchJSON<InteractionAnalysis>(
      `${DATA_BASE}/core/experiments/deposit_policy_comparison/data/interaction_analysis.json`,
    );
  } catch {
    return null;
  }
}

/** Load panel size sensitivity sweep JSON. */
export async function loadPanelSizeSensitivity(): Promise<PanelSweepResult | null> {
  try {
    return await fetchJSON<PanelSweepResult>(
      `${DATA_BASE}/core/experiments/panel_size_sensitivity/data/panel_sweep.json`,
    );
  } catch {
    return null;
  }
}

/** One row of the weight-rule comparison (Table 5.4 in the thesis).
 *  Each row is one (deposit_policy, weight_rule) cell, averaged over 20 seeds.
 */
export interface WeightRuleComparisonRow {
  depositPolicy: 'fixed_unit' | 'bankroll_conf';
  weightRule: 'uniform' | 'deposit' | 'skill' | 'mechanism' | 'best_single';
  /** Mean CRPS across all rounds, averaged over 20 seeds. */
  meanCrpsAll: number;
  /** Standard error across seeds for meanCrpsAll. */
  seAll: number;
  /** Mean CRPS on warm-start window t > T0 (matches thesis reporting). */
  meanCrpsWarmstart: number;
  /** Standard error for meanCrpsWarmstart. */
  seWs: number;
}

/** Load the canonical weight-rule comparison CSV used in thesis Table 5.4. */
export async function loadWeightRuleComparison(): Promise<WeightRuleComparisonRow[]> {
  const raw = await fetchCSV<{
    deposit_policy: string;
    weight_rule: string;
    mean_crps_all: number;
    se_all: number;
    mean_crps_warmstart: number;
    se_ws: number;
  }>(`${DATA_BASE}/core/experiments/weight_rule_comparison/data/weight_rule_comparison.csv`);
  return raw
    .filter((r) => r.deposit_policy && r.weight_rule)
    .map((r) => ({
      depositPolicy: r.deposit_policy as WeightRuleComparisonRow['depositPolicy'],
      weightRule: r.weight_rule as WeightRuleComparisonRow['weightRule'],
      meanCrpsAll: Number(r.mean_crps_all),
      seAll: Number(r.se_all),
      meanCrpsWarmstart: Number(r.mean_crps_warmstart),
      seWs: Number(r.se_ws),
    }));
}


// ── Audit adapters ─────────────────────────────────────────────────

import type { BaselinesData, DepositSensitivityData } from './audit/auditTypes';

/** Load baselines.json for the Aggregation Accuracy panel (Vitali OGD comparison). */
export async function loadBaselines(seriesName: string = 'elia_wind'): Promise<BaselinesData | null> {
  try {
    const raw = await fetchJSON<BaselinesData>(
      `${DATA_BASE}/real_data/${seriesName}/data/baselines.json`,
    );
    if (raw?.summary?.length) return raw;
  } catch {
    // Not available.
  }
  return null;
}

/** Load deposit_sensitivity.json for the Wager Allocation panel. */
export async function loadDepositSensitivity(seriesName: string = 'elia_wind'): Promise<DepositSensitivityData | null> {
  try {
    const raw = await fetchJSON<DepositSensitivityData>(
      `${DATA_BASE}/real_data/${seriesName}/data/deposit_sensitivity.json`,
    );
    if (raw?.deposit_sensitivity) return raw;
  } catch {
    // Not available.
  }
  return null;
}

/** CAMS PM2.5 headline artefact (schema cams_pm25_experiment.v1). Copied
 *  verbatim from the download probe; the dashboard reads it but never
 *  recomputes it. Only the headline aggregates and the 12-model mean weights
 *  are present (no per-round series, no per-model CRPS). */
export interface CamsHeadlineResult {
  schema_version: string;
  description: string;
  panel: { n_forecasters: number; forecaster_names: string[]; panel_type: string };
  block: { start: string; end: string; n_hours_total: number; n_hours_eval: number; warmup: number };
  params: {
    gamma: number; rho: number; lam: number; eta: number; normalize_mode: string;
    tau_grid: number[]; bootstrap_block_size_hours: number; bootstrap_n_replicates: number;
  };
  results: {
    mean_crps_uniform: number; mean_crps_mechanism: number; mean_crps_median: number;
    mean_crps_ensemble_alone: number; pct_reduction: number;
    dm_t: number; dm_p: number; dm_hac_lag: number;
    bootstrap_ci_lo: number; bootstrap_ci_hi: number;
    herfindahl: number; effective_n: number;
    mean_crps_uniform_ugm3: number; mean_crps_mechanism_ugm3: number;
    pm25_range_lo: number; pm25_range_hi: number;
    mean_weights: Record<string, number>;
  };
}

/** Load the committed CAMS PM2.5 headline artefact. Returns null when the file
 *  is absent so the evidence panel degrades gracefully (renders nothing). */
export async function loadCamsHeadline(): Promise<CamsHeadlineResult | null> {
  try {
    const raw = await fetchJSON<CamsHeadlineResult>(
      `${DATA_BASE}/real_data/cams_pm25/data/cams_headline.json`,
    );
    if (raw?.results) return raw;
  } catch {
    // Not available.
  }
  return null;
}
