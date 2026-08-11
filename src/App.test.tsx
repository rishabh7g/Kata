import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('app shell', () => {
  it('renders the Kata lockup, linking back to the Curriculum', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: 'Kata' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('renders the Checkpoint count in the nav', () => {
    renderAt('/');

    expect(screen.getByText('Checkpoints 0 / 5')).toBeInTheDocument();
  });

  it('renders an empty container for the screens to fill', () => {
    const { container } = renderAt('/');

    const main = container.querySelector('main .app-container');
    expect(main).toBeInTheDocument();
    expect(main).toBeEmptyDOMElement();
  });

  it('renders the shell for an unknown deep link instead of a dead end', () => {
    renderAt('/modules/m01');

    expect(screen.getByRole('link', { name: 'Kata' })).toBeInTheDocument();
  });
});
