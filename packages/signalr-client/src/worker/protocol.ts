import type { ConnectionStatus } from '@chat/shared-types';
import type { HubEventName, HubMethodName } from '../generated/hub-contracts';

/**
 * Сообщения из main-потока в Worker.
 * Отдельного протокола подписок нет: Worker всегда пересылает все события
 * из `HUB_EVENTS`, а фильтрацией занимается main-поток.
 */
export type WorkerInboundMessage =
  | { type: 'start'; url: string }
  | { type: 'stop' }
  | { type: 'invoke'; id: number; method: HubMethodName; request: unknown };

/** Сообщения из Worker в main-поток. */
export type WorkerOutboundMessage =
  | { type: 'status'; status: ConnectionStatus; error: string | null }
  | { type: 'event'; event: HubEventName; payload: unknown }
  | { type: 'invoke-result'; id: number; payload: unknown }
  | { type: 'invoke-error'; id: number; message: string }
  | { type: 'stopped' };
