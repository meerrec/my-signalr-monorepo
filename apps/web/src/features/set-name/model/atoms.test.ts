import { createStore } from 'jotai/vanilla';
import { describe, expect, it, vi } from 'vitest';
import type { ChatUser, SetNameRequest } from '@chat/signalr-client';
import { currentUserAtom, usersByIdAtom } from '@/entities/user';
import {
  changeNameDraftActionAtom,
  nameDraftAtom,
  setNameActionAtom,
  setNameErrorAtom,
  setNameStatusAtom,
} from './atoms';

const createUser = (id: string, name: string): ChatUser => ({ id, name });

describe('features/set-name model', () => {
  it('rejects an empty name without calling the invoker', async () => {
    const store = createStore();
    const invoke = vi.fn(
      async (_request: SetNameRequest): Promise<ChatUser> =>
        createUser('1', 'Alice'),
    );

    store.set(changeNameDraftActionAtom, '   ');
    await store.set(setNameActionAtom, { invoke });

    expect(invoke).not.toHaveBeenCalled();
    expect(store.get(setNameStatusAtom)).toBe('error');
    expect(store.get(setNameErrorAtom)).toBe('Введите имя');
  });

  it('sets the trimmed name and stores the updated user on success', async () => {
    const store = createStore();
    const updatedUser = createUser('1', 'Alice');
    const invoke = vi.fn(
      async (request: SetNameRequest): Promise<ChatUser> => {
        expect(request).toEqual({ name: 'Alice' });

        return updatedUser;
      },
    );

    store.set(changeNameDraftActionAtom, '  Alice  ');
    await store.set(setNameActionAtom, { invoke });

    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith({ name: 'Alice' });
    expect(store.get(currentUserAtom)).toBe(updatedUser);
    expect(store.get(usersByIdAtom)['1']).toBe(updatedUser);
    expect(store.get(nameDraftAtom)).toBe('');
    expect(store.get(setNameStatusAtom)).toBe('success');
    expect(store.get(setNameErrorAtom)).toBeNull();
  });

  it('keeps the current user and exposes the invoker error on failure', async () => {
    const store = createStore();
    const currentUser = createUser('1', 'Alice');
    const invoke = vi.fn(
      async (_request: SetNameRequest): Promise<ChatUser> => {
        throw new Error('Соединение потеряно');
      },
    );

    store.set(currentUserAtom, currentUser);
    store.set(changeNameDraftActionAtom, 'Bob');
    await expect(store.set(setNameActionAtom, { invoke })).resolves.toBe(
      undefined,
    );

    expect(store.get(setNameStatusAtom)).toBe('error');
    expect(store.get(setNameErrorAtom)).toBe('Соединение потеряно');
    expect(store.get(currentUserAtom)).toBe(currentUser);
  });

  it('clears a previous error after a successful retry', async () => {
    const store = createStore();
    const updatedUser = createUser('1', 'Alice');
    const invoke = vi
      .fn<(request: SetNameRequest) => Promise<ChatUser>>()
      .mockRejectedValueOnce(new Error('Соединение потеряно'))
      .mockResolvedValueOnce(updatedUser);

    store.set(changeNameDraftActionAtom, 'Alice');
    await store.set(setNameActionAtom, { invoke });

    expect(store.get(setNameStatusAtom)).toBe('error');
    expect(store.get(setNameErrorAtom)).toBe('Соединение потеряно');

    store.set(changeNameDraftActionAtom, 'Alice');
    await store.set(setNameActionAtom, { invoke });

    expect(store.get(setNameStatusAtom)).toBe('success');
    expect(store.get(setNameErrorAtom)).toBeNull();
    expect(store.get(currentUserAtom)).toBe(updatedUser);
  });
});
