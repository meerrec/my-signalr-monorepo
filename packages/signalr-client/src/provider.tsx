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
      }
    };

    connection.onreconnecting(handleReconnecting);
    connection.onreconnected(handleReconnected);
    connection.onclose(handleClose);

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
          setStatus(statusFromState(connection.state));
          setError(null);
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
