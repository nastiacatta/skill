import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { storyPalette } from './storyPalette';

export interface StoryFormulaBoxProps {
  latex: string;
  label: string;
  visible: boolean;
}

export default function StoryFormulaBox({
  latex,
  label,
  visible,
}: StoryFormulaBoxProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current && latex) {
      try {
        katex.render(latex, ref.current, {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        if (ref.current) ref.current.textContent = latex;
      }
    }
  }, [latex]);

  if (!visible) return null;

  return (
    <div
      data-testid="story-formula-box"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: storyPalette.pool.fill,
        border: `1px solid ${storyPalette.surface.border}`,
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: 13,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: storyPalette.text.muted,
          fontFamily: 'var(--font-sans, sans-serif)',
        }}
      >
        {label}
      </span>
      <span ref={ref} />
    </div>
  );
}

export const STORY_FORMULAS: Record<number, { latex: string; label: string }> = {
  2: {
    label: 'Gate',
    latex: 'm_i = b_i \\cdot g(\\sigma_i)',
  },
  3: {
    label: 'Aggregate',
    latex: '\\hat{q}(\\tau_k) = \\sum_i w_i \\cdot q_i(\\tau_k), \\quad w_i = \\frac{m_i}{\\sum_j m_j}',
  },
  5: {
    label: 'Score',
    latex: '\\hat{C}_i = \\frac{2}{K}\\sum_{k=1}^{K} L^{\\tau_k}(y,\\, q_i(\\tau_k)), \\quad s_i = 1 - \\hat{C}_i / 2',
  },
  6: {
    label: 'Settle',
    latex: '\\pi_i = m_i \\cdot (1 + s_i - \\bar{s}), \\quad \\bar{s} = \\frac{\\sum_j m_j s_j}{\\sum_j m_j}',
  },
};
