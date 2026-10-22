import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../generated/rest';
import type { SignalRStatusSnapshot } from '../transport/types';
import type { WorkerInboundMessage, WorkerOutboundMessage } from './protocol';
import { WorkerHubClient } from './worker-client';
import type { WorkerLike } from './worker-client';

const HUB_URL = 'http://localhost:5000/hubs/chat';

type InvokeMessage = Extract<WorkerInboundMessage, { type: 'invoke' }>;

class FakeWorker implements WorkerLike {
  readonly posted: WorkerInboundMessage[] = [];
  terminated = false;
  private readonly listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  postMessage(message: WorkerInboundMessage): void {
    this.posted.push(message);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    this.listeners.set(type, listeners);
    listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(message: WorkerOutboundMessage): void {
    for (const listener of [...(this.listeners.get('message') ?? [])]) {
      listener({ data: message } as MessageEvent);
    }
  }

  emitFailure(type: 'error' | 'messageerror', message: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener({ message } as unknown as MessageEvent);
    }
  }
}

function createClient(workers: FakeWorker[] = []): WorkerHubClient {
  return new WorkerHubClient({
    url: HUB_URL,
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
}

function getWorker(workers: FakeWorker[], index: number): FakeWorker {
  const worker = workers[index];

  if (worker === undefined) {
    throw new Error(`Worker #${index} не создан`);
  }

  return worker;
}

function sentInvokes(worker: FakeWorker): InvokeMessage[] {
  return worker.posted.flatMap((message) => (message.type === 'invoke' ? [message] : []));
}

const MESSAGE: ChatMessage = {
  id: 'm1',
  roomId: 'r1',
  authorId: 'u1',
  authorName: 'Аня',
  text: 'Привет',
  sentAt: '2026-10-23T10:00:00Z',
};

describe('WorkerHubClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('сопоставляет ответы invoke по id при обратном порядке ответов', async () => {
    const workers: FakeWorker[] = [];
    const client = createClient(workers);

    await client.start();
    const worker = getWorker(workers, 0);

    const first = client.invoke('SendMessage', { roomId: 'r1', text: 'Привет' });
    const second = client.invoke('SetName', { name: 'Аня' });

    const [firstMessage, secondMessage] = sentInvokes(worker);
    expect(firstMessage).toBeDefined();
    expect(secondMessage).toBeDefined();

    const user = { id: 'u1', name: 'Аня' };
    worker.emit({
      type: 'invoke-result',
      id: secondMessage?.id ?? 0,
      payload: user,
    });
    worker.emit({
      type: 'invoke-result',
      id: firstMessage?.id ?? 0,
      payload: MESSAGE,
    });

    await expect(second).resolves.toEqual(user);
    await expect(first).resolves.toEqual(MESSAGE);
  });

  it('отклоняет invoke с текстом invoke-error', async () => {
    const workers: FakeWorker[] = [];
    const client = createClient(workers);

    await client.start();
    const worker = getWorker(workers, 0);

    const promise = client.invoke('SetName', { name: 'Аня' });
    const [invoke] = sentInvokes(worker);

    worker.emit({
      type: 'invoke-error',
      id: invoke?.id ?? 0,
      message: 'Комната не найдена',
    });

    await expect(promise).rejects.toThrow('Комната не найдена');
  });

  it('отклоняет invoke, пока Worker не запущен', async () => {
    const workers: FakeWorker[] = [];
    const client = createClient(workers);

    await expect(client.invoke('SetName', { name: 'Аня' })).rejects.toThrow(
      'Нет соединения с SignalR',
    );
    expect(workers).toHaveLength(0);
  });

  it('маршрутизирует события по имени и снимает подписку идемпотентно', async () => {
    const workers: FakeWorker[] = [];
    const client = createClient(workers);
    const received: unknown[] = [];
    const rooms: unknown[] = [];

    const unsubscribe = client.on('ReceiveMessage', (payload) => {
      received.push(payload);
    });
    client.on('RoomUpdated', (payload) => {
      rooms.push(payload);
    });

    await client.start();
    const worker = getWorker(workers, 0);

    worker.emit({ type: 'event', event: 'ReceiveMessage', payload: MESSAGE });
    worker.emit({
      type: 'event',
      event: 'RoomUpdated',
      payload: { id: 'r1', name: 'Общий', memberCount: 2 },
    });

    expect(received).toEqual([MESSAGE]);
    expect(rooms).toHaveLength(1);

    unsubscribe();
    unsubscribe();

    worker.emit({ type: 'event', event: 'ReceiveMessage', payload: MESSAGE });

    expect(received).toHaveLength(1);
  });

  it('не прерывает рассылку, если один обработчик бросил ошибку', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const workers: FakeWorker[] = [];
    const client = createClient(workers);
    const received: unknown[] = [];

    client.on('ReceiveMessage', () => {
      throw new Error('boom');
    });
    client.on('ReceiveMessage', (payload) => {
      received.push(payload);
    });

    await client.start();
    getWorker(workers, 0).emit({
      type: 'event',
      event: 'ReceiveMessage',
      payload: MESSAGE,
    });

    expect(received).toEqual([MESSAGE]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('рассылает статусы и не проигрывает последний снимок новым подписчикам', async () => {
    const workers: FakeWorker[] = [];
    const client = createClient(workers);
    const snapshots: SignalRStatusSnapshot[] = [];

    client.subscribeStatus((snapshot) => {
      snapshots.push(snapshot);
    });

    await client.start();
    expect(snapshots).toEqual([{ status: 'connecting', error: null }]);

    const worker = getWorker(workers, 0);
    worker.emit({ type: 'status', status: 'connected', error: null });
    expect(snapshots.at(-1)).toEqual({ status: 'connected', error: null });

    const late: SignalRStatusSnapshot[] = [];
    const unsubscribe = client.subscribeStatus((snapshot) => {
      late.push(snapshot);
    });

    expect(late).toHaveLength(0);

    unsubscribe();
    unsubscribe();

    worker.emit({ type: 'status', status: 'reconnecting', error: 'нет сети' });
    expect(snapshots.at(-1)).toEqual({ status: 'reconnecting', error: 'нет сети' });
  });

  it('stop отклоняет pending-вызовы, шлёт stop и terminate', async () => {
    const workers: FakeWorker[] = [];
    const client = createClient(workers);

    await client.start();
    const worker = getWorker(workers, 0);

    const promise = client.invoke('GetHistory', { roomId: 'r1' });
    const stopPromise = client.stop();

    await expect(promise).rejects.toThrow('Соединение с SignalR остановлено');
    expect(worker.posted.at(-1)).toEqual({ type: 'stop' });

    worker.emit({ type: 'stopped' });
    await stopPromise;

    expect(worker.terminated).toBe(true);
  });

  it('не ждёт stopped дольше таймаута', async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const client = createClient(workers);

    await client.start();
    const worker = getWorker(workers, 0);
    const stopPromise = client.stop();
    const settled = vi.fn();

    void stopPromise.then(settled);

    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await stopPromise;

    expect(settled).toHaveBeenCalledTimes(1);
    expect(worker.terminated).toBe(true);
  });

  it('после stop создаёт новый Worker и игнорирует сообщения старого', async () => {
    const workers: FakeWorker[] = [];
    const client = createClient(workers);
    const snapshots: SignalRStatusSnapshot[] = [];

    client.subscribeStatus((snapshot) => {
      snapshots.push(snapshot);
    });

    await client.start();
    const first = getWorker(workers, 0);
    const stopPromise = client.stop();

    await client.start();
    expect(workers).toHaveLength(2);
    const second = getWorker(workers, 1);

    first.emit({ type: 'status', status: 'connected', error: null });
    second.emit({ type: 'status', status: 'connected', error: null });

    expect(snapshots).toEqual([
      { status: 'connecting', error: null },
      { status: 'connecting', error: null },
      { status: 'connected', error: null },
    ]);

    first.emit({ type: 'stopped' });
    await stopPromise;

    expect(first.terminated).toBe(true);
    expect(second.terminated).toBe(false);
  });

  it('переводит Worker в error по событию error', async () => {
    const workers: FakeWorker[] = [];
    const client = createClient(workers);
    const snapshots: SignalRStatusSnapshot[] = [];

    client.subscribeStatus((snapshot) => {
      snapshots.push(snapshot);
    });

    await client.start();
    const worker = getWorker(workers, 0);
    const promise = client.invoke('SetName', { name: 'Аня' });

    worker.emitFailure('error', 'Не удалось загрузить модуль Worker');

    await expect(promise).rejects.toThrow('Не удалось загрузить модуль Worker');
    expect(worker.terminated).toBe(true);
    expect(snapshots.at(-1)).toEqual({
      status: 'error',
      error: 'Не удалось загрузить модуль Worker',
    });
  });

  it('не принимает пустой URL', () => {
    expect(() => new WorkerHubClient({ url: '   ' })).toThrow(/не может быть пустым/);
  });
});
