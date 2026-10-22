import type { HubEventMap, HubEventName, HubMethodMap, HubMethodName } from '../generated/hub-contracts';
import { toErrorMessage } from '../lib/errors';
import type { SignalRClient, SignalRStatusSnapshot } from '../transport/types';
import type { WorkerInboundMessage, WorkerOutboundMessage } from './protocol';
import { toAbsoluteWorkerUrl } from './url';

/** Минимальная часть интерфейса Worker, которую использует клиент. */
export interface WorkerLike {
  postMessage(message: WorkerInboundMessage): void;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void;
  terminate(): void;
}

export interface WorkerHubClientOptions {
  url: string;
  createWorker?: () => WorkerLike;
}

interface PendingInvoke {
  resolve: (payload: unknown) => void;
  reject: (reason: unknown) => void;
}

interface WorkerListeners {
  message: (event: MessageEvent) => void;
  error: (event: MessageEvent) => void;
  messageerror: (event: MessageEvent) => void;
}

const STOP_TIMEOUT_MS = 2000;
const NO_CONNECTION_MESSAGE = 'Нет соединения с SignalR';

/**
 * Создаёт dedicated Worker с SignalR-соединением.
 * Конструкция обязана оставаться строго статической: только литерал
 * `new Worker(new URL(...), ...)` Vite распознаёт как отдельную точку входа
 * и выносит `@microsoft/signalr` из main-чанка.
 */
function createBrowserWorker(): WorkerLike {
  return new Worker(new URL('./entry.ts', import.meta.url), {
    type: 'module',
    name: 'signalr-client',
  });
}

/** Текст из события `error`/`messageerror`; у MessageEvent поля message нет. */
function readEventMessage(event: MessageEvent, fallback: string): string {
  const { message } = event as unknown as { message?: unknown };

  return toErrorMessage(message, fallback);
}

/**
 * Клиент хаба поверх dedicated Web Worker.
 * Сам Worker создаётся только в `start()`, поэтому конструктор без побочных эффектов.
 */
export class WorkerHubClient implements SignalRClient {
  private readonly url: string;
  private readonly createWorker: () => WorkerLike;
  private readonly pending = new Map<number, PendingInvoke>();
  private readonly eventHandlers = new Map<HubEventName, Set<(payload: unknown) => void>>();
  private readonly statusListeners = new Set<(snapshot: SignalRStatusSnapshot) => void>();
  private readonly workerListeners = new Map<WorkerLike, WorkerListeners>();
  private readonly stopWaiters = new Map<WorkerLike, () => void>();
  private worker: WorkerLike | null = null;
  private nextInvokeId = 1;

  constructor(options: WorkerHubClientOptions) {
    const url = options.url.trim();

    if (url.length === 0) {
      throw new Error('WorkerHubClient: URL хаба SignalR не может быть пустым');
    }

    this.url = url;
    this.createWorker = options.createWorker ?? createBrowserWorker;
  }

  async start(): Promise<void> {
    if (this.worker !== null) {
      return;
    }

    try {
      const worker = this.createWorker();
      this.worker = worker;
      this.attachListeners(worker);
      worker.postMessage({ type: 'start', url: toAbsoluteWorkerUrl(this.url) });

      // Подписчики узнают о старте синхронно, не дожидаясь ответа Worker.
      this.emitStatus({ status: 'connecting', error: null });
    } catch (error) {
      const failed = this.worker;
      this.worker = null;

      if (failed !== null) {
        this.detachListeners(failed);
        failed.terminate();
      }

      this.emitStatus({ status: 'error', error: toErrorMessage(error) });
    }
  }

  async stop(): Promise<void> {
    const worker = this.worker;

    if (worker === null) {
      return;
    }

    // Обнуляем синхронно: повторный start() после unmount (StrictMode)
    // должен получить новый Worker, пока этот ещё ждёт `stopped`.
    this.worker = null;
    this.rejectAllPending(new Error('Соединение с SignalR остановлено'));

    const stopped = this.waitForStop(worker);

    try {
      worker.postMessage({ type: 'stop' });
    } catch {
      // Worker уже мог быть завершён — не ждём таймаут впустую.
      this.stopWaiters.get(worker)?.();
    }

    await stopped;

    this.detachListeners(worker);
    worker.terminate();
  }

  invoke<K extends HubMethodName>(
    method: K,
    request: HubMethodMap[K]['request'],
  ): Promise<HubMethodMap[K]['response']> {
    const worker = this.worker;

    if (worker === null) {
      return Promise.reject(new Error(NO_CONNECTION_MESSAGE));
    }

    return new Promise<HubMethodMap[K]['response']>((resolve, reject) => {
      const id = this.nextInvokeId;
      this.nextInvokeId += 1;

      this.pending.set(id, {
        resolve: (payload: unknown): void => {
          resolve(payload as HubMethodMap[K]['response']);
        },
        reject,
      });

      try {
        worker.postMessage({ type: 'invoke', id, method, request });
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
      }
    });
  }

