/**
 * Registers the service worker the build emits at `${BASE_URL}sw.js`.
 *
 * There is no update UI: the worker calls `skipWaiting()` on install and claims
 * the open pages on activation, so a deploy is picked up by the next load.
 * Registration failures are logged and swallowed — Kata is a plain static site
 * without a worker, so an unsupported or blocked one must never break the app.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  // Let the shell paint before the worker starts precaching it.
  if (document.readyState === 'complete') {
    register();
    return;
  }
  window.addEventListener('load', register, { once: true });
}

function register(): void {
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      // Never let an HTTP-cached copy of the worker hide a new deploy.
      updateViaCache: 'none',
    })
    .catch((error: unknown) => {
      console.warn('Kata: service worker registration failed', error);
    });
}
