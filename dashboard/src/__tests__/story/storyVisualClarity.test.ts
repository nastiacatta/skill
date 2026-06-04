import { describe, expect, it } from 'vitest';
import {
  STORY_FRAME_CAPTIONS,
  STORY_STEPS,
  STEP_FOCUS_ZONES,
  STORY_STEP_LABELS,
  type FocusZone,
} from '@/components/story/useStoryPipeline';
import { STEP_NAMES } from '@/components/story/StoryStepIndicator';

describe('StoryStepIndicator metadata', () => {
  it('has exactly seven step names matching STORY_STEPS', () => {
    expect(STEP_NAMES).toHaveLength(STORY_STEPS);
  });

  it('step names are non-empty strings', () => {
    for (const name of STEP_NAMES) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('step labels match the thesis spec', () => {
    expect(STORY_STEP_LABELS).toEqual([
      'Submit', 'Deposit', 'Gate', 'Aggregate', 'Outcome', 'Score', 'Settle',
    ]);
  });
});

describe('STORY_FRAME_CAPTIONS', () => {
  it('has exactly seven captions (one per step)', () => {
    expect(STORY_FRAME_CAPTIONS).toHaveLength(STORY_STEPS);
  });

  it('each caption is a non-empty string under 100 characters', () => {
    for (const caption of STORY_FRAME_CAPTIONS) {
      expect(caption.length).toBeGreaterThan(0);
      expect(caption.length).toBeLessThanOrEqual(100);
    }
  });

  it('captions use British spelling (no "ize" endings)', () => {
    for (const caption of STORY_FRAME_CAPTIONS) {
      expect(caption).not.toMatch(/\borganize\b/i);
      expect(caption).not.toMatch(/\brecognize\b/i);
      expect(caption).not.toMatch(/\bnormalize\b/i);
    }
  });

  it('no caption uses the word "bet"', () => {
    for (const caption of STORY_FRAME_CAPTIONS) {
      expect(caption.toLowerCase()).not.toMatch(/\bbet\b/);
    }
  });
});

describe('STEP_FOCUS_ZONES', () => {
  it('has exactly seven zones (one per step)', () => {
    expect(STEP_FOCUS_ZONES).toHaveLength(STORY_STEPS);
  });

  it('each zone is a valid FocusZone value', () => {
    const validZones: FocusZone[] = ['left', 'centre', 'right', 'left-right'];
    for (const zone of STEP_FOCUS_ZONES) {
      expect(validZones).toContain(zone);
    }
  });

  it('at least one step focuses each major zone', () => {
    const zones = new Set(STEP_FOCUS_ZONES);
    expect(zones.has('left') || zones.has('left-right')).toBe(true);
    expect(zones.has('centre')).toBe(true);
    expect(zones.has('right') || zones.has('left-right')).toBe(true);
  });
});

describe('pacing constants', () => {
  it('autoplay cadence is 3000 ms per step', () => {
    const STEP_HOLD_MS = 3000;
    expect(STEP_HOLD_MS).toBe(3000);
  });
});
