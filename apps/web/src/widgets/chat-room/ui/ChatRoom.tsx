import { useAtomValue, useSetAtom } from 'jotai';
import type { ReactElement } from 'react';

import {
  MessageList,
  messagesForRoomAtom,
  useRoomHistory,
} from '@/entities/message';
import {
  RoomList,
  currentRoomAtom,
  currentRoomIdAtom,
  roomsAtom,
  selectCurrentRoomActionAtom,
} from '@/entities/room';
import { UserList, currentUserAtom, usersAtom } from '@/entities/user';
import { JoinRoomForm } from '@/features/join-room';
import { SendMessageForm } from '@/features/send-message';
import { SetNameForm } from '@/features/set-name';
import { useChatConnectionStatus, useChatInvoke } from '@/shared/api';
import type { ChatConnectionStatus } from '@/shared/api';
import { env } from '@/shared/config';
import { cn } from '@/shared/lib';
import { Avatar, Badge, Panel, Spinner } from '@/shared/ui';
import type { BadgeTone } from '@/shared/ui';

import styles from './ChatRoom.module.css';

const NO_ROOM_ID = '__no_room__';

interface ConnectionBadge {
  label: string;
  tone: BadgeTone;
}

function getConnectionBadge(status: ChatConnectionStatus['status']): ConnectionBadge {
  switch (status) {
    case 'connected':
      return { label: 'В сети', tone: 'success' };
    case 'connecting':
      return { label: 'Подключение…', tone: 'warning' };
    case 'reconnecting':
      return { label: 'Переподключение…', tone: 'warning' };
    case 'error':
      return { label: 'Ошибка', tone: 'danger' };
    case 'disconnected':
      return { label: 'Отключено', tone: 'danger' };
    case 'idle':
      return { label: 'Ожидание', tone: 'neutral' };
  }
}

export interface ChatRoomProps {
  className?: string;
}

export function ChatRoom({ className }: ChatRoomProps): ReactElement {
  const rooms = useAtomValue(roomsAtom);
  const currentRoomId = useAtomValue(currentRoomIdAtom);
  const currentRoom = useAtomValue(currentRoomAtom);
  const users = useAtomValue(usersAtom);
  const currentUser = useAtomValue(currentUserAtom);
  const selectRoom = useSetAtom(selectCurrentRoomActionAtom);

  const messages = useAtomValue(
    messagesForRoomAtom(currentRoomId ?? NO_ROOM_ID),
  );

  useRoomHistory(currentRoomId);

  const sendInvoke = useChatInvoke('SendMessage');
  const joinInvoke = useChatInvoke('JoinRoom');
  const setNameInvoke = useChatInvoke('SetName');

  const { status, error } = useChatConnectionStatus();
  const connectionBadge = getConnectionBadge(status);

  const showSpinner =
    status === 'connecting' && rooms.length === 0 && messages.length === 0;
  const canSendMessage = currentRoomId !== null && currentUser !== null;
  const hintText =
    currentUser === null
      ? 'Введите имя в панели слева, чтобы присоединиться к чату.'
      : 'Выберите комнату или войдите в неё, чтобы начать общение.';

  return (
    <section className={cn(styles.root, className)} aria-label="Комната чата">
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>{env.appName}</h1>
          <p className={styles.subtitle}>Общение в реальном времени</p>
        </div>
        <div className={styles.headerMeta}>
          <Badge tone={connectionBadge.tone} dot>
            {connectionBadge.label}
          </Badge>
          {currentUser !== null ? (
            <div className={styles.currentUser}>
              <Avatar name={currentUser.name} size="sm" />
              <span className={styles.currentUserName}>{currentUser.name}</span>
            </div>
          ) : null}
        </div>
        {error !== null ? (
          <p className={styles.connectionError} role="status" title={error}>
            {error}
          </p>
        ) : null}
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Комнаты и участники">
          <Panel>
            <RoomList
              rooms={rooms}
              currentRoomId={currentRoomId}
              onSelectRoom={(id) => {
                selectRoom(id);
              }}
            />
          </Panel>
          <Panel title="Войти в комнату">
            <JoinRoomForm invoke={joinInvoke} />
          </Panel>
          <Panel title="Профиль">
            <SetNameForm invoke={setNameInvoke} />
          </Panel>
          <Panel>
            <UserList
              users={users}
              currentUserId={currentUser?.id ?? null}
            />
          </Panel>
        </aside>

        <main className={styles.chat}>
          <div className={styles.chatHeader}>
            <div className={styles.roomInfo}>
              <h2 className={styles.roomTitle}>
                {currentRoom?.name ?? 'Комната не выбрана'}
              </h2>
              {currentRoom !== null ? (
                <p className={styles.roomMeta}>
                  Участников: {currentRoom.memberCount}
                </p>
              ) : null}
            </div>
          </div>

          <div className={styles.messages}>
            {showSpinner ? (
              <div className={styles.spinnerBox} role="status">
                <Spinner />
                <span>Подключение к чату…</span>
              </div>
            ) : (
              <MessageList
                messages={messages}
                currentUserId={currentUser?.id ?? null}
                emptyText={
                  currentRoomId !== null
                    ? 'Сообщений пока нет'
                    : 'Выберите комнату или войдите в неё'
                }
              />
            )}
          </div>

          {canSendMessage ? (
            <SendMessageForm
              invoke={sendInvoke}
              className={styles.composer}
            />
          ) : (
            <p className={styles.hint} role="status">
              {hintText}
            </p>
          )}
        </main>
      </div>
    </section>
  );
}
