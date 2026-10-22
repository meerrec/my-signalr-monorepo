import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ConnectionStatus } from '@chat/shared-types';
import { WorkerHubClient } from './worker/worker-client';
import type { SignalRClient, SignalRStatusSnapshot } from './transport/types';

export interface SignalRContextValue {
  client: SignalRClient;
  status: ConnectionStatus;
  error: string | null;
}

export interface SignalRProviderProps {
  /** URL хаба SignalR. Соединение живёт в dedicated Web Worker. */
  url: string;
  children: ReactNode;
}

export const SignalRContext = createContext<SignalRContextValue | null>(null);

const INITIAL_SNAPSHOT: SignalRStatusSnapshot = { status: 'idle', error: null };

/**
 * Владеет Worker-клиентом и отражает его статус в React-состоянии.
 * Жизненный цикл соединения: запуск в эффекте, остановка в cleanup.
 */
export function SignalRProvider({ url, children }: SignalRProviderProps) {
  const [client] = useState<SignalRClient>(() => new WorkerHubClient({ url }));
  const [snapshot, setSnapshot] = useState<SignalRStatusSnapshot>(INITIAL_SNAPSHOT);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = client.subscribeStatus((next) => {
      if (!cancelled) {
        setSnapshot(next);
      }
    });

    void client.start();

    return () => {
      cancelled = true;
      unsubscribe();
      void client.stop();
    };
  }, [client]);

  const value = useMemo<SignalRContextValue>(
    () => ({ client, status: snapshot.status, error: snapshot.error }),
    [client, snapshot],
  );

  return <SignalRContext.Provider value={value}>{children}</SignalRContext.Provider>;
}
