import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib';
import { Spinner } from '../Spinner';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  loading?: boolean | undefined;
  fullWidth?: boolean | undefined;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  type = 'button',
  disabled = false,
  className,
  children,
  'aria-busy': ariaBusy,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        loading && styles.loading,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading ? true : ariaBusy}
    >
      {loading ? <Spinner className={styles.spinner} size="sm" /> : null}
      {children !== undefined && children !== null ? (
        <span className={styles.label}>{children}</span>
      ) : null}
    </button>
  );
}
