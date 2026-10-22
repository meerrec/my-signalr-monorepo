import type { ReactElement } from 'react';

import type { ChatRoom } from '@chat/signalr-client';

import { cn } from '@/shared/lib';
import { Badge } from '@/shared/ui';

import styles from './RoomList.module.css';

export interface RoomListProps {
  rooms: ChatRoom[];
  currentRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  className?: string;
}

export function RoomList({
  rooms,
  currentRoomId,
  onSelectRoom,
  className,
}: RoomListProps): ReactElement {
  return (
    <section className={cn(styles.root, className)} aria-label="Комнаты">
      <h2 className={styles.title}>Комнаты</h2>
      {rooms.length === 0 ? (
        <p className={styles.empty} role="status">
          Комнат пока нет
        </p>
      ) : (
        <ul className={styles.list} role="list" aria-label="Список комнат">
          {rooms.map((room) => {
            const isSelected = room.id === currentRoomId;

            return (
              <li key={room.id} className={styles.item}>
                <button
                  type="button"
                  className={cn(styles.button, isSelected && styles.selected)}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onSelectRoom(room.id);
                  }}
                >
                  <span className={styles.name}>{room.name}</span>
                  {typeof room.memberCount === 'number' ? (
                    <Badge
                      tone={isSelected ? 'accent' : 'neutral'}
                      className={styles.count}
                    >
                      {room.memberCount} участн.
                    </Badge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
