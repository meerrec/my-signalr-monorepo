import {
  useHubEvent,
  type HubEventMap,
  type HubEventName,
} from '@chat/signalr-client';

/** Типизированная подписка на событие ChatHub. */
export function useChatEvent<K extends HubEventName>(
  event: K,
  handler: (payload: HubEventMap[K]) => void,
): void {
  useHubEvent(event, handler);
}
