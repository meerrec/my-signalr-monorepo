import { describe, expect, it } from 'vitest';

import { formatTime } from './format-time';

describe('formatTime', () => {
  it('formats a valid date as ru-RU HH:mm time', () => {
    const iso = new Date(2024, 4, 1, 9, 5).toISOString();

    expect(formatTime(iso)).toBe('09:05');
  });

  it('formats late evening time', () => {
    const iso = new Date(2024, 4, 1, 23, 59).toISOString();

    expect(formatTime(iso)).toBe('23:59');
  });

  it('returns an em dash for an empty string', () => {
    expect(formatTime('')).toBe('—');
    expect(formatTime('   ')).toBe('—');
  });

  it('returns an em dash for an invalid date', () => {
    expect(formatTime('not-a-date')).toBe('—');
    expect(formatTime('2024-99-99T99:99:99Z')).toBe('—');
  });
});
