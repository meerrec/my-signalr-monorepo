# SignalR Chat Monorepo

Production-ready монорепозиторий real-time чата на SignalR: React 19, TypeScript, Vite 8
(Rolldown), Jotai 3, Feature-Sliced Design и единая OpenAPI-спецификация как источник
правды для контрактов.

## Стек

| Слой | Технология |
| --- | --- |
| Монорепозиторий | pnpm workspaces (`apps/*`, `packages/*`) |
| Приложение | React 19, TypeScript 5.9 strict |
| Сборка | Vite 8 + Rolldown (`build.sourcemap`) |
| Состояние | Jotai 3, атомы в `model/` каждого слайса |
| Real-time | `@microsoft/signalr` 10, HTTP long polling |
| Транспорт клиента | Dedicated Web Worker, типизированный postMessage-RPC |
| Сервер | ASP.NET Core 10 + SignalR, очередь `Channel` и `BackgroundService` |
| Архитектура | Feature-Sliced Design, публичные API слайсов |
| Контракты | OpenAPI 3.1, `openapi-merge-cli`, `swagger-typescript-api` |
| Тесты | Vitest, `createStore()` из `jotai/vanilla` |
| Линт | ESLint 10 flat config, `eslint-plugin-boundaries` |

Требования: Node.js >= 22.12, pnpm >= 11. Рекомендуется Node 24 LTS (см. `.nvmrc`).

## Быстрый старт

```bash
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` одной командой поднимает ASP.NET Core SignalR-хаб и Vite. Скрипт сам
выбирает свободные порты, подставляет `VITE_SIGNALR_URL` для приложения и печатает
фактические адреса (по умолчанию хаб — `http://localhost:5000/hubs/chat`, UI —
`http://localhost:5173`). Значение `VITE_SIGNALR_URL` из `.env` при этом перекрывается
адресом запущенного хаба.

OpenAPI хаба доступен по `/openapi/signalr-v1.json`, Swagger UI — `/signalr-swagger`.
Отдельный запуск сервера: `pnpm server`.

## Сборка

Одна команда с чистого клона:

```bash
pnpm install && pnpm build
```

Сборка не требует сети и не запускает кодогенерацию: сгенерированные контракты
закоммичены в `packages/signalr-client/src/generated/`.

## Docker

Два multi-stage образа и `docker-compose.yml`:

- `docker/server.Dockerfile` — SDK 10.0 → `dotnet publish` → runtime `aspnet:10.0`,
  запуск от встроенного пользователя `app`, healthcheck на `/`;
- `docker/web.Dockerfile` — Node 24 + pnpm → `vite build` → `nginx:stable-alpine`.

```bash
pnpm docker:up        # docker compose up --build
```

- UI: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/signalr-swagger`
- OpenAPI хаба: `http://localhost:8080/openapi/signalr-v1.json`
- REST: `http://localhost:8080/api/rooms`

nginx отдаёт статику и проксирует `/hubs/`, `/api/`, `/openapi/` и `/signalr-swagger`
в сервис `server`, поэтому браузер работает с одним origin и CORS не участвует.
Web собирается с относительным `VITE_SIGNALR_URL=/hubs/chat`; worker-клиент достраивает
адрес от `location.href` в main-потоке. Порт сервера наружу не публикуется.

Остановка: `pnpm docker:down`. Порт web-контейнера переопределяется через
`WEB_PORT=9090 pnpm docker:up`; адрес хаба в сборке — через
`DOCKER_SIGNALR_URL=https://chat.example.com/hubs/chat pnpm docker:up` (абсолютный
адрес подходит для хаба, развёрнутого отдельно от статики).

## Команды

| Команда | Назначение |
| --- | --- |
| `pnpm dev` | Одна команда: SignalR-сервер + Vite, свободные порты выбираются автоматически |
| `pnpm dev:web` | Только Vite dev-сервер приложения |
| `pnpm server` | Только ASP.NET Core SignalR-сервер (`server/SignalRChat.Server`) |
| `pnpm server:build` | Сборка решения `server/SignalRChat.slnx` |
| `pnpm build` | Тип-чек пакетов и production-сборка `apps/web` |
| `pnpm type-check` | TypeScript strict без эмита по всем воркспейсам |
| `pnpm test` | Все тесты Vitest |
| `pnpm test:watch` | Тесты в watch-режиме |
| `pnpm lint` | ESLint, включая FSD-границы |
| `pnpm generate:contracts` | Скачивание/слияние OpenAPI и генерация контрактов |
| `pnpm verify` | `lint` + `type-check` + `test` + `build` |
| `pnpm docker:build` | Сборка образов `server` и `web` |
| `pnpm docker:up` | Сборка и запуск через `docker compose` (UI на `:8080`) |
| `pnpm docker:down` | Остановка и удаление контейнеров compose |

## Структура

