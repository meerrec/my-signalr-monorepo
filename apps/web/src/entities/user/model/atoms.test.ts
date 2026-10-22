import { createStore } from 'jotai/vanilla';
import { describe, expect, it } from 'vitest';
import type { ChatUser } from '@chat/signalr-client';
import {
  currentUserAtom,
  removeUserActionAtom,
  setCurrentUserActionAtom,
  upsertUserActionAtom,
  usersAtom,
  usersByIdAtom,
  usersCountAtom,
} from './atoms';

const createUser = (id: string, name: string): ChatUser => ({ id, name });

describe('entities/user model', () => {
  it('provides initial values', () => {
    const store = createStore();

    expect(store.get(currentUserAtom)).toBeNull();
    expect(store.get(usersByIdAtom)).toEqual({});
    expect(store.get(usersAtom)).toEqual([]);
    expect(store.get(usersCountAtom)).toBe(0);
  });

  it('adds and updates users by id', () => {
    const store = createStore();
    const alice = createUser('1', 'Alice');
    const bob = createUser('2', 'Bob');
    const updatedAlice = createUser('1', 'Alice Updated');

    store.set(upsertUserActionAtom, alice);
    store.set(upsertUserActionAtom, bob);

    expect(store.get(usersByIdAtom)).toEqual({ '1': alice, '2': bob });
    expect(store.get(usersAtom)).toEqual([alice, bob]);

    store.set(upsertUserActionAtom, updatedAlice);

    expect(store.get(usersByIdAtom)['1']).toBe(updatedAlice);
    expect(store.get(usersAtom)).toHaveLength(2);
    expect(store.get(usersAtom)).toContainEqual(updatedAlice);
  });

  it('keeps the previous users record immutable on upsert', () => {
    const store = createStore();
    const alice = createUser('1', 'Alice');
    const bob = createUser('2', 'Bob');

    store.set(upsertUserActionAtom, alice);
    const before = store.get(usersByIdAtom);
    store.set(upsertUserActionAtom, bob);

    expect(store.get(usersByIdAtom)).not.toBe(before);
    expect(before).toEqual({ '1': alice });
  });

  it('sorts users by name and then by id', () => {
    const store = createStore();
    const charlie = createUser('1', 'Charlie');
    const aliceWithGreaterId = createUser('3', 'Alice');
    const aliceWithSmallerId = createUser('2', 'Alice');
    const bob = createUser('4', 'Bob');

    for (const user of [charlie, bob, aliceWithGreaterId, aliceWithSmallerId]) {
      store.set(upsertUserActionAtom, user);
    }

    expect(store.get(usersAtom).map((user) => user.id)).toEqual([
      '2',
      '3',
      '4',
      '1',
    ]);
  });

  it('derives the users count', () => {
    const store = createStore();

    store.set(upsertUserActionAtom, createUser('1', 'Alice'));
    store.set(upsertUserActionAtom, createUser('2', 'Bob'));

    expect(store.get(usersCountAtom)).toBe(2);
  });

  it('removes a user and clears the current user when ids match', () => {
    const store = createStore();
    const alice = createUser('1', 'Alice');
    const bob = createUser('2', 'Bob');

    store.set(upsertUserActionAtom, alice);
    store.set(upsertUserActionAtom, bob);
    store.set(setCurrentUserActionAtom, alice);

    store.set(removeUserActionAtom, alice.id);

    expect(store.get(usersByIdAtom)).toEqual({ '2': bob });
    expect(store.get(usersAtom)).toEqual([bob]);
    expect(store.get(usersCountAtom)).toBe(1);
    expect(store.get(currentUserAtom)).toBeNull();
  });

  it('keeps the current user when another user is removed', () => {
    const store = createStore();
    const alice = createUser('1', 'Alice');
    const bob = createUser('2', 'Bob');

    store.set(upsertUserActionAtom, alice);
    store.set(upsertUserActionAtom, bob);
    store.set(setCurrentUserActionAtom, bob);

    store.set(removeUserActionAtom, alice.id);

    expect(store.get(currentUserAtom)).toBe(bob);
  });

  it('does not fail when removing an unknown id', () => {
    const store = createStore();
    const alice = createUser('1', 'Alice');

    store.set(upsertUserActionAtom, alice);
    store.set(setCurrentUserActionAtom, alice);

    expect(() => store.set(removeUserActionAtom, 'missing')).not.toThrow();
    expect(store.get(usersByIdAtom)).toEqual({ '1': alice });
    expect(store.get(currentUserAtom)).toBe(alice);
  });
});
