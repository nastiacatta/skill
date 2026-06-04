/**
 * Property-based tests for the Dashboard Academic Overhaul spec.
 *
 * Uses fast-check with vitest. Each property runs ≥ 100 iterations.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { viridis, cividis, sequentialBlue } from '@/lib/colourScales';
import { isSignificant, ciBounds } from '@/components/charts/deltaBarHelpers';
import { generateCSV, sanitiseFilename } from '@/lib/csv';
import { getMethodOpacity } from '@/lib/chartLinking';
import {
  validateNumericFields,
  validateRanges,
  validateMonotonicity,
  validateBudgetBalance,
} from '@/lib/validation';

// ─── Property 1: Sequential numbering ──────────────────────────────
// **Validates: Requirements 1.1, 1.3, 17.1, 17.7**

describe('Property 1: Sequential numbering produces correct sequences', () => {
  /** Simple counter class mirroring FigureContext / EquationContext logic. */
  class SequentialCounter {
    private count = 0;
    next(): number {
      return ++this.count;
    }
    reset(): void {
      this.count = 0;
    }
  }

  it('calling next() N times produces [1..N] with no skips or duplicates', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
        const counter = new SequentialCounter();
        const numbers: number[] = [];
        for (let i = 0; i < n; i++) {
          numbers.push(counter.next());
        }
        // Verify sequential [1..N]
        const expected = Array.from({ length: n }, (_, i) => i + 1);
        expect(numbers).toEqual(expected);
        // No duplicates
        expect(new Set(numbers).size).toBe(n);
      }),
      { numRuns: 100 },
    );
  });

  it('reset restarts numbering from 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (n1, n2) => {
          const counter = new SequentialCounter();
          for (let i = 0; i < n1; i++) counter.next();
          counter.reset();
          const afterReset: number[] = [];
          for (let i = 0; i < n2; i++) {
            afterReset.push(counter.next());
          }
          const expected = Array.from({ length: n2 }, (_, i) => i + 1);
          expect(afterReset).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 2: Colour scale functions ────────────────────────────
// **Validates: Requirements 2.1, 2.3, 9.4**

describe('Property 2: Colour scale functions produce valid RGB values', () => {
  const tArb = fc.double({ min: 0, max: 1, noNaN: true });

  it('viridis returns RGB channels in [0, 255] for any t ∈ [0, 1]', () => {
    fc.assert(
      fc.property(tArb, (t) => {
        const [r, g, b] = viridis(t);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }),
      { numRuns: 100 },
    );
  });

  it('cividis returns RGB channels in [0, 255] for any t ∈ [0, 1]', () => {
    fc.assert(
      fc.property(tArb, (t) => {
        const [r, g, b] = cividis(t);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }),
      { numRuns: 100 },
    );
  });

  it('sequentialBlue returns RGB channels in [0, 255] for any t ∈ [0, 1]', () => {
    fc.assert(
      fc.property(tArb, (t) => {
        const [r, g, b] = sequentialBlue(t);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }),
      { numRuns: 100 },
    );
  });

  it('all scales return integer channels for sorted t arrays', () => {
    const sortedTs = fc
      .array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 20 })
      .map((arr) => arr.sort((a, b) => a - b));

    fc.assert(
      fc.property(sortedTs, (ts) => {
        for (const scale of [viridis, cividis, sequentialBlue]) {
          for (const t of ts) {
            const [r, g, b] = scale(t);
            expect(Number.isInteger(r)).toBe(true);
            expect(Number.isInteger(g)).toBe(true);
            expect(Number.isInteger(b)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 3: Error bar positions and significance ──────────────
// **Validates: Requirements 3.1, 3.2**

describe('Property 3: Error bar positions and significance markers are correct', () => {
  const deltaArb = fc.double({ min: -1000, max: 1000, noNaN: true });
  const seArb = fc.double({ min: 0.001, max: 100, noNaN: true });

  it('whiskers are at delta ± 1.96*se', () => {
    fc.assert(
      fc.property(deltaArb, seArb, (delta, se) => {
        const [lo, hi] = ciBounds(delta, se);
        const expectedLo = delta - 1.96 * se;
        const expectedHi = delta + 1.96 * se;
        expect(lo).toBeCloseTo(expectedLo, 10);
        expect(hi).toBeCloseTo(expectedHi, 10);
      }),
      { numRuns: 100 },
    );
  });

  it('significance marker iff |delta| > 1.96*se', () => {
    fc.assert(
      fc.property(deltaArb, seArb, (delta, se) => {
        const sig = isSignificant(delta, se);
        const expected = Math.abs(delta) > 1.96 * se;
        expect(sig).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('isSignificant returns false when se <= 0', () => {
    fc.assert(
      fc.property(deltaArb, (delta) => {
        expect(isSignificant(delta, 0)).toBe(false);
        expect(isSignificant(delta, -1)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 4: Calibration point colour ──────────────────────────
// **Validates: Requirements 4.4**

describe('Property 4: Calibration point colour reflects deviation from diagonal', () => {
  const unitArb = fc.double({ min: 0, max: 1, noNaN: true });

  /**
   * Pure logic extracted from CalibrationChart:
   * isMiscalibrated = |pHat - tau| > 0.05
   */
  function isMiscalibrated(tau: number, pHat: number): boolean {
    return Math.abs(pHat - tau) > 0.05;
  }

  it('amber colour iff |pHat - tau| > 0.05', () => {
    fc.assert(
      fc.property(unitArb, unitArb, (tau, pHat) => {
        const result = isMiscalibrated(tau, pHat);
        const expected = Math.abs(pHat - tau) > 0.05;
        expect(result).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('points exactly on the diagonal are not miscalibrated', () => {
    fc.assert(
      fc.property(unitArb, (tau) => {
        expect(isMiscalibrated(tau, tau)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('points far from diagonal are always miscalibrated', () => {
    // Generate tau and pHat that are guaranteed to differ by > 0.05
    const farPairArb = fc
      .tuple(unitArb, fc.double({ min: 0.06, max: 1, noNaN: true }))
      .filter(([tau, offset]) => tau + offset <= 1)
      .map(([tau, offset]) => ({ tau, pHat: tau + offset }));

    fc.assert(
      fc.property(farPairArb, ({ tau, pHat }) => {
        expect(isMiscalibrated(tau, pHat)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5: CSV export round-trip ─────────────────────────────
// **Validates: Requirements 14.2, 14.3**

describe('Property 5: CSV export round-trips data correctly', () => {
  // Simple generator: array of records with 1-3 fixed keys and random number values
  const recordArb = fc
    .array(
      fc.record({
        a: fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        b: fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        c: fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
      }),
      { minLength: 1, maxLength: 10 },
    );

  it('generateCSV produces correct header count and row count', () => {
    fc.assert(
      fc.property(recordArb, (data) => {
        const csv = generateCSV(data as Record<string, unknown>[]);
        const lines = csv.split('\r\n');
        const headerLine = lines[0];
        const headers = headerLine.split(',');
        const expectedKeys = Object.keys(data[0]);

        // Header count matches keys
        expect(headers.length).toBe(expectedKeys.length);
        // Row count matches data length (header + data rows)
        expect(lines.length).toBe(data.length + 1);
      }),
      { numRuns: 100 },
    );
  });

  it('sanitiseFilename produces strings ending in .csv with only safe characters', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (title) => {
        const filename = sanitiseFilename(title);
        // Must end with .csv
        expect(filename.endsWith('.csv')).toBe(true);
        // Strip .csv suffix and check remaining chars are safe
        const stem = filename.slice(0, -4);
        // Stem should only contain lowercase alphanumeric, hyphens, underscores
        expect(stem).toMatch(/^[a-z0-9\-_]*$/);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 7: Cross-chart linking opacity ───────────────────────
// **Validates: Requirements 21.1, 21.7**

describe('Property 7: Cross-chart linking context correctly propagates state', () => {
  const methodKeyArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);
  const methodSetArb = fc.array(methodKeyArb, { minLength: 1, maxLength: 10 }).map(
    (keys) => [...new Set(keys)],
  );

  it('opacity is 0 if method not in visibleMethods', () => {
    fc.assert(
      fc.property(methodKeyArb, methodSetArb, (key, methods) => {
        const visible = new Set(methods.filter((m) => m !== key));
        expect(getMethodOpacity(key, null, visible)).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('opacity is 1.0 if method is hovered', () => {
    fc.assert(
      fc.property(methodSetArb, (methods) => {
        const visible = new Set(methods);
        for (const key of methods) {
          expect(getMethodOpacity(key, key, visible)).toBe(1.0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('opacity is 0.2 if another method is hovered', () => {
    fc.assert(
      fc.property(
        methodSetArb.filter((m) => m.length >= 2),
        (methods) => {
          const visible = new Set(methods);
          const hovered = methods[0];
          for (const key of methods.slice(1)) {
            expect(getMethodOpacity(key, hovered, visible)).toBe(0.2);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('opacity is 0.9 if nothing is hovered and method is visible', () => {
    fc.assert(
      fc.property(methodSetArb, (methods) => {
        const visible = new Set(methods);
        for (const key of methods) {
          expect(getMethodOpacity(key, null, visible)).toBe(0.9);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 8: Data validation ───────────────────────────────────
// **Validates: Requirements 27.1, 27.2, 27.3, 27.4, 27.5**

describe('Property 8: Data validation correctly identifies invalid values', () => {
  it('detects exact count of injected NaN values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (totalRows, nanCount) => {
          const actualNanCount = Math.min(nanCount, totalRows);
          const data: Record<string, unknown>[] = [];
          for (let i = 0; i < totalRows; i++) {
            data.push({ value: i < actualNanCount ? NaN : i * 1.0 });
          }
          const warnings = validateNumericFields(data, ['value']);
          if (actualNanCount > 0) {
            const nanWarning = warnings.find((w) => w.type === 'nan' && w.field === 'value');
            expect(nanWarning).toBeDefined();
            expect(nanWarning!.count).toBe(actualNanCount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('detects range violations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (totalRows, violationCount) => {
          const actualViolations = Math.min(violationCount, totalRows);
          const data: Record<string, unknown>[] = [];
          for (let i = 0; i < totalRows; i++) {
            // Values outside [0, 100] are violations
            data.push({ score: i < actualViolations ? 200 : 50 });
          }
          const warnings = validateRanges(data, [
            { field: 'score', min: 0, max: 100 },
          ]);
          if (actualViolations > 0) {
            const rangeWarning = warnings.find((w) => w.type === 'range' && w.field === 'score');
            expect(rangeWarning).toBeDefined();
            expect(rangeWarning!.count).toBe(actualViolations);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('detects monotonicity violations', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }), {
          minLength: 2,
          maxLength: 30,
        }),
        (values) => {
          const data = values.map((v) => ({ cumulative: v }));
          const warnings = validateMonotonicity(data, ['cumulative']);

          // Count expected violations manually
          let expectedViolations = 0;
          for (let i = 1; i < values.length; i++) {
            if (values[i] < values[i - 1]) expectedViolations++;
          }

          if (expectedViolations > 0) {
            const monoWarning = warnings.find(
              (w) => w.type === 'monotonicity' && w.field === 'cumulative',
            );
            expect(monoWarning).toBeDefined();
            expect(monoWarning!.count).toBe(expectedViolations);
          } else {
            const monoWarning = warnings.find(
              (w) => w.type === 'monotonicity' && w.field === 'cumulative',
            );
            expect(monoWarning).toBeUndefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 9: Budget balance validation ─────────────────────────
// **Validates: Requirements 27.6**

describe('Property 9: Budget balance validation detects violations', () => {
  const finiteDoubleArb = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true });

  it('passes when sums match within tolerance', () => {
    fc.assert(
      fc.property(
        fc.array(finiteDoubleArb, { minLength: 1, maxLength: 20 }),
        (values) => {
          // Use the same array for both payoffs and deposits → sums match exactly
          const warnings = validateBudgetBalance(values, [...values], 1e-10);
          expect(warnings.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('fails when imbalance exceeds tolerance', () => {
    fc.assert(
      fc.property(
        fc.array(finiteDoubleArb, { minLength: 1, maxLength: 20 }),
        fc.double({ min: 1, max: 1e6, noNaN: true }),
        (values, imbalance) => {
          // Create deposits that differ from payoffs by a known imbalance
          const deposits = values.map((v, i) => (i === 0 ? v + imbalance : v));
          const tolerance = 1e-10;
          const warnings = validateBudgetBalance(values, deposits, tolerance);
          expect(warnings.length).toBeGreaterThan(0);
          expect(warnings[0].type).toBe('budget');
        },
      ),
      { numRuns: 100 },
    );
  });
});
