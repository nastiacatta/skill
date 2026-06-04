/**
 * Compact display of named objects (e.g. DGP outputs passed to next stage)
 */
interface ObjectInspectorProps {
  title?: string;
  items: { key: string; value: string }[];
}

export default function ObjectInspector({ title, items }: ObjectInspectorProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      {title && (
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">{title}</h4>
      )}
      <ul className="text-xs text-slate-700 space-y-1">
        {items.map((item) => (
          <li key={item.key}>
            <strong>{item.key}:</strong> {item.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
