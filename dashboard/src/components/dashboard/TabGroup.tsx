import clsx from 'clsx';

interface TabGroupProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export default function TabGroup({ tabs, active, onChange }: TabGroupProps) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-4 w-fit">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            active === tab.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
