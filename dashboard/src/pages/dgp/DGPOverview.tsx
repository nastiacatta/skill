import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import PageHeader from '@/components/dashboard/PageHeader';
import MathBlock from '@/components/dashboard/MathBlock';
import ChartCard from '@/components/dashboard/ChartCard';
import { DGP_OPTIONS, generateDGP, type DGPId } from '@/lib/coreMechanism/dgpSimulator';

function roundTo(v: number, d = 3): number {
  return Number(v.toFixed(d));
}

export default function DGPOverview() {
  const [dgpId, setDgpId] = useState<DGPId>('baseline');
  const [seed, setSeed] = useState(42);
  const [rounds, setRounds] = useState(10000);
  const [nAgents, setNAgents] = useState(4);

  const series = useMemo(
    () => generateDGP(dgpId, seed, rounds, nAgents),
    [dgpId, seed, rounds, nAgents]
  );

  const chartData = useMemo(
    () =>
      series.rounds.map((r) => ({
        round: r.t,
        y: roundTo(r.y, 3),
        r_avg: roundTo(
          r.reports.reduce((a, b) => a + b, 0) / r.reports.length,
          3
        ),
        ...Object.fromEntries(
          r.reports.map((v, i) => [`r_${i}`, roundTo(v, 3)])
        ),
      })),
    [series]
  );

  const selectedDGP = DGP_OPTIONS.find((d) => d.id === dgpId);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <PageHeader
        title="DGP"
        description="Data generating process: how truth and forecaster reports are produced."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">DGP controls</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-500">DGP type</span>
                <select
                  value={dgpId}
                  onChange={(e) => setDgpId(e.target.value as DGPId)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mt-1"
                >
                  {DGP_OPTIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Seed</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mt-1"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Rounds</span>
                <input
                  type="number"
                  min={100}
                  max={10000}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mt-1"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Agents</span>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={nAgents}
                  onChange={(e) => setNAgents(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mt-1"
                />
              </label>
            </div>
          </div>

          {selectedDGP && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Formula</h3>
              <MathBlock latex={selectedDGP.formula} />
              <p className="text-xs text-slate-500 mt-2">{selectedDGP.description}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Truth source: {selectedDGP.truthSource}
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <ChartCard
            title="Truth and reports over time"
            subtitle="y (outcome) vs mean report and per-agent reports"
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="y" name="y (truth)" stroke="#0f172a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="r_avg" name="r̄ (mean report)" stroke="#2563eb" strokeWidth={2} dot={false} />
                {nAgents <= 4 &&
                  Array.from({ length: nAgents }, (_, i) => (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={`r_${i}`}
                      name={`r_${i}`}
                      stroke={['#94a3b8', '#0d9488', '#8b5cf6', '#ec4899'][i]}
                      strokeWidth={1}
                      strokeOpacity={0.7}
                      dot={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">DGP options</h3>
            <div className="space-y-2">
              {DGP_OPTIONS.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-3 p-2 rounded-lg border border-slate-100 hover:bg-slate-50"
                >
                  <span className="text-xs font-medium text-slate-700 w-24 shrink-0">
                    {d.label}
                  </span>
                  <span className="text-xs text-slate-500">{d.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
