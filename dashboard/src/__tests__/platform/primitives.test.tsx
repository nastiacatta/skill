import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { Card, Button, Tag, StatTile, SectionHeading } from '@/components/platform/ui';

afterEach(cleanup);

describe('platform/ui — Card', () => {
  it('renders children', () => {
    render(<Card>Hello card</Card>);
    expect(screen.getByText('Hello card')).toBeDefined();
  });

  it('marks interactive cards for the hover-lift class', () => {
    const { container } = render(<Card interactive>x</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('platform-card--interactive');
    expect(el.getAttribute('data-interactive')).toBe('true');
  });

  it('renders as a custom element via `as`', () => {
    const { container } = render(<Card as="section">x</Card>);
    expect(container.querySelector('section')).not.toBeNull();
  });
});

describe('platform/ui — Button', () => {
  it('renders a button with a label', () => {
    render(<Button>Submit</Button>);
    const btn = screen.getByRole('button', { name: 'Submit' });
    expect(btn).toBeDefined();
    // default type is button, not submit
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('disables and sets aria-busy when loading', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('renders as an anchor when as="a"', () => {
    render(
      <Button as="a" href="#/platform">
        Try it
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Try it' });
    expect(link.getAttribute('href')).toBe('#/platform');
  });

  it('meets the minimum 44px target height by default (md)', () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.style.minHeight).toBe('44px');
  });
});

describe('platform/ui — Tag', () => {
  it('renders its content', () => {
    render(<Tag tone="good">Synthetic</Tag>);
    expect(screen.getByText('Synthetic')).toBeDefined();
  });

  it('never renders text below the 13px floor', () => {
    render(<Tag size="sm">Elia precomputed</Tag>);
    const el = screen.getByText('Elia precomputed');
    expect(parseFloat(el.style.fontSize)).toBeGreaterThanOrEqual(13);
  });
});

describe('platform/ui — StatTile', () => {
  it('renders label, value and unit', () => {
    render(<StatTile label="Wind CRPS" value="-7.1" unit="%" />);
    expect(screen.getByText('Wind CRPS')).toBeDefined();
    expect(screen.getByText('-7.1')).toBeDefined();
    expect(screen.getByText('%')).toBeDefined();
  });

  it('uses the large statXL size for the headline number', () => {
    render(<StatTile label="Headline" value="83.7" size="xl" />);
    const num = screen.getByText('83.7');
    expect(parseFloat(num.style.fontSize)).toBe(64);
  });

  it('renders a delta with a direction arrow', () => {
    render(
      <StatTile label="x" value="1" delta={{ value: '5%', direction: 'down' }} />,
    );
    expect(screen.getByText('5%')).toBeDefined();
    expect(screen.getByText('↓')).toBeDefined();
  });
});

describe('platform/ui — SectionHeading', () => {
  it('renders eyebrow, title and subtitle', () => {
    render(
      <SectionHeading
        eyebrow="Platform"
        title="Submit a forecast"
        subtitle="The pool pays for itself."
      />,
    );
    expect(screen.getByText('Platform')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Submit a forecast' })).toBeDefined();
    expect(screen.getByText('The pool pays for itself.')).toBeDefined();
  });

  it('renders the requested heading level', () => {
    render(<SectionHeading title="Title" level={1} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Title');
  });

  it('renders an actions slot', () => {
    render(<SectionHeading title="T" actions={<button>Act</button>} />);
    expect(screen.getByRole('button', { name: 'Act' })).toBeDefined();
  });
});
