interface Entry {
  symbol: string;
  meaning: string;
}

interface SymbolGlossaryProps {
  entries: Entry[];
  className?: string;
}

export default function SymbolGlossary({ entries, className = '' }: SymbolGlossaryProps) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Symbols</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {entries.map(({ symbol, meaning }) => (
          <span key={symbol} className="contents">
            <dt className="font-mono text-slate-700">{symbol}</dt>
            <dd className="text-slate-600">{meaning}</dd>
          </span>
        ))}
      </dl>
    </div>
  );
}
