import { describe, it, expect } from 'vitest';
import { fanFromMedianSpread, monotonise, medianSpreadFromFan } from '@/components/platform/viz/fanMaths';
import { TAUS } from '@/lib/coreMechanism/dgpSimulator';

describe('fanMaths — monotone non-crossing', () => {
  it('fanFromMedianSpread produces a monotone non-decreasing, clamped vector', () => {
    const fan = fanFromMedianSpread(0.5, 0.4);
    expect(fan.length).toBe(TAUS.length);
    for (let k = 1; k < fan.length; k++) {
      expect(fan[k]).toBeGreaterThanOrEqual(fan[k - 1]);
    }
    for (const q of fan) {
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(1);
    }
  });

  it('the median quantile sits at the requested median', () => {
    const fan = fanFromMedianSpread(0.3, 0.3);
    const mid = Math.floor(fan.length / 2);
    // The middle grid level is τ=0.5, so q(0.5) should equal the median.
    expect(fan[mid]).toBeCloseTo(0.3, 6);
  });

  it('monotonise repairs a crossing vector and clamps', () => {
    expect(monotonise([0.2, 0.1, 1.5, -0.3, 0.4])).toEqual([0.2, 0.2, 1, 1, 1]);
  });

  it('medianSpreadFromFan round-trips approximately', () => {
    const fan = fanFromMedianSpread(0.6, 0.25);
    const { median, spread } = medianSpreadFromFan(fan);
    expect(median).toBeCloseTo(0.6, 6);
    expect(spread).toBeCloseTo(0.25, 1);
  });
});
