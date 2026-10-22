import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib';
import styles from './Textarea.module.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string | undefined;
  error?: string | undefined;
}

export function Textarea({
  label,
  error,
  id,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const messageId = `${textareaId}-message`;
  const hasError = error !== undefined && error.length > 0;
  const describedBy = [ariaDescribedBy, hasError ? messageId : undefined]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return (
    <div className={styles.field}>
      {label ? (
        <label className={styles.label} htmlFor={textareaId}>
          {label}
        </label>
      ) : null}
      <textarea
        {...rest}
        id={textareaId}
        className={cn(styles.textarea, hasError && styles.textareaError, className)}
        aria-invalid={hasError ? true : ariaInvalid}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
      />
      {hasError ? (
        <p id={messageId} className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
