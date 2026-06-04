import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
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
import {
  simulateScenario,
  PRESET_META,
  type BehaviourPresetId,
  type BehaviourControls,
} from '@/lib/behaviour/scenarioSimulator';

const BEHAVIOUR_SYMBOLS = [
  { symbol: 'y', meaning: 'Outcome' },
  { symbol: 'r_i', meaning: 'Agent report' },
  { symbol: 'b_i', meaning: 'Stake' },
  { symbol: 'N_eff', meaning: 'Effective participants' },
  { symbol: 'Gini', meaning: 'Wealth concentration' },
];

const INITIAL_CONTROLS: BehaviourControls = {
  preset: 'baseline',
  rounds: 10000,
  seed: 7,
  lam: 0.3,
  eta: 1.8,
  sigmaMin: 0.2,
  gamma: 3.5,
  rho: 0.18,
  omegaMax: 0.35,
  manipulation: 0.65,
  participationShock: 0.3,
  sybilCount: 3,
};

function roundTo(v: number, d = 3): number {
  return Number(v.toFixed(d));
}

export default function BehaviourOverview() {
  const [controls, setControls] = useState<BehaviourControls>(INITIAL_CONTROLS);

  const selectedScenario = useMemo(
    () => simulateScenario(controls.preset, controls),
    [controls]
  );

  const scenarioComparison = useMemo(
    () =>
      (Object.keys(PRESET_META) as BehaviourPresetId[]).map((preset) =>
        simulateScenario(preset, controls).summary
      ),
    [controls]
  );

  const presetMeta = PRESET_META[controls.preset];

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-lg font-semibold text-slate-900">Behaviours</h1>
        <SymbolGlossary entries={BEHAVIOUR_SYMBOLS} className="sm:max-w-xs" />
      </div>

      <section className="space-y-4" aria-labelledby="scenario-experiment-heading">
        <h2 id="scenario-experiment-heading" className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-2">
          Scenario experiment
        </h2>
        <p className="text-sm text-slate-600">
          Choose a scenario (baseline, manipulation, participation shock, sybils), set rounds and parameters, then compare forecast quality and concentration across presets.
        </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-teal-50/50 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Scenario controls</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-500">Scenario</span>
                <select
                  value={controls.preset}
                  onChange={(e) =>
                    setControls((c) => ({ ...c, preset: e.target.value as BehaviourPresetId }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mt-1"
                >
                  {(Object.keys(PRESET_META) as BehaviourPresetId[]).map((p) => (
                    <option key={p} value={p}>
                      {PRESET_META[p].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Rounds</span>
                <input
                  type="number"
                  min={100}
                  max={10000}
                  step={500}
                  value={controls.rounds}
                  onChange={(e) =>
                    setControls((c) => ({ ...c, rounds: Math.max(100, Number(e.target.value)) }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mt-1"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Seed</span>
                <input
                  type="range"
                  min={1}
                  max={50}
                  step={1}
                  value={controls.seed}
                  onChange={(e) => setControls((c) => ({ ...c, seed: Number(e.target.value) }))}
                  className="w-full accent-teal-600 mt-1"
                />
                <span className="text-xs text-slate-600">{controls.seed}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Manipulation</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={controls.manipulation}
                  onChange={(e) =>
                    setControls((c) => ({ ...c, manipulation: Number(e.target.value) }))
                  }
                  className="w-full accent-teal-600 mt-1"
                />
                <span className="text-xs text-slate-600">{roundTo(controls.manipulation, 2)}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Participation shock</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={controls.participationShock}
                  onChange={(e) =>
                    setControls((c) => ({ ...c, participationShock: Number(e.target.value) }))
                  }
                  className="w-full accent-teal-600 mt-1"
                />
                <span className="text-xs text-slate-600">{roundTo(controls.participationShock, 2)}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Sybil count</span>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  value={controls.sybilCount}
                  onChange={(e) =>
                    setControls((c) => ({ ...c, sybilCount: Number(e.target.value) }))
                  }
                  className="w-full accent-teal-600 mt-1"
                />
                <span className="text-xs text-slate-600">{controls.sybilCount}</span>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">ω_max</span>
                <input
                  type="range"
                  min={0.2}
                  max={0.8}
                  step={0.01}
                  value={controls.omegaMax}
                  onChange={(e) =>
                    setControls((c) => ({ ...c, omegaMax: Number(e.target.value) }))
                  }
                  className="w-full accent-teal-600 mt-1"
                />
                <span className="text-xs text-slate-600">{roundTo(controls.omegaMax, 2)}</span>
              </label>
            </div>
            <p className="text-xs text-slate-600 mt-3">{presetMeta.description}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {presetMeta.levers.map((l) => (
                <span
                  key={l}
                  className="rounded-full bg-teal-100 text-teal-700 px-2 py-0.5 text-[10px]"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Skill × stake params</h2>
            <div className="space-y-2">
              <label className="block">
                <span className="text-xs text-slate-500">λ</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={controls.lam}
                  onChange={(e) => setControls((c) => ({ ...c, lam: Number(e.target.value) }))}
                  className="w-full accent-teal-600"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">η, σ_min, γ</span>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    min={1}
                    max={4}
                    step={0.1}
                    value={controls.eta}
                    onChange={(e) => setControls((c) => ({ ...c, eta: Number(e.target.value) }))}
                    className="w-16 rounded border px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    min={0.05}
                    max={0.6}
                    step={0.01}
                    value={controls.sigmaMin}
                    onChange={(e) =>
                      setControls((c) => ({ ...c, sigmaMin: Number(e.target.value) }))
                    }
                    className="w-16 rounded border px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    min={0.5}
                    max={6}
                    step={0.1}
                    value={controls.gamma}
                    onChange={(e) => setControls((c) => ({ ...c, gamma: Number(e.target.value) }))}
                    className="w-16 rounded border px-2 py-1 text-xs"
                  />
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase text-slate-500">Mean error</p>
              <p className="text-lg font-semibold text-slate-800">
                {roundTo(selectedScenario.summary.meanError, 3)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase text-slate-500">Mean participation</p>
              <p className="text-lg font-semibold text-slate-800">
                {roundTo(selectedScenario.summary.meanParticipation, 2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase text-slate-500">Mean N_eff</p>
              <p className="text-lg font-semibold text-slate-800">
                {roundTo(selectedScenario.summary.meanNEff, 2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase text-slate-500">Final Gini</p>
              <p className="text-lg font-semibold text-slate-800">
                {roundTo(selectedScenario.summary.finalGini, 3)}
              </p>
            </div>
          </div>

          <ChartCard title="Selected scenario over time" subtitle="Error, N_eff, participation">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={selectedScenario.rounds}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="error" name="error" stroke={PALETTE.coral} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="nEff" name="N_eff" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="participation" name="participation" stroke="#0f172a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Final wealth by identity" subtitle="Per agent after simulation">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={selectedScenario.finalAgents.map((a) => ({
                  label: a.label,
                  Wealth: roundTo(a.finalWealth, 2),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="Wealth" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Across all presets" subtitle="Comparison by scenario">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={scenarioComparison.map((s) => ({
                  label: s.label,
                  'Mean error': roundTo(s.meanError, 3),
                  'Mean N_eff': roundTo(s.meanNEff, 2),
                  'Final Gini': roundTo(s.finalGini, 3),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="Mean error" stroke={PALETTE.coral} fill="#fecaca" />
                <Area type="monotone" dataKey="Mean N_eff" stroke="#2563eb" fill="#bfdbfe" />
                <Area type="monotone" dataKey="Final Gini" stroke="#0f172a" fill="#cbd5e1" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Scenario comparison" subtitle="Summary table">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 text-slate-500">Scenario</th>
                    <th className="text-left py-2 text-slate-500">Mean error</th>
                    <th className="text-left py-2 text-slate-500">Participation</th>
                    <th className="text-left py-2 text-slate-500">N_eff</th>
                    <th className="text-left py-2 text-slate-500">Final Gini</th>
                    <th className="text-left py-2 text-slate-500">Final r̂</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarioComparison.map((s) => (
                    <tr key={s.preset}>
                      <td className="py-2">{s.label}</td>
                      <td>{roundTo(s.meanError, 3)}</td>
                      <td>{roundTo(s.meanParticipation, 2)}</td>
                      <td>{roundTo(s.meanNEff, 2)}</td>
                      <td>{roundTo(s.finalGini, 3)}</td>
                      <td>{roundTo(s.finalAggregate, 3)}</td>
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
