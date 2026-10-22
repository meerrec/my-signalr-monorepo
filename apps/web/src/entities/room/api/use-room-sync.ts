import { useSetAtom } from 'jotai';

import { useChatEvent } from '@/shared/api';

import { upsertRoomActionAtom } from '../model';

/** Подписка на обновления комнат ChatHub. */
export function useRoomSync(): void {
  const upsertRoom = useSetAtom(upsertRoomActionAtom);

  useChatEvent('RoomUpdated', (room) => {
    upsertRoom(room);
  });
}
