import { motion, useReducedMotion } from 'framer-motion';
import { fmt } from '@/components/lab/shared';

interface MechanismResponseCardProps {
  metrics: {
    skillRecoveryRounds: number | null;
    wealthPenalty: number;
    aggregateContamination: number;
    concentrationImpact: number;
    ewmaHalfLife: number;
  };
  attackVector: string;
  defenceMechanism: string;
  effectiveness: number;
}

export default function MechanismResponseCard({
  metrics,
  attackVector,
  defenceMechanism,
  effectiveness,
}: MechanismResponseCardProps) {
  // framer-motion ignores prefers-reduced-motion unless told; settle instantly.
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.2 }}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      {/* Metric grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric
          label="Skill recovery"
          value={metrics.skillRecoveryRounds != null ? `${metrics.skillRecoveryRounds} rds` : '—'}
        />
        <Metric label="Wealth penalty" value={fmt(metrics.wealthPenalty, 2)} />
        <Metric label="Contamination" value={fmt(metrics.aggregateContamination)} />
        <Metric label="Δ Gini" value={fmt(metrics.concentrationImpact)} />
      </div>

      {/* Descriptions */}
      <div className="space-y-1.5 text-[13px] text-slate-600">
        <p>
          <span className="font-semibold text-slate-500">Attack:</span> {attackVector}
        </p>
        <p>
          <span className="font-semibold text-slate-500">Defence:</span> {defenceMechanism}
        </p>
      </div>

      {/* Effectiveness bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[13px] mb-1">
          <span className="font-semibold text-slate-500">Effectiveness</span>
          <span className="font-mono font-semibold text-slate-800">{fmt(effectiveness, 1)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, effectiveness))}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-semibold font-mono text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}
