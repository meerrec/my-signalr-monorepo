# QA-отчёт — SignalR Chat Monorepo

Дата прогона: 2026-10-23
Ветка: `fix/contracts-provider-alignment`
HEAD: `8a4f62b` (`fix: prevent connection.stop() during negotiation when stopping worker`)
Статус AGENTS.md: v1, заморожен до прохождения QA.
Коммит по итогам прогона не создавался. `@qa` изменял только этот файл.

Примечание о HEAD: прогон начат на `ab33f72` с четырьмя незакоммиченными файлами
(`AGENTS.md`, `docs/adr/0002-signalr-client-web-worker.md`,
`packages/signalr-client/src/worker/runtime.test.ts`,
`packages/signalr-client/src/worker/runtime.ts`). Во время прогона (01:18:54 +0500)
эти же файлы были закоммичены внешним процессом как `8a4f62b`; содержимое файлов
не менялось, на финальном замере рабочее дерево чистое. Все проверки ниже выполнены
на этом содержимом.

## 1. Фактические результаты проверок

| Проверка | Команда / время | Результат |
| --- | --- | --- |
| Линт (включая FSD-границы) | `pnpm lint`, 01:17:05–01:17:07 | PASS, exit 0. Вывод ESLint пустой: 0 ошибок, 0 предупреждений, сообщений `boundaries/*` нет |
| Проверка типов | `pnpm type-check`, 01:17:09–01:17:14 | PASS, exit 0. `Scope: 3 of 4 workspace projects`: `packages/shared-types`, `packages/signalr-client`, `apps/web` (оба tsconfig) + `tsconfig.tools.json` |
| Тесты | `pnpm test`, 01:17:17–01:17:18 | PASS. 15 тестовых файлов, 96 тестов. Start at 01:17:17, Duration 403 ms (transform 710 ms, setup 0 ms, import 1.07 s, tests 116 ms, environment 1 ms) |
| Сборка | `pnpm build`, 01:17:21–01:17:24 | PASS. `vite v8.3.5`, 131 модуль, built in 138 ms. `dist/index.html` 0.55 kB (gzip 0.35 kB), `entry-Cw2LtJX1.js` 57.68 kB, `index-orLUwT0T.css` 19.81 kB (gzip 4.20 kB), `index-QOt2V5CQ.js` 251.15 kB (gzip 79.43 kB, map 1 231.57 kB) |
| Полный прогон | `pnpm verify`, 01:17:30–01:17:40 | PASS, exit 0 (lint → type-check → test → build). Внутри: тесты 15 файлов / 96 тестов, Duration 531 ms; сборка 131 модуль, built in 144 ms |
| Сборка сервера | `dotnet build server/SignalRChat.slnx`, 01:17:44–01:17:47 | PASS, exit 0. 4 проекта, `Build succeeded`, 0 Warning(s), 0 Error(s), Time Elapsed 00:00:02.40 |
| Контракты не разошлись с HEAD | `git diff --exit-code -- openapi packages/signalr-client/src/generated` | PASS, exit 0, вывод пустой |
| Генерация контрактов, прогон 1 | `pnpm generate:contracts`, 01:17:52–01:17:56 | PASS, exit 0. `[generate-contracts] generated 2 hooks, 5 hub methods and 5 hub events` |
| Генерация контрактов, прогон 2 | `pnpm generate:contracts`, 01:17:56–01:17:57 | PASS, exit 0. Вывод идентичен прогону 1; SHA-256 файлов не изменились, `git status` после генерации не изменился (раздел 2) |
| Разделение main/worker | `grep -q HubConnectionBuilder apps/web/dist/assets/index-*.js` | PASS. В `index-QOt2V5CQ.js` строка `HubConnectionBuilder` НЕ найдена; `entry-Cw2LtJX1.js` (57 687 байт) существует и содержит `HubConnectionBuilder`; в main-чанке ровно один `new Worker` |
| Чистый клон | `pnpm install --frozen-lockfile && pnpm build` | PASS, exit 0. Install 1.6 s, build 659 ms (раздел 6) |
| E2E серверной очереди | Node-клиент, long polling, порт 5001 | PASS по проверенным сценариям (раздел 5) |

