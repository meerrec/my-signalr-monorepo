import type { ReactNode } from 'react';

import { cn } from '../../lib';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  tone?: BadgeTone | undefined;
  dot?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
}

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[tone], className)}>
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
