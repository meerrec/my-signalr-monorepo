import { useId } from 'react';
import type { ReactNode } from 'react';

import { cn } from '../../lib';
import styles from './Panel.module.css';

export interface PanelProps {
  title?: string | undefined;
  actions?: ReactNode;
  className?: string | undefined;
  children: ReactNode;
}

export function Panel({ title, actions, className, children }: PanelProps) {
  const titleId = useId();
  const hasTitle = title !== undefined && title.length > 0;
  const hasActions = actions !== undefined && actions !== null;

  return (
    <section
      className={cn(styles.panel, className)}
      aria-labelledby={hasTitle ? titleId : undefined}
    >
      {hasTitle || hasActions ? (
        <header className={styles.header}>
          {hasTitle ? (
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
          ) : null}
          {hasActions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
