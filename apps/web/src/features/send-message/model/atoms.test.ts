import { createStore } from 'jotai/vanilla';
import type { Store } from 'jotai/vanilla';
import { describe, expect, it, vi } from 'vitest';

import type { ChatMessage, ChatRoom, SendMessageRequest } from '@chat/signalr-client';

import { messagesForRoomAtom } from '@/entities/message';
import {
  selectCurrentRoomActionAtom,
  upsertRoomActionAtom,
} from '@/entities/room';

import {
  changeMessageDraftActionAtom,
  messageDraftAtom,
  sendMessageActionAtom,
  sendMessageErrorAtom,
  sendMessageStatusAtom,
} from './atoms';

const createRoom = (id = 'room-1'): ChatRoom => ({
  id,
  name: 'General',
  memberCount: 1,
});

const createMessage = (
  roomId: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage => ({
  id: 'message-1',
  roomId,
  authorId: 'user-1',
  authorName: 'Alice',
  text: 'hello',
  sentAt: '2024-01-01T10:00:00.000Z',
  ...overrides,
});

const selectRoom = (store: Store, room: ChatRoom = createRoom()): ChatRoom => {
  store.set(upsertRoomActionAtom, room);
  store.set(selectCurrentRoomActionAtom, room.id);

  return room;
};

describe('features/send-message model atoms', () => {
  it('starts with an empty draft, idle status and no error', () => {
    const store = createStore();

    expect(store.get(messageDraftAtom)).toBe('');
    expect(store.get(sendMessageStatusAtom)).toBe('idle');
    expect(store.get(sendMessageErrorAtom)).toBeNull();
  });

  it('changes the draft through the change action', () => {
    const store = createStore();

    store.set(changeMessageDraftActionAtom, 'hello');
    expect(store.get(messageDraftAtom)).toBe('hello');

    store.set(changeMessageDraftActionAtom, '');
    expect(store.get(messageDraftAtom)).toBe('');
  });

  it('rejects a blank draft without calling invoke', async () => {
    const store = createStore();
    const room = selectRoom(store);

    store.set(changeMessageDraftActionAtom, '   ');

    const invoke = vi.fn(async (_request: SendMessageRequest) =>
      createMessage(room.id),
    );

    await store.set(sendMessageActionAtom, { invoke });

    expect(invoke).not.toHaveBeenCalled();
    expect(store.get(sendMessageStatusAtom)).toBe('error');
    expect(store.get(sendMessageErrorAtom)).toBe('Введите сообщение');
    expect(store.get(messageDraftAtom)).toBe('   ');
  });

  it('rejects sending when no room is selected', async () => {
    const store = createStore();

    store.set(changeMessageDraftActionAtom, 'hello');

    const invoke = vi.fn(async (_request: SendMessageRequest) =>
      createMessage('room-1'),
    );

    await store.set(sendMessageActionAtom, { invoke });

    expect(invoke).not.toHaveBeenCalled();
    expect(store.get(sendMessageStatusAtom)).toBe('error');
    expect(store.get(sendMessageErrorAtom)).toBe('Сначала выберите комнату');
    expect(store.get(messageDraftAtom)).toBe('hello');
  });

  it('sends trimmed text, upserts the message, clears the draft and marks success', async () => {
    const store = createStore();
    const room = selectRoom(store);
    const created = createMessage(room.id, { text: 'Привет, мир' });

    store.set(changeMessageDraftActionAtom, '  Привет, мир  ');

    const invoke = vi.fn(async () => {
      expect(store.get(sendMessageStatusAtom)).toBe('pending');
      expect(store.get(sendMessageErrorAtom)).toBeNull();

      return created;
    });

    await store.set(sendMessageActionAtom, { invoke });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith({
      roomId: room.id,
      text: 'Привет, мир',
    });
    expect(store.get(messagesForRoomAtom(room.id))).toEqual([created]);
    expect(store.get(messageDraftAtom)).toBe('');
    expect(store.get(sendMessageStatusAtom)).toBe('success');
    expect(store.get(sendMessageErrorAtom)).toBeNull();
  });

  it('handles an Error from invoke, keeps the draft and adds no message', async () => {
    const store = createStore();
    const room = selectRoom(store);

    store.set(changeMessageDraftActionAtom, '  hello  ');

    const invoke = vi.fn(async (_request: SendMessageRequest) => {
      throw new Error('Сервер недоступен');
    });

    await store.set(sendMessageActionAtom, { invoke });

    expect(store.get(sendMessageStatusAtom)).toBe('error');
    expect(store.get(sendMessageErrorAtom)).toBe('Сервер недоступен');
    expect(store.get(messageDraftAtom)).toBe('  hello  ');
    expect(store.get(messagesForRoomAtom(room.id))).toEqual([]);
  });

  it('handles a string rejection from invoke with its message', async () => {
    const store = createStore();
    const room = selectRoom(store);

    store.set(changeMessageDraftActionAtom, 'hello');

    const invoke = vi.fn((_request: SendMessageRequest) =>
      Promise.reject('Сеть недоступна'),
    );

    await store.set(sendMessageActionAtom, { invoke });

    expect(store.get(sendMessageStatusAtom)).toBe('error');
    expect(store.get(sendMessageErrorAtom)).toBe('Сеть недоступна');
    expect(store.get(messageDraftAtom)).toBe('hello');
    expect(store.get(messagesForRoomAtom(room.id))).toEqual([]);
  });
});
