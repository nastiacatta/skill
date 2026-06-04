import type { ReactNode } from 'react';

interface DataStatesProps {
  message?: string;
  children?: ReactNode;
}

export function LoadingState({ message = 'Loading…' }: DataStatesProps) {
  return (
    <div
      className="p-8 flex flex-col items-center justify-center min-h-[200px]"
      role="status"
      aria-live="polite"
    >
      <div className="relative w-8 h-8 mb-3">
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid var(--border)' }}
        />
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{ border: '2px solid transparent', borderTopColor: 'var(--navy)' }}
        />
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{message}</p>
    </div>
  );
}

export function EmptyState({ message = 'No data available.', children }: DataStatesProps) {
  return (
    <div
      className="p-8 text-center min-h-[140px] flex flex-col items-center justify-center gap-2"
      style={{
        background: 'var(--card)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 6,
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ color: 'var(--ink-faint)', opacity: 0.55 }}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{message}</p>
      {children}
    </div>
  );
}

export function ErrorState({
  message = 'Something went wrong loading the data.',
  error,
  onRetry,
  children,
}: DataStatesProps & { error?: Error | null; onRetry?: () => void }) {
  return (
    <div
      className="p-4 mb-4"
      style={{
        background: 'var(--amber-tint)',
        border: '1px solid rgba(180, 83, 9, 0.25)',
        borderRadius: 6,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="shrink-0 inline-flex items-center justify-center rounded-full mt-0.5"
          style={{
            width: 28,
            height: 28,
            background: 'var(--amber)',
            color: '#fff',
            boxShadow: '0 1px 2px rgba(180, 83, 9, 0.25)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2L1.5 13.5H14.5L8 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M8 7V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="12" r="0.75" fill="currentColor" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: 13.5, fontWeight: 600, color: '#78350f' }}>{message}</p>
          {error?.message && (
            <p
              className="mt-1 font-mono break-words"
              style={{ fontSize: 11.5, color: 'rgba(120, 53, 15, 0.8)' }}
            >
              {error.message}
            </p>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 transition-colors"
              style={{
                padding: '6px 12px',
                borderRadius: 5,
                background: '#78350f',
                color: '#fbf9f4',
                fontSize: 12,
                fontWeight: 600,
                boxShadow: '0 1px 2px rgba(120, 53, 15, 0.25)',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.background = '#92400e';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.background = '#78350f';
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 8a6 6 0 1011-3.5L14 4M14 4V1M14 4H11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Retry
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
