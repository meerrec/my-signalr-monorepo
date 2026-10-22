import { atom } from 'jotai';
import type { PrimitiveAtom, WritableAtom } from 'jotai';
import type { ChatUser, SetNameRequest } from '@chat/signalr-client';
import type { AsyncStatus } from '@chat/shared-types';
import { setCurrentUserActionAtom, upsertUserActionAtom } from '@/entities/user';
import { getErrorMessage } from '@/shared/lib';

type ActionAtom<Value> = WritableAtom<null, [Value], void>;

export type SetNameInvoker = (request: SetNameRequest) => Promise<ChatUser>;

export const nameDraftAtom: PrimitiveAtom<string> = atom('');

export const setNameStatusAtom: PrimitiveAtom<AsyncStatus> =
  atom<AsyncStatus>('idle');

export const setNameErrorAtom: PrimitiveAtom<string | null> = atom<
  string | null
>(null);

export const changeNameDraftActionAtom: ActionAtom<string> = atom(
  null,
  (_get, set, name) => {
    set(nameDraftAtom, name);
  },
);

export const setNameActionAtom: ActionAtom<{ invoke: SetNameInvoker }> = atom(
  null,
  async (get, set, { invoke }) => {
    const name = get(nameDraftAtom).trim();

    if (name.length === 0) {
      set(setNameStatusAtom, 'error');
      set(setNameErrorAtom, 'Введите имя');

      return;
    }

    set(setNameStatusAtom, 'pending');
    set(setNameErrorAtom, null);

    try {
      const user = await invoke({ name });

      set(setCurrentUserActionAtom, user);
      set(upsertUserActionAtom, user);
      set(setNameStatusAtom, 'success');
      set(setNameErrorAtom, null);
      set(nameDraftAtom, '');
    } catch (error) {
      set(setNameStatusAtom, 'error');
      set(
        setNameErrorAtom,
        getErrorMessage(error, 'Не удалось изменить имя'),
      );
    }
  },
);
