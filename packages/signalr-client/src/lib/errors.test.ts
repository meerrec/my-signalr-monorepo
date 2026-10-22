import { describe, expect, it } from 'vitest';
import type { AppError } from '@chat/shared-types';
import { toErrorMessage } from './errors';

const DEFAULT_FALLBACK = 'Не удалось выполнить операцию';

describe('toErrorMessage', () => {
  it('возвращает message у Error', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('возвращает обрезанную непустую строку', () => {
    expect(toErrorMessage('  network down  ')).toBe('network down');
  });

  it('возвращает message у объекта с message', () => {
    expect(toErrorMessage({ message: 'объектная ошибка' })).toBe('объектная ошибка');
  });

  it('возвращает message у AppError', () => {
    const error: AppError = {
      code: 'ROOM_NOT_FOUND',
      message: 'Комната не найдена',
    };

    expect(toErrorMessage(error)).toBe('Комната не найдена');
  });

  it('возвращает code, если message отсутствует', () => {
    expect(toErrorMessage({ code: 'TIMEOUT' })).toBe('TIMEOUT');
  });

  it('возвращает fallback для null, undefined и пустых строк', () => {
    expect(toErrorMessage(null)).toBe(DEFAULT_FALLBACK);
    expect(toErrorMessage(undefined)).toBe(DEFAULT_FALLBACK);
    expect(toErrorMessage('   ')).toBe(DEFAULT_FALLBACK);
    expect(toErrorMessage(null, 'Свой текст')).toBe('Свой текст');
  });
});
