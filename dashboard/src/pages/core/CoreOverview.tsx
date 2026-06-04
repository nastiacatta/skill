import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import ChartCard from '@/components/dashboard/ChartCard';
import SymbolGlossary from '@/components/dashboard/SymbolGlossary';
import { PALETTE } from '@/lib/palette';
import PageHeader from '@/components/dashboard/PageHeader';
import FormulaCard from '@/components/dashboard/FormulaCard';
import MathBlock from '@/components/dashboard/MathBlock';
import { runRoundExtended } from '@/lib/coreMechanism/runRoundExtended';
import type { AgentState, AgentAction } from '@/lib/coreMechanism/runRound';
import type { ExtendedParams } from '@/lib/coreMechanism/runRoundExtended';

const CORE_SYMBOLS = [
  { symbol: 'y', meaning: 'Outcome (realised)' },
  { symbol: 'r_i', meaning: 'Agent i report' },
  { symbol: 'r̂', meaning: 'Aggregate forecast' },
  { symbol: 'b_i', meaning: 'Deposit (stake)' },
  { symbol: 'σ_i', meaning: 'Skill weight' },
  { symbol: 'm_i', meaning: 'Effective wager' },
  { symbol: 's_i', meaning: 'Score: 1 − |y − r_i|' },
  { symbol: 'π_i', meaning: 'Profit' },
  { symbol: 'ω_max', meaning: 'Weight cap (concentration limit)' },
];

type EditableAgent = {
  id: string;
  label: string;
  report: number;
  deposit: number;
  ewmaLoss: number;
  wealth: number;
  participate: boolean;
};

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

function roundTo(v: number, d = 3): number {
  return Number(v.toFixed(d));
}

function makeInitialAgents(): EditableAgent[] {
  return [
    { id: 'a1', label: 'A', report: 0.72, deposit: 6.5, ewmaLoss: 0.12, wealth: 20, participate: true },
    { id: 'a2', label: 'B', report: 0.58, deposit: 5.5, ewmaLoss: 0.21, wealth: 20, participate: true },
    { id: 'a3', label: 'C', report: 0.42, deposit: 4.5, ewmaLoss: 0.31, wealth: 20, participate: true },
    { id: 'a4', label: 'D', report: 0.33, deposit: 2.8, ewmaLoss: 0.4, wealth: 20, participate: true },
  ];
}

