/**
 * Property test for discrepancy warning threshold (Property 13).
 *
 * **Validates: Requirements 6.3**
 *
 * For any pair of synthetic ΔCRPS and real-data ΔCRPS values where
 * syntheticDeltaCrps ≠ 0, the discrepancy warning SHALL be displayed
 * if and only if |realDeltaCrps / syntheticDeltaCrps| > 2.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { hasDiscrepancyWarning } from '@/lib/analysis/discrepancyWarning';

describe('Property 13: Discrepancy warning threshold', () => {
  it('warning displayed iff |realΔCRPS / syntheticΔCRPS| > 2', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }).filter((v) => v !== 0),
        (realDeltaCrps, syntheticDeltaCrps) => {
          const result = hasDiscrepancyWarning(realDeltaCrps, syntheticDeltaCrps);
          const expected = Math.abs(realDeltaCrps / syntheticDeltaCrps) > 2;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('returns false when syntheticDeltaCrps is 0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
        (realDeltaCrps) => {
          expect(hasDiscrepancyWarning(realDeltaCrps, 0)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns false when either input is null', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          expect(hasDiscrepancyWarning(null, value)).toBe(false);
          expect(hasDiscrepancyWarning(value, null)).toBe(false);
          expect(hasDiscrepancyWarning(null, null)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
