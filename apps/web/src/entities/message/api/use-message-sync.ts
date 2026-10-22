import { useSetAtom } from 'jotai';

import { useChatEvent } from '@/shared/api';

import {
  upsertMessageActionAtom,
  upsertMessagesActionAtom,
} from '../model';

/** Подписки на события сообщений ChatHub. */
export function useMessageSync(): void {
  const upsertMessage = useSetAtom(upsertMessageActionAtom);
  const upsertMessages = useSetAtom(upsertMessagesActionAtom);

  useChatEvent('ReceiveMessage', (message) => {
    upsertMessage(message);
  });

  useChatEvent('MessageHistory', (history) => {
    upsertMessages(history.messages);
  });
}
