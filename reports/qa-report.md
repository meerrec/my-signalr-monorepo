# QA-отчёт — SignalR Chat Monorepo

Дата прогона: 2026-10-22
Ветка: `main`
Статус AGENTS.md: v1, заморожен до прохождения QA.
Коммит по итогам прогона не создавался. `@qa` изменял только этот файл.

## 1. Фактические результаты проверок

| Проверка | Команда | Результат |
| --- | --- | --- |
| Линт (включая FSD-границы) | `pnpm lint` | PASS, exit 0. Вывод ESLint пустой: 0 ошибок, 0 предупреждений, сообщений `boundaries/*` нет. Правило `boundaries/dependencies` включено в `eslint.config.js` (строка 208) |
| Проверка типов | `pnpm type-check` | PASS, exit 0. `Scope: 3 of 4 workspace projects`: `packages/shared-types`, `packages/signalr-client`, `apps/web` (оба tsconfig) + `tsconfig.tools.json` |
| Тесты | `pnpm test` | PASS. 12 тестовых файлов, 69 тестов. Start at 23:51:28, Duration 454 ms (transform 611 ms, setup 0 ms, import 965 ms, tests 82 ms, environment 4 ms) |
| Сборка | `pnpm build` | PASS. `vite v8.3.5`, 157 modules transformed, built in 124 ms. Предупреждений в выводе нет. `dist/index.html` 0.55 kB (gzip 0.35 kB), CSS 19.81 kB (gzip 4.20 kB), JS 304.25 kB (gzip 92.93 kB), map 1 449.72 kB |
| Полный прогон | `pnpm verify` | PASS, exit 0 (lint → type-check → test → build). Прогон 23:51:22–23:51:32 на текущем дереве |
| Генерация контрактов, прогон 1 | `pnpm generate:contracts` | PASS, exit 0. Вывод: `[generate-contracts] generated 2 hooks, 5 hub methods and 5 hub events` |
| Генерация контрактов, прогон 2 | `pnpm generate:contracts` | PASS, exit 0. Вывод идентичен прогону 1; хеши файлов не изменились (раздел 2) |
| Проверка `@ts-nocheck` | `grep -l "@ts-nocheck" packages/signalr-client/src/generated/*.ts` | Только `rest.ts` (строка 3). В `rest-hooks.ts` и `hub-contracts.ts` маркера нет |
| Чистый клон | `pnpm install --frozen-lockfile && pnpm build` | PASS, exit 0. Копия без `node_modules`/`dist`/`.cache`/`.git`; install 2 s, build 478 ms (раздел 7) |

Тестовые файлы: 11 в `apps/web` (4 entity-атома, 3 feature-атома, 4 утилиты `shared/lib`)
и 1 в `packages/signalr-client` (`src/lib/errors.test.ts`).

## 2. Идемпотентность генерации (SHA-256)

Хеши сняты до первого прогона, после первого и после второго прогона. Все три замера
совпали побайтно; файл `hub-contracts.ts` при генерации не изменился и в `git status`
отсутствует.

| Файл | До прогона | После прогона 1 | После прогона 2 |
| --- | --- | --- | --- |
| `packages/signalr-client/src/generated/rest.ts` | `58b8325a2799ca150805d4ce4f3b6f678adb8d2f56a56ebf6e04c9f634d9d7dc` | `58b8325a2799ca150805d4ce4f3b6f678adb8d2f56a56ebf6e04c9f634d9d7dc` | `58b8325a2799ca150805d4ce4f3b6f678adb8d2f56a56ebf6e04c9f634d9d7dc` |
| `packages/signalr-client/src/generated/rest-hooks.ts` | `a8b6503349e2c6361f7c1c4143f6ebf632a5fd60ec44e911880394233867d104` | `a8b6503349e2c6361f7c1c4143f6ebf632a5fd60ec44e911880394233867d104` | `a8b6503349e2c6361f7c1c4143f6ebf632a5fd60ec44e911880394233867d104` |
| `packages/signalr-client/src/generated/hub-contracts.ts` | `57fb860fa3b683c902733f2abbf686cc4a19d851b070a6a65799c72244d050d5` | `57fb860fa3b683c902733f2abbf686cc4a19d851b070a6a65799c72244d050d5` | `57fb860fa3b683c902733f2abbf686cc4a19d851b070a6a65799c72244d050d5` |

Фактический состав сгенерированных контрактов:

- 13 прикладных схем в `rest.ts`: `ChatRoom`, `ChatMessage`, `ErrorResponse`, `ChatUser`,
  `SendMessageRequest`, `JoinRoomRequest`, `JoinRoomResult`, `SetNameRequest`,
  `LeaveRoomRequest`, `GetHistoryRequest`, `MessageHistory`, `UserJoinedEvent`, `UserLeftEvent`
  (сверх них в файле только клиентские `FullRequestParams`, `ApiConfig`, `HttpResponse`).
