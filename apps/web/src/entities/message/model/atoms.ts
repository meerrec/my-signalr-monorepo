import { atom } from 'jotai/vanilla';
import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai/vanilla';

import type { ChatMessage } from '@chat/signalr-client';

export type AtomFamily<Param, Value> = (param: Param) => Atom<Value>;

export type ActionAtom<Payload> = WritableAtom<null, [Payload], void>;

const createAtomFamily = <Param, Value>(
  initialize: (param: Param) => Atom<Value>,
): AtomFamily<Param, Value> => {
  const cache = new Map<Param, Atom<Value>>();

  return (param) => {
    const cached = cache.get(param);

    if (cached !== undefined) {
      return cached;
    }

    const created = initialize(param);
    cache.set(param, created);

    return created;
  };
};

const getMessageTimestamp = (message: ChatMessage): number => {
  const timestamp = Date.parse(message.sentAt);

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const compareMessages = (left: ChatMessage, right: ChatMessage): number => {
  const timestampDiff = getMessageTimestamp(left) - getMessageTimestamp(right);

  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  return left.id.localeCompare(right.id);
};

export const messagesByRoomAtom: PrimitiveAtom<
  Record<string, Record<string, ChatMessage>>
> = atom({});

export const messagesForRoomAtom: AtomFamily<string, ChatMessage[]> =
  createAtomFamily((roomId: string) =>
    atom((get) => {
      const roomMessages = get(messagesByRoomAtom)[roomId];

      if (roomMessages === undefined) {
        return [];
      }

      return Object.values(roomMessages).sort(compareMessages);
    }),
  );

export const messageCountForRoomAtom: AtomFamily<string, number> =
  createAtomFamily((roomId: string) =>
    atom((get) => {
      const roomMessages = get(messagesByRoomAtom)[roomId];

      return roomMessages === undefined ? 0 : Object.keys(roomMessages).length;
    }),
  );

export const upsertMessageActionAtom: ActionAtom<ChatMessage> = atom(
  null,
  (get, set, message: ChatMessage) => {
    const messagesByRoom = get(messagesByRoomAtom);
    const roomMessages = messagesByRoom[message.roomId] ?? {};

    set(messagesByRoomAtom, {
      ...messagesByRoom,
      [message.roomId]: {
        ...roomMessages,
        [message.id]: message,
      },
    });
  },
);

export const upsertMessagesActionAtom: ActionAtom<ChatMessage[]> = atom(
  null,
  (get, set, messages: ChatMessage[]) => {
    if (messages.length === 0) {
      return;
    }

    const messagesByRoom = get(messagesByRoomAtom);
    const nextMessagesByRoom: Record<string, Record<string, ChatMessage>> = {
      ...messagesByRoom,
    };

    for (const message of messages) {
      const roomMessages = nextMessagesByRoom[message.roomId] ?? {};

      nextMessagesByRoom[message.roomId] = {
        ...roomMessages,
        [message.id]: message,
      };
    }

    set(messagesByRoomAtom, nextMessagesByRoom);
  },
);

export const clearRoomMessagesActionAtom: ActionAtom<string> = atom(
  null,
  (get, set, roomId: string) => {
    const messagesByRoom = get(messagesByRoomAtom);

    if (!(roomId in messagesByRoom)) {
      return;
    }

    const nextMessagesByRoom = { ...messagesByRoom };
    delete nextMessagesByRoom[roomId];

    set(messagesByRoomAtom, nextMessagesByRoom);
  },
);
