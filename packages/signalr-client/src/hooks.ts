import { useCallback, useContext, useEffect, useRef } from 'react';
import type { ConnectionStatus } from '@chat/shared-types';
import { SignalRContext, type SignalRContextValue } from './provider';
import type {
  HubEventMap,
  HubEventName,
  HubMethodMap,
  HubMethodName,
} from './generated/hub-contracts';

/** Возвращает значение контекста SignalR. Обязан вызываться внутри SignalRProvider. */
export function useSignalRContext(): SignalRContextValue {
  const context = useContext(SignalRContext);

  if (context === null) {
    throw new Error('useSignalRContext: хук должен использоваться внутри SignalRProvider');
  }

  return context;
}

/** Возвращает текущий статус соединения и текст последней ошибки. */
export function useSignalRStatus(): { status: ConnectionStatus; error: string | null } {
  const { status, error } = useSignalRContext();

  return { status, error };
}

/** Подписывается на событие хаба и автоматически отписывается при размонтировании. */
export function useHubEvent<K extends HubEventName>(
  event: K,
  handler: (payload: HubEventMap[K]) => void,
): void {
  const { client } = useSignalRContext();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (payload: HubEventMap[K]): void => {
      handlerRef.current(payload);
    };

    return client.on(event, listener);
  }, [client, event]);
}

/** Возвращает типизированный вызов метода хаба. */
export function useHubInvoke<K extends HubMethodName>(
  method: K,
): (request: HubMethodMap[K]['request']) => Promise<HubMethodMap[K]['response']> {
  const { client } = useSignalRContext();

  return useCallback(
    (request: HubMethodMap[K]['request']): Promise<HubMethodMap[K]['response']> =>
      client.invoke(method, request),
    [client, method],
  );
}
