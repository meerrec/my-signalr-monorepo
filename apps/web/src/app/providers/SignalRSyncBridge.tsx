import { useMessageSync } from '@/entities/message';
import { useRoomSync } from '@/entities/room';
import { useUserSync } from '@/entities/user';

/** Подписывает Jotai-состояние entities на события ChatHub. */
export function SignalRSyncBridge(): null {
  useMessageSync();
  useUserSync();
  useRoomSync();

  return null;
}
