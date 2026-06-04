import { AnimatePresence, motion } from 'framer-motion';
import { storyPalette } from './storyPalette';

export interface StoryCaptionProps {
  text: string;
  frameKey: string | number;
}

const FADE_IN = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };
const FADE_OUT = { duration: 0.25, ease: [0.64, 0, 0.78, 0] as const };

export default function StoryCaption({ text, frameKey }: StoryCaptionProps) {
  return (
    <div
      style={{
        minHeight: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '12px 24px',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={frameKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: FADE_IN }}
          exit={{ opacity: 0, y: -6, transition: FADE_OUT }}
          style={{
            fontSize: 20,
            fontWeight: 450,
            fontFamily: 'var(--font-sans)',
            color: storyPalette.text.caption,
            lineHeight: 1.5,
            margin: 0,
            maxWidth: 720,
            letterSpacing: '-0.01em',
          }}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
