import type { ConnectionStatus } from '@chat/shared-types';
import { useSignalRStatus } from '@chat/signalr-client';

export interface ChatConnectionStatus {
  status: ConnectionStatus;
  error: string | null;
  isConnected: boolean;
}

/** Возвращает статус соединения ChatHub в удобном для UI виде. */
export function useChatConnectionStatus(): ChatConnectionStatus {
  const { status, error } = useSignalRStatus();

  return {
    status,
    error,
    isConnected: status === 'connected',
  };
}
