import type { ReactElement } from 'react';

import { cn } from '@/shared/lib';
import { Avatar, Badge } from '@/shared/ui';

import type { ChatUser } from '../model';

import styles from './UserList.module.css';

export interface UserListProps {
  users: ChatUser[];
  currentUserId?: string | null;
  className?: string;
}

export function UserList({
  users,
  currentUserId = null,
  className,
}: UserListProps): ReactElement {
  return (
    <section className={cn(styles.root, className)} aria-label="Участники">
      <header className={styles.header}>
        <h2 className={styles.title}>Участники</h2>
        <Badge tone="neutral">{users.length}</Badge>
      </header>
      {users.length === 0 ? (
        <p className={styles.empty} role="status">
          Пока никого нет
        </p>
      ) : (
        <ul className={styles.list} role="list" aria-label="Список участников">
          {users.map((user) => {
            const isCurrent =
              currentUserId !== null && user.id === currentUserId;

            return (
              <li key={user.id} className={styles.item}>
                <Avatar name={user.name} size="sm" />
                <span className={styles.name}>{user.name}</span>
                {isCurrent ? (
                  <Badge tone="accent" className={styles.badge}>
                    вы
                  </Badge>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
