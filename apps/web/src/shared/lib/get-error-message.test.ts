import { describe, expect, it } from 'vitest';

import { getErrorMessage } from './get-error-message';

describe('getErrorMessage', () => {
  it('returns the message of an Error', () => {
    expect(getErrorMessage(new Error('Соединение потеряно'))).toBe(
      'Соединение потеряно',
    );
  });

  it('returns a non-empty string error', () => {
    expect(getErrorMessage('Таймаут')).toBe('Таймаут');
  });

  it('trims surrounding whitespace', () => {
    expect(getErrorMessage(new Error('  boom  '))).toBe('boom');
    expect(getErrorMessage('  oops  ')).toBe('oops');
  });

  it('returns the default fallback for empty messages', () => {
    expect(getErrorMessage(new Error('   '))).toBe('Неизвестная ошибка');
    expect(getErrorMessage('')).toBe('Неизвестная ошибка');
  });

  it('returns the default fallback for unknown values', () => {
    expect(getErrorMessage(undefined)).toBe('Неизвестная ошибка');
    expect(getErrorMessage(null)).toBe('Неизвестная ошибка');
    expect(getErrorMessage({ code: 500 })).toBe('Неизвестная ошибка');
  });

  it('supports a custom fallback', () => {
    expect(getErrorMessage(null, 'Не удалось загрузить чат')).toBe(
      'Не удалось загрузить чат',
    );
  });
});
