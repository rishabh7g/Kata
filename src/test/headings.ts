/**
 * The document outline a screen reader navigates by (#75) — every heading in
 * document order as `h<level> <text>`, plus the rule that outline has to obey:
 * exactly one h1, and no level that jumps more than one step below the level
 * above it.
 *
 * Levels are read from the tag, not from the type scale: the section labels
 * look like the design system's 13px `h6` label and are marked up `h2`, which
 * is the whole point of the fix these helpers guard.
 */
export function headingOutline(container: HTMLElement): string[] {
  return [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(
    (heading) =>
      `${heading.tagName.toLowerCase()} ${(heading.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()}`,
  );
}

/**
 * Asserts the outline is well-formed and returns it, so a test can then say
 * what the screen's sections actually are. Throws with the offending outline
 * so a failure reads as the outline itself, not as a boolean.
 */
export function expectWellFormedOutline(container: HTMLElement): string[] {
  const outline = headingOutline(container);
  const levels = outline.map((line) => Number(line[1]));

  const h1Count = levels.filter((level) => level === 1).length;
  if (h1Count !== 1) {
    throw new Error(
      `expected exactly one h1, found ${h1Count}:\n${outline.join('\n')}`,
    );
  }
  if (levels[0] !== 1) {
    throw new Error(`expected the outline to open with the h1:\n${outline.join('\n')}`);
  }
  for (let i = 1; i < levels.length; i += 1) {
    const previous = levels[i - 1] ?? 1;
    const current = levels[i] ?? 1;
    if (current > previous + 1) {
      throw new Error(
        `heading level skips h${previous} → h${current} at "${outline[i]}":\n${outline.join('\n')}`,
      );
    }
  }
  return outline;
}
