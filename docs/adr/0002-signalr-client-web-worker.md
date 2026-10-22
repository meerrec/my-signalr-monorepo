# ADR 0002. SignalR-клиент в dedicated Web Worker

- Статус: принято
- Дата: 2026-10-23
- Владелец: `@architect`
- Затрагивает: `packages/signalr-client/**`, `apps/web/src/shared/api/signalr/**`,
  `apps/web/vite.config.ts`

## Контекст

Соединение хаба создавалось и жило на главном потоке в `SignalRProvider`: провайдер
держал `HubConnection`, регистрировал lifecycle-обработчики через WeakMap-диспетчер,
опрашивал состояние в `Connecting` каждые 200 мс и раздавал соединение хукам.
Транспорт зафиксирован как HTTP long polling — каждый клиент постоянно держит
незавершённый HTTP-запрос, а разбор сообщений и статусов идёт в main thread.

Нужно изолировать сетевой слой от React: соединение, подписки, статусы и вызовы хаба
должны жить вне main thread, не меняя публичные контракты хуков и атомов.

## Решение

1. **Worker владеет соединением.** `worker/entry.ts` создаёт `HubConnection` через
   `createChatHubConnection` (long polling + `withAutomaticReconnect`) и транслирует
   его в main thread. `client.ts` остаётся внутренним модулем worker-графа и не
   реэкспортируется из корня пакета: статический re-export затянул бы runtime
   `@microsoft/signalr` в main-чанк.
2. **Типизированный postMessage-протокол.** main → worker: `start {url}`, `stop`,
   `invoke {id, method, request}`. worker → main: `status {status, error}`,
   `event {event, payload}`, `invoke-result {id, payload}`,
   `invoke-error {id, message}`, `stopped`. Корреляция invoke — по монотонному `id`;
   ошибки передаются строкой через `toErrorMessage`.
3. **Подписок в протоколе нет.** Worker всегда пересылает все события из `HUB_EVENTS`,
   main thread хранит `Map<HubEventName, Set<handler>>`. Порядок гарантирует React:
   эффекты детей (`useHubEvent`) выполняются раньше эффекта провайдера, который
   отправляет `start`, поэтому стартовые `RoomUpdated` из `OnConnectedAsync` не теряются.
4. **Публичный API пакета — worker-only.** `SignalRProvider` принимает только `url`;
   контекст отдаёт `SignalRClient` (`start/stop/invoke/on/subscribeStatus`), а не
   `HubConnection`; `useSignalRStatus` возвращает только `status` и `error`.
   Сигнатуры `useHubEvent`, `useHubInvoke`, `useChatEvent`, `useChatInvoke`,
   `useChatConnectionStatus` не меняются.
5. **Сборка.** Worker создаётся строго статической конструкцией
   `new Worker(new URL('./entry.ts', import.meta.url), { type: 'module' })`; Vite
   выносит его отдельным чанком. В `vite.config.ts` задан `worker.format: 'es'`,
   чтобы dev и build использовали одинаковый формат.
6. **Жизненный цикл.** Worker создаётся только в `start()`, поэтому конструктор
   `WorkerHubClient` без побочных эффектов. `stop()` отклоняет все pending invoke,
   просит Worker остановить соединение, ждёт `stopped` не дольше 2 с и вызывает
   `terminate()`. Повторный `start()` после `stop()` (StrictMode) создаёт новый Worker.
   Относительный URL хаба нормализуется в абсолютный на main thread: внутри Worker
   `@microsoft/signalr` не резолвит относительные URL.

## Последствия

- Main-чанк не содержит runtime `@microsoft/signalr`; события и статусы приходят
  через `WorkerHubClient`.
- Браузер должен поддерживать module workers (актуальные Chrome/Firefox/Safari).
- Тихая смерть Worker без события `error` не детектируется — heartbeat не реализован;
  это ограничение демо.
- Юнит-тесты не требуют браузера: `worker/runtime.ts` принимает `WorkerScope` и фабрику
  соединения, `WorkerHubClient` — фабрику `WorkerLike`.
- Контракты OpenAPI и сгенерированные типы не меняются: Worker не влияет на протокол хаба.

## Проверка решения

- `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` — зелёные.
- В `apps/web/dist/assets` есть отдельный worker-чанк; в `index-*.js` нет
  `HubConnectionBuilder`.
- В браузере negotiate и long-polling запросы к `/hubs/chat` идут из dedicated worker
  (`signalr-client`), комнаты и сообщения приходят через события Worker.
