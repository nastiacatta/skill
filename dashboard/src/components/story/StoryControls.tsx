/**
 * Three-switch lever row plus four transport buttons. Pure render:
 * stores no state, translates input events into the typed setters
 * the parent supplies. Helper copy and option labels are pinned
 * verbatim in the design copy spec.
 */

import type { DepositPolicy } from '@/lib/coreMechanism/runRoundComposable';
import { storyPalette } from './storyPalette';

export interface StoryControlsProps {
  sigmaMin: number;
  onSigmaMinChange: (value: number) => void;
  depositPolicy: DepositPolicy;
  onDepositPolicyChange: (policy: DepositPolicy) => void;
  sybilSplit: boolean;
  onSybilSplitChange: (enabled: boolean) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onRestart: () => void;
}

const DEPOSIT_OPTIONS: { id: DepositPolicy; label: string }[] = [
  { id: 'fixed_unit', label: 'Fixed amount' },
  { id: 'wealth_fraction', label: 'Fraction of wealth' },
  { id: 'sigma_scaled', label: 'Skill-scaled bankroll' },
];

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string }[];
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 4,
        background: 'var(--cream)',
        border: `1px solid ${storyPalette.surface.border}`,
        borderRadius: 6,
        padding: 3,
      }}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 4,
              border: 'none',
              background: active ? storyPalette.pool.stroke : 'transparent',
              color: active ? '#fff' : storyPalette.text.muted,
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}

function IconButton({ label, onClick, active, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 34,
        height: 34,
        borderRadius: 6,
        background: active ? storyPalette.pool.stroke : 'var(--cream)',
        color: active ? '#fff' : storyPalette.text.muted,
        border: `1px solid ${
          active ? storyPalette.pool.stroke : storyPalette.surface.border
        }`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const RestartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
    <path
      d="M8 3a5 5 0 1 0 4.6 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M13 1v4h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StepBackIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
    <path
      d="M11 3 5 8l6 5V3z"
      fill="currentColor"
    />
    <line
      x1="3"
      x2="3"
      y1="3"
      y2="13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const StepForwardIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
    <path
      d="M5 3l6 5-6 5V3z"
      fill="currentColor"
    />
    <line
      x1="13"
      x2="13"
      y1="3"
      y2="13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
    <path d="M4 3l9 5-9 5V3z" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
    <rect x="4" y="3" width="3" height="10" fill="currentColor" />
    <rect x="9" y="3" width="3" height="10" fill="currentColor" />
  </svg>
);

interface ControlBlockProps {
  label: string;
  helper: string;
  children: React.ReactNode;
}

function ControlBlock({ label, helper, children }: ControlBlockProps) {
  return (
    <div style={{ minWidth: 200 }}>
      <p
        className="eyebrow"
        style={{
          color: storyPalette.text.muted,
          marginBottom: 6,
          fontSize: 11,
        }}
      >
        {label}
      </p>
      {children}
      <p
        style={{
          marginTop: 6,
          fontSize: 12,
          color: storyPalette.text.muted,
          lineHeight: 1.4,
        }}
      >
        {helper}
      </p>
    </div>
  );
}

export default function StoryControls({
  sigmaMin,
  onSigmaMinChange,
  depositPolicy,
  onDepositPolicyChange,
  sybilSplit,
  onSybilSplitChange,
  isPlaying,
  onPlayPause,
  onStepBack,
  onStepForward,
  onRestart,
}: StoryControlsProps) {
  return (
    <div
      style={{
        background: storyPalette.surface.tile,
        border: `1px solid ${storyPalette.surface.border}`,
        borderRadius: 4,
        padding: '14px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}
    >
      <ControlBlock
        label="skill-gate floor σ_min"
        helper="Sets the minimum skill any forecaster can hold. A higher floor protects weak forecasters from losing all weight in the aggregate. Setting it to one disables the gate entirely."
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sigmaMin}
            onChange={(event) =>
              onSigmaMinChange(Number(event.target.value))
            }
            aria-label="skill-gate floor"
            style={{
              flex: 1,
              minWidth: 140,
              accentColor: storyPalette.pool.stroke,
            }}
          />
          <span
            className="font-mono tabular-nums"
            style={{
              fontSize: 12,
              color: storyPalette.text.body,
              minWidth: 36,
              textAlign: 'right',
            }}
          >
            {sigmaMin.toFixed(2)}
          </span>
        </div>
      </ControlBlock>

      <ControlBlock
        label="deposit policy"
        helper="Choose how each deposit is sized before the round begins."
      >
        <Segmented<DepositPolicy>
          value={depositPolicy}
          onChange={onDepositPolicyChange}
          options={DEPOSIT_OPTIONS}
        />
      </ControlBlock>

      <ControlBlock
        label="split forecaster F2"
        helper="Splits F2 into two clones sharing the deposit; total payout should be unchanged under narrow sybil invariance."
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: storyPalette.text.body,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={sybilSplit}
            onChange={(event) => onSybilSplitChange(event.target.checked)}
            style={{ accentColor: storyPalette.pool.stroke }}
          />
          {sybilSplit ? 'on (F2 → F2a + F2b)' : 'off'}
        </label>
      </ControlBlock>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
        }}
      >
        <IconButton label="restart" onClick={onRestart}>
          <RestartIcon />
        </IconButton>
        <IconButton label="step back one round" onClick={onStepBack}>
          <StepBackIcon />
        </IconButton>
        <IconButton
          label={isPlaying ? 'Pause' : 'Play'}
          onClick={onPlayPause}
          active={isPlaying}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton label="step forward one round" onClick={onStepForward}>
          <StepForwardIcon />
        </IconButton>
      </div>
    </div>
  );
}
