import SlideWrapper from './SlideWrapper';

/* ════════════════════════════════════════════════════════════════
   BEHAVIOUR ANALYSIS SLIDES
   
   5 slides covering:
   1. Architecture & Taxonomy — what the mechanism sees, what agents do
   2. Methodology — how experiments are run, what metrics mean, how Δ is computed
   3. Term Glossary & Preset Definitions — every preset explained clearly
   4. Threat Classification — the 18-preset ranking with derivation
   5. Structural Insights & Verdict — what we learned
   ════════════════════════════════════════════════════════════════ */

/* ── Shared data ────────────────────────────────────────────── */

const FAMILIES = [
  { name: 'Participation', desc: 'When and whether agents submit forecasts', example: 'Bursty: agents go offline in waves' },
  { name: 'Information', desc: 'Quality of the private signal each agent receives', example: 'Bias: persistent directional error in reports' },
  { name: 'Reporting', desc: 'How agents transform their belief into a submitted forecast', example: 'Hedging: shrinking reports toward 0.5' },
  { name: 'Staking', desc: 'How agents decide how much wealth to risk each round', example: 'Kelly: deposit proportional to estimated edge' },
  { name: 'Objectives', desc: 'What utility function agents maximise', example: 'CRRA: concave utility reduces staking' },
  { name: 'Identity', desc: 'Whether agents operate one or multiple accounts', example: 'Sybil: one agent splits into two identities' },
  { name: 'Learning', desc: 'How agents adapt their strategy based on past outcomes', example: 'Reinforcement: participate more after profits' },
  { name: 'Adversarial', desc: 'Strategies optimised to exploit the mechanism rules', example: 'Arbitrage: report mean of others for guaranteed payoff' },
  { name: 'Operational', desc: 'Real-world frictions in the submission process', example: 'Latency: partial outcome info leaks into report' },
];

/* ── Slide 1: Architecture & Taxonomy ───────────────────────── */

