import type { HubConnection } from '@microsoft/signalr';
import { describe, expect, it } from 'vitest';
import { HUB_EVENTS } from '../generated/hub-contracts';
import type { WorkerInboundMessage, WorkerOutboundMessage } from './protocol';
import { runChatWorker } from './runtime';
import type { WorkerScope } from './runtime';

const HUB_URL = 'http://localhost:5000/hubs/chat';

type EventHandler = (...args: unknown[]) => void;

class FakeScope implements WorkerScope {
  readonly messages: WorkerOutboundMessage[] = [];
  private readonly listeners: Array<(event: MessageEvent<WorkerInboundMessage>) => void> = [];

  postMessage(message: WorkerOutboundMessage): void {
    this.messages.push(message);
  }

  addEventListener(
    _type: 'message',
    listener: (event: MessageEvent<WorkerInboundMessage>) => void,
  ): void {
    this.listeners.push(listener);
  }

  send(message: WorkerInboundMessage): void {
    for (const listener of [...this.listeners]) {
      listener({ data: message } as MessageEvent<WorkerInboundMessage>);
    }
  }
}

class FakeConnection {
  readonly events = new Map<string, EventHandler[]>();
  startError: Error | null = null;
  invokeError: Error | null = null;
  invokeResult: unknown = undefined;
  started = false;
  stopped = false;
  eventsAtStart: string[] = [];
  invocations: Array<{ method: string; request: unknown }> = [];
  reconnecting: ((error?: Error) => void) | null = null;
  reconnected: (() => void) | null = null;
  close: ((error?: Error) => void) | null = null;

  async start(): Promise<void> {
    this.eventsAtStart = [...this.events.keys()];
    this.started = true;

    if (this.startError !== null) {
      throw this.startError;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }

  async invoke(method: string, request: unknown): Promise<unknown> {
    this.invocations.push({ method, request });

    if (this.invokeError !== null) {
      throw this.invokeError;
    }

    return this.invokeResult;
  }

  on(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event) ?? [];
    handlers.push(handler);
    this.events.set(event, handlers);
  }

  onreconnecting(handler: (error?: Error) => void): void {
    this.reconnecting = handler;
  }

  onreconnected(handler: () => void): void {
    this.reconnected = handler;
  }

  onclose(handler: (error?: Error) => void): void {
    this.close = handler;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.events.get(event) ?? []) {
      handler(...args);
    }
  }

  asHubConnection(): HubConnection {
    return this as unknown as HubConnection;
  }
}

