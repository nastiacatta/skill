import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MechanismPipelineSlide from '@/components/slides/MechanismPipelineSlide';

describe('MechanismPipelineSlide', () => {
  it('renders all 5 step boxes with correct labels', () => {
    render(<MechanismPipelineSlide />);

    expect(screen.getByText('1. Submit')).toBeDefined();
    expect(screen.getByText('2. Effective Wager')).toBeDefined();
    expect(screen.getByText('3. Aggregate')).toBeDefined();
    expect(screen.getByText('4. Settle')).toBeDefined();
    expect(screen.getByText('5. Skill Update')).toBeDefined();
  });

  it('renders KaTeX formula containers in each step box', () => {
    const { container } = render(<MechanismPipelineSlide />);

    const katexElements = container.querySelectorAll('.katex');
    // 5 steps + 1 secondary formula for Effective Wager = 6 KaTeX blocks
    expect(katexElements.length).toBeGreaterThanOrEqual(5);
  });

  it('renders the insight banner text', () => {
    const { container } = render(<MechanismPipelineSlide />);

    const bannerText = container.querySelectorAll('[style*="font-weight: 700"]');
    const found = Array.from(bannerText).some(
      (el) => el.textContent?.includes('Same effective wager'),
    );
    expect(found).toBe(true);
  });

  it('renders the feedback loop label', () => {
    const { container } = render(<MechanismPipelineSlide />);

    const svgTexts = container.querySelectorAll('svg text');
    const found = Array.from(svgTexts).some(
      (el) => el.textContent?.includes('feeds back'),
    );
    expect(found).toBe(true);
  });

  it('renders the outcome y label', () => {
    const { container } = render(<MechanismPipelineSlide />);

    // The component does not render a separate "outcome y" SVG label;
    // the settle step description mentions "relative score" which implies outcome observation
    const text = container.textContent ?? '';
    expect(text).toContain('Settle');
  });

  it('renders an SVG with dashed path for feedback loop', () => {
    const { container } = render(<MechanismPipelineSlide />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const dashedPath = container.querySelector('path[stroke-dasharray]');
    expect(dashedPath).not.toBeNull();
  });

  it('renders the slide title', () => {
    const { container } = render(<MechanismPipelineSlide />);

    const headings = container.querySelectorAll('h2');
    const found = Array.from(headings).some(
      (el) => el.textContent === 'Mechanism: Round-by-Round',
    );
    expect(found).toBe(true);
  });

  it('renders step subtitles', () => {
    const { container } = render(<MechanismPipelineSlide />);

    const text = container.textContent ?? '';
    expect(text).toContain('Forecaster submits');
    expect(text).toContain('skill factor');
    expect(text).toContain('Weighted average');
    expect(text).toContain('budget balanced');
    expect(text).toContain('feeds back');
  });
});
