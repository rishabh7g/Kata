// The cancelled-effect contract every read-on-mount hook relies on: a result
// that lands after the deps moved on is dropped, never set. (The same cleanup
// runs on unmount, but React 19 ignores a set on an unmounted component, so
// that case has no observable to pin — the deps case is the one that can fail.)
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAsyncValue } from './useAsyncValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/** A promise settled by hand, so the test decides when a read answers. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let container: HTMLDivElement;
let root: Root;
let renders: string[];

function Reader({ read, dep }: { read: () => Promise<string>; dep: string }) {
  const value = useAsyncValue(read, [dep], 'Failed to read');
  renders.push(value ?? '(null)');
  return <span>{value ?? '(null)'}</span>;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  renders = [];
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(read: () => Promise<string>, dep: string) {
  await act(async () => root.render(<Reader read={read} dep={dep} />));
}

describe('useAsyncValue', () => {
  it('is null until the read answers, then holds the answer', async () => {
    const read = deferred<string>();
    await render(() => read.promise, 'a');
    expect(container.textContent).toBe('(null)');
    await act(async () => read.resolve('first'));
    expect(container.textContent).toBe('first');
  });

  it('drops the earlier read when the deps move on before it answers', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const reads = [first, second];
    const read = () => reads.shift()!.promise;
    await render(read, 'a');
    await render(read, 'b');
    // The stale answer arrives first and must not show under the new dep.
    await act(async () => first.resolve('stale'));
    expect(container.textContent).toBe('(null)');
    await act(async () => second.resolve('current'));
    expect(container.textContent).toBe('current');
  });

  it('keeps the previous value while a re-read is in flight', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const reads = [first, second];
    const read = () => reads.shift()!.promise;
    await render(read, 'a');
    await act(async () => first.resolve('kept'));
    await render(read, 'b');
    expect(container.textContent).toBe('kept');
  });

  it('logs a rejection under the label and leaves the value at null', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const read = deferred<string>();
    await render(() => read.promise, 'a');
    await act(async () => read.reject(new Error('offline')));
    expect(container.textContent).toBe('(null)');
    expect(error).toHaveBeenCalledWith('Failed to read', new Error('offline'));
  });
});
