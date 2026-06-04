import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, ErrorBar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { THESIS_PALETTE } from '@/lib/palette';

const TAB10 = THESIS_PALETTE;

interface SybilRow {
  epsilon: number;
  k: number;
  mean_profit: number;
  se_profit: number;
  ci_low: number;
  ci_high: number;
  mean_n_eff: number;
  leakage_vs_narrow: number;
  n_seeds: number;
}

interface ArbitrageRow {
  lam: number;
  mean_profit: number;
  se_profit: number;
  ci_low: number;
  ci_high: number;
  mean_final_wealth: number;
  mean_found_rounds: number;
  mean_participation_rounds: number;
  n_seeds: number;
}

// Per-1,000-round attacker profits from the behaviour suite. All runs are
// T = 1,000 except whitewashing (T = 1,000, attacker reset profile). Numbers
// are seed means with the bootstrap 95% CI where available.
const PER_1K_ROUND_PROFITS: {
  attack: string;
  profit_per_1k: string;
  ci: string;
  seeds: number;
  source: string;
}[] = [
  {
    attack: 'Arbitrage seeker (λ = 0.05, n = 32)',
    profit_per_1k: '+13.40',
    ci: '[+10.97, +15.82]',
    seeds: 20,
    source: 'arbitrage_scan/data/arbitrage_scan_by_lam.csv',
  },
  {
    attack: 'Coalition (Chun & Shachter weighted-mean, n = 3)',
    profit_per_1k: '+19.87',
    ci: '[+15.32, +24.41]',
    seeds: 20,
    source: 'collusion_stress/data/collusion_stress_summary.csv',
  },
  {
    attack: 'Coalition (weighted-median variant, n = 3)',
    profit_per_1k: '+16.86',
    ci: '[+12.22, +21.50]',
    seeds: 20,
    source: 'collusion_stress/data/collusion_stress_summary.csv',
  },
  {
    attack: 'Informed collusion (AR(1), n = 3 insiders)',
    profit_per_1k: '+33.84',
    ci: '[+29.12, +38.56]',
    seeds: 10,
    source: 'informed_collusion/data/informed_collusion_summary.csv',
  },
  {
    attack: 'Privileged-information insider (lag 1, σ = 0.015)',
    profit_per_1k: '+57.14',
    ci: '[+52.93, +61.36]',
    seeds: 20,
    source: 'insider_advantage/data/insider_advantage_summary.csv',
  },
  {
    attack: 'Wash trader (anchor variant)',
    profit_per_1k: '+14.71',
    ci: '[+12.04, +17.39]',
    seeds: 20,
    source: 'wash_activity_gaming/data/wash_activity_gaming_summary.csv',
  },
  {
    attack: 'Whitewashing reset (κ = 0.05)',
    profit_per_1k: '−3.49',
    ci: '[−3.77, −3.21]',
    seeds: 5,
    source: 'reputation_reset/data/reputation_reset_summary.csv',
  },
  {
    attack: 'Manipulator (no reset, fixed identity)',
    profit_per_1k: '−20.00',
    ci: '[−20.00, −20.00]',
    seeds: 5,
    source: 'reputation_reset/data/reputation_reset_summary.csv',
  },
];

const DEFENCE_LEVERS: { threat: string; prevented: 'Yes' | 'No' | 'Partial'; lever: string; cost: string }[] = [
  {
    threat: 'Arbitrage',
    prevented: 'No',
    lever: 'Skill-gate floor λ scales but does not close the interval',
    cost: 'Closing requires the no-arbitrage family (loses exact budget balance)',
  },
  {
    threat: 'Collusion',
    prevented: 'No',
    lever: 'Skill gate does not track between-participant correlation',
    cost: 'Collusion-resistant scoring breaks per-round truthfulness',
  },
  {
    threat: 'Sybil clones (identical report)',
    prevented: 'Yes',
    lever: 'Effective-wager conservation under the Lambert identity',
    cost: 'Narrow scope only, diversified-report clones leak ~6.5%',
  },
  {
    threat: 'Whitewashing',
    prevented: 'Partial',
    lever: 'Staleness decay and non-unit prior discount newcomers',
    cost: 'Hold-out period or proof-of-identity gating closes the gap',
  },
  {
    threat: 'Wash trading (anchor)',
    prevented: 'No',
    lever: 'Score penalty insufficient at modest pull',
    cost: 'No lever within the current mechanism',
  },
  {
    threat: 'Insider information',
    prevented: 'No',
    lever: 'Per-round truthfulness is myopic only, information asymmetry sits outside scope',
    cost: 'Differential privacy or blind scoring would be required',
  },
];

