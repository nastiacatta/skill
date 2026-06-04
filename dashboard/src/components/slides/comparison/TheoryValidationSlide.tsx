import SlideWrapper from '../SlideWrapper';
import { useComparisonData } from '../../../lib/comparison/useComparisonData';
import {
  aggregateByMethod,
  formatDelta,
  deltaColor,
} from '../../../lib/comparison/comparisonUtils';
import type {
  DgpData,
  RealComparisonData,
  AggregatedRow,
  ComparisonRow,
  ThesisClaim,
} from '../../../lib/comparison/types';

/* ── Helpers ─────────────────────────────────────────────────── */

type SupportLevel = 'confirms' | 'weak-confirms' | 'supports' | 'counter-evidence';

interface EvidenceItem {
  dataset: string;
  delta: number;
  supportLevel: SupportLevel;
}

const SUPPORT_COLORS: Record<SupportLevel, string> = {
  confirms: 'text-emerald-600',
  'weak-confirms': 'text-amber-500',
  supports: 'text-emerald-600',
  'counter-evidence': 'text-red-500',
};

const SUPPORT_LABELS: Record<SupportLevel, string> = {
  confirms: '✓ Confirms',
  'weak-confirms': '~ Weak confirmation',
  supports: '✓ Supports',
  'counter-evidence': '✗ Counter-evidence',
};

function findRow<T extends { method: string }>(
  rows: T[],
  method: string,
): T | undefined {
  return rows.find((r) => r.method === method);
}

/* ── Claim card component ───────────────────────────────────── */

