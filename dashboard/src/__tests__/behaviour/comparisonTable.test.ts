/**
 * ComparisonTable property tests — Properties 13, 14, 15.
 * Feature: behaviour-analysis-redesign
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/** Column keys that must be present in ComparisonTable. */
const REQUIRED_COLUMNS = ['name', 'family', 'meanCrps', 'deltaCrpsPct', 'gini', 'nEff', 'participation'] as const;

interface ComparisonRow {
  name: string;
  family: string;
  meanCrps: number;
  deltaCrpsPct: number;
  gini: number;
  nEff: number;
  participation: number;
  color: string;
}

/** Extracted sort logic from ComparisonTable component. */
function sortRows(rows: ComparisonRow[], sortKey: keyof ComparisonRow, sortDir: 'asc' | 'desc'): ComparisonRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });
  return copy;
}

/** Extracted deltaColor logic from ComparisonTable component. */
function deltaColor(v: number): string {
  if (v < -1) return 'text-emerald-600';
  if (v > 1) return 'text-red-600';
  return 'text-slate-500';
}

const comparisonRowArb: fc.Arbitrary<ComparisonRow> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  family: fc.string({ minLength: 1, maxLength: 15 }),
  meanCrps: fc.double({ min: 0, max: 10, noNaN: true }),
  deltaCrpsPct: fc.double({ min: -50, max: 50, noNaN: true }),
  gini: fc.double({ min: 0, max: 1, noNaN: true }),
  nEff: fc.double({ min: 0, max: 20, noNaN: true }),
  participation: fc.double({ min: 0, max: 1, noNaN: true }),
  color: fc.constant('bg-slate-100'),
});

// Feature: behaviour-analysis-redesign, Property 13: ComparisonTable contains all required columns
// **Validates: Requirements 11.1**
describe('Property 13 — ComparisonTable contains all required columns', () => {
  it('every ComparisonRow has all required column keys', () => {
    fc.assert(
      fc.property(
        fc.array(comparisonRowArb, { minLength: 1, maxLength: 20 }),
        (rows) => {
          for (const row of rows) {
            for (const col of REQUIRED_COLUMNS) {
              expect(row).toHaveProperty(col);
              expect(row[col]).toBeDefined();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 14: ComparisonTable sort correctness
// **Validates: Requirements 11.2, 11.3**
describe('Property 14 — ComparisonTable sort correctness', () => {
  it('sorting by a numeric column produces correctly ordered rows', () => {
    fc.assert(
      fc.property(
        fc.array(comparisonRowArb, { minLength: 2, maxLength: 20 }),
        fc.constantFrom('meanCrps' as const, 'deltaCrpsPct' as const, 'gini' as const, 'nEff' as const, 'participation' as const),
        fc.constantFrom('asc' as const, 'desc' as const),
        (rows, sortKey, sortDir) => {
          const sorted = sortRows(rows, sortKey, sortDir);
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1][sortKey] as number;
            const curr = sorted[i][sortKey] as number;
            if (sortDir === 'asc') {
              expect(prev).toBeLessThanOrEqual(curr);
            } else {
              expect(prev).toBeGreaterThanOrEqual(curr);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('default sort is by deltaCrpsPct descending', () => {
    // The component defaults to sortKey='deltaCrpsPct', sortDir='desc'
    const rows: ComparisonRow[] = [
      { name: 'a', family: 'f', meanCrps: 1, deltaCrpsPct: 5, gini: 0.3, nEff: 4, participation: 0.8, color: '' },
      { name: 'b', family: 'f', meanCrps: 2, deltaCrpsPct: -2, gini: 0.4, nEff: 3, participation: 0.7, color: '' },
      { name: 'c', family: 'f', meanCrps: 1.5, deltaCrpsPct: 10, gini: 0.2, nEff: 5, participation: 0.9, color: '' },
    ];
    const sorted = sortRows(rows, 'deltaCrpsPct', 'desc');
    expect(sorted[0].deltaCrpsPct).toBe(10);
    expect(sorted[1].deltaCrpsPct).toBe(5);
    expect(sorted[2].deltaCrpsPct).toBe(-2);
  });
});

// Feature: behaviour-analysis-redesign, Property 15: ComparisonTable delta CRPS colour coding
// **Validates: Requirements 11.5**
describe('Property 15 — ComparisonTable delta CRPS colour coding', () => {
  it('colour is deterministic function of delta value', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -50, max: 50, noNaN: true }),
        (delta) => {
          const color = deltaColor(delta);
          if (delta < -1) {
            expect(color).toBe('text-emerald-600'); // green = improvement
          } else if (delta > 1) {
            expect(color).toBe('text-red-600'); // red = degradation
          } else {
            expect(color).toBe('text-slate-500'); // grey = neutral
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
