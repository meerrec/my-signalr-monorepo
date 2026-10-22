import { atom } from 'jotai/vanilla';
import type { PrimitiveAtom, WritableAtom } from 'jotai/vanilla';

import type { ChatMessage, SendMessageRequest } from '@chat/signalr-client';
import type { AsyncStatus } from '@chat/shared-types';

import { upsertMessageActionAtom } from '@/entities/message';
import { currentRoomAtom } from '@/entities/room';
import { getErrorMessage } from '@/shared/lib';

export type SendMessageInvoker = (
  request: SendMessageRequest,
) => Promise<ChatMessage>;

type ActionAtom<Payload> = WritableAtom<null, [Payload], void>;

export const messageDraftAtom: PrimitiveAtom<string> = atom('');

export const sendMessageStatusAtom: PrimitiveAtom<AsyncStatus> =
  atom<AsyncStatus>('idle');

export const sendMessageErrorAtom: PrimitiveAtom<string | null> =
  atom<string | null>(null);

export const changeMessageDraftActionAtom: ActionAtom<string> = atom(
  null,
  (_get, set, text: string) => {
    set(messageDraftAtom, text);
  },
);

export const sendMessageActionAtom: ActionAtom<{
  invoke: SendMessageInvoker;
}> = atom(null, async (get, set, { invoke }) => {
  const text = get(messageDraftAtom).trim();
  const room = get(currentRoomAtom);

  if (text.length === 0) {
    set(sendMessageStatusAtom, 'error');
    set(sendMessageErrorAtom, 'Введите сообщение');

    return;
  }

  if (room === null) {
    set(sendMessageStatusAtom, 'error');
    set(sendMessageErrorAtom, 'Сначала выберите комнату');

    return;
  }

  set(sendMessageStatusAtom, 'pending');
  set(sendMessageErrorAtom, null);

  try {
    const message = await invoke({ roomId: room.id, text });

    set(upsertMessageActionAtom, message);
    set(changeMessageDraftActionAtom, '');
    set(sendMessageStatusAtom, 'success');
    set(sendMessageErrorAtom, null);
  } catch (error) {
    set(sendMessageStatusAtom, 'error');
    set(
      sendMessageErrorAtom,
      getErrorMessage(error, 'Не удалось отправить сообщение'),
    );
  }
});
