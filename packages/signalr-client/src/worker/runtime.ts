import type { HubConnection } from '@microsoft/signalr';
import type { ConnectionStatus } from '@chat/shared-types';
import { HUB_EVENTS } from '../generated/hub-contracts';
import type { HubMethodName } from '../generated/hub-contracts';
import { toErrorMessage } from '../lib/errors';
import type { WorkerInboundMessage, WorkerOutboundMessage } from './protocol';

/**
 * Минимальная часть DedicatedWorkerGlobalScope, которая нужна рантайму.
 * Передаётся снаружи, чтобы модуль тестировался в node без глобального `self`.
 */
export interface WorkerScope {
  postMessage(message: WorkerOutboundMessage): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<WorkerInboundMessage>) => void,
  ): void;
}

export interface RunChatWorkerOptions {
  scope: WorkerScope;
  createConnection: (url: string) => HubConnection;
}

interface InvokeMessage {
  id: number;
  method: HubMethodName;
  request: unknown;
}

/**
 * Рантайм Worker: держит единственное соединение с хабом и транслирует его
 * события, вызовы и статусы в main-поток через `scope.postMessage`.
 */
export function runChatWorker({ scope, createConnection }: RunChatWorkerOptions): void {
  let connection: HubConnection | null = null;
  // Соединение, у которого start() уже завершился: только его можно штатно
  // останавливать через stop(). При отмене во время negotiate stop() заставил бы
  // SignalR залогировать ошибку «stopped during negotiation» (StrictMode).
  let startedConnection: HubConnection | null = null;
  // Поколение меняется на каждый start/stop: запоздавшие статусы старых
  // соединений не должны перетирать актуальное состояние.
  let generation = 0;

  const postStatus = (status: ConnectionStatus, error: string | null): void => {
    scope.postMessage({ type: 'status', status, error });
  };

  const handleStart = async (url: string): Promise<void> => {
    const current = generation + 1;
    generation = current;

    const previous = connection;
    connection = null;
    startedConnection = null;

    // Повторный start перезапускает соединение с нуля.
    if (previous !== null) {
      try {
        await previous.stop();
      } catch {
        // Ошибка остановки старого соединения не влияет на новый запуск.
      }

      if (generation !== current) {
        return;
      }
    }

    let next: HubConnection;

    try {
      next = createConnection(url);
    } catch (error) {
      if (generation === current) {
        postStatus('error', toErrorMessage(error));
      }

      return;
    }

    connection = next;

    // Подписки навешиваются до start(), иначе первые события можно потерять.
    for (const event of HUB_EVENTS) {
      next.on(event, (payload: unknown) => {
        if (connection !== next || generation !== current) {
          return;
        }

        scope.postMessage({ type: 'event', event, payload });
      });
    }

    next.onreconnecting((error?: Error) => {
      if (connection !== next || generation !== current) {
        return;
      }

      postStatus('reconnecting', toErrorMessage(error, 'Соединение с SignalR потеряно'));
    });

    next.onreconnected(() => {
      if (connection !== next || generation !== current) {
        return;
      }

      postStatus('connected', null);
    });

    next.onclose((error?: Error) => {
      if (connection !== next || generation !== current) {
        return;
      }

      postStatus(
        'disconnected',
        error === undefined ? null : toErrorMessage(error, 'Соединение с SignalR закрыто'),
      );
    });

    postStatus('connecting', null);

    try {
      await next.start();
    } catch (error) {
      if (connection !== next || generation !== current) {
        return;
      }

      connection = null;
      postStatus('error', toErrorMessage(error));
      return;
    }

    // Поздний connected после stop/нового start отправлять нельзя.
    if (connection !== next || generation !== current) {
      return;
    }

    startedConnection = next;
    postStatus('connected', null);
  };

  const handleStop = async (): Promise<void> => {
    const current = generation + 1;
    generation = current;

    const active = connection;
    connection = null;

    // Если start ещё не завершился, штатный stop() не нужен: main thread
    // завершит Worker, а незавершённый negotiate будет оборван вместе с ним.
    const wasStarted = active !== null && startedConnection === active;
    startedConnection = null;

    if (wasStarted && active !== null) {
      try {
        await active.stop();
      } catch {
        // Ошибка остановки не мешает сообщить main-потоку, что Worker свободен.
      }
    }

    if (generation !== current) {
      return;
    }

    scope.postMessage({ type: 'stopped' });
  };

  const handleInvoke = async (message: InvokeMessage): Promise<void> => {
    const active = connection;

    if (active === null) {
      scope.postMessage({
        type: 'invoke-error',
        id: message.id,
        message: 'Нет соединения с SignalR',
      });
      return;
    }

    try {
      const payload: unknown = await active.invoke(message.method, message.request);
      scope.postMessage({ type: 'invoke-result', id: message.id, payload });
    } catch (error) {
      scope.postMessage({
        type: 'invoke-error',
        id: message.id,
        message: toErrorMessage(error),
      });
    }
  };

  scope.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'start':
        void handleStart(message.url);
        break;
      case 'stop':
        void handleStop();
        break;
      case 'invoke':
        void handleInvoke(message);
        break;
      default:
        break;
    }
  });
}
