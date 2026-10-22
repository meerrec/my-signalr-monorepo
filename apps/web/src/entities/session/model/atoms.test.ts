import { describe, expect, it } from 'vitest';
import { createStore } from 'jotai/vanilla';
import type { ConnectionStatus } from '@chat/shared-types';

import {
  connectionErrorAtom,
  connectionStatusAtom,
  isConnectedAtom,
  setConnectionStatusActionAtom,
} from './index';

const allStatuses: ConnectionStatus[] = [
  'idle',
  'connecting',
  'connected',
  'reconnecting',
  'disconnected',
  'error',
];

describe('session model', () => {
  it('has idle status and no error initially', () => {
    const store = createStore();

    expect(store.get(connectionStatusAtom)).toBe('idle');
    expect(store.get(connectionErrorAtom)).toBeNull();
    expect(store.get(isConnectedAtom)).toBe(false);
  });

  it('sets status and error via the action', () => {
    const store = createStore();

    store.set(setConnectionStatusActionAtom, {
      status: 'connecting',
      error: null,
    });
    expect(store.get(connectionStatusAtom)).toBe('connecting');
    expect(store.get(connectionErrorAtom)).toBeNull();

    store.set(setConnectionStatusActionAtom, {
      status: 'error',
      error: 'connection lost',
    });
    expect(store.get(connectionStatusAtom)).toBe('error');
    expect(store.get(connectionErrorAtom)).toBe('connection lost');
  });

  it('isConnectedAtom is true only for connected', () => {
    const store = createStore();

    for (const status of allStatuses) {
      store.set(setConnectionStatusActionAtom, { status, error: null });
      expect(store.get(isConnectedAtom)).toBe(status === 'connected');
    }
  });

  it('overwrites the error when the status changes', () => {
    const store = createStore();

    store.set(setConnectionStatusActionAtom, {
      status: 'connected',
      error: null,
    });
    expect(store.get(connectionErrorAtom)).toBeNull();

    store.set(setConnectionStatusActionAtom, {
      status: 'error',
      error: 'timeout',
    });
    expect(store.get(connectionStatusAtom)).toBe('error');
    expect(store.get(connectionErrorAtom)).toBe('timeout');
    expect(store.get(isConnectedAtom)).toBe(false);

    store.set(setConnectionStatusActionAtom, {
      status: 'connected',
      error: null,
    });
    expect(store.get(connectionErrorAtom)).toBeNull();
    expect(store.get(isConnectedAtom)).toBe(true);
  });
});
