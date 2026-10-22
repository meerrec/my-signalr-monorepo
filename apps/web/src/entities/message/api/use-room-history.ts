import { useSetAtom } from 'jotai';
import { useEffect } from 'react';

import { useChatConnectionStatus, useChatInvoke } from '@/shared/api';

import { upsertMessagesActionAtom } from '../model';

/**
 * Загружает историю комнаты при подключении к хабу.
 * Ошибки наружу не пробрасываются: история также приходит событием MessageHistory.
 */
export function useRoomHistory(roomId: string | null): void {
  const invoke = useChatInvoke('GetHistory');
  const { isConnected } = useChatConnectionStatus();
  const upsertMessages = useSetAtom(upsertMessagesActionAtom);

  useEffect(() => {
    if (roomId === null || !isConnected) return;

    let cancelled = false;

    void invoke({ roomId })
      .then((history) => {
        if (!cancelled) {
          upsertMessages(history.messages);
        }
      })
      .catch(() => {
        // История догрузится событием MessageHistory.
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, isConnected, invoke, upsertMessages]);
}
