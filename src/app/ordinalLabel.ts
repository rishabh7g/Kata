/**
 * A Module's ordinal as every surface writes it: two digits, zero-padded —
 * `Module 03`, never `Module 3`.
 */
export function ordinalLabel(ordinal: number): string {
  return String(ordinal).padStart(2, '0');
}
