import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { setConnectionStatusActionAtom } from '@/entities/session';
import { useChatConnectionStatus } from '@/shared/api';

/** Переносит статус SignalR-соединения в Jotai-состояние `entities/session`. */
export function SignalRStateBridge(): null {
  const { status, error } = useChatConnectionStatus();
  const setConnectionStatus = useSetAtom(setConnectionStatusActionAtom);

  useEffect(() => {
    setConnectionStatus({ status, error });
  }, [status, error, setConnectionStatus]);

  return null;
}