Тестовые файлы: 11 в `apps/web` (4 entity-атома, 3 feature-атома, 4 утилиты `shared/lib`)
и 4 в `packages/signalr-client` (`lib/errors.test.ts`, `worker/runtime.test.ts`,
`worker/url.test.ts`, `worker/worker-client.test.ts`).

## 2. Идемпотентность генерации (SHA-256)

До прогонов `git diff --exit-code -- openapi packages/signalr-client/src/generated`
дал exit 0, то есть рабочие файлы совпадали с HEAD. После обоих прогонов хеши
совпали с HEAD побайтно; `git status --short` после генерации не изменился.

| Файл | До прогона (= HEAD) | После прогона 1 | После прогона 2 |
| --- | --- | --- | --- |
| `packages/signalr-client/src/generated/rest.ts` | `58b8325a2799ca150805d4ce4f3b6f678adb8d2f56a56ebf6e04c9f634d9d7dc` | `58b8325a2799ca150805d4ce4f3b6f678adb8d2f56a56ebf6e04c9f634d9d7dc` | `58b8325a2799ca150805d4ce4f3b6f678adb8d2f56a56ebf6e04c9f634d9d7dc` |
| `packages/signalr-client/src/generated/rest-hooks.ts` | `3bc1447acd4acff639939ad1e1e209d94c1a65444d1216482e0e5a6ab603e404` | `3bc1447acd4acff639939ad1e1e209d94c1a65444d1216482e0e5a6ab603e404` | `3bc1447acd4acff639939ad1e1e209d94c1a65444d1216482e0e5a6ab603e404` |
| `packages/signalr-client/src/generated/hub-contracts.ts` | `dc42ba23744b52c9d02d843bbadca66a92da02d8fedcfa84ad52835cb09ddf9d` | `dc42ba23744b52c9d02d843bbadca66a92da02d8fedcfa84ad52835cb09ddf9d` | `dc42ba23744b52c9d02d843bbadca66a92da02d8fedcfa84ad52835cb09ddf9d` |

Фактический состав сгенерированных контрактов:

- `rest.ts`: 16 интерфейсов, из них 13 прикладных схем OpenAPI (`ChatRoom`, `ChatMessage`,
  `ErrorResponse`, `ChatUser`, `SendMessageRequest`, `JoinRoomRequest`, `JoinRoomResult`,
  `SetNameRequest`, `LeaveRoomRequest`, `GetHistoryRequest`, `MessageHistory`,
  `UserJoinedEvent`, `UserLeftEvent`) и 3 клиентских (`FullRequestParams`, `ApiConfig`,
  `HttpResponse`).
- `rest-hooks.ts`: 2 хука — `useListRoomMessages`, `useListRooms`.
- `hub-contracts.ts`: 5 методов (`SendMessage`, `JoinRoom`, `SetName`, `LeaveRoom`,
  `GetHistory`) и 5 событий (`ReceiveMessage`, `MessageHistory`, `UserJoined`, `UserLeft`,
  `RoomUpdated`).
- Дублей `ChatRoom1`/`ChatMessage1`/`ErrorResponse1` в `rest.ts` нет.
- `negotiate` / `NegotiateResponse` не встречаются в `openapi/` и
  `packages/signalr-client/src/generated/`.
- `// @ts-nocheck` присутствует только в `generated/rest.ts`; в `rest-hooks.ts` и
  `hub-contracts.ts` маркера нет.

Исходные спеки: `openapi/rest.json` — 2 пути и 3 схемы; `openapi/signalr.json` —
10 схем, `x-signalr-hub` с 5 методами и 5 событиями. `openapi/merged.json` — 2 пути,
13 прикладных схем.

## 3. `git status --short`

На момент финального замера (до перезаписи этого отчёта) рабочее дерево чистое:

```text
(пусто)
```

Причина: четыре файла, которые в начале прогона были незакоммичены, во время прогона
были закоммичены внешним процессом (`8a4f62b`). После перезаписи этого файла ожидается
единственная строка ` M reports/qa-report.md` — это единственное изменение, внесённое QA.

