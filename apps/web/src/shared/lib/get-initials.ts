const FALLBACK_INITIAL = '?';

/**
 * Returns uppercased first letters of the first two words in a name.
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return FALLBACK_INITIAL;
  }

  const initials = words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();

  return initials.length > 0 ? initials : FALLBACK_INITIAL;
}
