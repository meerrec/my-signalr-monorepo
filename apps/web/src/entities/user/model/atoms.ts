import { atom } from 'jotai';
import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai';
import type { ChatUser } from '@chat/signalr-client';

type ActionAtom<Value> = WritableAtom<null, [Value], void>;

export const currentUserAtom: PrimitiveAtom<ChatUser | null> =
  atom<ChatUser | null>(null);

export const usersByIdAtom: PrimitiveAtom<Record<string, ChatUser>> = atom<
  Record<string, ChatUser>
>({});

export const usersAtom: Atom<ChatUser[]> = atom((get) => {
  const users = Object.values(get(usersByIdAtom));

  return users.sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
});

export const usersCountAtom: Atom<number> = atom(
  (get) => get(usersAtom).length,
);

export const setCurrentUserActionAtom: ActionAtom<ChatUser | null> = atom(
  null,
  (_get, set, user) => {
    set(currentUserAtom, user);
  },
);

export const upsertUserActionAtom: ActionAtom<ChatUser> = atom(
  null,
  (_get, set, user) => {
    set(usersByIdAtom, (previous) => ({
      ...previous,
      [user.id]: user,
    }));
  },
);

export const removeUserActionAtom: ActionAtom<string> = atom(
  null,
  (get, set, id) => {
    set(usersByIdAtom, (previous) => {
      if (!Object.hasOwn(previous, id)) {
        return previous;
      }

      return Object.fromEntries(
        Object.entries(previous).filter(([userId]) => userId !== id),
      );
    });

    if (get(currentUserAtom)?.id === id) {
      set(currentUserAtom, null);
    }
  },
);
