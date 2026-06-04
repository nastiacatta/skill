import type { SkillWagerPoint } from '@/lib/types';
import { fmtNum, agentDisplayName } from '@/lib/formatters';

interface Props {
  data: SkillWagerPoint[];
  round: number;
}

export default function AgentStateTable({ data, round }: Props) {
  const roundData = data.filter(d => d.t === round);

  if (roundData.length === 0) {
    return <div className="text-sm text-slate-400 py-4">No data for round {round}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-2 text-slate-500 font-medium">Agent</th>
            <th className="text-center py-2 px-2 text-slate-500 font-medium">Active</th>
            <th className="text-right py-2 px-2 text-slate-500 font-medium">σ (Skill)</th>
            <th className="text-right py-2 px-2 text-slate-500 font-medium">Wager</th>
            <th className="text-right py-2 px-2 text-slate-500 font-medium">m/b</th>
            <th className="text-right py-2 px-2 text-slate-500 font-medium">Profit</th>
            <th className="text-right py-2 px-2 text-slate-500 font-medium">Cum. Profit</th>
          </tr>
        </thead>
        <tbody>
          {roundData.map(d => (
            <tr key={d.agent} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-1.5 px-2 font-medium text-slate-700">{agentDisplayName(d.agent)}</td>
              <td className="py-1.5 px-2 text-center">
                <span className={`inline-block w-2 h-2 rounded-full ${d.missing ? 'bg-slate-300' : 'bg-emerald-400'}`} />
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-slate-600">{fmtNum(d.sigma)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums text-slate-600">{d.missing ? '—' : fmtNum(d.wager)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums text-slate-600">{d.mOverB != null ? fmtNum(d.mOverB) : '—'}</td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${d.profit > 0 ? 'text-emerald-600' : d.profit < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                {d.missing ? '—' : fmtNum(d.profit)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${d.cumProfit > 0 ? 'text-emerald-600' : d.cumProfit < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                {fmtNum(d.cumProfit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
