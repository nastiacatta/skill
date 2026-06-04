import type { FC } from 'react';

/* 16×16 inline SVG icons — stroke-based, currentColor */

const LightbulbIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 1.5V2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M12.5 4L11.8 4.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M3.5 4L4.2 4.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M5.5 11V10.5C5.5 9.5 4.5 8.5 4.5 7C4.5 5.1 6.1 3.5 8 3.5C9.9 3.5 11.5 5.1 11.5 7C11.5 8.5 10.5 9.5 10.5 10.5V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 13H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M6.5 11H9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const CheckIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WarningIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2L1.5 13.5H14.5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M8 7V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="8" cy="12" r="0.75" fill="currentColor" />
  </svg>
);

const ICONS = {
  info: LightbulbIcon,
  success: CheckIcon,
  warning: WarningIcon,
} as const;

interface InsightCalloutProps {
  title: string;
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning';
}

/**
 * Academic callout — coloured left rule, warm tint, no gradients.
 */
export default function InsightCallout({ title, children, variant = 'info' }: InsightCalloutProps) {
  const config = {
    info:    { accent: 'var(--navy)',    tint: 'var(--navy-tint)',    title: 'var(--navy-ink)', body: '#26324e' },
    success: { accent: 'var(--teal)',    tint: 'var(--teal-tint)',    title: 'var(--teal-deep)', body: '#194c48' },
    warning: { accent: 'var(--amber)',   tint: 'var(--amber-tint)',   title: '#78350f',          body: '#5c2a07' },
  }[variant];

  const Icon = ICONS[variant];

  return (
    <div
      className="flex gap-3 items-start p-4"
      style={{
        background: config.tint,
        borderLeft: `3px solid ${config.accent}`,
        borderRadius: 4,
      }}
    >
      <div
        className="shrink-0 flex items-center justify-center mt-0.5"
        style={{
          width: 24, height: 24, borderRadius: '50%',
          background: '#fff',
          border: `1.5px solid ${config.accent}`,
          color: config.accent,
        }}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="font-serif"
          style={{ fontSize: 14, fontWeight: 600, color: config.title, marginBottom: 3 }}
        >
          {title}
        </div>
        <div
          className="leading-relaxed"
          style={{ fontSize: 13, color: config.body, lineHeight: 1.55 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
