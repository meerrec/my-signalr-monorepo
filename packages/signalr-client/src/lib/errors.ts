const DEFAULT_FALLBACK = 'Не удалось выполнить операцию';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Приводит произвольную ошибку к человекочитаемому сообщению.
 * Поддерживает строки, Error, объекты с message (включая AppError) и объекты с code.
 */
export function toErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (isNonEmptyString(error)) {
    return error.trim();
  }

  if (error instanceof Error && isNonEmptyString(error.message)) {
    return error.message.trim();
  }

  if (isRecord(error)) {
    const { message, code } = error;

    if (isNonEmptyString(message)) {
      return message.trim();
    }

    if (isNonEmptyString(code)) {
      return code.trim();
    }
  }

  return fallback;
}
