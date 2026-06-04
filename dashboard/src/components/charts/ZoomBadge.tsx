interface ZoomBadgeProps {
  isZoomed: boolean;
  onReset: () => void;
}

export default function ZoomBadge({ isZoomed, onReset }: ZoomBadgeProps) {
  if (!isZoomed) return null;
  return (
    <button
      onClick={onReset}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-medium hover:bg-teal-100 border border-teal-200 transition-colors ml-1"
      title="Reset chart zoom"
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 8a6 6 0 1011-3.5L14 4M14 4V1M14 4H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Reset zoom
    </button>
  );
}
