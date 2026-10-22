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
| Real-time | `@microsoft/signalr` 10 |
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

Dev-сервер: http://localhost:5173. URL SignalR-хаба задаётся переменной
`VITE_SIGNALR_URL` (по умолчанию `http://localhost:5000/hubs/chat`).

## Сборка

Одна команда с чистого клона:

```bash
pnpm install && pnpm build
```

Сборка не требует сети и не запускает кодогенерацию: сгенерированные контракты
закоммичены в `packages/signalr-client/src/generated/`.

## Команды

| Команда | Назначение |
| --- | --- |
| `pnpm dev` | Запуск Vite dev-сервера приложения |
| `pnpm build` | Тип-чек пакетов и production-сборка `apps/web` |
| `pnpm type-check` | TypeScript strict без эмита по всем воркспейсам |
| `pnpm test` | Все тесты Vitest |
| `pnpm test:watch` | Тесты в watch-режиме |
| `pnpm lint` | ESLint, включая FSD-границы |
| `pnpm generate:contracts` | Скачивание/слияние OpenAPI и генерация контрактов |
| `pnpm verify` | `lint` + `type-check` + `test` + `build` |

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
│   └── signalr-client/           # провайдер, типизированные хуки, generated
├── specs/                        # rest.json + signalr.json (OpenAPI 3.1)
├── scripts/generate-contracts.ts # пайплайн контрактов
├── docs/                         # state-management.md, ADR
└── AGENTS.md                     # топология субагентов и контракты
```

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

Подробности и сравнение с Zustand/Redux/Valtio: [docs/state-management.md](docs/state-management.md).

## Контракты OpenAPI и SignalR

Источник правды:

- `specs/rest.json` — REST API.
- `specs/signalr.json` — SignalR Hub (`x-signalr-hub`) и связанные схемы.

Пайплайн:

```text
specs/*.json
  → openapi-merge-cli → .cache/merged-openapi.json
  → swagger-typescript-api → generated/rest.ts
  → generate-contracts.ts (reactHooks: true) → generated/rest-hooks.ts
  → generate-contracts.ts → generated/hub-contracts.ts
```

`swagger-typescript-api` 13.13 не содержит встроенного флага `reactHooks`, поэтому
`scripts/generate-contracts.ts` реализует этот режим сам: CLI генерирует `Api` и
data-контракты, а скрипт выпускает типизированные React-хуки из той же merged-спеки.

Сгенерированные файлы не редактируются руками. Типы из OpenAPI не дублируются:
сущности и фичи импортируют их через `shared/api/signalr`.

Обновление контрактов:

```bash
pnpm generate:contracts
```

При необходимости можно указать удалённые спеки через `SIGNALR_OPENAPI_URL` и
`REST_OPENAPI_URL`; иначе используются локальные файлы из `specs/`.

## Тестирование

```bash
pnpm test
```

Атомы тестируются без React через `createStore()` из `jotai/vanilla`, транспорт
SignalR внедряется в action-атомы как `invoke`, поэтому тесты не требуют хаба.

## Документация

- [AGENTS.md](AGENTS.md) — топология субагентов, зоны ответственности, контракты.
- [docs/state-management.md](docs/state-management.md) — Jotai, карта состояния, правила.
- [docs/adr/0001-fsd-boundaries.md](docs/adr/0001-fsd-boundaries.md) — FSD-границы и ESLint.

## Ограничения демо

- SignalR-сервер в репозиторий не входит. Без него приложение рендерится,
  но показывает статус соединения `error`/`disconnected`.
- Аутентификация и хранение истории на сервере не реализованы: контракты описывают
  точки интеграции, а состояние живёт в Jotai.