function ClaimCard({
  claim,
  evidence,
}: {
  claim: ThesisClaim;
  evidence: EvidenceItem[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h4 className="text-base font-bold text-slate-900">{claim.title}</h4>
      <p className="mt-1 text-sm text-slate-600 leading-relaxed">
        {claim.claim}
      </p>

      {/* Evidence rows */}
      <div className="mt-4 flex flex-col gap-2">
        {evidence.map((ev) => (
          <div
            key={ev.dataset}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {ev.dataset}
              </span>
              <span className={`text-sm font-semibold ${SUPPORT_COLORS[ev.supportLevel]}`}>
                {SUPPORT_LABELS[ev.supportLevel]}
              </span>
            </div>
            <span className={`font-mono text-sm ${deltaColor(ev.delta)}`}>
              ΔCRPS {formatDelta(ev.delta)}
            </span>
          </div>
        ))}
      </div>

      {/* Caveat */}
      <p className="mt-4 text-xs text-slate-400 italic leading-relaxed">
        Caveat: {claim.caveat}
      </p>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */

export default function TheoryValidationSlide() {
  const thesis = useComparisonData<ThesisClaim[]>('data/thesis_results.json');
  const dgp = useComparisonData<DgpData>(
    'data/core 2/experiments/master_comparison/data/master_comparison.json',
  );
  const elec = useComparisonData<RealComparisonData>(
    'data/real_data/elia_electricity/data/comparison.json',
  );
  const wind = useComparisonData<RealComparisonData>(
    'data/real_data/elia_wind/data/comparison.json',
  );

  const anyLoading = thesis.loading || dgp.loading || elec.loading || wind.loading;

  /* Extract mechanism deltas from each dataset */
  let dgpMechDelta: number | null = null;
  if (dgp.data) {
    const agg = aggregateByMethod(dgp.data.rows);
    const mechanism = findRow<AggregatedRow>(agg, 'mechanism');
    if (mechanism) dgpMechDelta = mechanism.meanDelta;
  }

  let elecMechDelta: number | null = null;
  if (elec.data) {
    const mechanism = findRow<ComparisonRow>(elec.data.rows, 'mechanism');
    if (mechanism) elecMechDelta = mechanism.delta_crps_vs_equal;
  }

  let windMechDelta: number | null = null;
  if (wind.data) {
    const mechanism = findRow<ComparisonRow>(wind.data.rows, 'mechanism');
    if (mechanism) windMechDelta = mechanism.delta_crps_vs_equal;
  }

  /* Find the two target claims */
  const skillClaim = thesis.data?.find((c) => c.id === 'skill_improves_accuracy') ?? null;
  const equalClaim = thesis.data?.find((c) => c.id === 'equal_is_strong_baseline') ?? null;

  /* Build evidence arrays */
  const skillEvidence: EvidenceItem[] = [];
  if (dgpMechDelta !== null) {
    skillEvidence.push({ dataset: 'DGP', delta: dgpMechDelta, supportLevel: 'confirms' });
  }
  if (elecMechDelta !== null) {
    skillEvidence.push({ dataset: 'Electricity', delta: elecMechDelta, supportLevel: 'weak-confirms' });
  }
  if (windMechDelta !== null) {
    skillEvidence.push({ dataset: 'Wind', delta: windMechDelta, supportLevel: 'confirms' });
  }

  const equalEvidence: EvidenceItem[] = [];
  if (elecMechDelta !== null) {
    equalEvidence.push({ dataset: 'Electricity', delta: elecMechDelta, supportLevel: 'supports' });
  }
  if (windMechDelta !== null) {
    equalEvidence.push({ dataset: 'Wind', delta: windMechDelta, supportLevel: 'counter-evidence' });
  }
  if (dgpMechDelta !== null) {
    equalEvidence.push({ dataset: 'DGP', delta: dgpMechDelta, supportLevel: 'counter-evidence' });
  }

  return (
    <SlideWrapper>
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
        Comparison
      </h2>
      <h3 className="text-2xl font-bold text-slate-900">
        Theory Validation
      </h3>
      <p className="mt-2 text-sm text-slate-500 max-w-2xl">
        How do the real-data results validate or challenge the project's theory
        claims? Each claim is tested against DGP, electricity, and wind evidence.
      </p>

      {/* Loading spinner */}
      {anyLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          Loading comparison data…
        </div>
      )}

      {/* Error banners */}
      {thesis.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Project data failed to load: {thesis.error}
        </div>
      )}
      {dgp.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          DGP data failed to load: {dgp.error}
        </div>
      )}
      {elec.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Electricity data failed to load: {elec.error}
        </div>
      )}
      {wind.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Wind data failed to load: {wind.error}
        </div>
      )}

      {/* Claim cards */}
      {!anyLoading && (
        <div className="mt-8 flex flex-col gap-6">
          {skillClaim && skillEvidence.length > 0 && (
            <ClaimCard claim={skillClaim} evidence={skillEvidence} />
          )}
          {equalClaim && equalEvidence.length > 0 && (
            <ClaimCard claim={equalClaim} evidence={equalEvidence} />
          )}

          {/* Fallback: project data failed but we still have data evidence */}
          {!thesis.data && (skillEvidence.length > 0 || equalEvidence.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h4 className="text-base font-bold text-slate-900">
                Dataset Evidence (project claims unavailable)
              </h4>
              <div className="mt-4 flex flex-col gap-2">
                {dgpMechDelta !== null && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      DGP
                    </span>
                    <span className={`font-mono text-sm ${deltaColor(dgpMechDelta)}`}>
                      ΔCRPS {formatDelta(dgpMechDelta)}
                    </span>
                  </div>
                )}
                {elecMechDelta !== null && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Electricity
                    </span>
                    <span className={`font-mono text-sm ${deltaColor(elecMechDelta)}`}>
                      ΔCRPS {formatDelta(elecMechDelta)}
                    </span>
                  </div>
                )}
                {windMechDelta !== null && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Wind
                    </span>
                    <span className={`font-mono text-sm ${deltaColor(windMechDelta)}`}>
                      ΔCRPS {formatDelta(windMechDelta)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </SlideWrapper>
  );
}
