interface ParamConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

interface ParamConfigPanelProps {
  presetId: string;
  params: ParamConfig[];
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  onReset: () => void;
  isRunning?: boolean;
}

export default function ParamConfigPanel({
  params,
  values,
  onChange,
  onReset,
  isRunning,
}: ParamConfigPanelProps) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-4">
      {isRunning && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm">
          <span className="text-[14px] text-slate-500 animate-pulse">Running…</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[14px] font-semibold text-slate-600">Parameters</h4>
        <button
          type="button"
          onClick={onReset}
          className="text-[13px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {params.map((p) => {
          const val = values[p.key] ?? p.default;
          return (
            <div key={p.key}>
              <div className="flex items-baseline justify-between mb-1">
                <label className="text-[13px] font-medium text-slate-600">{p.label}</label>
                <span className="text-[13px] font-mono text-slate-800">
                  {val}
                  {p.unit ? ` ${p.unit}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-slate-400 w-6 text-right font-mono">{p.min}</span>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={val}
                  onChange={(e) => onChange(p.key, Number(e.target.value))}
                  className="flex-1 h-1.5 accent-blue-600"
                />
                <span className="text-[13px] text-slate-400 w-6 font-mono">{p.max}</span>
                <input
                  type="number"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={val}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!isNaN(v)) onChange(p.key, Math.min(p.max, Math.max(p.min, v)));
                  }}
                  className="w-14 rounded border border-slate-200 px-1.5 py-0.5 text-[13px] font-mono text-slate-700 text-center"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