export default function CoreOverview() {
  const [agents, setAgents] = useState<EditableAgent[]>(makeInitialAgents);
  const [outcome, setOutcome] = useState(0.61);
  const [lam, setLam] = useState(0.3);
  const [eta, setEta] = useState(1.8);
  const [sigmaMin, setSigmaMin] = useState(0.2);
  const [gamma, setGamma] = useState(3.5);
  const [rho, setRho] = useState(0.2);
  const [omegaMax, setOmegaMax] = useState(0.45);
  const [utilityPool, setUtilityPool] = useState(0);
  const [scoreThreshold, setScoreThreshold] = useState(0.7);
  const [history, setHistory] = useState<Array<{ round: number; aggregate: number; outcome: number; error: number; nEff: number; gini: number }>>([]);

  const params: ExtendedParams = useMemo(
    () => ({
      lam,
      sigma_min: sigmaMin,
      gamma,
      rho,
      eta,
      omegaMax,
      utilityPool,
      scoreThreshold,
    }),
    [lam, sigmaMin, gamma, rho, eta, omegaMax, utilityPool, scoreThreshold]
  );

  const state: AgentState[] = useMemo(
    () =>
      agents.map((a, i) => ({
        accountId: i,
        L: a.ewmaLoss,
        sigma: 0.5,
        wealth: a.wealth,
      })),
    [agents]
  );

  const actions: AgentAction[] = useMemo(
    () =>
      agents.map((a, i) => ({
        accountId: i,
        participate: a.participate,
        report: a.report,
        deposit: a.deposit,
      })),
    [agents]
  );

  const result = useMemo(() => runRoundExtended(state, actions, outcome, params), [state, actions, outcome, params]);

  const barData = useMemo(
    () =>
      agents.map((a, i) => ({
        label: a.label,
        Deposit: roundTo(a.deposit, 2),
        'Effective wager': roundTo(result.m[i], 2),
        Score: roundTo(result.scores[i], 3),
        Profit: roundTo(result.profit[i], 2),
      })),
    [result, agents]
  );

  const rows = useMemo(
    () =>
      agents.map((a, idx) => ({
        ...a,
        sigma: result.sigma_t[idx],
        score: result.scores[idx],
        m: result.m[idx],
        weight: result.weight[idx],
        profit: result.profit[idx],
        wealth_new: result.wealth_new[idx],
      })),
    [result, agents]
  );

  const runOneRound = () => {
    setHistory((h) => [
      ...h,
      {
        round: h.length + 1,
        aggregate: roundTo(result.r_hat, 4),
        outcome: roundTo(outcome, 4),
        error: roundTo(Math.abs(outcome - result.r_hat), 4),
        nEff: roundTo(1 / result.weight.reduce((s, w) => s + w * w, 0), 4),
        gini: 0,
      },
    ]);
    setAgents((prev) =>
      prev.map((a, i) => ({
        ...a,
        report: a.report,
        deposit: a.deposit,
        participate: a.participate,
        ewmaLoss: result.L_new[i],
        wealth: result.wealth_new[i],
      }))
    );
  };

  const resetDemo = () => {
    setAgents(makeInitialAgents());
    setOutcome(0.61);
    setLam(0.3);
    setEta(1.8);
    setSigmaMin(0.2);
    setGamma(3.5);
    setRho(0.2);
    setOmegaMax(0.45);
    setUtilityPool(0);
    setScoreThreshold(0.7);
    setHistory([]);
  };

  const historyData =
    history.length > 0
      ? history
      : [
          {
            round: 0,
            aggregate: result.r_hat,
            outcome,
            error: Math.abs(outcome - result.r_hat),
            nEff: 1 / Math.max(result.weight.reduce((s, w) => s + w * w, 0), 1e-12),
            gini: 0,
          },
        ];

  const nEff = (() => {
    const h = result.weight.reduce((s, w) => s + w * w, 0);
    return h > 0 ? 1 / h : 0;
  })();
  const giniValues = result.wealth_new;
  const giniCoeff =
    giniValues.length > 0
      ? (() => {
          const sorted = [...giniValues].sort((a, b) => a - b);
          const total = sorted.reduce((a, b) => a + b, 0);
          if (total <= 0) return 0;
          let w = 0;
          sorted.forEach((x, i) => {
            w += (i + 1) * x;
          });
          return (2 * w - (sorted.length + 1) * total) / (sorted.length * total);
        })()
      : 0;

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <PageHeader
        title="Core"
        description="Inputs → Effective wager → Aggregation → Settlement → Skill update"
        breadcrumbs={[{ label: 'Core', to: '/core' }]}
        controls={
          <SymbolGlossary entries={CORE_SYMBOLS} className="sm:max-w-md" />
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormulaCard
          title="Score"
          latex="s_{i,t} = 1 - |y_t - r_{i,t}|"
          caption="Bounded point score in [0, 1]."
        />
        <FormulaCard
          title="Skill mapping"
          latex="\\sigma_{i,t} = \\sigma_{\\min} + (1 - \\sigma_{\\min}) \\exp(-\\gamma L_{i,t})"
          caption="Lower EWMA loss gives higher skill weight."
        />
        <FormulaCard
          title="Effective wager"
          latex="m_{i,t} = b_{i,t} \\bigl( \\lambda + (1-\\lambda) \\sigma_{i,t}^\\eta \\bigr)"
          caption="Deposits filtered by skill gate."
        />
        <FormulaCard
          title="Aggregation and payoff"
          latex="\\hat{r}_t = \\sum_i \\hat{m}_{i,t} r_{i,t},\\quad \\Pi_{i,t} = m_{i,t} (1 + s_{i,t} - \\bar{s}_t)"
          caption="Weights capped by ω_max. Settlement redistributes by relative score."
        />
      </div>

      <section className="space-y-4" aria-labelledby="experiment-heading">
        <h2 id="experiment-heading" className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-2">
          Interactive experiment
        </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Round controls</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-500">Outcome <MathBlock inline latex="y_t" /></span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={outcome}
                  onChange={(e) => setOutcome(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <span className="text-xs text-slate-600">{roundTo(outcome, 2)}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500"><MathBlock inline latex="\\lambda" /></span>
                <input type="range" min={0} max={1} step={0.01} value={lam} onChange={(e) => setLam(Number(e.target.value))} className="w-full accent-blue-600" />
                <span className="text-xs text-slate-600">{roundTo(lam, 2)}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500"><MathBlock inline latex="\\eta" /></span>
                <input type="range" min={1} max={4} step={0.1} value={eta} onChange={(e) => setEta(Number(e.target.value))} className="w-full accent-blue-600" />
                <span className="text-xs text-slate-600">{roundTo(eta, 1)}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500"><MathBlock inline latex="\\sigma_{\\min}" /></span>
                <input type="range" min={0.05} max={0.6} step={0.01} value={sigmaMin} onChange={(e) => setSigmaMin(Number(e.target.value))} className="w-full accent-blue-600" />
                <span className="text-xs text-slate-600">{roundTo(sigmaMin, 2)}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500"><MathBlock inline latex="\\gamma" /></span>
                <input type="range" min={0.5} max={6} step={0.1} value={gamma} onChange={(e) => setGamma(Number(e.target.value))} className="w-full accent-blue-600" />
                <span className="text-xs text-slate-600">{gamma}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500"><MathBlock inline latex="\\rho" /></span>
                <input type="range" min={0.05} max={0.5} step={0.01} value={rho} onChange={(e) => setRho(Number(e.target.value))} className="w-full accent-blue-600" />
                <span className="text-xs text-slate-600">{roundTo(rho, 2)}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500"><MathBlock inline latex="\\omega_{\\max}" /></span>
                <input type="range" min={0.25} max={1} step={0.01} value={omegaMax} onChange={(e) => setOmegaMax(Number(e.target.value))} className="w-full accent-blue-600" />
                <span className="text-xs text-slate-600">{roundTo(omegaMax, 2)}</span>
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={runOneRound} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Run round
              </button>
              <button onClick={resetDemo} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Reset
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Editable agents</h2>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1.5 text-slate-500">Agent</th>
                  <th className="text-left py-1.5 text-slate-500">Report</th>
                  <th className="text-left py-1.5 text-slate-500">Deposit</th>
                  <th className="text-left py-1.5 text-slate-500">Loss</th>
                  <th className="text-left py-1.5 text-slate-500">Wealth</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td className="py-1.5">{a.label}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={a.report}
                        onChange={(e) =>
                          setAgents((prev) =>
                            prev.map((x) => (x.id === a.id ? { ...x, report: clamp(Number(e.target.value)) } : x))
                          )
                        }
                        className="w-16 rounded border px-1.5 py-0.5 text-xs"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={a.deposit}
                        onChange={(e) =>
                          setAgents((prev) =>
                            prev.map((x) => (x.id === a.id ? { ...x, deposit: Math.max(0, Number(e.target.value)) } : x))
                          )
                        }
                        className="w-16 rounded border px-1.5 py-0.5 text-xs"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={roundTo(a.ewmaLoss, 3)}
                        onChange={(e) =>
                          setAgents((prev) =>
                            prev.map((x) => (x.id === a.id ? { ...x, ewmaLoss: clamp(Number(e.target.value)) } : x))
                          )
                        }
                        className="w-16 rounded border px-1.5 py-0.5 text-xs"
                      />
                    </td>
                    <td>{roundTo(a.wealth, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                Aggregate <MathBlock inline latex="\\hat{r}_t" />
              </p>
              <p className="text-lg font-semibold text-slate-800 mt-0.5">{roundTo(result.r_hat, 3)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[10px] uppercase text-slate-500">Error</p>
              <p className="text-lg font-semibold text-slate-800 mt-0.5">{roundTo(Math.abs(outcome - result.r_hat), 3)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                <MathBlock inline latex="N_{\\mathrm{eff}}" />
              </p>
              <p className="text-lg font-semibold text-slate-800 mt-0.5">{roundTo(nEff, 2)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[10px] uppercase text-slate-500">Gini</p>
              <p className="text-lg font-semibold text-slate-800 mt-0.5">{roundTo(giniCoeff, 3)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Deposit vs effective wager" subtitle="Skill gate effect">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Deposit" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Effective wager" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Score and profit" subtitle="Per agent">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Score" fill="#0f172a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Profit" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Round history" subtitle="After each commit">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="aggregate" name="r̂" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outcome" name="y" stroke="#0f172a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="error" name="error" stroke={PALETTE.coral} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Per-agent audit" subtitle="σ, gate, score, weight, profit">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 text-slate-500">Agent</th>
                    <th className="text-left py-2 text-slate-500"><MathBlock inline latex="\\sigma" /></th>
                    <th className="text-left py-2 text-slate-500">Gate</th>
                    <th className="text-left py-2 text-slate-500">Score</th>
                    <th className="text-left py-2 text-slate-500"><MathBlock inline latex="m" /></th>
                    <th className="text-left py-2 text-slate-500">Weight</th>
                    <th className="text-left py-2 text-slate-500">Profit</th>
                    <th className="text-left py-2 text-slate-500">Next W</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2">{r.label}</td>
                      <td>{roundTo(r.sigma, 3)}</td>
                      <td>{roundTo(lam + (1 - lam) * Math.pow(r.sigma, eta), 3)}</td>
                      <td>{roundTo(r.score, 3)}</td>
                      <td>{roundTo(r.m, 2)}</td>
                      <td>{roundTo((r.weight ?? 0) * 100, 1)}%</td>
                      <td>{roundTo(r.profit, 2)}</td>
                      <td>{roundTo(r.wealth_new, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      </div>
      </section>
    </div>
  );
}
