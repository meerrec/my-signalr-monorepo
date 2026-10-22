import { atom } from 'jotai/vanilla';
import type { PrimitiveAtom, WritableAtom } from 'jotai/vanilla';
import type { ConnectionStatus } from '@chat/shared-types';

export interface ConnectionStatusPayload {
  status: ConnectionStatus;
  error: string | null;
}

export const connectionStatusAtom: PrimitiveAtom<ConnectionStatus> =
  atom<ConnectionStatus>('idle');

export const connectionErrorAtom: PrimitiveAtom<string | null> =
  atom<string | null>(null);

export const isConnectedAtom = atom<boolean>(
  (get) => get(connectionStatusAtom) === 'connected',
);

export const setConnectionStatusActionAtom: WritableAtom<
  null,
  [ConnectionStatusPayload],
  void
> = atom(null, (_get, set, payload: ConnectionStatusPayload) => {
  set(connectionStatusAtom, payload.status);
  set(connectionErrorAtom, payload.error);
});
