import { createStore } from 'jotai/vanilla';
import { describe, expect, it, vi } from 'vitest';

import type {
  ChatRoom,
  ChatUser,
  JoinRoomRequest,
  JoinRoomResult,
} from '@chat/signalr-client';

import { currentRoomIdAtom, roomsByIdAtom } from '@/entities/room';
import { currentUserAtom, usersByIdAtom } from '@/entities/user';

import type { JoinRoomInvoker } from './atoms';
import {
  changeJoinRoomIdActionAtom,
  changeJoinRoomUserNameActionAtom,
  joinRoomActionAtom,
  joinRoomErrorAtom,
  joinRoomIdDraftAtom,
  joinRoomStatusAtom,
  joinRoomUserNameDraftAtom,
} from './atoms';

const createRoom = (id = 'room-1'): ChatRoom => ({
  id,
  name: 'General',
  memberCount: 1,
});

const createUser = (id = 'user-1', name = 'Alice'): ChatUser => ({
  id,
  name,
});

const createResult = (): JoinRoomResult => ({
  room: createRoom(),
  user: createUser(),
});

const fillDrafts = (
  store: ReturnType<typeof createStore>,
  roomId: string,
  userName: string,
): void => {
  store.set(changeJoinRoomIdActionAtom, roomId);
  store.set(changeJoinRoomUserNameActionAtom, userName);
};

const flushPromises = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('features/join-room model atoms', () => {
  it('starts with empty drafts, idle status and no error', () => {
    const store = createStore();

    expect(store.get(joinRoomIdDraftAtom)).toBe('');
    expect(store.get(joinRoomUserNameDraftAtom)).toBe('');
    expect(store.get(joinRoomStatusAtom)).toBe('idle');
    expect(store.get(joinRoomErrorAtom)).toBeNull();
  });

  it('changes both drafts through the change actions', () => {
    const store = createStore();

    store.set(changeJoinRoomIdActionAtom, 'room-42');
    store.set(changeJoinRoomUserNameActionAtom, 'Bob');

    expect(store.get(joinRoomIdDraftAtom)).toBe('room-42');
    expect(store.get(joinRoomUserNameDraftAtom)).toBe('Bob');

    store.set(changeJoinRoomIdActionAtom, '');
    store.set(changeJoinRoomUserNameActionAtom, '');

    expect(store.get(joinRoomIdDraftAtom)).toBe('');
    expect(store.get(joinRoomUserNameDraftAtom)).toBe('');
  });

  it('rejects a blank room id without calling invoke', async () => {
    const store = createStore();
    const invoke = vi.fn<JoinRoomInvoker>(async () => createResult());

    fillDrafts(store, '   ', 'Alice');

    await store.set(joinRoomActionAtom, { invoke });

    expect(invoke).not.toHaveBeenCalled();
    expect(store.get(joinRoomStatusAtom)).toBe('error');
    expect(store.get(joinRoomErrorAtom)).toBe('Введите идентификатор комнаты');
    expect(store.get(joinRoomIdDraftAtom)).toBe('   ');
  });

  it('rejects a blank user name without calling invoke', async () => {
    const store = createStore();
    const invoke = vi.fn<JoinRoomInvoker>(async () => createResult());

    fillDrafts(store, 'room-1', '   ');

    await store.set(joinRoomActionAtom, { invoke });

    expect(invoke).not.toHaveBeenCalled();
    expect(store.get(joinRoomStatusAtom)).toBe('error');
    expect(store.get(joinRoomErrorAtom)).toBe('Введите имя');
    expect(store.get(joinRoomUserNameDraftAtom)).toBe('   ');
  });

  it('joins the room with trimmed values and updates room and user state', async () => {
    const store = createStore();
    const room = createRoom('room-1');
    const user = createUser('user-1', 'Alice');
    const result: JoinRoomResult = { room, user };

    fillDrafts(store, '  room-1  ', '  Alice  ');

    const invoke = vi.fn<JoinRoomInvoker>(async (request: JoinRoomRequest) => {
      expect(request).toEqual({ roomId: 'room-1', userName: 'Alice' });
      expect(store.get(joinRoomStatusAtom)).toBe('pending');
      expect(store.get(joinRoomErrorAtom)).toBeNull();

      return result;
    });

    await store.set(joinRoomActionAtom, { invoke });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith({
      roomId: 'room-1',
      userName: 'Alice',
    });
    expect(store.get(joinRoomStatusAtom)).toBe('success');
    expect(store.get(joinRoomErrorAtom)).toBeNull();
    expect(store.get(currentRoomIdAtom)).toBe(room.id);
    expect(store.get(roomsByIdAtom)[room.id]).toEqual(room);
    expect(store.get(currentUserAtom)).toEqual(user);
    expect(store.get(usersByIdAtom)[user.id]).toEqual(user);
  });

  it('handles transport errors without touching room or user state', async () => {
    const store = createStore();

    fillDrafts(store, 'room-1', 'Alice');

    const invoke = vi.fn<JoinRoomInvoker>(async () => {
      throw new Error('нет сети');
    });

    await store.set(joinRoomActionAtom, { invoke });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(store.get(joinRoomStatusAtom)).toBe('error');
    expect(store.get(joinRoomErrorAtom)).toBe('нет сети');
    expect(store.get(currentRoomIdAtom)).toBeNull();
    expect(store.get(roomsByIdAtom)).toEqual({});
    expect(store.get(currentUserAtom)).toBeNull();
    expect(store.get(usersByIdAtom)).toEqual({});
  });

  it('ignores a stale response when a newer join request has been started', async () => {
    const store = createStore();
    const firstRoom = createRoom('room-first');
    const firstUser = createUser('user-first', 'Alice');
    const secondRoom = createRoom('room-second');
    const secondUser = createUser('user-second', 'Bob');

    let resolveFirst!: (value: JoinRoomResult) => void;
    let resolveSecond!: (value: JoinRoomResult) => void;

    const firstPromise = new Promise<JoinRoomResult>((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise<JoinRoomResult>((resolve) => {
      resolveSecond = resolve;
    });

    const firstInvoke = vi.fn<JoinRoomInvoker>(() => firstPromise);
    const secondInvoke = vi.fn<JoinRoomInvoker>(() => secondPromise);

    fillDrafts(store, 'room-first', 'Alice');
    store.set(joinRoomActionAtom, { invoke: firstInvoke });

    fillDrafts(store, 'room-second', 'Bob');
    store.set(joinRoomActionAtom, { invoke: secondInvoke });

    resolveSecond({ room: secondRoom, user: secondUser });
    await flushPromises();

    resolveFirst({ room: firstRoom, user: firstUser });
    await flushPromises();

    expect(store.get(joinRoomStatusAtom)).toBe('success');
    expect(store.get(joinRoomErrorAtom)).toBeNull();
    expect(store.get(currentRoomIdAtom)).toBe(secondRoom.id);
    expect(store.get(roomsByIdAtom)[secondRoom.id]).toEqual(secondRoom);
    expect(store.get(roomsByIdAtom)[firstRoom.id]).toBeUndefined();
    expect(store.get(currentUserAtom)).toEqual(secondUser);
    expect(store.get(usersByIdAtom)[secondUser.id]).toEqual(secondUser);
    expect(store.get(usersByIdAtom)[firstUser.id]).toBeUndefined();
  });
});
