/**
 * The browser's own words for a failure, e.g. `SecurityError: blocked` or
 * `TypeError: Failed to fetch` — the last line of a Notice, so the learner
 * can hand something concrete to a search box.
 *
 * Duck-typed rather than `instanceof Error`: what IndexedDB rejects with is a
 * DOMException, which does not inherit from Error everywhere. Shared by the
 * blocked progress store (#68) and a Module whose content will not load (#69).
 */
export function describeError(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (typeof name !== 'string' || name === '') return null;
  return typeof message === 'string' && message !== ''
    ? `${name}: ${message}`
    : name;
}
