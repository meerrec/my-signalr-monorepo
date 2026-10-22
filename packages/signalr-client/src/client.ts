import {
  HttpTransportType,
  HubConnectionBuilder,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';

/**
 * Создаёт неразрывное соединение с ChatHub по указанному URL.
 * Соединение не стартует: запуск выполняет SignalRProvider.
 * Транспорт фиксирован — только HTTP long polling: WebSockets и SSE отключены.
 */
export function createChatHubConnection(url: string): HubConnection {
  const normalizedUrl = url.trim();

  if (normalizedUrl.length === 0) {
    throw new Error('createChatHubConnection: URL хаба SignalR не может быть пустым');
  }

  return new HubConnectionBuilder()
    .withUrl(normalizedUrl, { transport: HttpTransportType.LongPolling })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}