- 2 REST-хука в `rest-hooks.ts`: `useListRooms`, `useListRoomMessages`.
- 5 методов хаба: `SendMessage`, `JoinRoom`, `SetName`, `LeaveRoom`, `GetHistory`.
- 5 событий хаба: `ReceiveMessage`, `MessageHistory`, `UserJoined`, `UserLeft`, `RoomUpdated`.
- Дублей вида `ChatRoom1`/`ChatMessage1`/`ErrorResponse1` в `rest.ts` нет.
- `negotiate` / `NegotiateResponse` не встречаются ни в `openapi/`, ни в
  `packages/signalr-client/src/generated/` (`grep -rni "negotiate"` не даёт совпадений).

Исходные спеки: `openapi/rest.json` — 2 пути (`/api/rooms`,
`/api/rooms/{roomId}/messages`) и 3 схемы (`ChatRoom`, `ChatMessage`, `ErrorResponse`);
`openapi/signalr.json` — 10 схем и `x-signalr-hub` с 5 методами и 5 событиями.
Merge даёт 13 прикладных схем.

## 3. `git status --short`

Фактический вывод после прогонов генерации и `pnpm verify`:

```text
 M AGENTS.md
 M README.md
 M apps/web/vite.config.ts
 M packages/signalr-client/src/generated/rest-hooks.ts
 M packages/signalr-client/src/generated/rest.ts
 M packages/signalr-client/src/provider.tsx
 M reports/qa-report.md
 M scripts/generate-contracts.ts
 M openapi/rest.json
 M openapi/signalr.json
```

Ровно 10 файлов из ожидаемого постановкой набора; неотслеживаемых файлов нет.
`packages/signalr-client/src/generated/hub-contracts.ts` в списке отсутствует, то есть
совпадает с HEAD. QA не правил ни один файл, кроме `reports/qa-report.md`.

## 4. `ChatRoom.memberCount`: рассинхрон устранён

- В `openapi/rest.json` (строка 68) `ChatRoom.required` содержит `["id", "name", "memberCount"]`;
  `memberCount` объявлен как `integer`/`int32`.
- В перегенерированном `packages/signalr-client/src/generated/rest.ts` поле обязательное:
  строка 17 — `memberCount: number;` (без `?`).
- Повторная генерация не меняет ни один из трёх файлов: SHA-256 до и после совпадают
  (раздел 2), следовательно сгенерированные контракты соответствуют текущей спеке.
- Рассинхрон, зафиксированный в прошлом отчёте (опциональный `memberCount?: number`
  при обязательном поле в спеке), **устранён**. Утверждения о наличии рассинхрона
  на текущем дереве нет: генерация воспроизводит обязательное поле.

## 5. Исправления по аудиту AGENTS.md

### (а) Провайдер SignalR

В `packages/signalr-client/src/provider.tsx` lifecycle-подписки реализованы через
диспетчер на `WeakMap<HubConnection, ConnectionListeners>` (строка 78):

- на каждое соединение однократно регистрируется стабильный диспетчер
  `onreconnecting`/`onreconnected`/`onclose`; провайдер лишь добавляет и удаляет свои
  обработчики в `Set` при монтировании и размонтировании (строки 199–201, 273–275);
- причина: `off` в `@microsoft/signalr@10.0.11` удаляет только обработчики из `_methods`,
  зарегистрированные через `on` (проверено в `dist/esm/HubConnection.js`, метод `off`);
  lifecycle-колбэки `onreconnecting`/`onreconnected`/`onclose` так снять нельзя, поэтому
  прямой `off` приводил бы к накоплению обработчиков, в том числе в StrictMode;
- для внешнего соединения, уже находящегося в `Connecting`, добавлен watcher состояния:
  опрос `connection.state` каждые 200 мс до выхода из `Connecting` (строки 175–194);
  watcher останавливается при размонтировании;
- при чистом закрытии (`onclose` без ошибки, `closeError === undefined`) статус
  выставляется `disconnected`, а `error` сбрасывается в `null`; при закрытии с ошибкой
  текст ошибки сохраняется (строки 157–168);
- owned-соединение останавливается при cleanup; внешнее соединение провайдер не
  останавливает и не перезапускает, а запускает только если оно в `Disconnected`.

### (б) Спецификация и генерация

Из `openapi/signalr.json` удалены negotiate-путь, `NegotiateResponse` и схемы-дубли:
`grep -rni "negotiate" openapi/ packages/signalr-client/src/generated/` не даёт совпадений.
Генерация даёт 13 прикладных схем, 2 REST-хука, 5 методов и 5 событий хаба (перечислены
в разделе 2); дубли `ChatRoom1`/`ChatMessage1`/`ErrorResponse1` в `rest.ts` отсутствуют.
Проверка выполнена на текущем состоянии спеки; повторная генерация подтверждает
`memberCount: number;` и не изменяет контракты (разделы 2 и 4).

### (в) Конфигурация Vite

В `apps/web/vite.config.ts` блок `build` содержит `rolldownOptions: {}` (строка 24)
и `sourcemap: true` (строка 25); `rollupOptions` в конфиге отсутствует. Сборка проходит
без предупреждений.