Относительно `main` ветка содержит 49 файлов (`git diff --shortstat main...HEAD`:
`49 files changed, 3216 insertions(+), 406 deletions(-)`):

```text
M	.gitignore
A	.vscode/launch.json
M	AGENTS.md
M	README.md
M	apps/web/src/shared/api/signalr/index.ts
M	apps/web/vite.config.ts
A	docs/adr/0002-signalr-client-web-worker.md
A	docs/adr/0003-server-command-queue.md
M	docs/state-management.md
A	openapi/merged.json
R097	specs/rest.json	openapi/rest.json
R074	specs/signalr.json	openapi/signalr.json
M	package.json
M	packages/signalr-client/src/client.ts
M	packages/signalr-client/src/generated/hub-contracts.ts
M	packages/signalr-client/src/generated/rest-hooks.ts
M	packages/signalr-client/src/generated/rest.ts
M	packages/signalr-client/src/hooks.ts
M	packages/signalr-client/src/index.ts
M	packages/signalr-client/src/provider.tsx
A	packages/signalr-client/src/transport/types.ts
A	packages/signalr-client/src/worker/entry.ts
A	packages/signalr-client/src/worker/protocol.ts
A	packages/signalr-client/src/worker/runtime.test.ts
A	packages/signalr-client/src/worker/runtime.ts
A	packages/signalr-client/src/worker/url.test.ts
A	packages/signalr-client/src/worker/url.ts
A	packages/signalr-client/src/worker/worker-client.test.ts
A	packages/signalr-client/src/worker/worker-client.ts
M	reports/qa-report.md
A	scripts/dev-all.mjs
M	scripts/generate-contracts.ts
A	server/SignalRChat.Application/Abstractions/IChatStore.cs
A	server/SignalRChat.Application/Exceptions/ChatValidationException.cs
A	server/SignalRChat.Application/Services/ChatService.cs
A	server/SignalRChat.Application/SignalRChat.Application.csproj
A	server/SignalRChat.Domain/Entities/ChatEntities.cs
A	server/SignalRChat.Domain/SignalRChat.Domain.csproj
A	server/SignalRChat.Infrastructure/Persistence/InMemoryChatStore.cs
A	server/SignalRChat.Infrastructure/SignalRChat.Infrastructure.csproj
A	server/SignalRChat.Server/Contracts/ChatContracts.cs
A	server/SignalRChat.Server/Hubs/ChatHub.cs
A	server/SignalRChat.Server/Mapping/ContractMappings.cs
A	server/SignalRChat.Server/Program.cs
A	server/SignalRChat.Server/Properties/launchSettings.json
A	server/SignalRChat.Server/Queues/ChatWorkQueue.cs
A	server/SignalRChat.Server/Realtime/ChatRealtimeService.cs
A	server/SignalRChat.Server/SignalRChat.Server.csproj
A	server/SignalRChat.slnx
```

## 4. Worker-клиент SignalR

### 4.1 Архитектура

- Dedicated Web Worker: точка входа `packages/signalr-client/src/worker/entry.ts`
  вызывает `runChatWorker` из `worker/runtime.ts`; `HubConnection` создаётся и живёт
  только внутри Worker (`createChatHubConnection` из `../client`).
- Main thread общается с Worker через типизированный postMessage-протокол
  (`worker/protocol.ts`): `start` / `stop` / `invoke` → `status` / `event` /
  `invoke-result` / `invoke-error` / `stopped`.
- `WorkerHubClient` (`worker/worker-client.ts`) создаёт Worker через
  `new Worker(new URL('./entry.ts', import.meta.url), { type: 'module' })`.
- `SignalRProvider` принимает только `url` и создаёт `WorkerHubClient`; в публичном
  `packages/signalr-client/src/index.ts` нет `createChatHubConnection`, а
  `useSignalRStatus()` возвращает только `{ status, error }` (без `connection`).
- `apps/web/vite.config.ts` содержит `worker.format: 'es'`; сборка подтверждает
  разделение чанков (раздел 1).
- Исправление StrictMode-дефекта: `startedConnection` выставляется только после
  успешного `start()`; `handleStop` вызывает `connection.stop()` лишь если соединение
  действительно стартовало. При остановке во время negotiate Worker просто завершается,
  поэтому ошибка «The connection was stopped during negotiation» не возникает.
