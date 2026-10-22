import { createStore } from 'jotai/vanilla';
import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '@chat/signalr-client';

import {
  clearRoomMessagesActionAtom,
  messageCountForRoomAtom,
  messagesByRoomAtom,
  messagesForRoomAtom,
  upsertMessageActionAtom,
  upsertMessagesActionAtom,
} from './atoms';

const createMessage = (
  id: string,
  roomId: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage => ({
  id,
  roomId,
  authorId: 'author-1',
  authorName: 'Alice',
  text: `message ${id}`,
  sentAt: '2024-01-01T10:00:00.000Z',
  ...overrides,
});

describe('message model atoms', () => {
  it('starts with empty state and derived values', () => {
    const store = createStore();

    expect(store.get(messagesByRoomAtom)).toEqual({});
    expect(store.get(messagesForRoomAtom('room-1'))).toEqual([]);
    expect(store.get(messageCountForRoomAtom('room-1'))).toBe(0);
  });

  it('upserts a message and replaces a message with the same id', () => {
    const store = createStore();
    const original = createMessage('message-1', 'room-1', { text: 'first' });

    store.set(upsertMessageActionAtom, original);

    expect(store.get(messagesForRoomAtom('room-1'))).toEqual([original]);

    const updated = createMessage('message-1', 'room-1', { text: 'updated' });

    store.set(upsertMessageActionAtom, updated);

    const messages = store.get(messagesForRoomAtom('room-1'));

    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBe('updated');
    expect(store.get(messageCountForRoomAtom('room-1'))).toBe(1);
    expect(original.text).toBe('first');
  });

  it('isolates messages by room', () => {
    const store = createStore();

    store.set(upsertMessageActionAtom, createMessage('message-1', 'room-1'));
    store.set(upsertMessageActionAtom, createMessage('message-2', 'room-2'));

    expect(store.get(messagesForRoomAtom('room-1')).map(({ id }) => id)).toEqual([
      'message-1',
    ]);
    expect(store.get(messagesForRoomAtom('room-2')).map(({ id }) => id)).toEqual([
      'message-2',
    ]);
  });

  it('sorts messages by sentAt ascending, then by id', () => {
    const store = createStore();

    store.set(upsertMessagesActionAtom, [
      createMessage('b', 'room-1', { sentAt: '2024-01-01T12:00:00.000Z' }),
      createMessage('a', 'room-1', { sentAt: '2024-01-01T12:00:00.000Z' }),
      createMessage('later', 'room-1', { sentAt: '2024-01-02T00:00:00.000Z' }),
      createMessage('invalid', 'room-1', { sentAt: 'not-a-date' }),
    ]);

    expect(store.get(messagesForRoomAtom('room-1')).map(({ id }) => id)).toEqual([
      'invalid',
      'a',
      'b',
      'later',
    ]);
  });

  it('batch upserts messages across rooms without losing existing messages', () => {
    const store = createStore();

    store.set(upsertMessageActionAtom, createMessage('existing', 'room-1'));

    store.set(upsertMessagesActionAtom, [
      createMessage('room-1-new', 'room-1'),
      createMessage('room-2-new', 'room-2'),
      createMessage('room-2-second', 'room-2'),
    ]);

    expect(store.get(messagesForRoomAtom('room-1')).map(({ id }) => id)).toEqual([
      'existing',
      'room-1-new',
    ]);
    expect(store.get(messagesForRoomAtom('room-2')).map(({ id }) => id)).toEqual([
      'room-2-new',
      'room-2-second',
    ]);
  });

  it('counts messages per room', () => {
    const store = createStore();

    store.set(upsertMessagesActionAtom, [
      createMessage('message-1', 'room-1'),
      createMessage('message-2', 'room-1'),
      createMessage('message-3', 'room-2'),
    ]);

    expect(store.get(messageCountForRoomAtom('room-1'))).toBe(2);
    expect(store.get(messageCountForRoomAtom('room-2'))).toBe(1);
    expect(store.get(messageCountForRoomAtom('room-3'))).toBe(0);
  });

  it('clears only the specified room', () => {
    const store = createStore();

    store.set(upsertMessagesActionAtom, [
      createMessage('message-1', 'room-1'),
      createMessage('message-2', 'room-2'),
    ]);

    store.set(clearRoomMessagesActionAtom, 'room-1');

    expect(store.get(messagesByRoomAtom)).toEqual({
      'room-2': {
        'message-2': createMessage('message-2', 'room-2'),
      },
    });
    expect(store.get(messagesForRoomAtom('room-1'))).toEqual([]);
    expect(store.get(messageCountForRoomAtom('room-1'))).toBe(0);
    expect(store.get(messagesForRoomAtom('room-2')).map(({ id }) => id)).toEqual([
      'message-2',
    ]);
    expect(store.get(messageCountForRoomAtom('room-2'))).toBe(1);
  });
});