function setup(connection: FakeConnection = new FakeConnection()): {
  scope: FakeScope;
  connection: FakeConnection;
} {
  const scope = new FakeScope();

  runChatWorker({
    scope,
    createConnection: () => connection.asHubConnection(),
  });

  return { scope, connection };
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('runChatWorker', () => {
  it('start переводит соединение из connecting в connected', async () => {
    const { scope, connection } = setup();

    scope.send({ type: 'start', url: HUB_URL });
    await flush();

    expect(connection.started).toBe(true);
    expect(scope.messages).toEqual([
      { type: 'status', status: 'connecting', error: null },
      { type: 'status', status: 'connected', error: null },
    ]);
  });

  it('подписывается на все события хаба до start', async () => {
    const { scope, connection } = setup();

    scope.send({ type: 'start', url: HUB_URL });
    await flush();

    expect(connection.eventsAtStart).toEqual([...HUB_EVENTS]);
  });

  it('переводит соединение в error, если start завершился ошибкой', async () => {
    const connection = new FakeConnection();
    connection.startError = new Error('сеть недоступна');
    const { scope } = setup(connection);

    scope.send({ type: 'start', url: HUB_URL });
    await flush();

    expect(scope.messages).toEqual([
      { type: 'status', status: 'connecting', error: null },
      { type: 'status', status: 'error', error: 'сеть недоступна' },
    ]);
  });

  it('пересылает события хаба в main-поток', async () => {
    const { scope, connection } = setup();

    scope.send({ type: 'start', url: HUB_URL });
    await flush();

    const payload = { id: 'm1', roomId: 'r1' };
    connection.emit('ReceiveMessage', payload);

    expect(scope.messages.at(-1)).toEqual({
      type: 'event',
      event: 'ReceiveMessage',
      payload,
    });
  });

  it('пересылает lifecycle-статусы SignalR', async () => {
    const { scope, connection } = setup();

    scope.send({ type: 'start', url: HUB_URL });
    await flush();
    scope.messages.length = 0;

    connection.reconnecting?.(new Error('ping timeout'));
    connection.reconnected?.();
    connection.close?.(new Error('closed'));

    expect(scope.messages).toEqual([
      { type: 'status', status: 'reconnecting', error: 'ping timeout' },
      { type: 'status', status: 'connected', error: null },
      { type: 'status', status: 'disconnected', error: 'closed' },
    ]);
  });

  it('возвращает результат invoke', async () => {
    const { scope, connection } = setup();

    scope.send({ type: 'start', url: HUB_URL });
    await flush();
    scope.messages.length = 0;

    const payload = { roomId: 'r1', messages: [] };
    connection.invokeResult = payload;
    scope.send({ type: 'invoke', id: 5, method: 'GetHistory', request: { roomId: 'r1' } });
    await flush();

    expect(connection.invocations).toEqual([
      { method: 'GetHistory', request: { roomId: 'r1' } },
    ]);
    expect(scope.messages).toEqual([{ type: 'invoke-result', id: 5, payload }]);
  });

  it('возвращает ошибку invoke', async () => {
    const { scope, connection } = setup();

    scope.send({ type: 'start', url: HUB_URL });
    await flush();
    scope.messages.length = 0;

    connection.invokeError = new Error('комната не найдена');
    scope.send({ type: 'invoke', id: 7, method: 'SetName', request: { name: 'Аня' } });
    await flush();

    expect(scope.messages).toEqual([
      { type: 'invoke-error', id: 7, message: 'комната не найдена' },
    ]);
  });

  it('отвечает invoke-error, если соединения ещё нет', async () => {
    const { scope } = setup();

    scope.send({ type: 'invoke', id: 1, method: 'SetName', request: { name: 'Аня' } });
    await flush();

    expect(scope.messages).toEqual([
      { type: 'invoke-error', id: 1, message: 'Нет соединения с SignalR' },
    ]);
  });

  it('stop останавливает соединение и шлёт stopped', async () => {
    const { scope, connection } = setup();

    scope.send({ type: 'start', url: HUB_URL });
    await flush();
    scope.messages.length = 0;

    scope.send({ type: 'stop' });
    await flush();

    expect(connection.stopped).toBe(true);
    expect(scope.messages).toEqual([{ type: 'stopped' }]);
  });

  it('stop во время start не вызывает stop соединения', async () => {
    const connection = new FakeConnection();
    let resolveStart: () => void = () => {};

    connection.start = (): Promise<void> =>
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      });

    const { scope } = setup(connection);

    scope.send({ type: 'start', url: HUB_URL });
    await flush();

    scope.send({ type: 'stop' });
    await flush();

    // Незавершённый negotiate обрывается завершением Worker, а не stop():
    // иначе SignalR логирует ошибку «stopped during negotiation».
    expect(connection.stopped).toBe(false);
    expect(scope.messages.at(-1)).toEqual({ type: 'stopped' });

    resolveStart();
    await flush();

    expect(connection.stopped).toBe(false);
  });

  it('не отправляет запоздавший connected после stop', async () => {
    const connection = new FakeConnection();
    let resolveStart: () => void = () => {};

    connection.start = (): Promise<void> => {
      connection.started = true;
      return new Promise<void>((resolve) => {
        resolveStart = resolve;
      });
    };

    const { scope } = setup(connection);

    scope.send({ type: 'start', url: HUB_URL });
    await flush();

    scope.send({ type: 'stop' });
    await flush();

    resolveStart();
    await flush();

    const statuses = scope.messages.filter((message) => message.type === 'status');

    expect(statuses).toEqual([{ type: 'status', status: 'connecting', error: null }]);
    expect(scope.messages.at(-1)).toEqual({ type: 'stopped' });
  });
});
