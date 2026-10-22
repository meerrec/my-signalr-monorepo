import type { ReactElement } from 'react';

import type { ChatMessage } from '@chat/signalr-client';

import { cn, formatTime } from '@/shared/lib';
import { Avatar } from '@/shared/ui';

import styles from './MessageList.module.css';

export interface MessageListProps {
  messages: ChatMessage[];
  currentUserId?: string | null;
  emptyText?: string;
  className?: string;
}

export function MessageList({
  messages,
  currentUserId = null,
  emptyText,
  className,
}: MessageListProps): ReactElement {
  if (messages.length === 0) {
    return (
      <p className={cn(styles.empty, className)} role="status">
        {emptyText ?? 'Сообщений пока нет'}
      </p>
    );
  }

  return (
    <ul className={cn(styles.list, className)} role="list" aria-label="Сообщения">
      {messages.map((message) => {
        const isOwn =
          currentUserId !== null && message.authorId === currentUserId;

        return (
          <li
            key={message.id}
            className={cn(styles.item, isOwn && styles.own)}
            data-own={isOwn ? 'true' : undefined}
          >
            <Avatar
              name={message.authorName}
              size="sm"
              className={styles.avatar}
            />
            <div className={styles.bubble}>
              <div className={styles.meta}>
                <span className={styles.author}>{message.authorName}</span>
                <time className={styles.time} dateTime={message.sentAt}>
                  {formatTime(message.sentAt)}
                </time>
              </div>
              <p className={styles.text}>{message.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
