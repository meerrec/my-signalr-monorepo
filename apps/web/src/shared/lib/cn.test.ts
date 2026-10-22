import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('returns an empty string when no values are provided', () => {
    expect(cn()).toBe('');
  });

  it('joins class names with a single space', () => {
    expect(cn('panel', 'panel-wide')).toBe('panel panel-wide');
  });

  it('skips false, null, undefined and empty strings', () => {
    expect(cn('button', false, null, undefined, '', 'button-primary')).toBe(
      'button button-primary',
    );
  });

  it('keeps the provided order', () => {
    expect(cn('b', 'a')).toBe('b a');
  });
});