```text
.
├── apps/
│   └── web/                      # React-приложение
│       └── src/
│           ├── app/              # провайдеры, стили, корневой App
│           ├── pages/            # страницы
│           ├── widgets/          # самостоятельные UI-блоки
│           ├── features/         # SendMessage, JoinRoom, SetName
│           ├── entities/         # Message, User, Room, Session
│           └── shared/           # UI-кит, API, config, lib
├── packages/
│   ├── shared-types/             # типы, не генерируемые из OpenAPI
│   └── signalr-client/           # worker-мост, провайдер, хуки, generated
├── server/
│   ├── SignalRChat.slnx
│   ├── SignalRChat.Domain/       # сущности чата
│   ├── SignalRChat.Application/  # use cases и порты (IChatStore)
│   ├── SignalRChat.Infrastructure/ # in-memory реализация хранилища
│   └── SignalRChat.Server/       # composition root: Hub, REST, очереди (Queues/, Realtime/)
├── openapi/                      # rest.json, signalr.json, merged.json (OpenAPI 3.1)
├── scripts/generate-contracts.ts # пайплайн контрактов
├── docs/                         # state-management.md, ADR
└── AGENTS.md                     # топология субагентов и контракты
```

Сервер построен по Clean Architecture: `Domain ← Application ← Infrastructure`,
`Server` — composition root и слой доставки (Hub + REST).

## Feature-Sliced Design

Слои: `app → pages → widgets → features → entities → shared`.

- Кросс-слайсовые импорты только через `index.ts` слайса.
- Импорты вниз разрешены, «вбок» между разными слайсами и «вверх» запрещены.
- Циклы запрещены.
- Сегменты слайса: `ui/`, `model/`, `api/`, `lib/`, `config/`.
- Границы проверяет `eslint-plugin-boundaries` (`pnpm lint`).

## Состояние на Jotai

- Примитивные атомы (`atom(initialValue)`) хранят базовое состояние.
- Производные атомы (`atom(get => ...)`) вычисляют селекторы.
- Атомы-действия (`atom(null, (get, set, payload) => ...)`) — единственная точка мутации.
- Компоненты читают через `useAtomValue`, пишут через `useSetAtom` и действия.
- Мега-атомы на всё приложение запрещены.
- `messagesByRoomAtom` + локальная typed atom family (Map-cache) изолируют сообщения комнат.

Соединение SignalR живёт в dedicated Web Worker: main thread получает статусы и события
через `SignalRProvider` → `useChatEvent` → action-атомы, сам `HubConnection` в приложение
не попадает. Серверные мутации сериализуются очередью `ChatWorkQueue`, поэтому состояние
и broadcast меняются строго в порядке поступления.

Подробности и сравнение с Zustand/Redux/Valtio: [docs/state-management.md](docs/state-management.md).

## Контракты OpenAPI и SignalR

Источник правды:

- `openapi/rest.json` — REST API.
- `openapi/signalr.json` — SignalR Hub (`x-signalr-hub`) и связанные схемы.
- `openapi/merged.json` — результат слияния, пересоздаётся генератором.

Пайплайн:

```text
openapi/rest.json + openapi/signalr.json
  → openapi-merge-cli → openapi/merged.json
  → swagger-typescript-api → generated/rest.ts
  → generate-contracts.ts (reactHooks: true) → generated/rest-hooks.ts
  → generate-contracts.ts → generated/hub-contracts.ts
```

`swagger-typescript-api` 13.13 не содержит встроенного флага `reactHooks`, поэтому
`scripts/generate-contracts.ts` реализует этот режим сам: CLI генерирует `Api` и
data-контракты, а скрипт выпускает типизированные React-хуки из той же merged-спеки.

Сгенерированные файлы не редактируются руками. Типы из OpenAPI не дублируются:
сущности и фичи импортируют их из `@chat/signalr-client`, а типизированные
SignalR-обёртки (`useChatEvent`, `useChatInvoke`, `useChatConnectionStatus`) —
через `shared/api/signalr`.

Обновление контрактов:

```bash
pnpm generate:contracts
```

При необходимости можно указать удалённые спеки через `SIGNALR_OPENAPI_URL` и
`REST_OPENAPI_URL`; иначе используются локальные файлы из `openapi/`.

## Тестирование

```bash
pnpm test
```

Атомы тестируются без React через `createStore()` из `jotai/vanilla`, транспорт
SignalR внедряется в action-атомы как `invoke`, поэтому тесты не требуют хаба.
Мост Worker↔main и рантайм воркера покрыты юнит-тестами на фейковых `Worker` и соединении.

## Документация

- [AGENTS.md](AGENTS.md) — топология субагентов, зоны ответственности, контракты.
- [docs/state-management.md](docs/state-management.md) — Jotai, карта состояния, правила.
- [docs/adr/0001-fsd-boundaries.md](docs/adr/0001-fsd-boundaries.md) — FSD-границы и ESLint.
- [docs/adr/0002-signalr-client-web-worker.md](docs/adr/0002-signalr-client-web-worker.md) — SignalR в Web Worker.
- [docs/adr/0003-server-command-queue.md](docs/adr/0003-server-command-queue.md) — серверная очередь и BackgroundService.

## Ограничения демо

- SignalR-сервер входит в репозиторий (`server/`), но состояние и очередь живут in-memory:
  при рестарте история и необработанные операции теряются, несколько инстансов не согласуются.
- Аутентификация не реализована; история ограничена временем жизни процесса.
- Транспорт ограничен HTTP long polling на клиенте и сервере: задержки выше, чем у WebSocket.
- Тихая смерть Worker без события `error` не детектируется — heartbeat не реализован.
