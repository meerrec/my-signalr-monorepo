const DEFAULT_ERROR_MESSAGE = 'Неизвестная ошибка';

/**
 * Extracts a non-empty human-readable message from an unknown error.
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_ERROR_MESSAGE,
): string {
  if (error instanceof Error) {
    const message = error.message.trim();

    return message.length > 0 ? message : fallback;
  }

  if (typeof error === 'string') {
    const message = error.trim();

    return message.length > 0 ? message : fallback;
  }

  return fallback;
}
