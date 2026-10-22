# ADR 0001. Проверка FSD-границ через eslint-plugin-boundaries

- Статус: принято
- Дата: 2026-10-22
- Владелец: `@architect`
- Затрагивает: `eslint.config.js`, `pnpm lint`

## Контекст

Монорепозиторий построен по Feature-Sliced Design. Слои идут сверху вниз:

```text
app -> pages -> widgets -> features -> entities -> shared
```

Правила FSD, зафиксированные в `AGENTS.md`:

- импорт разрешён только вниз по слоям;
- импорты «вбок» между слайсами одного слоя запрещены;
- импорты «вверх» запрещены;
- кросс-слайсовый импорт возможен только через публичный API слайса (`index.ts`);
- `shared` не импортирует другие слои приложения;
- пакеты `packages/*` не импортируют `apps/web`.

Без автоматической проверки эти ограничения нарушаются незаметно: достаточно одного
`import { ... } from '@/features/...'` внутри `entities`, и сборка останется зелёной.
Нужен линт-барьер, который падает на нарушении границ и при этом не даёт ложных
срабатываний на существующем коде.

## Решение

Используется `eslint-plugin-boundaries` v7 в flat-конфиге ESLint 10
(`eslint.config.js`, ESM). Правило — `boundaries/dependencies`.

Ключевые решения:

1. **Элемент = папка слайса.** Шаблоны заданы с `partialMatch: false` и `capture`,
   поэтому `entities/message` и `entities/room` — разные элементы, а все файлы внутри
   `entities/message` (сегменты `model`, `ui`, `api`) — один элемент.
2. **Проверяются и внутренние импорты** (`checkInternals: true`). Это позволяет явно
   разрешить импорты между сегментами одного слайса тем же правилом, что и остальные
   зависимости, а не полагаться на неявное исключение.
3. **Один слайс — одна политика.** Для `pages`, `widgets`, `features`, `entities`
   импорт в тот же слой разрешён только при совпадении capture `slice`:
   `captured: { slice: '${from.slice}' }`. Поэтому `entities/session -> entities/message`
   запрещён, а `entities/message/ui -> entities/message/model` разрешён.
4. **Пакеты доступны всем слоям приложения.** `@chat/shared-types` и
   `@chat/signalr-client` — source-first workspace-пакеты, лежащие ниже `shared`.
   Существующий код (`entities/*/model`, `features/*/model`, `shared/api`) импортирует
   из них типы и хуки, поэтому `package` добавлен в allow-список всех слоёв `apps/web`.
   Это осознанное расширение буквальной матрицы из постановки, без него линт был бы
   красным на текущем коде.
5. **Алиас `@/` резолвится.** В v7 настройка `boundaries/alias` удалена (осталось только
   предупреждение), а `eslint-import-resolver-typescript` в зависимостях нет.
   `eslint.config.js` экспортирует resolver-интерфейс v2 (`interfaceVersion`, `resolve`)
   и передаёт собственный путь в `settings['import/resolver']`. Resolver разрешает
   `@/...` в `apps/web/src`, а `@chat/*` — в реальные каталоги `packages/*` (без этого
   pnpm-симлинки в `node_modules` делали бы пакеты внешними и политики `package`
   не проверялись бы). Остальное отдаётся встроенному `node`-резолверу с расширениями
   `.ts/.tsx/.css`. Это делает проверку алиасов и пакетов реальной, а не декоративной.
6. **Неизвестные цели не ломают сборку.** `boundaries/no-unknown`,
   `boundaries/no-unknown-dependencies` и `boundaries/no-unknown-files` выключены:
   вне слайсов остаются `apps/web/vite.config.ts`, `apps/web/src/vite-env.d.ts` и т.п.

### Матрица разрешённых импортов

`+` — разрешено, `same` — только внутри одного слайса (совпадает captured `slice`),
`same layer` — любой слайс этого слоя, `-` — запрещено.

| from \ to | app | pages | widgets | features | entities | shared | package | root |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app | + | + | + | + | + | + | + | - |
| pages | - | same | + | + | + | + | + | - |
| widgets | - | - | same | + | + | + | + | - |
| features | - | - | - | same | + | + | + | - |
| entities | - | - | - | - | same | + | + | - |
| shared | - | - | - | - | - | same layer | + | - |
| package | - | - | - | - | - | - | + | - |
| root | - | - | - | - | - | + | + | + |

Пояснения:

