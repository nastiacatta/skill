import { describe, it, expect } from 'vitest';
import {
  PX_FLOOR,
  TYPE,
  CHART,
  CONTROL,
  DURATION,
  SPACE,
  LAYOUT,
  tokens,
} from '@/components/platform/designTokens';

describe('platform designTokens — px floor', () => {
  it('keeps the body floor at or above 16px', () => {
    expect(PX_FLOOR.body).toBeGreaterThanOrEqual(16);
    expect(TYPE.body.size).toBeGreaterThanOrEqual(PX_FLOOR.body);
  });

  it('keeps the smallest label above the harness default (12px)', () => {
    expect(PX_FLOOR.minLabel).toBeGreaterThan(PX_FLOOR.harnessDefault);
    expect(TYPE.label.size).toBeGreaterThanOrEqual(PX_FLOOR.minLabel);
  });

  it('every type step is at or above the smallest-label floor', () => {
    for (const step of Object.values(TYPE)) {
      expect(step.size).toBeGreaterThanOrEqual(PX_FLOOR.minLabel);
    }
  });
});

describe('platform designTokens — large-size minimums', () => {
  it('the headline stat number is large (>= 56px)', () => {
    expect(TYPE.statXL.size).toBeGreaterThanOrEqual(56);
    expect(TYPE.statL.size).toBeGreaterThanOrEqual(44);
  });

  it('chart min-heights sit well above the harness collapse threshold (40px)', () => {
    expect(CHART.minHeight.sm).toBeGreaterThanOrEqual(240);
    expect(CHART.minHeight.md).toBeGreaterThan(CHART.minHeight.sm);
    expect(CHART.minHeight.lg).toBeGreaterThan(CHART.minHeight.md);
  });

  it('chart axis labels are at or above 14px', () => {
    expect(CHART.axisLabel).toBeGreaterThanOrEqual(14);
  });

  it('interactive targets are at least 44px', () => {
    expect(CONTROL.minTarget).toBeGreaterThanOrEqual(44);
    expect(CONTROL.height.md).toBeGreaterThanOrEqual(44);
  });
});

describe('platform designTokens — motion band', () => {
  it('durations sit inside the 100-500ms research band', () => {
    const ds = [
      DURATION.instant,
      DURATION.fast,
      DURATION.base,
      DURATION.slow,
      DURATION.deliberate,
      DURATION.exit,
    ];
    for (const d of ds) {
      expect(d).toBeGreaterThanOrEqual(100);
      expect(d).toBeLessThanOrEqual(500);
    }
  });

  it('exit is shorter than the matching base entrance', () => {
    expect(DURATION.exit).toBeLessThan(DURATION.base);
  });
});

describe('platform designTokens — scales and layout', () => {
  it('spacing scale is a 4px grid', () => {
    for (const v of Object.values(SPACE)) {
      expect(v % 4).toBe(0);
    }
  });

  it('content stays within the 1280 lower bound with the rail and padding', () => {
    // ~944px available at 1280 after a 256px rail and 2x 40px padding;
    // the 1200px cap never forces overflow at the primary widths.
    expect(LAYOUT.contentMaxWidth).toBe(1200);
    expect(LAYOUT.proseMaxWidth).toBeLessThan(LAYOUT.contentMaxWidth);
  });

  it('exposes a single bundled namespace', () => {
    expect(tokens.TYPE).toBe(TYPE);
    expect(tokens.CHART).toBe(CHART);
  });
});