  on<K extends HubEventName>(
    event: K,
    handler: (payload: HubEventMap[K]) => void,
  ): () => void {
    let handlers = this.eventHandlers.get(event);

    if (handlers === undefined) {
      handlers = new Set();
      this.eventHandlers.set(event, handlers);
    }

    const wrapped = (payload: unknown): void => {
      handler(payload as HubEventMap[K]);
    };

    handlers.add(wrapped);
    let active = true;

    return (): void => {
      if (!active) {
        return;
      }

      active = false;
      handlers.delete(wrapped);

      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    };
  }

  subscribeStatus(listener: (snapshot: SignalRStatusSnapshot) => void): () => void {
    // Последний снимок при подписке не проигрывается: провайдер сам держит состояние.
    this.statusListeners.add(listener);

    return (): void => {
      this.statusListeners.delete(listener);
    };
  }

  private emitStatus(snapshot: SignalRStatusSnapshot): void {
    for (const listener of [...this.statusListeners]) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('WorkerHubClient: подписчик статуса завершился ошибкой', error);
      }
    }
  }

  private dispatchEvent(event: HubEventName, payload: unknown): void {
    const handlers = this.eventHandlers.get(event);

    if (handlers === undefined) {
      return;
    }

    // Копия защищает обход, если обработчик отпишется во время рассылки.
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`WorkerHubClient: обработчик события ${event} завершился ошибкой`, error);
      }
    }
  }

  private rejectAllPending(reason: Error): void {
    if (this.pending.size === 0) {
      return;
    }

    const pending = [...this.pending.values()];
    this.pending.clear();

    for (const entry of pending) {
      entry.reject(reason);
    }
  }

  private waitForStop(worker: WorkerLike): Promise<void> {
    return new Promise((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const finish = (): void => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        this.stopWaiters.delete(worker);
        resolve();
      };

      timeoutId = setTimeout(finish, STOP_TIMEOUT_MS);
      this.stopWaiters.set(worker, finish);
    });
  }

  private attachListeners(worker: WorkerLike): void {
    const listeners: WorkerListeners = {
      message: (event): void => {
        this.handleMessage(worker, event);
      },
      error: (event): void => {
        this.handleWorkerFailure(worker, readEventMessage(event, 'Ошибка Worker'));
      },
      messageerror: (event): void => {
        this.handleWorkerFailure(
          worker,
          readEventMessage(event, 'Не удалось прочитать сообщение Worker'),
        );
      },
    };

    this.workerListeners.set(worker, listeners);
    worker.addEventListener('message', listeners.message);
    worker.addEventListener('error', listeners.error);
    worker.addEventListener('messageerror', listeners.messageerror);
  }

  private detachListeners(worker: WorkerLike): void {
    const listeners = this.workerListeners.get(worker);

    if (listeners === undefined) {
      return;
    }

    worker.removeEventListener('message', listeners.message);
    worker.removeEventListener('error', listeners.error);
    worker.removeEventListener('messageerror', listeners.messageerror);
    this.workerListeners.delete(worker);
  }

  private handleMessage(worker: WorkerLike, event: MessageEvent): void {
    const message = event.data as WorkerOutboundMessage;

    if (message.type === 'stopped') {
      this.stopWaiters.get(worker)?.();
      return;
    }

    // Сообщения вытесненного Worker игнорируются: обработчик привязан к экземпляру.
    if (this.worker !== worker) {
      return;
    }

    switch (message.type) {
      case 'status':
        this.emitStatus({ status: message.status, error: message.error });
        break;
      case 'event':
        this.dispatchEvent(message.event, message.payload);
        break;
      case 'invoke-result': {
        const pending = this.pending.get(message.id);

        if (pending === undefined) {
          return;
        }

        this.pending.delete(message.id);
        pending.resolve(message.payload);
        break;
      }
      case 'invoke-error': {
        const pending = this.pending.get(message.id);

        if (pending === undefined) {
          return;
        }

        this.pending.delete(message.id);
        pending.reject(new Error(message.message));
        break;
      }
      default:
        break;
    }
  }

  private handleWorkerFailure(worker: WorkerLike, message: string): void {
    // Worker уже не пришлёт stopped — не держим приостановленный stop() до таймаута.
    this.stopWaiters.get(worker)?.();

    // Даже вытеснённый Worker нужно освободить.
    this.detachListeners(worker);
    worker.terminate();

    if (this.worker !== worker) {
      return;
    }

    this.worker = null;
    this.rejectAllPending(new Error(message));
    this.emitStatus({ status: 'error', error: message });
  }
}
