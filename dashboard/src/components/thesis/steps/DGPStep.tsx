import MathBlock from '@/components/dashboard/MathBlock';
import type { WalkthroughDGPMeta } from '@/lib/types';

interface DGPStepProps {
  dgpMeta: WalkthroughDGPMeta | null;
}

export default function DGPStep({ dgpMeta }: DGPStepProps) {
  return (
    <div className="space-y-4">
      {!dgpMeta?.dgpId && (
        <p className="text-sm text-slate-500">
          Select an experiment to see its DGP (data generating process).
        </p>
      )}
      {dgpMeta?.dgpId && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">
              {dgpMeta.label ?? dgpMeta.dgpId}
            </h4>
            {dgpMeta.truthSource && (
              <p className="text-xs text-slate-500 mb-2">
                Truth source: {dgpMeta.truthSource}
              </p>
            )}
            {dgpMeta.description && (
              <p className="text-sm text-slate-700">{dgpMeta.description}</p>
            )}
          </div>
          {dgpMeta.formula && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">Outcome and signals</p>
              <MathBlock inline latex={dgpMeta.formula} />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {dgpMeta.driftRegime && (
              <div className="rounded border border-slate-200 p-2">
                <span className="text-xs text-slate-500">Drift regime</span>
                <p>{dgpMeta.driftRegime}</p>
              </div>
            )}
            {dgpMeta.signalPrecision && (
              <div className="rounded border border-slate-200 p-2">
                <span className="text-xs text-slate-500">Signal precision</span>
                <p>{dgpMeta.signalPrecision}</p>
              </div>
            )}
            {dgpMeta.correlationStructure && (
              <div className="rounded border border-slate-200 p-2 sm:col-span-2">
                <span className="text-xs text-slate-500">Correlation structure</span>
                <p>{dgpMeta.correlationStructure}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
