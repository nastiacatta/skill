import { motion, AnimatePresence } from 'framer-motion';
import { storyPalette } from './storyPalette';

export interface StoryDepositChipProps {
  depositPre: number;
  effectiveWager: number;
  forecasterColour: string;
  step: number;
  reducedMotion?: boolean;
}

const DEPOSIT_GREY = storyPalette.surface.border;

const MORPH_SPRING = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 20,
  duration: 0.5,
};

const FADE_TRANSITION = { duration: 0.3, ease: [0, 0, 0.2, 1] as const };

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '.';
  return value.toFixed(2);
}

export default function StoryDepositChip({
  depositPre,
  effectiveWager,
  forecasterColour,
  step,
  reducedMotion = false,
}: StoryDepositChipProps) {
  const showDeposit = step >= 1;
  const showWager = step >= 2;
  const ratio = depositPre > 0 ? effectiveWager / depositPre : 1;
  const refund = depositPre - effectiveWager;
  const showRefund = step === 2 && refund > 0.001;

  if (!showDeposit) return null;

  const morphTransition = reducedMotion
    ? { duration: 0.15 }
    : MORPH_SPRING;

  const fadeTransition = reducedMotion
    ? { duration: 0.15 }
    : FADE_TRANSITION;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
      <motion.div
        layout
        style={{
          height: 20,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 8px',
          overflow: 'hidden',
        }}
        initial={false}
        animate={{
          width: showWager ? `${Math.max(ratio * 100, 40)}%` : '100%',
          backgroundColor: showWager ? forecasterColour : DEPOSIT_GREY,
        }}
        transition={morphTransition}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: showWager ? '#fff' : storyPalette.text.body,
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {showWager ? `Wager ${fmt(effectiveWager)}` : `Deposit ${fmt(depositPre)}`}
        </span>
      </motion.div>
      <AnimatePresence>
        {showRefund && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.4, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            style={{
              height: 20,
              borderRadius: 10,
              border: `1.5px dashed ${storyPalette.surface.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
            }}
          >
            <span
              style={{
                fontSize: 9,
                color: storyPalette.text.muted,
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
              }}
            >
              −{fmt(refund)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