- `shared/api` — это элемент типа `shared` с `segment = "api"`; отдельного типа нет.
- `package` — каждый пакет `packages/*` является отдельным элементом, но импорты между
  пакетами разрешены (например, `signalr-client -> shared-types`).
- `root` — корневые `*.ts`, `*.js` и `scripts/*`; им разрешены только нижние уровни
  (`shared`, `package`) и другие корневые файлы.
- Внешние пакеты (`react`, `jotai`, `@microsoft/signalr`) не проверяются:
  `checkAllOrigins: false`.

### Примеры запрещённых импортов

```ts
// apps/web/src/entities/message/ui/MessageList.tsx
import { SendMessageForm } from '@/features/send-message';
// entities -> features: импорт вверх по слоям.

// apps/web/src/features/send-message/model/atoms.ts
import { ChatRoom } from '@/widgets/chat-room';
// features -> widgets: импорт вверх по слоям.

// apps/web/src/entities/message/ui/MessageList.tsx
import { RoomList } from '@/entities/room';
// entities/message -> entities/room: импорт вбок между слайсами одного слоя.

// apps/web/src/shared/lib/some-helper.ts
import { currentUserAtom } from '@/entities/user';
// shared -> entities: shared не может импортировать слои выше себя.

// packages/shared-types/src/index.ts
import { ChatPage } from '../../apps/web/src/pages/chat';
// package -> apps/web: пакеты не знают о приложении.
```

Разрешённые аналоги:

```ts
// apps/web/src/entities/message/ui/MessageList.tsx
import { messagesForRoomAtom } from '../model';          // тот же слайс
import { formatTime } from '@/shared/lib';               // вниз по слоям

// apps/web/src/features/send-message/model/atoms.ts
import { upsertMessageActionAtom } from '@/entities/message'; // features -> entities
```

## Как запускать

```bash
pnpm lint                 # eslint .
pnpm exec eslint . --max-warnings=0
pnpm exec eslint apps/web/src/entities/session/model/atoms.ts
pnpm exec eslint --print-config apps/web/src/entities/message/model/atoms.ts
```

Проверка границ включена в общий `pnpm lint`; отдельной команды не требуется.

## Последствия

- Нарушения FSD-границ являются ошибками ESLint и валят `pnpm lint`/`pnpm verify`.
- Тесты `**/*.test.{ts,tsx}` исключены из `boundaries/dependencies` отдельным блоком:
  тестовые дубли могут импортировать сущности иначе, чем production-код.
- Сгенерированные контракты `packages/signalr-client/src/generated/**` исключены
  глобально: они не участвуют в FSD-архитектуре и не должны редактироваться руками.
- `mode: 'full'` для корневых файлов помечен в v7 как deprecated, но остаётся
  единственным способом классифицировать отдельные файлы в элементе `root`.
  Предупреждения о legacy-настройках отключены (`boundaries/legacy-warnings: false`).
  Шаблоны `${from.slice}` требуют `boundaries/legacy-templates: true`.
- `preserve-caught-error` (core-правило ESLint 10) отключено только для `scripts/**`:
  `scripts/generate-contracts.ts` перебрасывает ошибки без `cause`, а этот файл
  принадлежит `@signalr-integrator` и не входит в зону задачи.
- `@typescript-eslint/no-unused-vars` настроен с `argsIgnorePattern: '^_'`:
  существующие тестовые заглушки используют `_request`.
- Resolver для `@/` живёт в `eslint.config.js` и не требует новых зависимостей.
  Если в проект добавят `eslint-import-resolver-typescript`, resolver можно заменить
  на стандартный `typescript`-резолвер без изменения матрицы политик.
- Type-aware проверки не включены: конфиг не требует `projectService` и не падает на
  сгенерированных файлах.

## Проверка решения

На финальном конфиге:

```text
pnpm exec eslint apps/web/src/entities/session/model/atoms.ts packages/shared-types/src/index.ts   -> 0
pnpm exec eslint --print-config apps/web/src/entities/message/model/atoms.ts > /dev/null            -> 0
pnpm exec eslint . --max-warnings=0                                                                -> 0
```

Временный probe `apps/web/src/entities/session/model/__boundary_probe__.ts`:

- импорт `@/features/set-name` из `entities/session` — ошибка
  `boundaries/dependencies` (entities -> features запрещён);
- импорт `@/entities/message` из `entities/session` — ошибка `boundaries/dependencies`
  (вбок между слайсами запрещён);
- импорт `@/entities/session` из `entities/session/model` — ошибки нет
  (тот же слайс разрешён).

Probe-файл удалён после проверки.
