import type { ReactNode } from 'react';
import { Provider } from 'jotai';
import { SignalRProvider } from '@/shared/api';
import { env } from '@/shared/config';
import { SignalRSyncBridge } from './SignalRSyncBridge';
import { SignalRStateBridge } from './SignalRStateBridge';

export interface AppProvidersProps {
  children: ReactNode;
}

/** Корневые провайдеры приложения: Jotai снаружи, SignalR внутри. */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <Provider>
      <SignalRProvider url={env.signalRUrl}>
        <SignalRStateBridge />
        <SignalRSyncBridge />
        {children}
      </SignalRProvider>
    </Provider>
  );
}
