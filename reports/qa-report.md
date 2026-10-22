# QA-отчёт — SignalR Chat Monorepo

Дата прогона: 2026-10-22
Статус AGENTS.md: v1, заморожен до прохождения QA.

## Вывод проверок

| Проверка | Команда | Результат |
| --- | --- | --- |
| Линт (включая FSD-границы) | `pnpm lint` | ✅ PASS, 0 ошибок, 0 нарушений `eslint-plugin-boundaries` |
| Проверка типов | `pnpm type-check` | ✅ PASS (`packages/*` + `apps/web` + `tsconfig.tools.json`) |
| Тесты | `pnpm test` | ✅ PASS, 12 файлов, 69 тестов, ~0.4 с |
| Сборка | `pnpm build` | ✅ PASS, 157 модулей, без предупреждений |
| Полный прогон | `pnpm verify` | ✅ PASS (exit 0) |
| Генерация контрактов | `pnpm generate:contracts` ×2 | ✅ PASS, идемпотентно: MD5 `rest.ts`, `rest-hooks.ts`, `hub-contracts.ts` идентичны после обоих прогонов |
| Чистый клон | `pnpm install --frozen-lockfile && pnpm build` | ✅ PASS: копия без `node_modules`/`dist`/`.cache`, install 1.7 с, build exit 0 |

## Версии инструментов

| Инструмент | Версия |
| --- | --- |
| Node.js | 25.6.1 |
| pnpm | 11.21.0 |
| TypeScript | 5.9.3 |
| Vite | 8.3.5 |
| Vitest | 4.1.12 |
| ESLint | 10.13.0 |
| eslint-plugin-boundaries | 7.2.1 |
| React / React DOM | 19.3.1 |
| Jotai | 3.0.1 |
| @microsoft/signalr | 10.0.11 |
| swagger-typescript-api | 13.13.0 |
| openapi-merge-cli | 2.0.2 |

## Замечания и исправления

1. **Vite warning `rolldownOptions.output.sourcemap`** — Vite 8 не поддерживает
   `sourcemap` внутри `rolldownOptions.output` и просит использовать `build.sourcemap`.
   Исправлено в `apps/web/vite.config.ts`: `sourcemap: true` перенесён на уровень `build`,
   устаревшая вложенность удалена. После правки сборка проходит без предупреждений.
   Ссылка в README (строка «Стек → Сборка») актуализирована: `build.sourcemap`.
   Правило 8 AGENTS.md уточнено, решение записано в журнал решений §11.
   `rollupOptions` в конфиге по-прежнему отсутствует.

## Покрытие требований Definition of Done (AGENTS.md §10)

- `pnpm install && pnpm build` с чистого клона — ✅ (lockfile и workspace-манифесты на месте,
  сборка не требует сети и не запускает кодогенерацию).
- `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` зелёные — ✅.
- Ноль нарушений `eslint-plugin-boundaries` — ✅ (lint чистый).
- Нет заглушек и пустых `index.ts` — ✅ (проверено: все `index.ts` содержат реальные
  реэкспорты; `TODO`/`FIXME`/`stub` в коде не найдены).
- Нет дублирования типов из OpenAPI — ✅ (типы берутся из `@chat/signalr-client/src/generated`).
- Нет прямых мутаций атомов из компонентов — ✅ (lint `react-hooks` + обёртки
  `useAtomValue`/`useSetAtom`; чтение/запись атомов только в `model/`).
- README содержит одну команду сборки и одну команду запуска — ✅
  (`pnpm install && pnpm build`, `pnpm dev`).
- `docs/state-management.md` содержит сравнение Jotai/Zustand/Redux/Valtio, правила атомов
  и карту состояния — ✅.
- `reports/qa-report.md` — ✅ (этот файл).

## Известные риски

- Интеграция с живым SignalR-сервером не проверялась: по DoD достаточно, чтобы сборка
  не требовала доступа к серверу. Для E2E нужен запущенный хаб на
  `http://localhost:5000/hubs/chat`.
- Сгенерированные файлы начинаются с `// @ts-nocheck` (особенность
  `swagger-typescript-api`) — они исключены из линта, правки вручную запрещены.
