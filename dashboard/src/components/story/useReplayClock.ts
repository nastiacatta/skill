/**
 * Six-second cadence clock for the Story-page replay.
 *
 * Advances `roundIndex` once per `intervalMs` while `isPlaying` is true,
 * wrapping at `totalRounds`. The round index is also scrubbable through
 * `setRound`, which pauses the clock by default; the parent decides
 * whether to resume after a scrub. `step(delta)` walks the index by
 * one round at a time without affecting the playing flag.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export const STORY_REPLAY_INTERVAL_MS = 6000;

export interface UseReplayClockArgs {
  totalRounds: number;
  autoplay?: boolean;
  intervalMs?: number;
}

export interface UseReplayClockReturn {
  roundIndex: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setRound: (round: number, options?: { keepPlaying?: boolean }) => void;
  step: (delta: number) => void;
  restart: () => void;
}

function clampIndex(value: number, total: number): number {
  if (total <= 0) return 0;
  const wrapped = ((value % total) + total) % total;
  return wrapped;
}

export function useReplayClock({
  totalRounds,
  autoplay = true,
  intervalMs = STORY_REPLAY_INTERVAL_MS,
}: UseReplayClockArgs): UseReplayClockReturn {
  const [roundIndex, setRoundIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoplay);

  const totalRef = useRef(totalRounds);
  totalRef.current = totalRounds;

  useEffect(() => {
    if (totalRounds <= 0) return;
    setRoundIndex((prev) => clampIndex(prev, totalRounds));
  }, [totalRounds]);

  useEffect(() => {
    if (!isPlaying || totalRounds <= 0) return undefined;
    const id = window.setInterval(() => {
      setRoundIndex((prev) => clampIndex(prev + 1, totalRef.current));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isPlaying, intervalMs, totalRounds]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => setIsPlaying((prev) => !prev), []);

  const setRound = useCallback(
    (round: number, options?: { keepPlaying?: boolean }) => {
      setRoundIndex(clampIndex(round, totalRef.current));
      if (!options?.keepPlaying) {
        setIsPlaying(false);
      }
    },
    [],
  );

  const step = useCallback((delta: number) => {
    setRoundIndex((prev) => clampIndex(prev + delta, totalRef.current));
  }, []);

  const restart = useCallback(() => {
    setRoundIndex(0);
    setIsPlaying(autoplay);
  }, [autoplay]);

  return {
    roundIndex,
    isPlaying,
    play,
    pause,
    toggle,
    setRound,
    step,
    restart,
  };
}
