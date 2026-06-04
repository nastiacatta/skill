/**
 * Reusable selector for variant options (DGP, weighting, behaviour preset, etc.)
 */
interface SelectOption {
  id: string;
  label: string;
  description?: string;
}

interface VariantSelectorProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (id: string) => void;
}

export default function VariantSelector({ label, value, options, onChange }: VariantSelectorProps) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {options.find((o) => o.id === value)?.description && (
        <p className="text-xs text-slate-500 mt-1">
          {options.find((o) => o.id === value)?.description}
        </p>
      )}
    </label>
  );
}
