interface RunBadgeProps {
  mode: 'live' | 'cached' | 'demo';
  seed?: number;
  rounds?: number;
  agents?: number;
  timestamp?: number;
}

const MODE_STYLES = {
  live: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Live run' },
  cached: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', text: 'text-amber-700', label: 'Cached' },
  demo: { bg: 'bg-slate-100', border: 'border-slate-200', dot: 'bg-slate-400', text: 'text-slate-600', label: 'Demo data' },
} as const;

export default function RunBadge({ mode, seed, rounds, agents }: RunBadgeProps) {
  const s = MODE_STYLES[mode];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${s.bg} ${s.border} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${mode === 'live' ? 'animate-pulse' : ''}`} />
      <span>{s.label}</span>
      {seed != null && <span>seed={seed}</span>}
      {rounds != null && <span>T={rounds}</span>}
      {agents != null && <span>N={agents}</span>}
    </div>
  );
}
