import { atom } from 'jotai';
import type { PrimitiveAtom, WritableAtom } from 'jotai';
import type { JoinRoomRequest, JoinRoomResult } from '@chat/signalr-client';
import type { AsyncStatus } from '@chat/shared-types';
import {
  selectCurrentRoomActionAtom,
  upsertRoomActionAtom,
} from '@/entities/room';
import {
  setCurrentUserActionAtom,
  upsertUserActionAtom,
} from '@/entities/user';
import { getErrorMessage } from '@/shared/lib';

type ActionAtom<Value> = WritableAtom<null, [Value], void>;

export type JoinRoomInvoker = (
  request: JoinRoomRequest,
) => Promise<JoinRoomResult>;

export const joinRoomIdDraftAtom: PrimitiveAtom<string> = atom('');
export const joinRoomUserNameDraftAtom: PrimitiveAtom<string> = atom('');
export const joinRoomStatusAtom: PrimitiveAtom<AsyncStatus> =
  atom<AsyncStatus>('idle');
export const joinRoomErrorAtom: PrimitiveAtom<string | null> = atom<
  string | null
>(null);

export const changeJoinRoomIdActionAtom: ActionAtom<string> = atom(
  null,
  (_get, set, roomId) => {
    set(joinRoomIdDraftAtom, roomId);
  },
);

export const changeJoinRoomUserNameActionAtom: ActionAtom<string> = atom(
  null,
  (_get, set, userName) => {
    set(joinRoomUserNameDraftAtom, userName);
  },
);

let latestJoinRoomRequestId = 0;

export const joinRoomActionAtom: ActionAtom<{
  invoke: JoinRoomInvoker;
}> = atom(null, async (get, set, { invoke }): Promise<void> => {
  const requestId = ++latestJoinRoomRequestId;
  const roomId = get(joinRoomIdDraftAtom).trim();
  const userName = get(joinRoomUserNameDraftAtom).trim();

  if (roomId.length === 0) {
    set(joinRoomStatusAtom, 'error');
    set(joinRoomErrorAtom, 'Введите идентификатор комнаты');

    return;
  }

  if (userName.length === 0) {
    set(joinRoomStatusAtom, 'error');
    set(joinRoomErrorAtom, 'Введите имя');

    return;
  }

  set(joinRoomStatusAtom, 'pending');
  set(joinRoomErrorAtom, null);

  try {
    const result = await invoke({ roomId, userName });

    if (requestId !== latestJoinRoomRequestId) {
      return;
    }

    set(upsertRoomActionAtom, result.room);
    set(selectCurrentRoomActionAtom, result.room.id);
    set(setCurrentUserActionAtom, result.user);
    set(upsertUserActionAtom, result.user);
    set(joinRoomStatusAtom, 'success');
    set(joinRoomErrorAtom, null);
  } catch (error) {
    if (requestId !== latestJoinRoomRequestId) {
      return;
    }

    set(joinRoomStatusAtom, 'error');
    set(
      joinRoomErrorAtom,
      getErrorMessage(error, 'Не удалось войти в комнату'),
    );
  }
});