### (г) AGENTS.md §4.2

Публичный API `@chat/signalr-client` дополнен:

- `export type { SignalRProviderProps, SignalRContextValue } from './provider';`
  (`AGENTS.md`, строка 113);
- `export * from './generated/rest-hooks';` (`AGENTS.md`, строка 117).

Соответствующая запись добавлена в «Журнал решений» (`AGENTS.md`, строка 402).

### (д) Исправленные неточности прежнего отчёта

- Идемпотентность генерации подтверждается SHA-256, а не MD5: в таблице раздела 2
  приведены полные SHA-256-хеши всех трёх файлов.
- `// @ts-nocheck` присутствует только в `generated/rest.ts` (строка 3); утверждение, что
  маркер есть у всех сгенерированных файлов, удалено — в `rest-hooks.ts` и
  `hub-contracts.ts` его нет.

## 6. Версии инструментов

Версии установленных пакетов получены из `node_modules`; Node.js и pnpm — из
`node --version` и `pnpm --version`.

| Инструмент | Версия |
| --- | --- |
| Node.js | 25.6.1 |
| pnpm | 11.21.0 (`packageManager` в корневом `package.json`: `pnpm@11.21.0`) |
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

Требование `engines` корневого `package.json` (`node >=22.12.0`, `pnpm >=11`) выполняется.

## 7. Проверка чистого клона

Копия репозитория создана в `/tmp/qa-clean-clone-final` через `rsync` с исключением
`node_modules`, `dist`, `.cache` и `.git`; размер копии 856 KB,
каталогов `node_modules`/`dist` в ней нет. Затем выполнено:

```bash
pnpm install --frozen-lockfile   # exit 0, Done in 2s using pnpm v11.21.0, Packages: +329
pnpm build                       # exit 0, 157 modules transformed, vite built in 478ms
```

`pnpm build` в чистой копии завершился успешно: `dist/index.html` 0.55 kB,
CSS 19.81 kB, JS 304.25 kB, map 1 449.72 kB. Прогон на финальном дереве
(после правки этого отчёта) повторён: install exit 0, build exit 0, 157 modules.
Первый прогон на дереве до правки отчёта дал install 1.6 s и build 477 ms.
Установка использовала локальное хранилище pnpm (`/Users/irek/Library/pnpm/store/v11`);
поведение при полностью холодном хранилище и без сети не проверялось.

## 8. Definition of Done: подтверждено / не подтверждено

Подтверждено фактическими проверками:

- `pnpm install && pnpm build` с чистого клона — PASS (вариант с `--frozen-lockfile`).
- `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` — PASS; `pnpm verify` exit 0.
- Нарушения `eslint-plugin-boundaries`: в выводе линта отсутствуют (правило
  `boundaries/dependencies` включено в `eslint.config.js`).
- Идемпотентность генерации контрактов: SHA-256 до и после двух прогонов совпадают.
- Сгенерированные контракты соответствуют текущей спеке по `ChatRoom.memberCount`
  (`memberCount: number;`, раздел 4).
- Пустые `index.ts`: не найдены (42 файла, ни один не имеет размера 0 байт);
  `TODO`/`FIXME`/`stub` вне сгенерированных файлов не найдены.
- README содержит команды `pnpm install`, `pnpm dev`, `pnpm install && pnpm build`
  (строки 26, 28, 39).
- `docs/state-management.md` содержит сравнение Jotai / Zustand / Redux Toolkit / Valtio
  (раздел 2), правила использования Jotai (раздел 4) и каталог состояния по слайсам
  (раздел 3).
- `reports/qa-report.md` обновлён этим прогоном.

Не проверялось в этом прогоне (не считать подтверждённым):

- Отсутствие дублирования типов OpenAPI отдельным анализом не проверялось; выборочно
  `grep` подтверждает импорт типов из `@chat/signalr-client` в `model/` и `shared/api`.
- Отсутствие прямых мутаций атомов из компонентов отдельной проверкой не измерялось;
  косвенно покрыто зелёным линтом с `eslint-plugin-react-hooks`.
- Покрытие тестами (coverage) не измерялось.
- Интеграция с живым SignalR-сервером и поведение в браузере не проверялись.
- Cold-cache/no-network установка пакетов не проверялась.
- Производительность и иные метрики, кроме вывода Vite и размеров `dist`, не измерялись.

## 9. Известные риски

- `generated/rest.ts` содержит `// @ts-nocheck` (особенность `swagger-typescript-api`);
  `rest-hooks.ts` и `hub-contracts.ts` этого маркера не содержат. Ручные правки
  сгенерированных файлов запрещены.
- Для E2E-проверки нужен запущенный хаб на `http://localhost:5000/hubs/chat`; в рамках
  этого прогона такая проверка не выполнялась.
- Установка в чистом клоне опиралась на локальное хранилище pnpm; воспроизводимость
  с пустым store не подтверждена.
