import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Test infrastructure', () => {
  it('renders a trivial React component in jsdom', () => {
    function Hello() {
      return <h1>Hello, test!</h1>;
    }

    render(<Hello />);
    expect(screen.getByText('Hello, test!')).toBeDefined();
  });
});