export function BehaviourArchitectureSlide() {
  return (
    <SlideWrapper>
      <div className="-mx-10 -mt-10 mb-6 h-1.5 rounded-t-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500" />

      <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700">
        Behaviour Analysis
      </span>
      <h2 className="mt-2 text-2xl font-bold text-slate-900">
        Two-Block Architecture
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-3xl">
        The mechanism is split into two independent blocks. Block A (the core) is a deterministic
        state machine that processes only observable actions — it never sees why an agent acts.
        Block B (agent behaviour) generates those actions from hidden attributes. This separation
        means we can test any strategic behaviour without modifying the settlement logic.
      </p>

      {/* Architecture diagram */}
      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <div className="flex-1 rounded-xl border-2 border-violet-300 bg-violet-50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-200 text-xs font-bold text-violet-800">B</span>
            <span className="text-sm font-semibold text-violet-800">Agent Policies</span>
          </div>
          <p className="text-xs text-violet-600 leading-relaxed">
            Each agent is a policy π that maps hidden attributes and platform state to an action.
            Hidden attributes are sampled once per agent and stay fixed across all rounds.
          </p>
          <div className="mt-3 space-y-1">
            {[
              { attr: 'Intrinsic skill', desc: 'signal precision — how noisy the agent\'s private forecast is' },
              { attr: 'CRRA γ', desc: 'risk aversion parameter — higher γ = more cautious staking' },
              { attr: 'Bias', desc: 'persistent directional error added to every report' },
              { attr: 'Budget', desc: 'initial wealth — determines how long the agent can participate' },
              { attr: 'Identity count', desc: '1 = honest single account, >1 = sybil split' },
            ].map(a => (
              <div key={a.attr} className="flex gap-2 text-[10px]">
                <span className="font-semibold text-violet-700 w-24 shrink-0">{a.attr}</span>
                <span className="text-violet-500">{a.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-slate-400 shrink-0">
          <div className="text-[10px] font-medium text-slate-500">Behaviour Contract</div>
          <div className="flex items-center gap-1">
            <span className="text-xs">→</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono">(participate, report, deposit)</span>
            <span className="text-xs">→</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs">←</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono">(wealth, σ, r̂, round)</span>
            <span className="text-xs">←</span>
          </div>
          <div className="text-[10px] font-medium text-slate-500">Platform State</div>
        </div>

        <div className="flex-1 rounded-xl border-2 border-teal-300 bg-teal-50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-200 text-xs font-bold text-teal-800">A</span>
            <span className="text-sm font-semibold text-teal-800">Core Mechanism</span>
          </div>
          <p className="text-xs text-teal-600 leading-relaxed mb-3">
            Five-step deterministic pipeline executed every round:
          </p>
          <div className="space-y-1">
            {[
              { step: '1. Score', formula: 's_i = 1 − CRPS_hat/2', desc: 'proper scoring rule on quantile forecasts' },
              { step: '2. Effective wager', formula: 'm_i = b_i · g(σ_i)', desc: 'deposit modulated by skill gate' },
              { step: '3. Aggregate', formula: 'r̂ = Σ w_i · q_i', desc: 'weighted quantile average, capped at ω_max' },
              { step: '4. Settle', formula: 'π_i = m_i(1 + s_i − s̄)', desc: 'zero-sum payoff based on relative score' },
              { step: '5. Update σ', formula: 'L ← EWMA(L, loss)', desc: 'online skill learning via exponential smoothing' },
            ].map(s => (
              <div key={s.step} className="flex gap-2 text-[10px]">
                <span className="font-semibold text-teal-700 w-28 shrink-0">{s.step}</span>
                <span className="font-mono text-teal-600 w-36 shrink-0">{s.formula}</span>
                <span className="text-teal-500">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 9 Families grid */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">9 Behaviour Families — 46 items total</h3>
        <div className="grid grid-cols-3 gap-2">
          {FAMILIES.map(f => (
            <div key={f.name} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0"
                />
                <span className="text-xs font-semibold text-slate-800">{f.name}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{f.desc}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 italic">{f.example}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}


/* ── Slide 2: Methodology — How We Get the Numbers ──────────── */

export function BehaviourMethodologySlide() {
  return (
    <SlideWrapper>
      <div className="-mx-10 -mt-10 mb-6 h-1.5 rounded-t-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500" />

      <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700">
        Behaviour Analysis
      </span>
      <h2 className="mt-2 text-2xl font-bold text-slate-900">
        Methodology
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-3xl">
        Every number in the threat classification comes from a paired simulation.
        We run the same experiment twice — once with truthful agents (baseline), once with
        the behaviour under test — and measure the difference.
      </p>

      {/* Experiment setup */}
      <div className="mt-6 grid grid-cols-4 gap-3">
        {[
          { label: 'Rounds (T)', value: '300', desc: 'Each simulation runs for 300 sequential rounds' },
          { label: 'Agents (N)', value: '6', desc: 'Panel of 6 forecasters per simulation' },
          { label: 'Seed', value: '42', desc: 'Fixed random seed — results are deterministic and reproducible' },
          { label: 'DGP', value: 'baseline', desc: 'Exogenous truth with noisy private signals per agent' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{m.value}</p>
            <p className="text-[10px] text-slate-400 mt-1">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* How Δ CRPS is computed */}
      <div className="mt-6 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5">
        <h3 className="text-sm font-semibold text-indigo-800 mb-3">How Δ CRPS (%) is computed</h3>
        <div className="space-y-3 text-xs text-indigo-700 leading-relaxed">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold shrink-0">1</span>
            <div>
              <span className="font-semibold">Run baseline:</span> All 6 agents report truthfully with full participation.
              Record mean CRPS over 300 rounds = CRPS<sub>base</sub>.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold shrink-0">2</span>
            <div>
              <span className="font-semibold">Run test:</span> Same seed, same DGP, but one or more agents follow the
              behaviour preset (e.g., agent 0 adds bias). Record mean CRPS = CRPS<sub>test</sub>.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold shrink-0">3</span>
            <div>
              <span className="font-semibold">Compute delta:</span>{' '}
              <span className="font-mono bg-indigo-100 px-1.5 py-0.5 rounded">
                Δ CRPS (%) = (CRPS<sub>test</sub> − CRPS<sub>base</sub>) / CRPS<sub>base</sub> × 100
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold shrink-0">4</span>
            <div>
              <span className="font-semibold">Interpret:</span> Positive Δ = behaviour degrades the aggregate.
              Negative Δ = behaviour improves it. Zero = no effect.
            </div>
          </div>
        </div>
      </div>

      {/* Metric definitions */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Key metrics — definitions</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              name: 'CRPS',
              full: 'Continuous Ranked Probability Score',
              formula: 'CRPS = (2/K) Σ_k pinball(y, q_k, τ_k)',
              meaning: 'Measures how well the full quantile forecast matches the outcome. Lower = better. Computed as the average pinball loss across 5 quantile levels (τ = 0.1, 0.25, 0.5, 0.75, 0.9).',
            },
            {
              name: 'σ (skill estimate)',
              full: 'EWMA-based skill score',
              formula: 'σ = σ_min + (1−σ_min)·exp(−γ·L)',
              meaning: 'Online estimate of agent quality. L is the exponentially weighted moving average of CRPS loss. Low loss → high σ → more weight. Half-life ≈ ln(2)/ρ ≈ 7 rounds with ρ = 0.1.',
            },
            {
              name: 'Gini',
              full: 'Gini coefficient of wealth',
              formula: 'Gini = (2·Σ(i·w_i) − (n+1)·Σw_i) / (n·Σw_i)',
              meaning: 'Measures wealth inequality across agents. 0 = perfectly equal, 1 = one agent holds all wealth. Tracks whether the mechanism creates unfair concentration.',
            },
            {
              name: 'N_eff',
              full: 'Effective number of independent signals',
              formula: 'N_eff = 1 / Σ(w_i²) = 1 / HHI',
              meaning: 'How many agents effectively contribute to the aggregate. If one agent has 50% weight, N_eff ≈ 2 even with 6 agents. Drops when weight concentrates.',
            },
          ].map(m => (
            <div key={m.name} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-bold text-slate-800">{m.name}</span>
                <span className="text-[10px] text-slate-400">{m.full}</span>
              </div>
              <p className="text-[10px] font-mono text-slate-500 bg-slate-50 rounded px-2 py-1 mb-2">{m.formula}</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">{m.meaning}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}


/* ── Slide 3: Preset Glossary — What Each Behaviour Means ───── */

const PRESET_GLOSSARY: Array<{
  name: string;
  family: string;
  familyColor: string;
  definition: string;
  mechanism: string;
  whoIsAffected: string;
}> = [
  {
    name: 'Bursty participation',
    family: 'Participation',
    familyColor: 'bg-sky-100 text-sky-700',
    definition: 'Agents go online and offline in waves rather than participating every round. Participation probability follows a sinusoidal pattern: p = 0.18 + 0.72 × sin(round/3.5), producing clusters of high and low attendance.',
    mechanism: 'Some rounds have 1–2 agents, others have 5–6. The mechanism can\'t aggregate signals that aren\'t submitted. The EWMA freezes σ during absences (no corruption), but fewer agents = worse aggregate.',
    whoIsAffected: 'All 6 agents follow the bursty pattern. Average attendance drops to ~54%.',
  },
  {
    name: 'Reputation gamer',
    family: 'Reporting',
    familyColor: 'bg-violet-100 text-violet-700',
    definition: 'Agent 0 anchors reports to the previous aggregate forecast instead of reporting their true belief. Formula: report = 0.7 × previousAggregate + 0.3 × trueReport. This makes the agent appear accurate (close to consensus) to inflate their skill estimate σ.',
    mechanism: 'The EWMA measures loss relative to the outcome, not relative to the aggregate. But since the aggregate is usually close to truth, anchoring to it produces low measured loss → high σ → more weight. The distortion propagates through all 5 quantile levels.',
    whoIsAffected: 'Agent 0 only. The other 5 agents report truthfully.',
  },
  {
    name: 'Sandbagger',
    family: 'Reporting',
    familyColor: 'bg-violet-100 text-violet-700',
    definition: 'Agent 0 deliberately adds large random noise to their reports: report = trueReport + N(0, 0.2²). This makes the agent appear worse than they are, lowering the mechanism\'s expectation of their quality.',
    mechanism: 'The noise shifts all 5 quantile levels (via qReportShift), degrading the aggregate\'s calibration. The skill layer eventually detects this (σ drops), but the damage to the weighted average is already done each round.',
    whoIsAffected: 'Agent 0 only.',
  },
  {
    name: 'Noisy reporter',
    family: 'Reporting',
    familyColor: 'bg-violet-100 text-violet-700',
    definition: 'Agent 0 adds random noise to truthful reports: report = trueReport + N(0, 0.15²). Unlike sandbagging, this is sloppy rather than strategic — the agent isn\'t trying to game the system, just submitting imprecise forecasts.',
    mechanism: 'Random noise in quantile reports propagates linearly through the weighted average. The skill layer detects the lower signal quality and reduces σ, but the aggregate still suffers from the noisy quantiles.',
    whoIsAffected: 'Agent 0 only.',
  },
  {
    name: 'Systematic bias',
    family: 'Information',
    familyColor: 'bg-blue-100 text-blue-700',
    definition: 'Agent 0 adds a persistent +0.15 shift to every report: report = trueReport + 0.15. This models a forecaster with a consistent directional error (e.g., always overestimating).',
    mechanism: 'The bias shifts all 5 quantile levels upward systematically. Unlike random noise, bias is persistent and directional — the aggregate is consistently pulled in one direction. The EWMA accumulates evidence over multiple rounds to detect this.',
    whoIsAffected: 'Agent 0 only.',
  },
  {
    name: 'Kelly sizing',
    family: 'Staking',
    familyColor: 'bg-teal-100 text-teal-700',
    definition: 'Agents 0–2 size their deposit proportional to their estimated edge, following the Kelly criterion: riskFraction = 0.5 × σ × (1−σ). In gambling theory, the Kelly criterion maximises long-run wealth growth by betting a fraction proportional to your edge.',
    mechanism: 'The function σ×(1−σ) peaks at σ = 0.5, meaning agents with mediocre skill stake the most. This amplifies the weight of mediocre forecasters in the aggregate, degrading accuracy.',
    whoIsAffected: 'Agents 0–2 use Kelly sizing. Agents 3–5 use the default deposit policy.',
  },
  {
    name: 'Miscalibrated',
    family: 'Information',
    familyColor: 'bg-blue-100 text-blue-700',
    definition: 'Agent 0 exaggerates deviations from 0.5: report = 0.5 + (trueReport − 0.5) × 1.8. This models overconfidence — the agent believes their signal is more informative than it actually is, pushing forecasts further from the centre.',
    mechanism: 'Overconfidence distorts the quantile spread. If the true forecast is 0.6, the miscalibrated agent reports 0.68. This widens or narrows the quantile fan depending on direction, degrading CRPS.',
    whoIsAffected: 'Agent 0 only.',
  },
  {
    name: 'Sybil split',
    family: 'Identity',
    familyColor: 'bg-amber-100 text-amber-700',
    definition: 'Agent 0 splits into 2 identities that submit near-identical reports (±0.005 noise) and each deposit half the original amount. This tests whether splitting identity gains an advantage.',
    mechanism: 'Despite the deposit-splitting defence (each clone gets 1/k of total stake), two correlated signals with reduced individual deposits create a different weighting pattern than one agent with full deposit. The clone pair wealth ratio stays ≤ 1.05.',
    whoIsAffected: 'Agents 0–1 are the sybil pair. Agents 2–5 are honest.',
  },
  {
    name: 'Collusion',
    family: 'Identity',
    familyColor: 'bg-amber-100 text-amber-700',
    definition: 'Agents 0–1 coordinate: they participate together (skip every 5th round in sync), submit averaged reports (mean of their two beliefs + tiny noise), and concentrate stake when their σ is high.',
    mechanism: 'Coordination amplifies their combined weight beyond what individual attacks achieve. The skill layer sees mediocre individual performance but can\'t detect the coordination itself.',
    whoIsAffected: 'Agents 0–1 collude. Agents 2–5 are honest.',
  },
  {
    name: 'Arbitrageur',
    family: 'Adversarial',
    familyColor: 'bg-red-100 text-red-700',
    definition: 'Agent 5 reports the mean of all other agents\' reports and only enters when disagreement is high (dispersion > 0.05). This exploits the Chen et al. (2014) arbitrage interval in weighted-score wagering mechanisms: any prediction within a certain range yields non-negative payoff.',
    mechanism: 'In the repeated setting, the arbitrageur earns mediocre scores (can\'t beat the best forecaster), so σ stays moderate. But the aggregate shifts because the arbitrageur\'s report pulls toward consensus, reducing effective diversity.',
    whoIsAffected: 'Agent 5 is the arbitrageur. Agents 0–4 are honest.',
  },
  {
    name: 'Reputation reset',
    family: 'Identity',
    familyColor: 'bg-amber-100 text-amber-700',
    definition: 'Agent 0 plays honestly for 100 rounds to build a high skill estimate σ, then switches to manipulation (report + 0.25 × direction, riskFraction × 1.5). This tests whether built-up reputation can be exploited.',
    mechanism: 'The EWMA detects the switch within ~20 rounds (3× the half-life). Once manipulation starts, loss increases → L rises → σ drops → weight decreases. The damage is limited because the attack window is long enough for detection.',
    whoIsAffected: 'Agent 0 only. Phase transition at round 100.',
  },
  {
    name: 'Risk-averse hedging',
    family: 'Objectives',
    familyColor: 'bg-indigo-100 text-indigo-700',
    definition: 'All agents shrink reports toward the centre: report = 0.7 × trueReport + 0.3 × 0.5, and cut their risk fraction by 45%. This models agents with CRRA utility (γ > 0) who prefer certainty over expected value.',
    mechanism: 'Hedging loses informativeness (reports are pulled toward 0.5) but doesn\'t break the system. The skill layer measures actual forecast quality, not boldness. Hedged agents get lower σ (less weight) naturally.',
    whoIsAffected: 'All 6 agents hedge.',
  },
  {
    name: 'Manipulator',
    family: 'Adversarial',
    familyColor: 'bg-red-100 text-red-700',
    definition: 'Agent 0 pushes their point report by 0.22 in the direction opposite the aggregate: report = trueReport + 0.22 × sign(0.5 − aggregate). Stakes 35% more aggressively.',
    mechanism: 'The point-forecast manipulation is contained because quantile forecasts are unaffected (only the point report shifts). The EWMA detects the manipulation within ~7 rounds and downweights the attacker.',
    whoIsAffected: 'Agent 0 only.',
  },
  {
    name: 'House-money effect',
    family: 'Staking',
    familyColor: 'bg-teal-100 text-teal-700',
    definition: 'All agents scale their risk fraction based on recent gains: riskFraction × (1 + 0.8 × clamp(gain/20, −0.5, 1)). After winning, agents bet more. After losing, they bet less. Named after the casino psychology where gamblers are bolder with "house money" (winnings).',
    mechanism: 'Winners get more weight, which aligns incentives: agents who\'ve been accurate stake more → get more weight → improve the aggregate. This positive feedback loop is beneficial.',
    whoIsAffected: 'All 6 agents.',
  },
  {
    name: 'Latency exploiter',
    family: 'Operational',
    familyColor: 'bg-slate-100 text-slate-700',
    definition: 'Agent 0 submits reports that blend 15% of the actual outcome with 85% of their true forecast: report = 0.15 × y + 0.85 × trueReport. This models a real-world scenario where submission latency allows partial outcome information to leak.',
    mechanism: 'The exploiter\'s better-informed quantiles actually improve the aggregate. The mechanism can\'t distinguish genuine skill from information advantage — both produce low CRPS loss and high σ.',
    whoIsAffected: 'Agent 0 only.',
  },
  {
    name: 'Budget-constrained',
    family: 'Staking',
    familyColor: 'bg-teal-100 text-teal-700',
    definition: 'Agents 0–2 start with lower wealth (6 vs 20) and stop participating when wealth drops below 0.1. This models agents with finite budgets who face ruin risk.',
    mechanism: 'In 300 rounds, no agents actually reach ruin — the pool compensates. The mechanism remains stable under finite budgets over this horizon.',
    whoIsAffected: 'Agents 0–2 are budget-constrained. Agents 3–5 have normal budgets.',
  },
  {
    name: 'Evader',
    family: 'Adversarial',
    familyColor: 'bg-red-100 text-red-700',
    definition: 'Agent 0 manipulates like the manipulator but adapts strength based on how detectable the attack is. When dispersion > 0.15 (attack is obvious), stealth factor drops to 0.45 (softer attack).',
    mechanism: 'Stealth evasion slows EWMA detection but doesn\'t escape it. The persistent error still accumulates in L over time.',
    whoIsAffected: 'Agent 0 only.',
  },
  {
    name: 'Reinforcement learner',
    family: 'Learning',
    familyColor: 'bg-emerald-100 text-emerald-700',
    definition: 'Agents 0–2 adjust participation probability based on cumulative profit: p = 0.5 + 0.6 × clamp(profit/20, −1, 1). Profitable rounds → participate more. Losing rounds → withdraw.',
    mechanism: 'Creates a feedback loop between profit and participation. Excluded from the 18-preset comparison because it operates at the mechanism layer (participation is endogenous to profit).',
    whoIsAffected: 'Agents 0–2 are reinforcement learners. Agents 3–5 always participate.',
  },
];

export function BehaviourGlossarySlide() {
  return (
    <SlideWrapper>
      <div className="-mx-10 -mt-10 mb-6 h-1.5 rounded-t-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500" />

      <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700">
        Behaviour Analysis
      </span>
      <h2 className="mt-2 text-2xl font-bold text-slate-900">
        Preset Definitions
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-3xl">
        Each preset modifies one aspect of agent behaviour while keeping everything else at baseline.
        The "who is affected" column shows which of the 6 agents deviate from truthful reporting.
      </p>

      <div className="mt-5 space-y-2 max-h-[60vh] overflow-y-auto pr-2">
        {PRESET_GLOSSARY.map(p => (
          <details key={p.name} className="rounded-xl border border-slate-200 bg-white group">
            <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.familyColor}`}>{p.family}</span>
              <span className="text-xs font-semibold text-slate-800">{p.name}</span>
              <span className="ml-auto text-[10px] text-slate-400 group-open:hidden">click to expand</span>
            </summary>
            <div className="px-4 pb-4 space-y-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What it is</p>
                <p className="text-xs text-slate-600 leading-relaxed">{p.definition}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">How it affects the mechanism</p>
                <p className="text-xs text-slate-600 leading-relaxed">{p.mechanism}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Who is affected</p>
                <p className="text-xs text-slate-500">{p.whoIsAffected}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </SlideWrapper>
  );
}


/* ── Slide 4: Threat Classification with Derivation ─────────── */

interface ThreatPreset {
  label: string;
  delta: string;
  derivation: string;
}

interface ThreatTier {
  tier: string;
  /** Tailwind bg class for the small colour chip replacing the legacy emoji. */
  chip: string;
  rule: string;
  border: string;
  bg: string;
  text: string;
  presets: ThreatPreset[];
}

const THREAT_TIERS: ThreatTier[] = [
  {
    tier: 'CRITICAL', chip: 'bg-red-500', rule: 'Δ CRPS > +10%',
    border: 'border-l-red-500', bg: 'bg-red-50', text: 'text-red-700',
    presets: [
      { label: 'Bursty', delta: '+934%', derivation: 'Participation drops to ~54% → fewer signals → aggregate error explodes' },
      { label: 'Rep. gamer', delta: '+28%', derivation: 'Anchoring to aggregate inflates σ while distorting all 5 quantile levels' },
      { label: 'Sandbagger', delta: '+22%', derivation: 'N(0, 0.2²) noise shifts all quantiles via qReportShift → calibration degrades' },
      { label: 'Noisy reporter', delta: '+18%', derivation: 'N(0, 0.15²) noise propagates linearly through weighted quantile average' },
      { label: 'Bias', delta: '+17%', derivation: '+0.15 persistent shift on all quantile levels → aggregate pulled directionally' },
      { label: 'Kelly sizing', delta: '+14%', derivation: 'σ×(1−σ) peaks at σ=0.5 → mediocre forecasters stake the most' },
      { label: 'Miscalibrated', delta: '+13%', derivation: '1.8× overconfidence factor distorts quantile spread → CRPS degrades' },
      { label: 'Sybil', delta: '+10%', derivation: '2 correlated clones with halved deposits create different weighting pattern' },
    ],
  },
  {
    tier: 'MODERATE', chip: 'bg-orange-400', rule: 'Δ CRPS 2–10%',
    border: 'border-l-orange-400', bg: 'bg-orange-50', text: 'text-orange-700',
    presets: [
      { label: 'Collusion', delta: '+8%', derivation: '2 agents coordinate participation + reports → amplified combined weight' },
      { label: 'Arbitrageur', delta: '+5%', derivation: 'Reports mean of others (Chen arb.) → pulls aggregate toward consensus' },
    ],
  },
  {
    tier: 'MILD', chip: 'bg-yellow-400', rule: 'Δ CRPS 0.5–2%',
    border: 'border-l-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700',
    presets: [
      { label: 'Rep. reset', delta: '+1.3%', derivation: '100 rounds honest → manipulate → EWMA detects within ~20 rounds' },
      { label: 'Risk-averse', delta: '+1.3%', derivation: 'Reports shrunk toward 0.5 → less informative but not destructive' },
      { label: 'Manipulator', delta: '+1.1%', derivation: 'Point-forecast shift only → quantiles unaffected → EWMA detects in ~7 rounds' },
    ],
  },
  {
    tier: 'NEGLIGIBLE', chip: 'bg-slate-300', rule: '|Δ CRPS| ≤ 0.5%',
    border: 'border-l-slate-300', bg: 'bg-slate-50', text: 'text-slate-600',
    presets: [
      { label: 'Budget', delta: '+0.5%', derivation: 'No ruin in 300 rounds — pool compensates for lower-wealth agents' },
      { label: 'Evader', delta: '+0.3%', derivation: 'Stealth factor slows detection but persistent error still accumulates in L' },
      { label: 'Baseline', delta: '0%', derivation: 'Reference: all agents truthful, full participation' },
    ],
  },
  {
    tier: 'BENEFICIAL', chip: 'bg-emerald-500', rule: 'Δ CRPS < −0.5%',
    border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700',
    presets: [
      { label: 'House-money', delta: '−1.1%', derivation: 'Winners stake more → accurate agents get more weight → aggregate improves' },
      { label: 'Latency exploit', delta: '−2.9%', derivation: '15% outcome info → better quantiles → aggregate benefits from informed agent' },
    ],
  },
];

export function BehaviourThreatSlide() {
  return (
    <SlideWrapper>
      <div className="-mx-10 -mt-10 mb-6 h-1.5 rounded-t-2xl bg-gradient-to-r from-red-500 to-orange-500" />

      <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-700">
        Behaviour Analysis
      </span>
      <h2 className="mt-2 text-2xl font-bold text-slate-900">
        Threat Classification
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-3xl">
        18 behaviour presets ranked by Δ CRPS vs truthful baseline.
        Each number is computed as (CRPS<sub>test</sub> − CRPS<sub>base</sub>) / CRPS<sub>base</sub> × 100.
        All runs: T=300, N=6, seed=42, baseline DGP.
      </p>

      <div className="mt-5 space-y-2.5">
        {THREAT_TIERS.map(tier => (
          <div key={tier.tier} className={`rounded-xl border border-slate-200 border-l-4 ${tier.border} ${tier.bg} p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <span
                aria-hidden="true"
                className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${tier.chip}`}
              />
              <span className={`text-xs font-bold uppercase tracking-wider ${tier.text}`}>{tier.tier}</span>
              <span className="text-[10px] text-slate-400 ml-1">({tier.rule})</span>
            </div>
            <div className="space-y-1.5">
              {tier.presets.map(p => (
                <div key={p.label} className="flex items-baseline gap-2 text-xs">
                  <span className={`font-semibold ${tier.text} w-24 shrink-0`}>{p.label}</span>
                  <span className="font-mono font-bold text-slate-700 w-16 shrink-0 text-right">{p.delta}</span>
                  <span className="text-slate-500">{p.derivation}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}


/* ── Slide 5: Structural Insights & Verdict ─────────────────── */

const INSIGHTS: Array<{
  title: string;
  finding: string;
  evidence: string;
  verdict: 'good' | 'neutral' | 'bad';
}> = [
  {
    title: 'Participation dominates accuracy',
    finding: 'Missing agents cannot be compensated by any weighting scheme.',
    evidence: 'Bursty at 54% attendance → +934% CRPS. The mechanism preserves σ during absences (EWMA freezes), but fewer signals = worse aggregate. This is the single largest effect in the entire experiment suite.',
    verdict: 'bad',
  },
  {
    title: 'Quantile distortions are the real threat',
    finding: 'Attacks that shift all 5 quantile levels are 15–25× more damaging than point-forecast manipulation.',
    evidence: 'Rep. gamer +28%, sandbagger +22%, noisy +18%, bias +17% — all shift quantiles via qReportShift. Manipulator +1.1% — only shifts the point forecast, quantiles unaffected. The skill layer downweights slowly when distortion affects all quantile levels simultaneously.',
    verdict: 'bad',
  },
  {
    title: 'Point-forecast attacks are well-contained',
    finding: 'The skill gate detects and downweights point-forecast attackers within ~7 rounds.',
    evidence: 'Manipulator +1.1%, evader +0.3%, rep. reset +1.3%. The EWMA half-life is ln(2)/0.1 ≈ 7 rounds. After ~14 rounds, 75% of accumulated good reputation is gone. Even the reputation reset (100 rounds honest → exploit) is detected within ~20 rounds of the switch.',
    verdict: 'good',
  },
  {
    title: 'Multi-agent coordination amplifies impact',
    finding: 'Coordinated behaviour exceeds what the skill gate absorbs from individual attacks.',
    evidence: 'Sybil +10%, Collusion +8%. The sybil defence (deposit splitting: each clone gets 1/k of total stake) keeps clone pair wealth ratio ≤ 1.05, but the aggregate still suffers from correlated signals with fragmented deposits.',
    verdict: 'neutral',
  },
  {
    title: 'Staking strategy has mixed effects',
    finding: 'How agents size bets matters — the effect depends on whether staking correlates with forecast quality.',
    evidence: 'Kelly +14% (σ×(1−σ) peaks at σ=0.5, giving mediocre forecasters highest stake). House-money −1.1% (winners stake more, aligning incentives). Budget +0.5% (no ruin in 300 rounds).',
    verdict: 'neutral',
  },
  {
    title: 'Information advantage is indistinguishable from skill',
    finding: 'The mechanism cannot tell the difference between a genuinely skilled forecaster and one with an information advantage.',
    evidence: 'Latency exploiter −2.9%: 15% outcome info → low CRPS loss → high σ → more weight. The aggregate actually improves because the exploiter\'s better-informed quantiles help everyone. But this creates fairness concerns.',
    verdict: 'good',
  },
];

const VERDICT_STYLES = {
  good: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  neutral: { border: 'border-l-amber-400', bg: 'bg-amber-50', text: 'text-amber-600' },
  bad: { border: 'border-l-red-400', bg: 'bg-red-50', text: 'text-red-600' },
};

export function BehaviourInsightsSlide() {
  return (
    <SlideWrapper dark>
      <div className="-mx-10 -mt-10 mb-6 h-1.5 rounded-t-2xl bg-gradient-to-r from-violet-400 to-fuchsia-400" />

      <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/70">
        Behaviour Analysis
      </span>
      <h2 className="mt-2 text-2xl font-bold text-white">
        Structural Findings
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400 max-w-3xl">
        Six findings from testing 18 strategic behaviours against the Skill × Stake mechanism.
        Each finding states the claim, then the evidence from the simulation results.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INSIGHTS.map((ins, i) => {
          const s = VERDICT_STYLES[ins.verdict];
          return (
            <div key={i} className={`rounded-xl border-l-4 ${s.border} ${s.bg} p-4 ring-1 ring-slate-200/50`}>
              <div className={`text-xs font-bold ${s.text} mb-1`}>{ins.title}</div>
              <p className="text-[11px] font-semibold text-slate-700 mb-1">{ins.finding}</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">{ins.evidence}</p>
            </div>
          );
        })}
      </div>

      {/* Thesis verdict */}
      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">Project Verdict</p>
        <p className="text-sm text-white/90 leading-relaxed">
          The mechanism is <span className="font-semibold text-emerald-400">partially stable</span> under
          strategic behaviour. The skill gate g(σ) = 0.3 + 0.7σ combined with EWMA tracking
          (half-life ≈ 7 rounds) contains point-forecast attacks.
          The weight cap (ω<sub>max</sub> = 0.25) prevents concentration.
          However, <span className="font-semibold text-red-400">quantile-level distortions</span> propagate
          to aggregate CRPS before the skill layer can detect and downweight them.
          The <span className="font-semibold text-amber-400">dominant vulnerability is participation</span>:
          missing agents directly reduce aggregate quality and no weighting scheme can compensate.
        </p>
      </div>
    </SlideWrapper>
  );
}
