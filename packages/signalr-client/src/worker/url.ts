/**
 * Приводит адрес хаба к абсолютному URL.
 * Внутри Worker `@microsoft/signalr` не умеет резолвить относительные адреса,
 * поэтому путь достраивается от текущей страницы ещё в main-потоке.
 */
export function toAbsoluteWorkerUrl(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    throw new Error('toAbsoluteWorkerUrl: URL хаба SignalR не может быть пустым');
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    // Не абсолютный адрес — резолвим от страницы ниже.
  }

  const base = globalThis.location?.href;

  if (base === undefined || base.length === 0) {
    throw new Error(
      'toAbsoluteWorkerUrl: не удалось определить базовый URL для относительного адреса хаба',
    );
  }

  return new URL(trimmed, base).toString();
}
