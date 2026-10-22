const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

const EMPTY_TIME = '—';

/**
 * Formats an ISO date-time as local ru-RU time (HH:mm).
 * Returns an em dash for empty or invalid input instead of throwing.
 */
export function formatTime(iso: string): string {
  const value = iso.trim();

  if (value.length === 0) {
    return EMPTY_TIME;
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return EMPTY_TIME;
    }

    return timeFormatter.format(date);
  } catch {
    return EMPTY_TIME;
  }
}
