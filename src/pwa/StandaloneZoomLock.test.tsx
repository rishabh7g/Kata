import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StandaloneZoomLock } from './StandaloneZoomLock';

/** What the static tag reads (#101) — the string the lock has to amend, not replace. */
const STATIC_TAG = 'width=device-width, initial-scale=1, viewport-fit=cover';

function viewportMeta(): HTMLMetaElement {
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="viewport"]',
  );
  if (!meta) throw new Error('No viewport meta tag in the test DOM');
  return meta;
}

/** jsdom has no matchMedia; this is the only browser input the component reads. */
function stubDisplayMode(standalone: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: standalone && query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = STATIC_TAG;
  document.head.appendChild(meta);
});

afterEach(() => {
  viewportMeta().remove();
  vi.unstubAllGlobals();
});

describe('StandaloneZoomLock', () => {
  it('locks zoom when installed — while keeping viewport-fit=cover', () => {
    stubDisplayMode(true);

    render(<StandaloneZoomLock />);

    const { content } = viewportMeta();
    expect(content).toContain('user-scalable=no');
    expect(content).toContain('maximum-scale=1');

    // THE ASSERTION THAT MATTERS. `viewport-fit=cover` is what turns
    // `env(safe-area-inset-*)` on; losing it would silently regress the
    // header's safe-area padding in exactly the mode this component acts on.
    // A lock that wrote a hardcoded content string would pass every other
    // assertion here and fail this one.
    expect(content).toContain('viewport-fit=cover');
    expect(content).toContain('width=device-width');
    expect(content).toContain('initial-scale=1');
  });

  it('leaves a browser tab untouched', () => {
    stubDisplayMode(false);

    render(<StandaloneZoomLock />);

    expect(viewportMeta().content).toBe(STATIC_TAG);
  });
});
