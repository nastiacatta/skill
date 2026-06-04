import type { SimResult } from '@/lib/mechanismExplorer/types';
import { AGENT_COLORS } from '@/lib/formatters';
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

interface OutcomeStudioTabProps {
  simData: SimResult | null;
  currentRound: number;
  onRoundChange?: (r: number) => void;
}

export default function OutcomeStudioTab({
  simData,
  currentRound,
  onRoundChange,
}: OutcomeStudioTabProps) {
  if (!simData) {
    return (
      <p className="text-slate-500 text-sm text-center py-12">
        Run the simulation first (Mechanism builder → Run).
      </p>
    );
  }

  const rd = simData.rounds[currentRound];
  const N = simData.N;
  const aggErr = Math.abs(rd.aggregate.q50 - rd.y_true);

  // Pre-event
  const range = 1.2;
  const toPct = (v: number) => Math.max(0, Math.min(100, (v / range) * 100));
  const q50x = toPct(rd.aggregate.q50);
  const q10x = toPct(rd.aggregate.q10);
  const q90x = toPct(rd.aggregate.q90);
  const ytruex = toPct(rd.y_true);

  // Top winners/losers
  const ranked = rd.profits
    .map((p, i) => ({ i, p }))
    .sort((a, b) => b.p - a.p);
  const topWinners = ranked.slice(0, 3);
  const topLosers = ranked.slice(-2).reverse();

  // Wealth over time
  const wealthSeries = simData.rounds.map((r, t) => {
    const point: Record<string, number | string> = { t: t + 1 };
    for (let i = 0; i < N; i++) {
      point[`F${i + 1}`] = Math.round(r.wealth[i] * 10) / 10;
    }
    return point;
  });

  return (
    <div className="space-y-8">
      {onRoundChange && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => onRoundChange(Math.max(0, currentRound - 1))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50"
          >
            ← Prev round
          </button>
          <span className="text-sm text-slate-600">
            Round {currentRound + 1} / {simData.T}
          </span>
          <button
            type="button"
            onClick={() =>
              onRoundChange(Math.min(simData.T - 1, currentRound + 1))
            }
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50"
          >
            Next round →
          </button>
        </div>
      )}
      {/* Pre-event */}
      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Pre-event — Round {currentRound + 1}
        </h3>
        <p className="text-sm text-slate-600 mb-3">
          What forecast did the market produce, and who shaped it?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              Aggregate median
            </div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">
              {rd.aggregate.q50.toFixed(3)}
            </div>
            <div className="text-[10px] text-slate-400">
              vs outcome {rd.y_true.toFixed(3)}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              Active forecasters
            </div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">
              {rd.active.filter(Boolean).length} / {N}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              N_eff (1/HHI)
            </div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">
              {rd.nEff.toFixed(1)}
            </div>
            <div className="text-[10px] text-slate-400">effective market size</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              HHI concentration
            </div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">
              {rd.hhi.toFixed(3)}
            </div>
            <div className="text-[10px] text-slate-400">lower = more diverse</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              80% interval
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5">
              [{rd.aggregate.q10.toFixed(2)}, {rd.aggregate.q90.toFixed(2)}]
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              Abs. error
            </div>
            <div
              className={`text-lg font-semibold mt-0.5 ${
                aggErr < 0.1 ? 'text-teal-700' : 'text-red-600'
              }`}
            >
              {aggErr.toFixed(3)}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[11px] text-slate-500 mb-2">
            Forecast distribution — Round {currentRound + 1}
          </div>
          <div className="relative h-8 bg-slate-100 rounded-lg overflow-hidden">
            <div
              className="absolute top-0 h-full bg-blue-200 rounded-lg"
              style={{
                left: `${q10x}%`,
                width: `${q90x - q10x}%`,
              }}
            />
            <div
              className="absolute top-[10%] h-[80%] w-0.5 bg-blue-600 rounded-full"
              style={{ left: `${q50x}%` }}
            />
            <div
              className="absolute top-0 h-full w-0.5 rounded-full"
              style={{ left: `${ytruex}%`, backgroundColor: '#993C1D' }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-slate-400">
            <span style={{ marginLeft: `${q50x}%` }}>q̂</span>
            <span style={{ marginLeft: `${ytruex}%` }}>y</span>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-500 uppercase font-medium mb-2">
            Contributor weight shares
          </div>
          <ul className="space-y-2">
            {rd.weights.map((w, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <span className="w-8 text-xs">F{i + 1}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${(w * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="w-12 text-right tabular-nums text-xs">
                  {(w * 100).toFixed(1)}%
                </span>
                {!rd.active[i] && (
                  <span className="text-[10px] text-slate-400">absent</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Post-event */}
      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Post-event — Settlement
        </h3>
        <p className="text-sm text-slate-600 mb-3">
          What got distributed, to whom, and why?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              Total deposited
            </div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">
              Σb = {rd.totalDeposit.toFixed(1)}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              Total wager Σm
            </div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">
              {rd.totalWager.toFixed(1)}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              Total refunded
            </div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">
              {rd.totalRefund.toFixed(1)}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              Utility U offered
            </div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">
              {rd.U}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-medium">
              Total payout
            </div>
            <div className="text-lg font-semibold text-slate-800 mt-0.5">
              {rd.totalPayout.toFixed(1)}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[10px] text-slate-500 uppercase font-medium mb-2">
            Top winners / losers — Round {currentRound + 1}
          </div>
          <div className="flex gap-6 flex-wrap">
            <div>
              <div className="text-[11px] text-slate-500 mb-1">Winners</div>
              <ul className="space-y-1">
                {topWinners.map(({ i, p }) => (
                  <li key={i} className="text-sm flex justify-between gap-4">
                    <span>F{i + 1}</span>
                    <span className="text-teal-700 font-medium">
                      +{p.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 mb-1">Losers</div>
              <ul className="space-y-1">
                {topLosers.map(({ i, p }) => (
                  <li key={i} className="text-sm flex justify-between gap-4">
                    <span>F{i + 1}</span>
                    <span className="text-red-600 font-medium">
                      {p.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-500 uppercase font-medium mb-2">
            Wealth evolution (all rounds)
          </div>
          <div className="h-64 bg-white border border-slate-200 rounded-xl p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wealthSeries} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="t"
                  type="number"
                  tick={{ fontSize: 10 }}
                  stroke="#94a3b8"
                />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Legend />
                {Array.from({ length: N }, (_, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`F${i + 1}`}
                    stroke={AGENT_COLORS[i % AGENT_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    name={`F${i + 1}`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
