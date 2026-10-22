import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  HubConnectionState,
  type HubConnection,
} from '@microsoft/signalr';
import type { ConnectionStatus } from '@chat/shared-types';
import { createChatHubConnection } from './client';
import { toErrorMessage } from './lib/errors';

export interface SignalRContextValue {
  connection: HubConnection | null;
  status: ConnectionStatus;
  error: string | null;
}

export interface SignalRProviderProps {
  /** URL хаба. Используется, если не передан готовый `connection`. */
  url?: string;
  /**
   * Готовое соединение. Провайдер запускает его при необходимости, наблюдает
   * за статусом, но не останавливает при размонтировании: жизненным циклом
   * владеет тот, кто создал соединение.
   */
  connection?: HubConnection;
  children: ReactNode;
}

export const SignalRContext = createContext<SignalRContextValue | null>(null);

interface ConnectionEntry {
  connection: HubConnection;
  owned: boolean;
}

function createConnectionEntry(
  connection: HubConnection | undefined,
  url: string | undefined,
): ConnectionEntry {
  if (connection !== undefined) {
    return { connection, owned: false };
  }

  if (url === undefined || url.trim().length === 0) {
    throw new Error('SignalRProvider: укажите url или connection');
  }

  return { connection: createChatHubConnection(url.trim()), owned: true };
}

function statusFromState(state: HubConnectionState): ConnectionStatus {
  switch (state) {
    case HubConnectionState.Connected:
      return 'connected';
    case HubConnectionState.Connecting:
      return 'connecting';
    case HubConnectionState.Reconnecting:
      return 'reconnecting';
    case HubConnectionState.Disconnecting:
    case HubConnectionState.Disconnected:
      return 'disconnected';
    default:
      return 'idle';
  }
}

interface ConnectionListeners {
  reconnecting: Set<(error?: Error) => void>;
  reconnected: Set<(connectionId?: string) => void>;
  close: Set<(error?: Error) => void>;
}

const connectionListeners = new WeakMap<HubConnection, ConnectionListeners>();

/**
 * SignalR не умеет снимать lifecycle-обработчики: `off` работает только с методами,
 * зарегистрированными через `on`. Поэтому на каждое соединение один раз ставится
 * стабильный диспетчер, а подписки провайдера хранятся в наборах и снимаются точечно.
 * Это защищает от накопления обработчиков при двойном вызове эффекта в StrictMode.
 */
function getConnectionListeners(connection: HubConnection): ConnectionListeners {
  const existing = connectionListeners.get(connection);

  if (existing !== undefined) {
    return existing;
  }

  const listeners: ConnectionListeners = {
    reconnecting: new Set(),
    reconnected: new Set(),
    close: new Set(),
  };

  connectionListeners.set(connection, listeners);

  connection.onreconnecting((reconnectError) => {
    for (const handler of listeners.reconnecting) {
      handler(reconnectError);
    }
  });
  connection.onreconnected((connectionId) => {
    for (const handler of listeners.reconnected) {
      handler(connectionId);
    }
  });
  connection.onclose((closeError) => {
    for (const handler of listeners.close) {
      handler(closeError);
    }
  });

  return listeners;
}

export function SignalRProvider({
  url,
  connection: externalConnection,
  children,
}: SignalRProviderProps) {
  const [entry] = useState<ConnectionEntry>(() =>
    createConnectionEntry(externalConnection, url),
  );
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const { connection, owned } = entry;

  useEffect(() => {
    let cancelled = false;
    let stopStateWatcher: (() => void) | undefined;

    const listeners = getConnectionListeners(connection);

    const handleReconnecting = (reconnectError?: Error): void => {
      if (cancelled) {
        return;
      }

      setStatus('reconnecting');
      setError(toErrorMessage(reconnectError, 'Соединение с SignalR потеряно'));
    };

    const handleReconnected = (): void => {
      if (cancelled) {
        return;
      }

      setStatus('connected');
      setError(null);
    };

    const handleClose = (closeError?: Error): void => {
      if (cancelled) {
        return;
      }

      setStatus('disconnected');

      if (closeError !== undefined) {
        setError(toErrorMessage(closeError, 'Соединение с SignalR закрыто'));
        return;
      }

      setError(null);
    };

    // События onconnected у SignalR нет, поэтому внешнее соединение, которое
    // уже находится в Connecting, переводим в конечный статус опросом состояния.
    const watchConnectionState = (): (() => void) => {
      const intervalId = setInterval(() => {
        if (cancelled) {
          clearInterval(intervalId);
          return;
        }

        if (connection.state === HubConnectionState.Connecting) {
          return;
        }

        clearInterval(intervalId);

        const nextStatus = statusFromState(connection.state);
        setStatus(nextStatus);

        // Текст ошибки обрыва выставляет onclose, здесь его не затираем.
        if (nextStatus === 'connected') {
          setError(null);
        }
      }, 200);

      return () => clearInterval(intervalId);
    };

    listeners.reconnecting.add(handleReconnecting);
    listeners.reconnected.add(handleReconnected);
    listeners.close.add(handleClose);

    const start = async (): Promise<void> => {
      try {
        if (owned) {
          // Защита от StrictMode: эффект запускается дважды, а соединение
          // из первого прохода могло остаться в Connecting/Connected.
          if (connection.state !== HubConnectionState.Disconnected) {
            await connection.stop().catch(() => {});
          }

          if (cancelled) {
            return;
          }

          setStatus('connecting');
          setError(null);

          await connection.start();

          if (cancelled) {
            return;
          }

          setStatus('connected');
          return;
        }

        // Внешнее соединение не перезапускаем: если владелец уже его запустил,
        // только отражаем фактическое состояние. Не запущенное — запускаем,
        // но обратно не останавливаем.
        if (connection.state === HubConnectionState.Disconnected) {
          setStatus('connecting');
          setError(null);

          await connection.start();

          if (cancelled) {
            return;
          }

          setStatus('connected');
          return;
        }

        if (!cancelled) {
          const nextStatus = statusFromState(connection.state);
          setStatus(nextStatus);
          setError(null);

          // Владелец уже запускает соединение: дождёмся смены состояния опросом,
          // потому что отдельного события об успешном подключении нет.
          if (nextStatus === 'connecting') {
            stopStateWatcher = watchConnectionState();
          }
        }
      } catch (startError) {
        if (cancelled) {
          return;
        }

        setStatus('error');
        setError(toErrorMessage(startError));
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopStateWatcher?.();

      listeners.reconnecting.delete(handleReconnecting);
      listeners.reconnected.delete(handleReconnected);
      listeners.close.delete(handleClose);

      if (owned) {
        void connection.stop().catch(() => {});
      }
    };
  }, [connection, owned]);

  const value = useMemo<SignalRContextValue>(
    () => ({ connection, status, error }),
    [connection, status, error],
  );

  return <SignalRContext.Provider value={value}>{children}</SignalRContext.Provider>;
}
