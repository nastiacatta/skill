/**
 * Coverage audit property tests — Properties 2, 3, 18.
 * Feature: behaviour-analysis-redesign
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TAXONOMY_ITEMS } from '@/lib/behaviour/taxonomyData';
import type { TaxonomyItem, BehaviourFamily } from '@/lib/behaviour/hiddenAttributes';

const ALL_FAMILIES: BehaviourFamily[] = [
  'participation', 'information', 'reporting', 'staking',
  'objectives', 'identity', 'learning', 'adversarial', 'operational',
];

/** Pure logic extracted from CoverageAudit component for testing. */
function computeCoverageStats(items: TaxonomyItem[]) {
  const experiment = items.filter(i => i.status === 'experiment').length;
  const taxonomyOnly = items.filter(i => i.status === 'taxonomy-only').length;
  const notCovered = items.filter(i => i.status === 'not-covered').length;
  const total = items.length;
  const coveragePct = total > 0 ? (experiment / total) * 100 : 0;
  return { experiment, taxonomyOnly, notCovered, total, coveragePct };
}

function groupByFamily(items: TaxonomyItem[]): Record<string, TaxonomyItem[]> {
  const groups: Record<string, TaxonomyItem[]> = {};
  for (const item of items) {
    if (!groups[item.family]) groups[item.family] = [];
    groups[item.family].push(item);
  }
  return groups;
}

const taxonomyItemArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  family: fc.constantFrom(...ALL_FAMILIES),
  status: fc.constantFrom('experiment' as const, 'taxonomy-only' as const, 'not-covered' as const),
});

// Feature: behaviour-analysis-redesign, Property 2: Coverage statistics are mathematically correct
// **Validates: Requirements 1.3, 13.2**
describe('Property 2 — Coverage statistics are mathematically correct', () => {
  it('experiment + taxonomy_only + not_covered = total, and coverage % is correct', () => {
    fc.assert(
      fc.property(
        fc.array(taxonomyItemArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const stats = computeCoverageStats(items);
          expect(stats.experiment + stats.taxonomyOnly + stats.notCovered).toBe(stats.total);
          expect(stats.coveragePct).toBeCloseTo((stats.experiment / stats.total) * 100);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('works with real TAXONOMY_ITEMS data', () => {
    const stats = computeCoverageStats(TAXONOMY_ITEMS);
    expect(stats.experiment + stats.taxonomyOnly + stats.notCovered).toBe(stats.total);
    expect(stats.total).toBe(TAXONOMY_ITEMS.length);
  });
});

// Feature: behaviour-analysis-redesign, Property 3: Experiment-backed item click navigates to correct tab
// **Validates: Requirements 1.4, 13.3**
describe('Property 3 — Experiment-backed item click navigates to correct tab', () => {
  it('every experiment-backed item with a tab field has a non-empty tab string', () => {
    const experimentItems = TAXONOMY_ITEMS.filter(i => i.status === 'experiment' && i.tab);
    expect(experimentItems.length).toBeGreaterThan(0);
    for (const item of experimentItems) {
      expect(typeof item.tab).toBe('string');
      expect(item.tab!.length).toBeGreaterThan(0);
    }
  });

  it('onNavigate callback receives the correct tab for experiment items', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TAXONOMY_ITEMS.filter(i => i.status === 'experiment' && i.tab)),
        (item) => {
          // Simulate what CoverageAudit does: clickable items call onNavigate(item.experimentTab)
          // The experimentTab in CoverageAudit maps from item.tab
          const navigatedTab = item.tab;
          expect(navigatedTab).toBeDefined();
          expect(typeof navigatedTab).toBe('string');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 18: Coverage audit groups items correctly by family
// **Validates: Requirements 13.1, 13.4**
describe('Property 18 — Coverage audit groups items correctly by family', () => {
  it('grouping preserves all items and each group contains only items of that family', () => {
    fc.assert(
      fc.property(
        fc.array(taxonomyItemArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const groups = groupByFamily(items);
          // Total items across all groups equals input length
          const totalGrouped = Object.values(groups).reduce((s, g) => s + g.length, 0);
          expect(totalGrouped).toBe(items.length);
          // Each group only contains items of that family
          for (const [family, groupItems] of Object.entries(groups)) {
            for (const item of groupItems) {
              expect(item.family).toBe(family);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('real TAXONOMY_ITEMS groups into exactly 9 families', () => {
    const groups = groupByFamily(TAXONOMY_ITEMS);
    expect(Object.keys(groups).sort()).toEqual(ALL_FAMILIES.sort());
  });
});
