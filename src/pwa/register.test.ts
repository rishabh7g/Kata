import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './register';

function stubServiceWorkerContainer(register: () => Promise<unknown>) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register },
    configurable: true,
  });
}

function stubReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', {
    value: state,
    configurable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(document, 'readyState');
  vi.restoreAllMocks();
});

describe('registerServiceWorker', () => {
  it('registers the built worker at the base path', () => {
    const register = vi.fn(() => Promise.resolve({}));
    stubServiceWorkerContainer(register);

    registerServiceWorker();

    expect(register).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    });
  });

  it('waits for the page to finish loading before precaching starts', () => {
    const register = vi.fn(() => Promise.resolve({}));
    stubServiceWorkerContainer(register);
    stubReadyState('loading');

    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));

    expect(register).toHaveBeenCalledOnce();
  });

  it('logs and swallows a failed registration — the app works without one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failure = Promise.reject(new Error('blocked'));
    stubServiceWorkerContainer(() => failure);

    registerServiceWorker();
    await failure.catch(() => undefined);

    expect(warn).toHaveBeenCalled();
  });

  it('does nothing where service workers are unsupported', () => {
    expect(() => {
      registerServiceWorker();
    }).not.toThrow();
  });
});