const ARCHETYPES: { name: string; basis: string }[] = [
  { name: 'Arbitrage seeker', basis: 'Chen (2014) Theorem 3.3 (MAE analogue); Chun & Shachter (2011)' },
  { name: 'Coordinated coalition', basis: 'Chun & Shachter (2011) coalition; Chen (2014) Section 3' },
  { name: 'Informed collusion', basis: 'Coalition + AR(1) insider signal' },
  { name: 'Strategic reporter', basis: 'Soft manipulator mixing anchor with target report' },
  { name: 'Privileged-information insider', basis: 'Lambert et al. (2008); Kelly (1956)' },
  { name: 'Detector-aware evader', basis: 'Adaptive evader tracking detector scores' },
  { name: 'Wash trader', basis: 'Parimutuel wash and multi-account activity inflation' },
  { name: 'Sybil arbitrageur', basis: 'Audit combining sybil splitting with arbitrage' },
  { name: 'Reputation-reset attacker', basis: 'Feldman & Chuang (2004) whitewashing' },
];

const HEADLINE_NUMBERS: { label: string; value: string; note: string }[] = [
  {
    label: 'Narrow Lambert sybil ratio',
    value: '1.0',
    note: 'Identical reports, conserved total wager, matching the Lambert proof to floating-point noise.',
  },
  {
    label: 'Diversified-report sybil leakage',
    value: '+6.5%',
    note: 'Diversified clone reports break the identical-report (r_i = r_j) precondition. +6.5% over narrow-Lambert.',
  },
  {
    label: 'Coalition profit (weighted-mean, n=3)',
    value: '+19.87',
    note: '95% CI [+15.32, +24.41] over 20 seeds, T=1,000.',
  },
  {
    label: 'Informed-collusion uplift',
    value: '+40%',
    note: 'Information channel adds ~40% over pure coalition under AR(1).',
  },
  {
    label: 'Whitewashing loss reduction',
    value: '-83%',
    note: 'Reset cuts attacker loss from −20.0 to −3.49 (5 seeds).',
  },
  {
    label: 'Insider profit (lag 1, σ=0.015)',
    value: '+57.1',
    note: 'Lagged variant captures ~89% of outright leakage under AR(1).',
  },
];

// Parse the signed profit / CI strings (which use a unicode minus) into numbers
// for the bar chart. The underlying values are the committed seed means above.
function parseSigned(s: string): number {
  return Number(s.replace(/−/g, '-').replace(/[+\s]/g, ''));
}

// Short labels for the horizontal profit bar, in the same order as the table.
const PER_1K_BAR = PER_1K_ROUND_PROFITS.map((row) => {
  const value = parseSigned(row.profit_per_1k);
  const ci = row.ci.replace(/[[\]]/g, '').split(',').map(parseSigned);
  const shortName = row.attack.replace(/\s*\([^)]*\)/g, '');
  return {
    name: shortName,
    value,
    lowErr: Number.isFinite(ci[0]) ? value - ci[0] : 0,
    highErr: Number.isFinite(ci[1]) ? ci[1] - value : 0,
  };
});

function loadCsv<T>(text: string): T[] {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, number> = {};
    header.forEach((col, i) => {
      row[col.trim()] = Number(cells[i]);
    });
    return row as unknown as T;
  });
}

