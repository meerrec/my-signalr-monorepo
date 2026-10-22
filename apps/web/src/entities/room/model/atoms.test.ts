import { createStore } from 'jotai/vanilla';
import { describe, expect, it } from 'vitest';
import type { ChatRoom } from '@chat/signalr-client';
import {
  currentRoomAtom,
  currentRoomIdAtom,
  roomsAtom,
  roomsByIdAtom,
  selectCurrentRoomActionAtom,
  upsertRoomActionAtom,
} from './atoms';

const makeRoom = (
  id: string,
  name: string,
  memberCount = 0,
): ChatRoom => ({
  id,
  name,
  memberCount,
});

describe('entities/room model atoms', () => {
  it('starts with an empty room registry and no selected room', () => {
    const store = createStore();

    expect(store.get(roomsByIdAtom)).toEqual({});
    expect(store.get(currentRoomIdAtom)).toBeNull();
    expect(store.get(currentRoomAtom)).toBeNull();
    expect(store.get(roomsAtom)).toEqual([]);
  });

  it('adds a room and replaces it on repeated upsert', () => {
    const store = createStore();
    const originalRoom = makeRoom('room-1', 'General', 2);
    const updatedRoom = makeRoom('room-1', 'General', 5);

    store.set(upsertRoomActionAtom, originalRoom);

    expect(store.get(roomsByIdAtom)).toEqual({ 'room-1': originalRoom });

    store.set(upsertRoomActionAtom, updatedRoom);

    expect(store.get(roomsByIdAtom)).toEqual({ 'room-1': updatedRoom });
    expect(originalRoom.memberCount).toBe(2);
  });

  it('sorts rooms by name and then by id', () => {
    const store = createStore();

    store.set(upsertRoomActionAtom, makeRoom('z', 'Same'));
    store.set(upsertRoomActionAtom, makeRoom('a', 'Same'));
    store.set(upsertRoomActionAtom, makeRoom('b', 'Alpha'));

    expect(store.get(roomsAtom).map((room) => room.id)).toEqual([
      'b',
      'a',
      'z',
    ]);
  });

  it('returns the selected room', () => {
    const store = createStore();
    const room = makeRoom('room-1', 'General', 3);

    store.set(upsertRoomActionAtom, room);
    store.set(selectCurrentRoomActionAtom, room.id);

    expect(store.get(currentRoomIdAtom)).toBe(room.id);
    expect(store.get(currentRoomAtom)).toBe(room);
  });

  it('returns null when selecting a missing room', () => {
    const store = createStore();

    store.set(selectCurrentRoomActionAtom, 'missing-room');

    expect(store.get(currentRoomIdAtom)).toBe('missing-room');
    expect(store.get(currentRoomAtom)).toBeNull();
  });

  it('resets the selected room to null', () => {
    const store = createStore();
    const room = makeRoom('room-1', 'General');

    store.set(upsertRoomActionAtom, room);
    store.set(selectCurrentRoomActionAtom, room.id);
    store.set(selectCurrentRoomActionAtom, null);

    expect(store.get(currentRoomIdAtom)).toBeNull();
    expect(store.get(currentRoomAtom)).toBeNull();
  });
});
