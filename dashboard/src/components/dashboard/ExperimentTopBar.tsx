import { useStore } from '@/lib/store';
import type { ExperimentMeta } from '@/lib/types';

/** Project question groups (README: aggregation, intermittency, sybil, arbitrage, adaptation). */
const THESIS_GROUP_ORDER = [
  'aggregation',
  'intermittency',
  'sybil',
  'arbitrage',
  'adaptation',
  'core',
  'other',
] as const;

const THESIS_GROUP_LABELS: Record<string, string> = {
  aggregation: 'Aggregation',
  intermittency: 'Intermittency',
  sybil: 'Sybil',
  arbitrage: 'Arbitrage',
  adaptation: 'Adaptation',
  core: 'Core / invariants',
  other: 'Other',
};

function getThesisGroup(exp: ExperimentMeta): string {
  if (exp.family && THESIS_GROUP_ORDER.includes(exp.family as (typeof THESIS_GROUP_ORDER)[number])) {
    return exp.family;
  }
  if (exp.name.includes('sybil')) return 'sybil';
  if (exp.name.includes('arbitrage') || exp.name.includes('manipulat')) return 'arbitrage';
  if (exp.name.includes('intermittency') || exp.name.includes('bursty') || exp.name.includes('missing')) return 'intermittency';
  if (exp.name.includes('aggregation') || exp.name.includes('forecast_aggregation') || exp.name.includes('calibration')) return 'aggregation';
  if (exp.name.includes('skill') || exp.name.includes('parameter_sweep') || exp.name.includes('fixed_deposit')) return 'adaptation';
  if (exp.block === 'core') return 'core';
  return 'other';
}

function groupExperimentsByThesis(experiments: ExperimentMeta[]): Map<string, ExperimentMeta[]> {
  const map = new Map<string, ExperimentMeta[]>();
  for (const exp of experiments) {
    const group = getThesisGroup(exp);
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(exp);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return map;
}

interface ExperimentTopBarProps {
  /** When set, only these experiments are shown (e.g. filtered by tab on Experiments page). */
  experimentsFilter?: ExperimentMeta[] | null;
}

export default function ExperimentTopBar({ experimentsFilter }: ExperimentTopBarProps = {}) {
  const { experiments, selectedExperiment, setSelectedExperiment } = useStore();
  const source = experimentsFilter ?? experiments;
  const grouped = groupExperimentsByThesis(source);

  return (
    <div
      className="flex flex-wrap items-center gap-3 py-3 px-6"
      style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}
    >
      <label
        htmlFor="experiment-select"
        className="eyebrow shrink-0"
        style={{ color: 'var(--navy)', fontSize: 11 }}
      >
        Experiment (by research question)
      </label>
      <div className="relative">
        <select
          id="experiment-select"
          value={selectedExperiment?.name ?? ''}
          onChange={(e) => {
            const exp = experiments.find((x) => x.name === e.target.value);
            setSelectedExperiment(exp ?? null);
          }}
          className="appearance-none pl-3 pr-9 py-1.5 min-w-[240px] focus:outline-none transition-colors cursor-pointer"
          style={{
            fontSize: 14,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--ink)',
            borderRadius: 4,
          }}
        >
          <option value="">Select experiment</option>
          {THESIS_GROUP_ORDER.map((groupKey) => {
            const list = grouped.get(groupKey);
            if (!list?.length) return null;
            const label = THESIS_GROUP_LABELS[groupKey] ?? groupKey;
            return (
              <optgroup key={groupKey} label={label}>
                {list.map((exp) => (
                  <option key={exp.name} value={exp.name}>
                    {exp.displayName}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--ink-faint)' }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