- Lifecycle-подписки (`onreconnecting`/`onreconnected`/`onclose`) и статусы перенесены
  из провайдера в `worker/runtime.ts`; поколение (`generation`) отсекает запоздавшие
  статусы старых соединений.

### 4.2 Что проверено

- `pnpm type-check`, `pnpm test`, `pnpm build` зелёные; Worker-логика покрыта
  `runtime.test.ts`, `url.test.ts`, `worker-client.test.ts` (всего 15 файлов / 96 тестов).
- В production-сборке `@microsoft/signalr` отсутствует в main-чанке и присутствует
  только в worker-чанке `entry-Cw2LtJX1.js` (57.68 kB).
- `dotnet build` сервера зелёный с 0 предупреждений и 0 ошибок.

## 5. Серверная очередь и E2E

### 5.1 Архитектура

- `ChatWorkQueue` (`server/SignalRChat.Server/Queues/ChatWorkQueue.cs`) —
  `BackgroundService` с `Channel.CreateBounded` ёмкостью 1024,
  `SingleReader = true`, `SingleWriter = false`, `FullMode = Wait`;
  `EnqueueAsync` использует `WriteAsync` (backpressure) и `TaskCompletionSource`,
  сохраняя тип исключения.
- `ChatRealtimeService` выполняет мутацию состояния, изменение групп и broadcast одной
  работой очереди для `SendMessage`, `JoinRoom`, `SetName`, `LeaveRoom`, `Disconnect`.
- `ChatHub` направляет мутации через `ExecuteAsync` → `ChatRealtimeService` → очередь;
  `GetHistory` и `OnConnectedAsync` остаются прямыми (вне очереди).
- При shutdown `StopAsync` вызывает `TryComplete()`, reader дочитывает остаток очереди;
  ожидающие вызовы не зависают.
- В `Program.cs` очередь зарегистрирована singleton и как hosted service; транспорт
  хаба ограничен `HttpTransportType.LongPolling`.

### 5.2 E2E серверной очереди (Node-клиент, long polling, порт 5001)

Окружение: Node.js 25.6.1, `@microsoft/signalr` 10.0.11, два клиента
(observer + основной), `transport: LongPolling`, URL `http://127.0.0.1:5001/hubs/chat`.
Dev-серверы на 5001/5176 не останавливались.

| Проверка | Фактический результат |
| --- | --- |
| Negotiate | `POST /hubs/chat/negotiate?negotiateVersion=1` → 200; `availableTransports` = только `[{"transport":"LongPolling","transferFormats":["Text","Binary"]}]` |
| Стартовые комнаты | При подключении пришли 3 события `RoomUpdated`: `general`/`support`/`random`; REST `/api/*` клиентом не вызывался |
| Чистый прогон в пустой комнате `support` (01:19:43–01:19:47) | Начальная история 0; `JoinRoom` → `memberCount: 1`; одно сообщение найдено в `GetHistory`; после 30 параллельных `SendMessage` история ровно **31**; `memberCount` после `stop` = **0**; история после `stop` = 31 |
| Ошибка валидации пустого текста | Текст `""` и `"   "` → сообщение содержит `HubException: Текст сообщения: значение обязательно.` |
| 30 параллельных `SendMessage` | 30 вызовов, 30 уникальных `id`; порядок в broadcast = порядок разрешения промисов = порядок входа = порядок в `GetHistory` (все четыре сравнения `true`) |
| Прогон в `general` на долгоживущем dev-сервере (01:19:26–01:19:29) | До прогона в истории уже было 33 сообщения (следы предыдущих проверок), `memberCount` 0; после `JoinRoom` — 1; добавлены 1 + 30 новых сообщений; итоговая история 64 (33 + 31), все 31 новые присутствуют и упорядочены; после `stop` `memberCount` = 0 |

Отклонение: ожидаемое «история 31 сообщение» на порту 5001 в комнате `general`
не воспроизводится без перезапуска dev-сервера (в истории уже было 33 сообщения;
перезапуск запрещён постановкой). Ровно 31 сообщение подтверждено в пустой комнате
`support` тем же сценарием.

