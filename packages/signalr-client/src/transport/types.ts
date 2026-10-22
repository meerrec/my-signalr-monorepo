import type { ConnectionStatus } from '@chat/shared-types';
import type {
  HubEventMap,
  HubEventName,
  HubMethodMap,
  HubMethodName,
} from '../generated/hub-contracts';

/** Снимок статуса соединения, который рассылается подписчикам клиента. */
export interface SignalRStatusSnapshot {
  status: ConnectionStatus;
  error: string | null;
}

/**
 * Транспорт хаба, не зависящий от React и от способа доставки.
 * Реализация `WorkerHubClient` проксирует вызовы в dedicated Web Worker.
 */
export interface SignalRClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  invoke<K extends HubMethodName>(
    method: K,
    request: HubMethodMap[K]['request'],
  ): Promise<HubMethodMap[K]['response']>;
  on<K extends HubEventName>(
    event: K,
    handler: (payload: HubEventMap[K]) => void,
  ): () => void;
  subscribeStatus(listener: (snapshot: SignalRStatusSnapshot) => void): () => void;
}
