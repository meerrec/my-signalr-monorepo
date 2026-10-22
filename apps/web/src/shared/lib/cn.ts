export type ClassNameValue = string | false | null | undefined;

/**
 * Joins truthy class name values with a single space.
 */
export function cn(...values: ClassNameValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}
