import { describe, expect, it } from 'vitest';

import { getInitials } from './get-initials';

describe('getInitials', () => {
  it('returns initials of the first two words', () => {
    expect(getInitials('Иван Петров')).toBe('ИП');
  });

  it('uppercases lowercase names', () => {
    expect(getInitials('иван петров')).toBe('ИП');
  });

  it('returns a single initial for a single word', () => {
    expect(getInitials('Анна')).toBe('А');
  });

  it('ignores words after the first two', () => {
    expect(getInitials('Иван Петрович Сидоров')).toBe('ИП');
  });

  it('tolerates extra whitespace', () => {
    expect(getInitials('  иван   петров  ')).toBe('ИП');
  });

  it('returns a fallback for empty and whitespace-only names', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });
});
