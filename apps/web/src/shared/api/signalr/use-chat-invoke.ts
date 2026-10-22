import {
  useHubInvoke,
  type HubMethodMap,
  type HubMethodName,
} from '@chat/signalr-client';

/** Типизированный вызов метода ChatHub. */
export function useChatInvoke<K extends HubMethodName>(
  method: K,
): (request: HubMethodMap[K]['request']) => Promise<HubMethodMap[K]['response']> {
  return useHubInvoke(method);
}
