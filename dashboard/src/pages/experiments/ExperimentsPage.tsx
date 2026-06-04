import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import type { ExperimentMeta } from '@/lib/types';
import ExperimentCard from '@/components/dashboard/ExperimentCard';
import Breadcrumb from '@/components/dashboard/Breadcrumb';
import ThesisRef from '@/components/dashboard/ThesisRef';

const BLOCK_FILTERS = ['all', 'core', 'behaviour', 'experiments'] as const;
type BlockFilter = (typeof BLOCK_FILTERS)[number];

function filterExperiments(
  experiments: ExperimentMeta[],
  block: BlockFilter,
  query: string,
): ExperimentMeta[] {
  let filtered = experiments;
  if (block !== 'all') {
    filtered = filtered.filter((e) => e.block === block);
  }
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.displayName ?? '').toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q),
    );
  }
  return filtered;
}

export default function ExperimentsPage() {
  const { experiments } = useStore();
  const [blockFilter, setBlockFilter] = useState<BlockFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(
    () => filterExperiments(experiments, blockFilter, searchQuery),
    [experiments, blockFilter, searchQuery],
  );

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--paper)' }}>
      <div
        className="px-8 py-6"
        style={{
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Breadcrumb />
        <p className="eyebrow mb-2" style={{ color: 'var(--navy)' }}>
          Appendix
        </p>
        <h1
          className="font-serif tracking-tight"
          style={{ fontSize: 28, lineHeight: 1.2, fontWeight: 600, color: 'var(--ink)' }}
        >
          Experiments
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 6 }}>
          Browse all experiments. Filter by block or search by name.
        </p>
        <ThesisRef viewKey="appendix/experiments" style={{ marginTop: 10 }} />
      </div>

      {/* Filter controls */}
      <div
        className="px-8 pt-4 pb-3 flex flex-wrap items-center gap-3"
        style={{ background: 'var(--paper)' }}
      >
        <span
          className="eyebrow"
          style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}
        >
          Filter
        </span>
        <div
          className="inline-flex flex-wrap gap-1 p-1"
          role="group"
          aria-label="Filter by block"
          style={{
            background: 'var(--cream)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          {BLOCK_FILTERS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBlockFilter(b)}
              aria-pressed={blockFilter === b}
              className={clsx(
                'px-3 py-1.5 transition-colors capitalize',
              )}
              style={{
                fontSize: 13.5,
                fontWeight: blockFilter === b ? 600 : 500,
                borderRadius: 4,
                background: blockFilter === b ? 'var(--card)' : 'transparent',
                color: blockFilter === b ? 'var(--ink)' : 'var(--ink-soft)',
                boxShadow: blockFilter === b ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {b === 'all' ? 'All' : b}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <svg
            width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--ink-faint)' }}
          >
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search experiments…"
            aria-label="Search experiments"
            className="w-full pl-9 pr-8 py-2 focus:outline-none transition-colors"
            style={{
              fontSize: 14,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--ink)',
              borderRadius: 4,
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-colors"
              style={{ color: 'var(--ink-faint)' }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <span
          className="ml-auto font-medium tabular-nums"
          style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}
        >
          Results: {filtered.length} of {experiments.length}
        </span>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--ink-faint)' }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
              No experiments match your filters.
            </p>
            {(searchQuery || blockFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setBlockFilter('all');
                }}
                className="transition-colors mt-1"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {/* Catalogue region label. Each card carries an h3 title, so the
                grid needs an intervening h2 to keep the document outline
                ordered (no h1 -> h3 skip). Visually hidden: the page h1 and
                filter row already make the section's purpose clear on screen. */}
            <h2 className="sr-only">All experiments</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((exp) => (
                <ExperimentCard key={exp.name} experiment={exp} />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
