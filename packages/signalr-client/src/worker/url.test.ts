import { afterEach, describe, expect, it, vi } from 'vitest';
import { toAbsoluteWorkerUrl } from './url';

describe('toAbsoluteWorkerUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('возвращает абсолютный URL', () => {
    expect(toAbsoluteWorkerUrl('http://localhost:5000/hubs/chat')).toBe(
      'http://localhost:5000/hubs/chat',
    );
  });

  it('обрезает пробелы вокруг адреса', () => {
    expect(toAbsoluteWorkerUrl('  https://chat.example.com/hubs/chat  ')).toBe(
      'https://chat.example.com/hubs/chat',
    );
  });

  it('резолвит относительный URL от location.href', () => {
    vi.stubGlobal('location', { href: 'http://localhost:5173/app' });

    expect(toAbsoluteWorkerUrl('/hubs/chat')).toBe('http://localhost:5173/hubs/chat');
  });

  it('бросает ошибку для пустого адреса', () => {
    expect(() => toAbsoluteWorkerUrl('   ')).toThrow(/не может быть пустым/);
  });

  it('бросает ошибку, если базового URL нет', () => {
    vi.stubGlobal('location', undefined);

    expect(() => toAbsoluteWorkerUrl('/hubs/chat')).toThrow(/базовый URL/);
  });
});
