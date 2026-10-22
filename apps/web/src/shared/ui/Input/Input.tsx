import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

import { cn } from '../../lib';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
}

export function Input({
  label,
  error,
  hint,
  id,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasError = error !== undefined && error.length > 0;
  const message = hasError ? error : hint;
  const hasMessage = message !== undefined && message.length > 0;
  const describedBy = [ariaDescribedBy, hasMessage ? messageId : undefined]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return (
    <div className={styles.field}>
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        {...rest}
        id={inputId}
        className={cn(styles.input, hasError && styles.inputError, className)}
        aria-invalid={hasError ? true : ariaInvalid}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
      />
      {hasMessage ? (
        <p
          id={messageId}
          className={cn(styles.message, hasError && styles.errorText)}
          role={hasError ? 'alert' : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
