/**
 * DGP stage: selectable DGP variants, explanation, output objects, chart preview
 */
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useExplorer } from '@/lib/explorerStore';
import { DGP_OPTIONS, generateDGP, type DGPId } from '@/lib/coreMechanism/dgpSimulator';
import { PALETTE } from '@/lib/palette';
import VariantSelector from '@/components/thesis/VariantSelector';
import FormulaCallout from '@/components/thesis/FormulaCallout';
import ObjectInspector from '@/components/thesis/ObjectInspector';
import { fmtNum } from '@/lib/formatters';

export default function DGPPanel() {
  const { selectedDGP, setSelectedDGP, rounds, seed, nAgents } = useExplorer();

  const dgpSeries = useMemo(() => {
    const series = generateDGP(selectedDGP, seed, Math.min(rounds, 100), nAgents);
    return series.rounds.slice(0, 50).map((r, i) => ({
      t: i + 1,
      y: r.y,
      meanReport: r.reports.reduce((a, b) => a + b, 0) / r.reports.length,
    }));
  }, [selectedDGP, seed, rounds, nAgents]);

  const selected = DGP_OPTIONS.find((d) => d.id === selectedDGP);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The DGP (data generating process) controls how the latent truth and agent signals are produced. Non-stationarity and correlation enter here.
      </p>

      <VariantSelector
        label="DGP variant"
        value={selectedDGP}
        options={DGP_OPTIONS.map((d) => ({
          id: d.id,
          label: d.label,
          description: d.description,
        }))}
        onChange={(id) => setSelectedDGP(id as DGPId)}
      />

      {selected?.formula && (
        <FormulaCallout label="Outcome and signals" latex={selected.formula} />
      )}

      <ObjectInspector
        title="Output objects passed to next stage"
        items={[
          { key: 'Latent truth / outcome process', value: 'y_t per round' },
          { key: 'Signal environment', value: 'reports r_i for each agent' },
          { key: 'Regime / drift state', value: selected?.truthSource === 'endogenous' ? 'AR(1) shared state' : 'Exogenous draws' },
        ]}
      />

      {dgpSeries.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500 mb-2">Preview: outcome y and mean report (first 50 rounds)</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dgpSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="t" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 1]} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? fmtNum(v, 4) : String(v))} />
              <Line type="monotone" dataKey="y" name="y" stroke={PALETTE.slate} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="meanReport" name="mean r" stroke={PALETTE.imperial} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
