import { useCallback, useContext, useEffect, useRef } from 'react';
import type { HubConnection } from '@microsoft/signalr';
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

/** Возвращает текущий статус соединения, ошибку и объект соединения. */
export function useSignalRStatus(): {
  status: ConnectionStatus;
  error: string | null;
  connection: HubConnection | null;
} {
  const { status, error, connection } = useSignalRContext();

  return { status, error, connection };
}

/** Подписывается на событие хаба и автоматически отписывается при размонтировании. */
export function useHubEvent<K extends HubEventName>(
  event: K,
  handler: (payload: HubEventMap[K]) => void,
): void {
  const { connection } = useSignalRContext();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (connection === null) {
      return;
    }

    const listener = (payload: HubEventMap[K]): void => {
      handlerRef.current(payload);
    };

    connection.on(event, listener);

    return () => {
      connection.off(event, listener);
    };
  }, [connection, event]);
}

/** Возвращает типизированный вызов метода хаба. */
export function useHubInvoke<K extends HubMethodName>(
  method: K,
): (request: HubMethodMap[K]['request']) => Promise<HubMethodMap[K]['response']> {
  const { connection } = useSignalRContext();

  return useCallback(
    (request: HubMethodMap[K]['request']): Promise<HubMethodMap[K]['response']> => {
      if (connection === null) {
        return Promise.reject(new Error('Нет соединения с SignalR'));
      }

      return connection.invoke<HubMethodMap[K]['response']>(method, request);
    },
    [connection, method],
  );
}
