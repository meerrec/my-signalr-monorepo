export {
  currentUserAtom,
  removeUserActionAtom,
  setCurrentUserActionAtom,
  upsertUserActionAtom,
  usersAtom,
  usersByIdAtom,
  usersCountAtom,
} from './atoms';

import type { ChatUser } from '@chat/signalr-client';

export type { ChatUser };
