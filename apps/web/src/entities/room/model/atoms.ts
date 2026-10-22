import { atom } from 'jotai';
import type { ChatRoom } from '@chat/signalr-client';

export const roomsByIdAtom = atom<Record<string, ChatRoom>>({});
export const currentRoomIdAtom = atom<string | null>(null);

export const currentRoomAtom = atom((get) => {
  const roomId = get(currentRoomIdAtom);

  return roomId === null ? null : (get(roomsByIdAtom)[roomId] ?? null);
});

export const roomsAtom = atom((get) =>
  Object.values(get(roomsByIdAtom)).sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  ),
);

export const upsertRoomActionAtom = atom(
  null,
  (_get, set, room: ChatRoom) => {
    set(roomsByIdAtom, (previous) => ({
      ...previous,
      [room.id]: room,
    }));
  },
);

export const selectCurrentRoomActionAtom = atom(
  null,
  (_get, set, roomId: string | null) => {
    set(currentRoomIdAtom, roomId);
  },
);