Замечание по первому прогону: Node-скрипт первого прогона возвращал из обработчиков
`RoomUpdated` результат `Array.push()` (число), из-за чего клиент писал
`Result given for 'roomupdated' method but server is not expecting a result.`.
Это артефакт тестового скрипта, а не дефект приложения; повторный прогон с обработчиками,
возвращающими `void`, прошёл без единой записи в лог клиента.

### 5.3 E2E в браузере (предоставленные доказательства)

Результаты ниже предоставлены оркестратором (Chrome 155, CDP). В этом прогоне они
независимо не воспроизводились: запущенный Chrome использует `remote-debugging-pipe`,
TCP-эндпоинтов 9222/9223 нет, CLI `chrome-devtools` не установлен. Проверка версии
Chrome: `Google Chrome 155.0.8059.85`. Часть утверждений независимо подтверждена
протокольными проверками (negotiate и стартовые `RoomUpdated` — раздел 5.2).

- Ровно один dedicated worker-таргет `signalr-client` (`entry.ts`); после reload —
  один новый таргет.
- `POST /hubs/chat/negotiate` (4 запроса) и все long-polling `GET`/`POST`
  `/hubs/chat?id=...` (15/7) инициированы Worker-ом; страница делает только CORS
  `OPTIONS`.
- Negotiate отвечает только `LongPolling` (подтверждено также прямым запросом, раздел 5.2).
- Комнаты `general`/`support`/`random` приходят в теле long-poll событиями
  `RoomUpdated`; REST `/api/*` не вызывался.
- `SetName`, `JoinRoom`, `SendMessage` работают; после reload в ленте ровно 1 сообщение.
- При блокировке URL статус меняется «В сети» → «Переподключение…» → «В сети»,
  target Worker не меняется.
- После исправления: 0 записей в консоли Worker, 0 ошибок/предупреждений страницы;
  остаётся 404 `/favicon.ico` (известное замечание, не связано с задачей; подтверждено
  запросом к Vite dev-серверу: `GET http://localhost:5176/favicon.ico` → 404).

## 6. Проверка чистого клона

Копия репозитория создана в `/tmp/qa-clean-clone-2N7evn` через `rsync` с исключением
`node_modules`, `dist`, `.cache`, `.git`, `server/*/bin`, `server/*/obj`; размер 1.0 MB,
каталогов `node_modules`/`dist`/`.cache`/`.git` в копии нет. Копия сделана в 01:18:13,
до внешнего коммита в 01:18:54, но содержит те же изменённые файлы, что и коммит.

```bash
pnpm install --frozen-lockfile   # exit 0, Done in 1.6s, Packages: +329
pnpm build                       # exit 0, 131 modules transformed, vite built in 659ms
```

Установка использовала локальное хранилище pnpm
(`/Users/irek/Library/pnpm/store/v11`): `reused 329, downloaded 0` — сеть для пакетов
не использовалась. Поведение при полностью холодном store и без сети не проверялось.
Сборка в копии дала те же имена и размеры ассетов, что и в основном дереве
(`entry-Cw2LtJX1.js` 57.68 kB, `index-QOt2V5CQ.js` 251.15 kB, CSS 19.81 kB).

## 7. Definition of Done: подтверждено / не подтверждено

Подтверждено фактическими проверками:

- `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` — PASS; `pnpm verify` exit 0.
- `dotnet build server/SignalRChat.slnx` — PASS, 0 warnings, 0 errors.
- Нарушения `eslint-plugin-boundaries`: в выводе линта отсутствуют.
- Идемпотентность генерации контрактов: SHA-256 до и после двух прогонов совпадают;
  `git diff --exit-code -- openapi packages/signalr-client/src/generated` → 0.
- Сборка разделяет main- и worker-чанки: `HubConnectionBuilder` отсутствует в main
  и присутствует в `entry-*.js`.
- `pnpm install --frozen-lockfile && pnpm build` в чистой копии — PASS (с локальным
  pnpm-store).
