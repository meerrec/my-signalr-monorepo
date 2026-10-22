# AGENTS.md — SignalR Chat Monorepo

Статус: **v1, заморожен до прохождения QA**.
Владелец документа: `@architect`. Арбитр конфликтов: оркестратор.
Документ описывает топологию субагентов, зоны записи, замороженные контракты и правила,
которые обязаны соблюдать все агенты. Любое изменение контракта ниже требует явного
решения оркестратора и записи в разделе «Журнал решений».

## 1. Цель и незыблемые ограничения

Сгенерировать production-ready монорепозиторий чата на SignalR со сборкой одной командой:

```bash
pnpm install && pnpm build
```

Ограничения:

1. Feature-Sliced Design с публичными API `index.ts` у каждого слайса.
2. Импорты только вниз по слоям FSD. «Вбок» и «вверх» запрещены. Циклы запрещены.
3. Единая OpenAPI-спецификация — источник правды для REST- и SignalR-контрактов.
4. Состояние — только Jotai с гранулярными атомами в `model/` слайсов.
5. Никаких Zustand, MobX, Valtio, Redux Toolkit.
6. Никаких мега-атомов вида `appStateAtom`.
7. Компоненты не мутируют атомы напрямую: только через атомы-действия.
8. В `vite.config.ts` используется `build.rolldownOptions`, не `rollupOptions`; sourcemap задаётся через `build.sourcemap` (Vite 8 не поддерживает `rolldownOptions.output.sourcemap`).
9. Сгенерированные из OpenAPI типы не дублируются руками.
10. В `index.ts` нет заглушек, только реальные реэкспорты.
11. `pnpm install && pnpm build` обязан работать с чистого клона без сетевого доступа
    к SignalR-серверу: сгенерированные контракты коммитятся в репозиторий.

## 2. Топология субагентов (supervisor)

```text
                    ┌──────────────────────┐
                    │     Оркестратор      │
                    │  контракты, арбитраж │
                    └──────────┬───────────┘
         ┌───────────┬─────────┼──────────┬────────────┬──────────┐
         ▼           ▼         ▼          ▼            ▼          ▼
   @architect  @infra  @signalr-integrator  @state-manager  @ui-builder  @qa
```

Каждый субагент получает только свою постановку и свою зону записи. Чужие файлы не читает
целиком: только `grep` и участки через `sed -n`/`head`/`tail` при необходимости.

| Субагент | Вход | Выход | Критерий готовности |
| --- | --- | --- | --- |
| `@architect` | Черновик AGENTS.md, FSD-требования | Финальный AGENTS.md, `eslint.config.js` с `eslint-plugin-boundaries`, ADR | Ноль нарушений границ |
| `@state-manager` | Список слайсов, контракт атомов | `docs/state-management.md`, атомы в `model/`, тесты атомов через `createStore()` | Все атомы изолированы в слайсах, мега-атомов нет |
| `@signalr-integrator` | OpenAPI-спеки, `packages/*`, сервер | `openapi/**`, `server/**`, `scripts/generate-contracts.ts`, `packages/signalr-client`, `packages/shared-types` | Type-safe вызовы и подписки, генерация воспроизводима |
| `@ui-builder` | Публичные API слайсов, дизайн-токены | `shared/ui`, `app/providers`, `widgets`, `pages`, UI/API-сегменты слайсов | Компоненты собираются без циклов |
| `@infra` | Технологический стек | Корневые манифесты, `vite.config.ts`, tsconfig, workspace, скрипты | `pnpm build` зелёный с чистого клона |
| `@qa` | Код всех субагентов | `reports/qa-report.md`, список дефектов | `lint`, `type-check`, `test`, `build` зелёные |

## 3. Зоны записи (ownership)

Правило: **только владелец пишет файлы в своей зоне**. Пересечение зон запрещено.
Если для слайса нужна правка в чужой зоне, агент сообщает об этом оркестратору.

