import { Button } from '@/components/platform/ui';
import { TYPE, SPACE } from '@/components/platform/designTokens';
import { SPEED_OPTIONS } from '@/components/platform/hooks/useMarketSimulation';

/**
 * Play / pause / step / scrub transport for a round clock, with a speed
 * control. Position-encoded scrubber; large 44px+ controls. The clock starts
 * paused; the viewer presses play. Reused by the market view.
 */
export interface TransportControlsProps {
  round: number;
  totalRounds: number;
  isPlaying: boolean;
  onToggle: () => void;
  onStep: (delta: number) => void;
  onScrub: (round: number) => void;
  onRestart: () => void;
  /** Current cadence in ms per round. */
  speedMs?: number;
  onSpeed?: (ms: number) => void;
}

export default function TransportControls({
  round,
  totalRounds,
  isPlaying,
  onToggle,
  onStep,
  onScrub,
  onRestart,
  speedMs,
  onSpeed,
}: TransportControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Market playback"
      style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], flexWrap: 'wrap' }}
    >
      <Button size="md" variant="secondary" onClick={() => onStep(-1)} aria-label="Previous round" disabled={round <= 0}>
        &larr;
      </Button>
      <Button size="md" onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'} data-testid="transport-toggle">
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
      <Button size="md" variant="secondary" onClick={() => onStep(1)} aria-label="Next round" disabled={round >= totalRounds - 1}>
        &rarr;
      </Button>
      <Button size="md" variant="ghost" onClick={onRestart} aria-label="Restart">
        Restart
      </Button>
      <input
        type="range"
        min={0}
        max={Math.max(0, totalRounds - 1)}
        step={1}
        value={round}
        onChange={(e) => onScrub(parseInt(e.target.value, 10))}
        aria-label="Scrub round"
        data-testid="round-scrubber"
        style={{ flex: '1 1 200px', minWidth: 140 }}
      />
      {onSpeed && speedMs != null && (
        <div role="group" aria-label="Playback speed" style={{ display: 'inline-flex', gap: SPACE[2], alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.label.size, fontWeight: 600, color: 'var(--ink-soft)' }}>Speed</span>
          {SPEED_OPTIONS.map((opt) => (
            <Button
              key={opt.label}
              size="sm"
              variant={speedMs === opt.ms ? 'primary' : 'secondary'}
              onClick={() => onSpeed(opt.ms)}
              aria-pressed={speedMs === opt.ms}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}
      <span
        className="tabular-nums"
        aria-live="polite"
        style={{ fontFamily: 'var(--font-mono)', fontSize: TYPE.caption.size, color: 'var(--ink-soft)', minWidth: 110, textAlign: 'right' }}
      >
        Round {round + 1} / {totalRounds}
      </span>
    </div>
  );
}
