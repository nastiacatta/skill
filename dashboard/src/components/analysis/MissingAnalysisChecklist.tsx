/**
 * Missing analysis checklist (academic redesign).
 *
 * Sortable list of analysis gaps from analysis_gaps.json.
 * Priority badges (colour-coded), rationale, status.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { useState, useMemo } from 'react';
import type { AnalysisGap } from '../../lib/analysis/types';
import PanelShell from './PanelShell';

interface MissingAnalysisChecklistProps {
  gaps: AnalysisGap[];
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type Cfg = { bg: string; fg: string; border: string; dot: string };

const PRIORITY: Record<string, Cfg> = {
  critical: { bg: 'var(--crimson-tint)', fg: '#6a1221',         border: 'rgba(154,26,47,0.22)', dot: 'var(--crimson)' },
  high:     { bg: 'var(--amber-tint)',   fg: '#78350f',         border: 'rgba(180,83,9,0.22)',  dot: 'var(--amber)'   },
  medium:   { bg: 'var(--navy-tint)',    fg: 'var(--navy)',     border: 'rgba(29,52,97,0.22)',  dot: 'var(--navy)'    },
  low:      { bg: 'var(--cream)',        fg: 'var(--ink-soft)', border: 'var(--border)',         dot: 'var(--ink-faint)' },
};

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  not_started: { label: 'Not started', color: 'var(--ink-soft)',   dot: 'var(--ink-faint)' },
  in_progress: { label: 'In progress', color: 'var(--navy)',       dot: 'var(--navy)'      },
  complete:    { label: 'Complete',    color: 'var(--teal-deep)',  dot: 'var(--teal)'      },
};

type SortField = 'priority' | 'status' | 'title';

export default function MissingAnalysisChecklist({ gaps }: MissingAnalysisChecklistProps) {
  const [sortBy, setSortBy] = useState<SortField>('priority');

  const sorted = useMemo(() => {
    return [...gaps].sort((a, b) => {
      if (sortBy === 'priority') {
        return (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      }
      return a.title.localeCompare(b.title);
    });
  }, [gaps, sortBy]);

  if (gaps.length === 0) {
    return (
      <PanelShell title="Analysis gaps" accent="var(--plum)" emptyState="No analysis gaps identified." />
    );
  }

  return (
    <PanelShell
      title={`Analysis gaps · ${gaps.length}`}
      accent="var(--plum)"
      right={
        <div
          className="flex items-center gap-1 p-1"
          role="group"
          aria-label="Sort gaps"
          style={{
            background: 'var(--cream)',
            border: '1px solid var(--border)',
            borderRadius: 4,
          }}
        >
          <span
            className="uppercase pl-1 pr-1"
            style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-faint)' }}
          >
            Sort
          </span>
          {(['priority', 'status', 'title'] as SortField[]).map((field) => {
            const active = sortBy === field;
            return (
              <button
                key={field}
                onClick={() => setSortBy(field)}
                aria-pressed={active}
                className="capitalize transition-colors"
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 3,
                  fontWeight: active ? 600 : 500,
                  background: active ? 'var(--card)' : 'transparent',
                  color:      active ? 'var(--ink)' : 'var(--ink-soft)',
                  boxShadow:  active ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {field}
              </button>
            );
          })}
        </div>
      }
    >
      <div className="space-y-2.5">
        {sorted.map((gap) => {
          const statusInfo = STATUS[gap.status] ?? STATUS.not_started;
          const priorityCfg = PRIORITY[gap.priority] ?? PRIORITY.low;
          return (
            <div
              key={gap.id}
              className="p-3.5 transition-colors"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span
                    className="inline-flex items-center gap-1.5 capitalize"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: priorityCfg.bg,
                      color: priorityCfg.fg,
                      border: `1px solid ${priorityCfg.border}`,
                    }}
                  >
                    <span
                      className="inline-block w-1 h-1 rounded-full"
                      style={{ background: priorityCfg.dot }}
                    />
                    {gap.priority}
                  </span>
                  <h4
                    className="font-serif"
                    style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}
                  >
                    {gap.title}
                  </h4>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 shrink-0"
                  style={{ fontSize: 11.5, fontWeight: 500, color: statusInfo.color }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: statusInfo.dot }}
                  />
                  {statusInfo.label}
                </span>
              </div>

              <p
                className="mt-2"
                style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}
              >
                {gap.rationale}
              </p>

              <div className="mt-2.5 flex items-center gap-3">
                <span
                  className="uppercase"
                  style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-faint)' }}
                >
                  Effort
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}
                >
                  {gap.estimated_effort}
                </span>
                {gap.status === 'complete' && gap.link && (
                  <a
                    href={gap.link}
                    className="ml-auto inline-flex items-center gap-1 group"
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}
                  >
                    View analysis
                    <svg
                      width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                      className="transition-transform group-hover:translate-x-0.5"
                    >
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}