| Зона | Владелец |
| --- | --- |
| `AGENTS.md`, `eslint.config.js`, `docs/adr/**` | `@architect` |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.npmrc`, `.gitignore`, `vitest.config.ts`, `apps/web/{package.json,vite.config.ts,tsconfig.json,tsconfig.node.json,index.html}` | `@infra` |
| `openapi/**`, `scripts/**`, `packages/shared-types/**`, `packages/signalr-client/**` | `@signalr-integrator` |
| `server/**` | `@signalr-integrator` |
| `apps/web/src/entities/*/model/**`, `apps/web/src/features/*/model/**`, `docs/state-management.md` | `@state-manager` |
| `apps/web/src/app/**`, `apps/web/src/pages/**`, `apps/web/src/widgets/**`, `apps/web/src/shared/{ui,lib,config}/**`, `apps/web/src/entities/*/{api,ui}/**`, `apps/web/src/features/*/{api,ui}/**` | `@ui-builder` |
| `apps/web/src/shared/api/**` | `@signalr-integrator` |
| `README.md` | `@infra` (финальная вычитка оркестратором) |
| `reports/**` | `@qa` |

Тесты:

- тесты атомов и селекторов лежат рядом с `model/` и принадлежат `@state-manager`;
- тесты утилит/провайдера SignalR лежат рядом с исходником и принадлежат владельцу файла;
- `@qa` только запускает проверки и пишет отчёт, код не правит.

## 4. Замороженный контракт пакетов

Пакеты — source-first workspace-пакеты: `exports` указывают на `src/*.ts`, отдельного
`dist` нет. Vite собирает их исходники. Скрипт `build` пакета = `tsc --noEmit`.

### 4.1 `@chat/shared-types`

Только типы и константы, которые **не** генерируются из OpenAPI:

```ts
export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type AsyncStatus = 'idle' | 'pending' | 'success' | 'error';
export type EntityId = string;

export interface AppError {
  code: string;
  message: string;
}
```

### 4.2 `@chat/signalr-client`

Публичный API пакета:

```ts
export * from './generated/rest';          // сгенерировано swagger-typescript-api
export * from './generated/hub-contracts'; // сгенерировано из x-signalr-hub
export { SignalRProvider } from './provider';
export type { SignalRProviderProps, SignalRContextValue } from './provider';
export { useSignalRContext, useSignalRStatus, useHubEvent, useHubInvoke } from './hooks';
export type { SignalRClient, SignalRStatusSnapshot } from './transport/types';
export { toErrorMessage } from './lib/errors';
export * from './generated/rest-hooks';          // сгенерировано scripts/generate-contracts.ts
```

Соединение создаётся и живёт только в dedicated Web Worker (`worker/entry.ts`):
main thread общается с ним через `SignalRClient` (`WorkerHubClient`, postMessage-RPC).
`client.ts` с `createChatHubConnection` — внутренний модуль worker-графа и не входит
в публичный API, иначе runtime `@microsoft/signalr` попадёт в main-чанк.
`SignalRProvider` принимает только `url`; `HubConnection` в приложение не передаётся.

Хуки:

```ts
function useSignalRStatus(): {
  status: ConnectionStatus;
  error: string | null;
};

function useHubEvent<K extends HubEventName>(
  event: K,
  handler: (payload: HubEventMap[K]) => void,
): void;

function useHubInvoke<K extends HubMethodName>(
  method: K,
): (request: HubMethodMap[K]['request']) => Promise<HubMethodMap[K]['response']>;
```

`apps/web/src/shared/api/**` принадлежит `@signalr-integrator`: реэкспорт типов и провайдера из пакета, типизированные обёртки `useChatEvent`, `useChatInvoke`, `useChatConnectionStatus`.

### 4.3 Контракт SignalR-хаба

Хаб: `ChatHub`, маршрут `/hubs/chat`. Метаданные хранятся в `openapi/signalr.json`
в корневом расширении `x-signalr-hub` (переживает merge через отдельное чтение спеки).

| Метод | Request | Response |
| --- | --- | --- |
| `SendMessage` | `SendMessageRequest` | `ChatMessage` |
| `JoinRoom` | `JoinRoomRequest` | `JoinRoomResult` |
| `SetName` | `SetNameRequest` | `ChatUser` |
| `LeaveRoom` | `LeaveRoomRequest` | `void` |
| `GetHistory` | `GetHistoryRequest` | `MessageHistory` |

| Событие | Payload |
| --- | --- |
| `ReceiveMessage` | `ChatMessage` |
| `MessageHistory` | `MessageHistory` |
| `UserJoined` | `UserJoinedEvent` |
| `UserLeft` | `UserLeftEvent` |
| `RoomUpdated` | `ChatRoom` |

Схемы OpenAPI: `ChatUser {id, name}`, `ChatRoom {id, name, memberCount}`,
`ChatMessage {id, roomId, authorId, authorName, text, sentAt}`,
`SendMessageRequest {roomId, text}`, `JoinRoomRequest {roomId, userName}`,
`JoinRoomResult {room, user}`, `SetNameRequest {name}`, `LeaveRoomRequest {roomId}`,
`GetHistoryRequest {roomId}`, `MessageHistory {roomId, messages}`,
`UserJoinedEvent {roomId, user}`, `UserLeftEvent {roomId, userId}`,
`ErrorResponse {code, message}`.

REST-пути объявлены в `openapi/rest.json`:

- `GET /api/rooms` → `ChatRoom[]`
- `GET /api/rooms/{roomId}/messages` → `ChatMessage[]`

## 5. Замороженный контракт состояния (Jotai)

Атомы создаются только в `model/` соответствующего слайса и экспортируются только через
`index.ts` слайса. Действия — единственный способ менять примитивные атомы из UI.

### 5.1 Слой entities

`entities/session`:

```ts
connectionStatusAtom: PrimitiveAtom<ConnectionStatus>
connectionErrorAtom: PrimitiveAtom<string | null>
isConnectedAtom: Atom<boolean> // derived
setConnectionStatusActionAtom: ActionAtom<{ status: ConnectionStatus; error: string | null }>
```

`entities/user`:

```ts
currentUserAtom: PrimitiveAtom<ChatUser | null>
usersByIdAtom: PrimitiveAtom<Record<string, ChatUser>>
usersAtom: Atom<ChatUser[]> // derived, сортировка по name
usersCountAtom: Atom<number> // derived
setCurrentUserActionAtom: ActionAtom<ChatUser | null>
upsertUserActionAtom: ActionAtom<ChatUser>
removeUserActionAtom: ActionAtom<string>
```

`entities/room`:

```ts
roomsByIdAtom: PrimitiveAtom<Record<string, ChatRoom>>
currentRoomIdAtom: PrimitiveAtom<string | null>
currentRoomAtom: Atom<ChatRoom | null> // derived
roomsAtom: Atom<ChatRoom[]> // derived, сортировка по name
upsertRoomActionAtom: ActionAtom<ChatRoom>
selectCurrentRoomActionAtom: ActionAtom<string | null>
```

`entities/message`:

```ts
messagesByRoomAtom: PrimitiveAtom<Record<string, Record<string, ChatMessage>>>
messagesForRoomAtom: AtomFamily<string, ChatMessage[]> // локальная typed atom family (Map-cache), сортировка по sentAt и id
messageCountForRoomAtom: AtomFamily<string, number> // локальная typed atom family (Map-cache)
upsertMessageActionAtom: ActionAtom<ChatMessage> // upsert по id
upsertMessagesActionAtom: ActionAtom<ChatMessage[]> // batch upsert
clearRoomMessagesActionAtom: ActionAtom<string>
```

### 5.2 Слой features

`features/send-message`:

```ts
messageDraftAtom: PrimitiveAtom<string>
sendMessageStatusAtom: PrimitiveAtom<AsyncStatus>
sendMessageErrorAtom: PrimitiveAtom<string | null>
changeMessageDraftActionAtom: ActionAtom<string>
sendMessageActionAtom: ActionAtom<{ invoke: SendMessageInvoker }>
```

`features/join-room`:

```ts
joinRoomIdDraftAtom: PrimitiveAtom<string>
joinRoomUserNameDraftAtom: PrimitiveAtom<string>
joinRoomStatusAtom: PrimitiveAtom<AsyncStatus>
joinRoomErrorAtom: PrimitiveAtom<string | null>
changeJoinRoomIdActionAtom: ActionAtom<string>
changeJoinRoomUserNameActionAtom: ActionAtom<string>
joinRoomActionAtom: ActionAtom<{ invoke: JoinRoomInvoker }>
```

`features/set-name`:

```ts
nameDraftAtom: PrimitiveAtom<string>
setNameStatusAtom: PrimitiveAtom<AsyncStatus>
setNameErrorAtom: PrimitiveAtom<string | null>
changeNameDraftActionAtom: ActionAtom<string>
setNameActionAtom: ActionAtom<{ invoke: SetNameInvoker }>
```

Типы инвокеров:

```ts
type SendMessageInvoker = (request: SendMessageRequest) => Promise<ChatMessage>;
type JoinRoomInvoker = (request: JoinRoomRequest) => Promise<JoinRoomResult>;
type SetNameInvoker = (request: SetNameRequest) => Promise<ChatUser>;
```

Поведение действий:

- валидируют ввод до вызова транспорта;
- выставляют `pending`, затем `success` или `error`;
- ошибки транспорта преобразуются через `getErrorMessage` и не выбрасываются наружу;
- при успехе обновляют только свои данные и данные нижележащих entities через их action-атомы;
- `sendMessageActionAtom` очищает черновик при успехе;
- `joinRoomActionAtom` выбирает комнату, сохраняет `room` и `user`;
- `setNameActionAtom` обновляет `currentUserAtom` и `usersByIdAtom`.

### 5.3 Интеграция SignalR с состоянием

- Подписки на события хаба живут в `api/` сегментах entities и вызывают action-атомы
  через `useSetAtom`.
- Соединение живёт в Web Worker; main thread получает события и статусы через
  `SignalRClient` из контекста провайдера. `useHubEvent` регистрируется в эффектах детей
  раньше `start()` провайдера, поэтому стартовые `RoomUpdated` не теряются.
- `ReceiveMessage` → `upsertMessageActionAtom`.
- `MessageHistory` → `upsertMessagesActionAtom`.
- `UserJoined` → `upsertUserActionAtom`.
- `UserLeft` → `removeUserActionAtom`.
- `RoomUpdated` → `upsertRoomActionAtom`.
- Статус соединения попадает в `entities/session` через `SignalRStateBridge`
  в `app/providers/`, который вызывает `setConnectionStatusActionAtom`.
- В компонентах используется `useAtomValue` для чтения и `useSetAtom` для записи.
  `useAtom` допускается только когда нужны и чтение, и запись.

## 6. Замороженный контракт UI

`shared/ui` (публичный API `shared/ui/index.ts`):

- `Button`: `variant: 'primary' | 'secondary' | 'ghost' | 'danger'`, `size: 'sm' | 'md'`,
  `loading?: boolean`, `fullWidth?: boolean`.
- `Input`: `label?: string`, `error?: string`, `hint?: string`, остальные пропсы
  `InputHTMLAttributes<HTMLInputElement>`.
- `Textarea`: `label?: string`, `error?: string`, остальные пропсы
  `TextareaHTMLAttributes<HTMLTextAreaElement>`.
- `Avatar`: `name: string`, `size?: 'sm' | 'md' | 'lg'`.
- `Badge`: `tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'`, `dot?: boolean`.
- `Spinner`: `size?: 'sm' | 'md'`.
- `Panel`: `title?: string`, `actions?: ReactNode`, `className?: string`, `children`.

`shared/lib`:

- `cn(...values: Array<string | false | null | undefined>): string`
- `formatTime(iso: string): string`
- `getInitials(name: string): string`
- `getErrorMessage(error: unknown, fallback?: string): string`

`shared/config`:

- `env.signalRUrl`, `env.appName`; URL по умолчанию `http://localhost:5000/hubs/chat`.

`shared/api/signalr`:

- реэкспорт типов и провайдера из `@chat/signalr-client`;
- типизированные обёртки `useChatEvent` и `useChatInvoke`;
- `useChatConnectionStatus` для UI.

## 7. FSD и границы

Слои сверху вниз: `app → pages → widgets → features → entities → shared`.

- Кросс-слайсовый импорт только через `index.ts` слайса.
- Внутри слайса допустимы относительные импорты между сегментами.
- `shared` не импортирует другие слои.
- Пакеты `packages/*` не импортируют `apps/web`.
- Границы проверяет `eslint-plugin-boundaries`; элемент = папка слайса.
- Тесты (`*.test.ts(x)`) исключены из проверки границ.
- Запрещены циклические зависимости.

## 8. Технологический стек и команды

- pnpm workspaces: `apps/*`, `packages/*`.
- Vite 8 (Rolldown), React 19, TypeScript strict.
- Jotai 3; `Provider` в `app/providers/`.
- SignalR: `@microsoft/signalr`.
- Сервер: ASP.NET Core 10 + SignalR + `SignalR.OpenApi` (`server/SignalRChat.Server`), состояние in-memory.
  Слои: `SignalRChat.Domain` ← `SignalRChat.Application` ← `SignalRChat.Infrastructure`;
  `SignalRChat.Server` — composition root, Hub и REST. Мутации и рассылки сериализуются
  очередью `ChatWorkQueue` (`Channel` + `BackgroundService`, bounded 1024, single reader).
- SignalR-клиент: dedicated Web Worker, `worker.format: 'es'`, типизированный postMessage-RPC;
  runtime `@microsoft/signalr` не попадает в main-чанк.
- OpenAPI: `swagger-typescript-api` + `openapi-merge-cli`. В версии 13.13 у генератора нет
  встроенного флага `reactHooks`, поэтому `scripts/generate-contracts.ts` реализует режим
  `reactHooks: true` сам: генерирует `Api` и типы через CLI, затем выпускает типизированные
  React-хуки в `generated/rest-hooks.ts` из той же merged-спеки.
- Тесты: Vitest, атомы через `createStore()` из `jotai/vanilla`.
- Линт: ESLint flat config + `typescript-eslint` + `eslint-plugin-boundaries`.

Команды:

```bash
pnpm install
pnpm dev
pnpm build
pnpm type-check
pnpm test
pnpm lint
pnpm generate:contracts
pnpm verify
```

`pnpm build` не запускает генерацию контрактов и не требует сети. Генерация — отдельная
команда, её результат коммитится.

## 9. Протокол делегирования

1. Один субагент — один слайс или одна инфраструктурная задача.
2. В постановке перечисляются: цель, точные файлы для записи, файлы, которые трогать нельзя,
   готовые контракты, команды проверки.
3. Читать большие файлы целиком запрещено. Поиск через `grep`/`rg`, чтение участками
   `sed -n`, `head`, `tail`.
4. Если слайс велик, субагент обязан дробить его и передавать подзадачи своим субагентам.
   Это ожидаемое поведение, а не признак невыполнения.
5. Запрещено менять корневые манифесты и lockfile без роли `@infra`.
6. Запрещено форматировать или рефакторить чужие файлы.
7. Результат субагента: список созданных файлов, выполненные проверки, известные риски.
8. Оркестратор собирает выходы, разрешает конфликты и запускает `@qa` последним.

## 10. Definition of Done

- `pnpm install && pnpm build` с чистого клона завершается успешно.
- `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` зелёные.
- Ноль нарушений `eslint-plugin-boundaries`.
- Нет заглушек и пустых `index.ts`.
- Нет дублирования типов, сгенерированных из OpenAPI.
- Нет прямых мутаций атомов из компонентов.
- В main-чанке нет runtime `@microsoft/signalr`; worker-ассет собирается Vite.
- Серверная очередь дренируется при shutdown: ожидающие вызовы не зависают.
- README содержит одну команду сборки и одну команду запуска dev.
- `docs/state-management.md` содержит сравнение Jotai с Zustand/Redux/Valtio,
  правила атомов и карту состояния.
- `reports/qa-report.md` содержит вывод проверок и версии инструментов.

## 11. Журнал решений

| Дата | Решение | Причина |
| --- | --- | --- |
| 2026-10-22 | Source-first workspace-пакеты без `dist` | Vite собирает TS-исходники; меньше шагов сборки, нет рассинхрона |
| 2026-10-22 | Один Vite-конфиг в `apps/web`, `vitest.config.ts` в корне | Единый прогон тестов для app и packages |
| 2026-10-22 | `messagesByRoomAtom` + локальная typed atom family для сообщений | Изоляция комнат без мега-атома и без sideways-импортов |
| 2026-10-22 | Транспорт внедряется в action-атом параметром `invoke` | Атомы тестируются без React и SignalR |
| 2026-10-22 | Локальная typed atom family в `entities/message/model` вместо `atomFamily` | Jotai 3 удалил `atomFamily`; контракт имён сохранён без downgrade Jotai |
| 2026-10-22 | Внешнее `connection` провайдер запускает, но не останавливает и не перезапускает | Владелец соединения управляет жизненным циклом; провайдер только наблюдает |
| 2026-10-22 | `sourcemap` в `vite.config.ts` перенесён из `rolldownOptions.output` в `build.sourcemap` | Vite 8 не поддерживает `rolldownOptions.output.sourcemap` (warning); `rollupOptions` по-прежнему не используется |
| 2026-10-22 | Публичный API `@chat/signalr-client` дополнен `generated/rest-hooks` и типами `SignalRProviderProps`/`SignalRContextValue` | §4.2 отставал от фактического экспорта; типы нужны `shared/api`, хуки генерируются по §8 |
| 2026-10-22 | Из `openapi/signalr.json` удалены negotiate-путь, `NegotiateResponse` и схемы-алиасы `ChatRoom`/`ChatMessage`/`ErrorResponse` | §4.3 не описывает negotiate; дубли давали `ChatRoom1`/`ChatMessage1`/`ErrorResponse1` в `generated/rest.ts` |
| 2026-10-22 | Lifecycle-подписки провайдера снимаются диспетчером с `WeakMap`, а не `connection.off` | в `@microsoft/signalr@10.0.11` `off` не удаляет колбэки `onreconnecting`/`onreconnected`/`onclose`; иначе StrictMode копит обработчики |
| 2026-10-22 | Статус внешнего соединения в `Connecting` синхронизируется опросом состояния (200 мс) | события `onconnected` в SignalR нет — статус залипал в `connecting` |
| 2026-10-22 | В `build` добавлен `rolldownOptions` | приведение `vite.config.ts` к правилу 8; `rollupOptions` отсутствует, sourcemap остаётся в `build.sourcemap` |
| 2026-10-22 | `ChatRoom.memberCount` сделан обязательным в `openapi/rest.json` и сгенерированных контрактах | Поле перечислено в контракте §4.3 и всегда передаётся UI и тестами; необязательность расходилась с фактическим использованием |
| 2026-10-23 | Спеки перенесены из `specs/` в `openapi/`; merged-спека сохраняется в `openapi/merged.json` | Единая точка хранения контрактов и результата слияния в дереве |
| 2026-10-23 | Добавлен ASP.NET Core сервер `server/SignalRChat.Server` с SignalR.OpenApi | Контракт §4.3 требует реального хаба для интеграции; OpenAPI хаба генерируется из кода |
| 2026-10-23 | Сервер хранит состояние in-memory и работает без БД | Dev-сценарий и интеграционные проверки; контракт не описывает персистентность |
| 2026-10-23 | Сервер разложен по Clean Architecture: Domain / Application / Infrastructure / Server | Изоляция контрактов хаба от use cases и хранилища; composition root только в Server |
| 2026-10-23 | `pnpm dev` запускает сервер и Vite одной командой, порты выбираются автоматически | Локальный запуск без ручной синхронизации `VITE_SIGNALR_URL` и портов |
| 2026-10-23 | Транспорт SignalR ограничен HTTP long polling: `transport` в клиенте и `HttpConnectionDispatcherOptions.Transports` на сервере | WebSockets и SSE не должны использоваться ни клиентом, ни сервером |
| 2026-10-23 | SignalR-соединение перенесено в dedicated Web Worker; main thread общается через `SignalRClient` (postMessage-RPC) | Сеть не занимает main thread; тихий worker без heartbeat — известное ограничение демо |
| 2026-10-23 | `SignalRProvider` принимает только `url`; `createChatHubConnection` убран из публичного API, `useSignalRStatus` больше не отдаёт `connection` | В worker-режиме `HubConnection` на main thread нет; статический re-export фабрики затянул бы `@microsoft/signalr` в main-чанк |
| 2026-10-23 | Lifecycle-подписки и опрос `Connecting` переехали из провайдера в `worker/runtime.ts`; WeakMap-диспетчер больше не нужен | Соединение создаёт и стартует сам Worker, `start()` резолвится в `connected`; `stop` до завершения `start` не вызывает `connection.stop` — Worker просто завершается; запись 2026-10-22 про WeakMap и опрос 200 мс заменена |
| 2026-10-23 | Серверные мутации, изменение групп и broadcast сериализованы `ChatWorkQueue` (`Channel` bounded 1024, `BackgroundService`); `GetHistory` и `OnConnectedAsync` остаются прямыми | Мутация + рассылка — одна единица работы без гонок; backlog ограничен backpressure, shutdown дренирует очередь |
