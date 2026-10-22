# ADR 0003. Серверная очередь работ и BackgroundService

- Статус: принято
- Дата: 2026-10-23
- Владелец: `@architect`
- Затрагивает: `server/SignalRChat.Server/**` (`Queues/`, `Realtime/`, `Hubs/`, `Program.cs`)

## Контекст

`ChatHub` сам вызывал `ChatService` и тут же рассылал результат через `Clients`/`Groups`.
Несколько вызовов одного клиента и разных клиентов могли выполняться параллельно:
`ChatService.SendMessage` и `Disconnect` состоят из нескольких независимых операций
`IChatStore` под отдельными блокировками, поэтому между мутацией и broadcast возможны
гонки и неатомарное состояние.

Сервер — единственный процесс с in-memory состоянием; нужна простая сериализация
операций без внешнего брокера и без изменения контракта хаба.

## Решение

1. **Actor-очередь в Server.** `ChatWorkQueue : BackgroundService` (`Queues/`) —
   singleton с bounded `Channel<Func<CancellationToken, Task>>` (ёмкость 1024,
   `SingleReader`, `FullMode.Wait`). `EnqueueAsync<T>` возвращает `TaskCompletionSource`
   с `RunContinuationsAsynchronously`; при заполненном канале `WriteAsync` ждёт слота,
   то есть backpressure доходит до Hub-вызова.
2. **Одна единица работы = мутация + группы + рассылка.** `ChatRealtimeService`
   (`Realtime/`) ставит в очередь `ChatService`-операцию, изменение групп через
   `IHubContext<ChatHub>.Groups` и broadcast через `IHubContext<ChatHub>.Clients`.
   Hub захватывает `Context.ConnectionId` строкой до постановки: `Context` после
   возврата из метода использовать нельзя. `Clients.Caller` в очереди недоступен.
3. **Hub остаётся тонким.** Сигнатуры пяти методов не меняются (SignalR.OpenApi,
   `openapi/signalr.json` и generated-клиент зависят от них); тела делегируют
   в `ChatRealtimeService`. `ExecuteAsync` по-прежнему превращает
   `ChatValidationException` в `HubException` — исключение проходит через TCS
   без потери типа.
4. **Прямые чтения.** `GetHistory` и `OnConnectedAsync` остаются вне очереди:
   это чтения, а стартовый список комнат отправляется через `Clients.Caller`.
5. **Shutdown.** `StopAsync` закрывает writer (`TryComplete`), reader дочитывает
   остаток через `ReadAllAsync()` без токена. Работы, не начатые до отмены, завершают
   свои TCS как canceled; in-flight получают отменённый `stoppingToken`.
   `OnDisconnectedAsync` ловит `OperationCanceledException`/`ChannelClosedException`
   и всегда вызывает `base`.
6. **Регистрация без дублей.**
   `AddSingleton<ChatWorkQueue>()` + `AddHostedService(sp => sp.GetRequiredService<ChatWorkQueue>())`
   — обычный `AddHostedService<ChatWorkQueue>()` создал бы второй экземпляр.

## Последствия

- Порядок операций фиксирован (FIFO), мутация и broadcast согласованы.
- Очередь и состояние in-memory: при рестарте необработанные операции теряются,
  несколько инстансов не согласуются. Для масштабирования потребуется внешний брокер
  и backplane; порт очереди тогда выносится в Application.
- Bounded-канал даёт head-of-line blocking под нагрузкой — осознанный выбор в пользу
  ограниченной памяти.
- `GetHistory` вне очереди может не увидеть мутацию другого клиента, ещё стоящую
  в очереди; для собственных вызовов порядок гарантирован await-семантикой.
- Нижние слои (Domain/Application/Infrastructure) не менялись.

## Проверка решения

- `dotnet build server/SignalRChat.slnx` — зелёный; `openapi/**` и generated-файлы
  не изменились.
- Живой e2e long polling: `SendMessage` → `GetHistory` содержит сообщение;
  30 параллельных отправок сохраняют порядок; `memberCount` уменьшается после
  disconnect; сообщение с пустым текстом возвращает текст `HubException`;
  Ctrl+C завершает сервер без зависших запросов.