- Серверная очередь: мутации сериализованы, порядок 30 параллельных `SendMessage`
  сохранён, `memberCount` меняется 1 → 0, пустой текст даёт `HubException`.
- Пустые `index.ts`: не найдены (0 файлов размера 0); `TODO`/`FIXME`/`stub` вне
  сгенерированных файлов не найдены.
- README содержит команды `pnpm install`, `pnpm dev`, `pnpm install && pnpm build`
  (строки 28, 30, 47).
- `docs/state-management.md` содержит сравнение Jotai / Zustand / Redux Toolkit / Valtio
  (раздел 2), правила Jotai (раздел 4) и каталог состояния (раздел 3).
- `AGENTS.md`, README, `docs/state-management.md`, ADR 0002/0003 обновлены под Worker
  и серверную очередь (записи в «Журнале решений» от 2026-10-23).
- `reports/qa-report.md` обновлён этим прогоном.

Не подтверждено / не проверялось в этом прогоне:

- C#-автотесты сервера отсутствуют: в `server/` не найдено тестовых проектов/xunit.
- Браузерные CDP-факты (один worker-таргет, инициатор запросов, reload, переходы
  статуса, чистая консоль) приняты как предоставленные доказательства и независимо
  не воспроизведены; CDP-эндпоинт в этом окружении недоступен.
- Cold-cache/no-network установка пакетов не проверялась; использовался локальный store.
- Покрытие тестами (coverage) не измерялось.
- Отсутствие прямых мутаций атомов из компонентов отдельной проверкой не измерялось.
- Отсутствие ручного дублирования типов OpenAPI отдельным аудитом не проверялось;
  подтверждено лишь отсутствие дублей в сгенерированных схемах.
- Нагрузочное поведение очереди при заполнении всех 1024 слотов и multi-instance
  сценарий не проверялись.

## 8. Известные риски

- Состояние и очередь in-memory: сообщения, комнаты и участники теряются при рестарте;
  очередь живёт в процессе.
- Single-instance: нет распределённой очереди/backplane, горизонтальное масштабирование
  сервера без внешнего хранилища невозможно.
- Head-of-line blocking: единственный reader очереди сериализует все мутации и broadcast;
  медленная рассылка задерживает остальные операции.
- Нет heartbeat между main thread и Worker: зависший/тихий Worker не детектируется
  (есть только таймаут остановки), соединение может выглядеть живым.
- `GetHistory` и `OnConnectedAsync` выполняются вне очереди: чтение не упорядочено
  относительно ещё не выполненных мутаций.
- Backpressure без таймаута: при заполненной очереди вызовы ждут освобождения слота
  неограниченно долго.
- 404 `/favicon.ico` в dev-режиме (Vite) — известное замечание, не связано с задачей.
- Отсутствие C#-автотестов: поведение хаба и очереди проверяется только E2E-скриптами.
- Проверка чистого клона опиралась на локальный pnpm-store; воспроизводимость с пустым
  store и без сети не подтверждена.
- `generated/rest.ts` содержит `// @ts-nocheck` (особенность `swagger-typescript-api`);
  ручные правки сгенерированных файлов запрещены.

## 9. Версии инструментов

| Инструмент | Версия |
| --- | --- |
| Node.js | 25.6.1 |
| pnpm | 11.21.0 (`packageManager`: `pnpm@11.21.0`) |
| .NET SDK | 10.0.301 |
| TypeScript | 5.9.3 |
| Vite | 8.3.5 |
| Vitest | 4.1.12 |
| ESLint | 10.13.0 |
| eslint-plugin-boundaries | 7.2.1 |
| eslint-plugin-react-hooks | 7.1.1 |
| typescript-eslint | 8.72.0 |
| tsx | 4.23.15 |
| React / React DOM | 19.3.1 / 19.3.1 |
| Jotai | 3.0.1 |
| @microsoft/signalr | 10.0.11 |
| @vitejs/plugin-react | 6.1.2 |
| swagger-typescript-api | 13.13.0 |
| openapi-merge-cli | 2.0.2 |
| @eslint/js | 10.0.1 |
| @types/node | 24.19.2 |
| globals | 17.13.0 |
| Google Chrome | 155.0.8059.85 |