export default function AdversaryCatalogue() {
  const [sybilRows, setSybilRows] = useState<SybilRow[]>([]);
  const [arbRows, setArbRows] = useState<ArbitrageRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [arbError, setArbError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/';
    Promise.all([
      fetch(`${base}data/behaviour/experiments/sybil_epsilon/data/sybil_epsilon_summary.csv`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then((text) => setSybilRows(loadCsv<SybilRow>(text)))
        .catch((err) => setLoadError(String(err))),
      fetch(`${base}data/behaviour/experiments/arbitrage_scan/data/arbitrage_scan_by_lam.csv`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then((text) => setArbRows(loadCsv<ArbitrageRow>(text)))
        .catch((err) => setArbError(String(err))),
    ]).finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Adversary catalogue (per-class detail)</h3>
        <p className="text-[14px] text-slate-500 mb-4">
          Pan, Buchwalter, &amp; Roughgarden (2024) prove no non-wasteful, symmetric, incentive-compatible,
          sybil-proof direct mechanism exists beyond the second-price auction. The catalogue probes the
          regimes where each invariant holds and where it breaks.
        </p>

        <h4 className="text-[14px] font-semibold text-slate-700 mb-2 uppercase tracking-wide">
          Defence levers
        </h4>
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-left py-2 pr-3 font-medium">Threat</th>
                <th className="text-left py-2 px-2 font-medium">Mechanism prevents?</th>
                <th className="text-left py-2 px-2 font-medium">Main lever</th>
                <th className="text-left py-2 px-2 font-medium">Cost of prevention</th>
              </tr>
            </thead>
            <tbody>
              {DEFENCE_LEVERS.map((row) => (
                <tr key={row.threat} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium text-slate-700">{row.threat}</td>
                  <td
                    className="py-2 px-2 font-mono"
                    style={{
                      color: row.prevented === 'Yes' ? TAB10.external
                        : row.prevented === 'Partial' ? TAB10.postProcessed
                        : TAB10.adversary,
                    }}
                  >
                    {row.prevented}
                  </td>
                  <td className="py-2 px-2 text-slate-600">{row.lever}</td>
                  <td className="py-2 px-2 text-slate-500">{row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="text-[14px] font-semibold text-slate-700 mb-2 uppercase tracking-wide">
          Archetypes evaluated
        </h4>
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-left py-2 pr-3 font-medium">Archetype</th>
                <th className="text-left py-2 px-2 font-medium">Theoretical basis</th>
              </tr>
            </thead>
            <tbody>
              {ARCHETYPES.map((row) => (
                <tr key={row.name} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium text-slate-700">{row.name}</td>
                  <td className="py-2 px-2 text-slate-500">{row.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="text-[14px] font-semibold text-slate-700 mb-2 uppercase tracking-wide">
          Headline outcomes
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HEADLINE_NUMBERS.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-slate-200 p-3 bg-slate-50"
            >
              <div className="text-[13px] uppercase tracking-wider text-slate-400 font-semibold">
                {card.label}
              </div>
              <div
                className="font-mono tabular-nums"
                style={{ fontSize: 20, fontWeight: 700, color: TAB10.ink, marginTop: 2 }}
              >
                {card.value}
              </div>
              <div className="text-[13px] text-slate-500 leading-snug mt-1.5">{card.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">
          Sybil-arbitrage leakage versus report perturbation ε
        </h3>
        <p className="text-[14px] text-slate-500 mb-3">
          Diversifying clone reports trades arbitrage precision for detection evasion, and precision dominates.
          At ε = 0.10 attacker profit falls to +5.35, a 55% reduction from identical clones (ε = 0).
        </p>
        {isLoading && !loadError && (
          <div
            className="rounded-lg border border-dashed border-slate-200 bg-slate-50 animate-pulse mb-2"
            style={{ height: 280 }}
            aria-label="Loading sybil-epsilon data"
            role="status"
          />
        )}
        {loadError && (
          <p className="text-[14px] text-red-600 mb-2" role="alert">
            Could not load sybil-epsilon data: {loadError}
          </p>
        )}
        {sybilRows.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={sybilRows}
              margin={{ top: 10, right: 16, bottom: 28, left: 36 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(31, 42, 56, 0.08)" />
              <XAxis
                dataKey="epsilon"
                type="number"
                tick={{ fontSize: 14, fill: '#475569' }}
                stroke="#94A3B8"
                label={{
                  value: 'ε (clone-report perturbation)',
                  position: 'insideBottom',
                  offset: -8,
                  fontSize: 14,
                  fill: '#475569',
                }}
              />
              <YAxis
                tick={{ fontSize: 14, fill: '#475569' }}
                stroke="#94A3B8"
                label={{
                  value: 'Mean profit (deposit units)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 8,
                  fontSize: 14,
                  fill: '#475569',
                }}
              />
              <Tooltip
                contentStyle={{ fontSize: 14, borderRadius: 6, border: '1px solid #e2e8f0' }}
                formatter={(value, name) => {
                  const num = typeof value === 'number' ? value : Number(value);
                  if (!Number.isFinite(num)) return [String(value), String(name)];
                  return [num.toFixed(2), String(name)];
                }}
                labelFormatter={(label) => {
                  const num = typeof label === 'number' ? label : Number(label);
                  return Number.isFinite(num) ? `ε = ${num.toFixed(3)}` : String(label);
                }}
              />
              <ReferenceLine y={0} stroke={TAB10.baseline} strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="mean_profit"
                name="Profit"
                stroke={TAB10.adversary}
                strokeWidth={2}
                dot={{ r: 3, fill: TAB10.adversary }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-right py-2 pr-3 font-medium">ε</th>
                <th className="text-right py-2 px-2 font-medium">Profit</th>
                <th className="text-right py-2 px-2 font-medium">95% CI</th>
                <th className="text-right py-2 px-2 font-medium">Leakage %</th>
                <th className="text-right py-2 px-2 font-medium">Seeds</th>
              </tr>
            </thead>
            <tbody>
              {sybilRows.map((r) => (
                <tr key={r.epsilon} className="border-b border-slate-50 font-mono tabular-nums">
                  <td className="text-right py-1.5 pr-3">{r.epsilon.toFixed(3)}</td>
                  <td className="text-right py-1.5 px-2">{r.mean_profit.toFixed(2)}</td>
                  <td className="text-right py-1.5 px-2">
                    [{r.ci_low.toFixed(2)}, {r.ci_high.toFixed(2)}]
                  </td>
                  <td className="text-right py-1.5 px-2">{r.leakage_vs_narrow.toFixed(1)}%</td>
                  <td className="text-right py-1.5 px-2">{r.n_seeds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Arbitrage scan: profit rises monotonically with the skill-gate floor λ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">
          Arbitrage profit against the skill-gate floor λ
        </h3>
        <p className="text-[14px] text-slate-500 mb-3">
          Across the λ-grid every bootstrap interval lies strictly above breakeven, and the seed mean
          rises monotonically with λ. The arbitrage surface is a property of the weighted-score
          family inherited from Lambert et al. (2008).
        </p>
        {isLoading && !arbError && arbRows.length === 0 && (
          <div
            className="rounded-lg border border-dashed border-slate-200 bg-slate-50 animate-pulse mb-2"
            style={{ height: 280 }}
            aria-label="Loading arbitrage-scan data"
            role="status"
          />
        )}
        {arbError && (
          <p className="text-[14px] text-red-600 mb-2" role="alert">
            Could not load arbitrage-scan data: {arbError}
          </p>
        )}
        {arbRows.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={arbRows}
              margin={{ top: 10, right: 16, bottom: 28, left: 36 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(31, 42, 56, 0.08)" />
              <XAxis
                dataKey="lam"
                type="number"
                tick={{ fontSize: 14, fill: '#475569' }}
                stroke="#94A3B8"
                label={{
                  value: 'λ (skill-gate floor)',
                  position: 'insideBottom',
                  offset: -8,
                  fontSize: 14,
                  fill: '#475569',
                }}
              />
              <YAxis
                tick={{ fontSize: 14, fill: '#475569' }}
                stroke="#94A3B8"
                label={{
                  value: 'Mean attacker profit',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 8,
                  fontSize: 14,
                  fill: '#475569',
                }}
              />
              <Tooltip
                contentStyle={{ fontSize: 14, borderRadius: 6, border: '1px solid #e2e8f0' }}
                formatter={(value, name) => {
                  const num = typeof value === 'number' ? value : Number(value);
                  if (!Number.isFinite(num)) return [String(value), String(name)];
                  return [num.toFixed(2), String(name)];
                }}
                labelFormatter={(label) => {
                  const num = typeof label === 'number' ? label : Number(label);
                  return Number.isFinite(num) ? `λ = ${num.toFixed(2)}` : String(label);
                }}
              />
              <ReferenceLine y={0} stroke={TAB10.baseline} strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="mean_profit"
                name="Attacker profit"
                stroke={TAB10.adversary}
                strokeWidth={2}
                dot={{ r: 3, fill: TAB10.adversary }}
              />
              <Line
                type="monotone"
                dataKey="ci_low"
                name="95% CI lower"
                stroke={TAB10.adversary}
                strokeOpacity={0.4}
                strokeDasharray="4 3"
                strokeWidth={1}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="ci_high"
                name="95% CI upper"
                stroke={TAB10.adversary}
                strokeOpacity={0.4}
                strokeDasharray="4 3"
                strokeWidth={1}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-right py-2 pr-3 font-medium">λ</th>
                <th className="text-right py-2 px-2 font-medium">Mean profit</th>
                <th className="text-right py-2 px-2 font-medium">95% CI</th>
                <th className="text-right py-2 px-2 font-medium">Found rounds</th>
                <th className="text-right py-2 px-2 font-medium">Seeds</th>
              </tr>
            </thead>
            <tbody>
              {arbRows.map((r) => (
                <tr key={r.lam} className="border-b border-slate-50 font-mono tabular-nums">
                  <td className="text-right py-1.5 pr-3">{r.lam.toFixed(2)}</td>
                  <td className="text-right py-1.5 px-2">{r.mean_profit.toFixed(2)}</td>
                  <td className="text-right py-1.5 px-2">
                    [{r.ci_low.toFixed(2)}, {r.ci_high.toFixed(2)}]
                  </td>
                  <td className="text-right py-1.5 px-2">{r.mean_found_rounds.toFixed(0)}</td>
                  <td className="text-right py-1.5 px-2">{r.n_seeds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-1,000-round attacker profit anchor */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">
          Attacker profit per 1,000 rounds (seed means with 95% CI)
        </h3>
        <p className="text-[14px] text-slate-500 mb-3">
          Anchors the adversary catalogue to a single time horizon. Each row is the seed-mean
          attacker profit on a T = 1,000-round run. Positive numbers mean the attack extracts
          surplus from honest participants, negative numbers mean the attacker pays the cost of the
          attack. The insider tops the catalogue at +57.1, whitewashing sits below breakeven at −3.49.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={PER_1K_BAR} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(31, 42, 56, 0.08)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 14, fill: '#475569' }}
              stroke="#94A3B8"
              label={{ value: 'Profit / 1k rounds (deposit units)', position: 'insideBottom', offset: -4, fontSize: 14, fill: '#475569' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 12, fill: '#475569' }}
              stroke="#94A3B8"
            />
            <Tooltip
              contentStyle={{ fontSize: 14, borderRadius: 6, border: '1px solid #e2e8f0' }}
              formatter={(value: unknown) => {
                const num = typeof value === 'number' ? value : Number(value);
                return Number.isFinite(num) ? num.toFixed(2) : String(value);
              }}
            />
            <ReferenceLine x={0} stroke={TAB10.baseline} strokeDasharray="3 3" />
            <Bar dataKey="value" name="Profit / 1k rounds" radius={[0, 3, 3, 0]}>
              {PER_1K_BAR.map((d) => (
                <Cell key={d.name} fill={d.value >= 0 ? TAB10.adversary : TAB10.external} />
              ))}
              <ErrorBar dataKey="lowErr" width={4} strokeWidth={1} stroke="#64748B" direction="x" />
              <ErrorBar dataKey="highErr" width={4} strokeWidth={1} stroke="#64748B" direction="x" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-left py-2 pr-3 font-medium">Attack</th>
                <th className="text-right py-2 px-2 font-medium">Profit / 1k rounds</th>
                <th className="text-right py-2 px-2 font-medium">95% CI</th>
                <th className="text-right py-2 px-2 font-medium">Seeds</th>
              </tr>
            </thead>
            <tbody>
              {PER_1K_ROUND_PROFITS.map((row) => {
                const positive = row.profit_per_1k.startsWith('+');
                return (
                  <tr key={row.attack} className="border-b border-slate-50">
                    <td className="py-1.5 pr-3 text-slate-700">{row.attack}</td>
                    <td
                      className="text-right py-1.5 px-2 font-mono tabular-nums"
                      style={{ color: positive ? TAB10.adversary : TAB10.external, fontWeight: 600 }}
                    >
                      {row.profit_per_1k}
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono tabular-nums text-slate-500">
                      {row.ci}
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono tabular-nums text-slate-500">
                      {row.seeds}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
