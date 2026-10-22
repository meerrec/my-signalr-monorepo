import { useSetAtom } from 'jotai';

import { useChatEvent } from '@/shared/api';

import { removeUserActionAtom, upsertUserActionAtom } from '../model';

/** Подписки на события участников ChatHub. */
export function useUserSync(): void {
  const upsertUser = useSetAtom(upsertUserActionAtom);
  const removeUser = useSetAtom(removeUserActionAtom);

  useChatEvent('UserJoined', (event) => {
    upsertUser(event.user);
  });

  useChatEvent('UserLeft', (event) => {
    removeUser(event.userId);
  });
}
