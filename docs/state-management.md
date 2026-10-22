# Управление состоянием

Статус: документ замороженного контракта `@state-manager`. Источник правды по именам атомов,
их видам и правилам записи — `AGENTS.md`, раздел 5. Ниже — контракт и эталонные сниппеты;
документ не утверждает, что соответствующие файлы уже реализованы.

## 1. Контекст и требования к состоянию real-time чата

Приложение — чат на SignalR (хаб `ChatHub`, маршрут `/hubs/chat`) с комнатами, историей
сообщений и списком участников.

| Требование | Что это означает для состояния |
| --- | --- |
| Низкая задержка | Событие хаба → action-атом → одна запись в store. Без промежуточных `useState`, очередей в компонентах и повторных преобразований; история применяется одним batch-действием. |
| Изоляция комнат | Сообщения нормализованы по `roomId`; подписка на комнату A не перерисовывается от сообщений комнаты B; очистка истории затрагивает одну комнату. |
| Отсутствие лишних ре-рендеров | Компонент подписан только на нужный атом; derived-атомы возвращают ссылочно-стабильные значения; подписка на весь store и мега-атомы запрещены. |
| Тестируемость без React | Действия проверяются через `createStore()` из `jotai/vanilla`; транспорт (`invoke`) внедряется параметром. |
| Интеграция с SignalR | Подписки на события живут в `api/` сегментах entities и вызывают только action-атомы; статус соединения попадает в `entities/session` через `SignalRStateBridge`. |
| Границы FSD | Атомы создаются только в `model/` своего слайса и экспортируются через `index.ts`; кросс-слайсовые импорты — только вниз по слоям. |
| Предсказуемость | Записи идемпотентны по `id`, ошибки не выбрасываются наружу, `status`/`error` отделены от данных. |

Нефункциональные инварианты: детерминированная сортировка (tie-break по `id`), идемпотентность событий, отсутствие циклов.

## 2. Сравнение Jotai, Zustand, Redux Toolkit и Valtio

Размеры — порядок величины gzip для клиентского рантайма без учёта tree-shaking и версии.

| Критерий | Jotai | Zustand | Redux Toolkit | Valtio |
| --- | --- | --- | --- | --- |
| Размер | ~3–4 KB | ~1 KB | ~11–13 KB + `react-redux` ~5 KB | ~3 KB |
| Модель обновлений | Независимые атомы, запись через `set` | Один store, `set` с частью состояния | Один store, чистые reducers и actions | Прокси-объект, прямые мутации |
| Гранулярность подписок | На каждый атом; компонент зависит только от прочитанных атомов | Селектор + функция равенства, настройка вручную | `useSelector` + мемоизированные селекторы | Отслеживание прочитанных свойств прокси |
| Boilerplate | Низкий: `atom`, derived, action-атом | Низкий | Высокий: slice, thunk, типизированные хуки, root reducer | Низкий, но мутации неявны |
| FSD-интеграция (`model/`) | Атомы естественно живут в `model/` каждого слайса | Store чаще глобальный, слайс-скоупинг вручную | Store централизован в `app`, слайсы связаны root reducer | Store-объекты можно разложить по слайсам, дисциплина ручная |
| Тестируемость без React | `createStore()` из `jotai/vanilla` | `createStore()` из `zustand/vanilla` | `configureStore` + `dispatch`, больше обвязки | `snapshot()`/прокси, тесты возможны |
| Асинхронность | Async write в action-атоме, транспорт внедряется | Async-действия внутри store | `createAsyncThunk`, listener middleware | Async-функции рядом, статусы вручную |
| Экосистема | Большая: utils, devtools, SSR | Большая: middleware, devtools | Крупнейшая: RTK Query, канонические паттерны | Средняя, нишевая |

**Вывод.** Zustand легче, но требует ручной настройки селекторов и хуже ложится на «атомы
принадлежат слайсу». Redux Toolkit каноничнее, но тяжелее, а централизованный store конфликтует
с изоляцией `model/`. Valtio удобен для форм, но мутабельные прокси усложняют нормализованные
карты сообщений. Jotai выбран по совокупности:

- атомарная модель совпадает с доменом: сессия, пользователь, комната, сообщение;
- бандл ~3–4 KB и отсутствие обязательного глобального root reducer;
- компонент подписывается только на нужные атомы (`useAtomValue`), derived-атомы дают точечные проекции;
- `Provider` создаёт изолированный store: отдельный scope для приложения и чистые тесты;
- атомы и действия естественно размещаются в `model/` слайса, а внедряемый `invoke` делает их тестируемыми без React и SignalR.

Ограничение зафиксировано в `AGENTS.md`: Zustand, MobX, Valtio и Redux Toolkit запрещены;
сравнение приведено как обоснование, а не как альтернатива.

## 3. Каталог состояния по слайсам

Нотация `ActionAtom<T>` — writable-атом, чей `write` принимает payload `T`
(`WritableAtom<null, [T], void | Promise<void>>`). Имена совпадают с `AGENTS.md` и не меняются.

| Слайс | Атом | Вид | Тип | Читает / пишет | Инварианты |
| --- | --- | --- | --- | --- | --- |
| `entities/session` | `connectionStatusAtom` | primitive | `PrimitiveAtom<ConnectionStatus>` | Читают виджеты статуса; пишет action | Отражает состояние SignalR-соединения |
| `entities/session` | `connectionErrorAtom` | primitive | `PrimitiveAtom<string \| null>` | Читают виджеты ошибок; пишет action | `null` без ошибки; текст нормализован |
| `entities/session` | `isConnectedAtom` | derived | `Atom<boolean>` | Читают компоненты готовности | `true` только при `status === 'connected'` |
| `entities/session` | `setConnectionStatusActionAtom` | action | `ActionAtom<{ status: ConnectionStatus; error: string \| null }>` | Вызывает `SignalRStateBridge` | `status` и `error` обновляются одной записью |
| `entities/user` | `currentUserAtom` | primitive | `PrimitiveAtom<ChatUser \| null>` | Читают шапка и композер; пишут действия features | `null` до входа/установки имени |
| `entities/user` | `usersByIdAtom` | primitive | `PrimitiveAtom<Record<string, ChatUser>>` | Читают derived; пишут action-атомы | Ключ равен `user.id`, дублей нет |
| `entities/user` | `usersAtom` | derived | `Atom<ChatUser[]>` | Читают списки участников | Сортировка по `name`, tie-break по `id` |
| `entities/user` | `usersCountAtom` | derived | `Atom<number>` | Читают счётчики | Равен числу ключей `usersByIdAtom` |
| `entities/user` | `setCurrentUserActionAtom` | action | `ActionAtom<ChatUser \| null>` | Вызывают join и set-name | Не меняет реестр `usersByIdAtom` |
| `entities/user` | `upsertUserActionAtom` | action | `ActionAtom<ChatUser>` | Вызывают `UserJoined`, join/set-name | Upsert по `id`, повтор не создаёт дубль |
| `entities/user` | `removeUserActionAtom` | action | `ActionAtom<string>` | Вызывает `UserLeft` | Удаляет запись по `id`; отсутствующий `id` — no-op |
| `entities/room` | `roomsByIdAtom` | primitive | `PrimitiveAtom<Record<string, ChatRoom>>` | Читают derived; пишут action-атомы | Ключ равен `room.id`; `memberCount` обновляется upsert-ом |
| `entities/room` | `currentRoomIdAtom` | primitive | `PrimitiveAtom<string \| null>` | Читают действия и страницы; пишут action-атомы | Может быть `null`; смена комнаты не удаляет сообщения |
| `entities/room` | `currentRoomAtom` | derived | `Atom<ChatRoom \| null>` | Читают шапка и композер | `roomsByIdAtom[currentRoomId] ?? null` |
| `entities/room` | `roomsAtom` | derived | `Atom<ChatRoom[]>` | Читают списки комнат | Сортировка по `name`, tie-break по `id` |
| `entities/room` | `upsertRoomActionAtom` | action | `ActionAtom<ChatRoom>` | Вызывают `RoomUpdated`, join | Upsert по `room.id` |
| `entities/room` | `selectCurrentRoomActionAtom` | action | `ActionAtom<string \| null>` | Вызывают страницы и join | Только выбирает `id`; не создаёт комнату и не чистит историю |
| `entities/message` | `messagesByRoomAtom` | primitive | `PrimitiveAtom<Record<string, Record<string, ChatMessage>>>` | Читают derived; пишут action-атомы | `roomId → messageId → ChatMessage`; ключ равен `message.id` |
| `entities/message` | `messagesForRoomAtom` | derived family | `AtomFamily<string, ChatMessage[]>` | Читают компоненты ленты | Сортировка по `sentAt`, tie-break по `id`; ссылка стабильна до изменения комнаты |
| `entities/message` | `messageCountForRoomAtom` | derived family | `AtomFamily<string, number>` | Читают бейджи/счётчики | Равен длине `messagesForRoomAtom(roomId)` |
| `entities/message` | `upsertMessageActionAtom` | action | `ActionAtom<ChatMessage>` | Вызывают `ReceiveMessage` и send-message | Upsert по `id` внутри `roomId`, идемпотентен |
| `entities/message` | `upsertMessagesActionAtom` | action | `ActionAtom<ChatMessage[]>` | Вызывает `MessageHistory` | Один batch-write; merge по `id`, не замена ленты |
| `entities/message` | `clearRoomMessagesActionAtom` | action | `ActionAtom<string>` | Вызывают страницы/выход из комнаты | Удаляет только bucket указанной комнаты |
| `features/send-message` | `messageDraftAtom` | primitive | `PrimitiveAtom<string>` | Читает textarea; пишет action | Черновик — UI-состояние, не источник сообщений |
| `features/send-message` | `sendMessageStatusAtom` | primitive | `PrimitiveAtom<AsyncStatus>` | Читает кнопка отправки | `pending` только на время запроса |
| `features/send-message` | `sendMessageErrorAtom` | primitive | `PrimitiveAtom<string \| null>` | Читает блок ошибки | Сбрасывается в `null` при старте запроса |
| `features/send-message` | `changeMessageDraftActionAtom` | action | `ActionAtom<string>` | Вызывает textarea | Единственный способ изменить черновик |
| `features/send-message` | `sendMessageActionAtom` | action | `ActionAtom<{ invoke: SendMessageInvoker }>` | Вызывает UI | Валидирует ввод, очищает черновик только при успехе |
| `features/join-room` | `joinRoomIdDraftAtom` | primitive | `PrimitiveAtom<string>` | Читает форма входа | Не является выбранной комнатой |
| `features/join-room` | `joinRoomUserNameDraftAtom` | primitive | `PrimitiveAtom<string>` | Читает форма входа | Не является `currentUserAtom` |
| `features/join-room` | `joinRoomStatusAtom` | primitive | `PrimitiveAtom<AsyncStatus>` | Читает кнопка входа | `pending` на время `JoinRoom` |
| `features/join-room` | `joinRoomErrorAtom` | primitive | `PrimitiveAtom<string \| null>` | Читает блок ошибки | Сбрасывается при старте запроса |
| `features/join-room` | `changeJoinRoomIdActionAtom` | action | `ActionAtom<string>` | Вызывает поле `roomId` | Только запись черновика |
| `features/join-room` | `changeJoinRoomUserNameActionAtom` | action | `ActionAtom<string>` | Вызывает поле имени | Только запись черновика |
| `features/join-room` | `joinRoomActionAtom` | action | `ActionAtom<{ invoke: JoinRoomInvoker }>` | Вызывает UI | Валидирует поля; при успехе upsert-ит комнату, выбирает её, сохраняет пользователя |
| `features/set-name` | `nameDraftAtom` | primitive | `PrimitiveAtom<string>` | Читает поле имени | Не равен `currentUserAtom.name` автоматически |
| `features/set-name` | `setNameStatusAtom` | primitive | `PrimitiveAtom<AsyncStatus>` | Читает кнопка сохранения | `pending` на время `SetName` |
| `features/set-name` | `setNameErrorAtom` | primitive | `PrimitiveAtom<string \| null>` | Читает блок ошибки | Сбрасывается при старте запроса |
| `features/set-name` | `changeNameDraftActionAtom` | action | `ActionAtom<string>` | Вызывает поле имени | Только запись черновика |
| `features/set-name` | `setNameActionAtom` | action | `ActionAtom<{ invoke: SetNameInvoker }>` | Вызывает UI | Валидирует непустое имя; обновляет `currentUserAtom` и `usersByIdAtom` |

### 3.1 `messagesByRoomAtom` и локальная atom family

`messagesByRoomAtom` — единственный primitive-атом сообщений: карта
`roomId → messageId → ChatMessage`. Она даёт идемпотентный upsert по `id`, batch-историю
одной записью и очистку одной комнаты; плоский массив сообщений в feature-слайсе запрещён.

`messagesForRoomAtom` и `messageCountForRoomAtom` — family-функции `(roomId) => Atom<T>`.
Jotai 3.0.1 удалил `atomFamily` из `jotai/utils` и `jotai/vanilla/utils`, поэтому family
реализуется локально в `entities/message/model` поверх `Map`-кэша: контракт
`AtomFamily<string, T>` сохранён без downgrade Jotai 3. Атомы общие для store, состояние — своё.

Компонент ленты подписывается на `messagesForRoomAtom(roomId)` и не зависит от других комнат.
Но derived-функция читает общий `messagesByRoomAtom`, поэтому наивный
`Object.values(...).sort(...)` создаёт новый массив при изменении любой комнаты и даёт лишний
ре-рендер. Эталон — мемоизация по ссылке bucket-а: upsert-ы сохраняют ссылки нетронутых комнат,
и для них возвращается прежний массив (см. §9.2). `messageCountForRoomAtom` возвращает примитив
и реагирует только на число сообщений. Кэш ограничен числом комнат; публичного eviction нет.

## 4. Правила использования Jotai

1. **Три вида атомов.** Primitive хранит данные, derived — чистую проекцию без эффектов и записи, action — единственную точку мутации; derived-атом с `write` запрещён.
2. **Размещение.** Атомы создаются только в `model/` слайса и экспортируются только через `index.ts`; кросс-слайсовый импорт — только вниз (`features → entities`).
3. **Чтение и запись.** В компонентах: `useAtomValue` для чтения, `useSetAtom` для записи, `useAtom` — только когда нужны оба; запись — всегда action-атом.
4. **Запрет прямых мутаций.** Компоненты и `api/`-подписки не вызывают `set(primitiveAtom, ...)`: это ломает валидацию и инварианты.
5. **Запрет мега-атома.** `appStateAtom` и срезы «всё в одном» запрещены; состояние принадлежит слайсу и нормализовано.
6. **status/error отдельно от data.** `AsyncStatus` и текст ошибки — отдельные primitive-атомы; объект `{ data, status, error }` смешивает домен и UI-фазу.
7. **Действия — единственная точка мутации.** Валидация, транспорт, ошибки и обновление сущностей — в action-атоме; только он пишет несколько атомов согласованно.
8. **Derived-атомы чистые.** Никаких `fetch`, `Date.now()`, мутаций и записи в другие атомы; входные данные читаются через `get`.
9. **Ссылочная стабильность.** Селекторы списков возвращают стабильные ссылки или примитивы; сортировка детерминирована (`id` как tie-break).
10. **Типы.** Используются типы из `@chat/signalr-client` и `@chat/shared-types`; дублирование сгенерированных типов запрещено, импорт типов — `import type`.

## 5. Асинхронные действия

Action-атом с внедряемым транспортом — базовый паттерн сетевых операций. Транспорт приходит
параметром `{ invoke }`, поэтому `model/` не импортирует React, провайдер и SignalR.

1. Прочитать входные данные через `get` (черновик, выбранная комната).
2. Валидировать до транспорта; при ошибке — `status = 'error'` и текст, без `invoke`.
3. Выставить `status = 'pending'`, `error = null`.
4. Вызвать `invoke(request)`.
5. При успехе обновить данные через action-атомы нижележащих entities, затем `status = 'success'`.
6. При исключении: `status = 'error'`, `error = getErrorMessage(error, fallback)`; наружу не бросать.

```ts
// features/send-message/model/send-message.ts
import { atom } from 'jotai';
import type { AsyncStatus } from '@chat/shared-types';
import { getErrorMessage } from '@/shared/lib';
import { currentRoomIdAtom } from '@/entities/room';
import { upsertMessageActionAtom } from '@/entities/message';
import type { SendMessageInvoker } from './types';

export const messageDraftAtom = atom('');
export const sendMessageStatusAtom = atom<AsyncStatus>('idle');
export const sendMessageErrorAtom = atom<string | null>(null);

export const sendMessageActionAtom = atom(
  null,
  async (get, set, { invoke }: { invoke: SendMessageInvoker }): Promise<void> => {
    const roomId = get(currentRoomIdAtom);
    const text = get(messageDraftAtom).trim();
    if (!roomId || !text) {
      set(sendMessageStatusAtom, 'error');
      set(sendMessageErrorAtom, roomId ? 'Сообщение не может быть пустым' : 'Комната не выбрана');
      return;
    }
    set(sendMessageStatusAtom, 'pending');
    set(sendMessageErrorAtom, null);
    try {
      const message = await invoke({ roomId, text });
      set(upsertMessageActionAtom, message);
      if (get(messageDraftAtom).trim() === text) set(messageDraftAtom, '');
      set(sendMessageStatusAtom, 'success');
    } catch (error) {
      set(sendMessageStatusAtom, 'error');
      set(sendMessageErrorAtom, getErrorMessage(error, 'Не удалось отправить сообщение'));
    }
  },
);
```

**Устаревшие ответы.** Контракт инвокеров не принимает `AbortSignal`, поэтому отмена
кооперативная. Для действий «последний победил» (join-room, set-name) хранится монотонный счётчик
запросов: ответ применяется только при совпадении номера с последним. В send-message ответ старого
запроса не сотрёт новый ввод: черновик очищается лишь при совпадении с отправленным текстом.

**Гонки с событиями хаба.** `ReceiveMessage` может прийти раньше ответа `invoke` на собственное
сообщение. Оба пути пишут через `upsertMessageActionAtom` по `id`, поэтому повтор идемпотентен.
`MessageHistory` применяется batch-мержем и не теряет live-сообщения, пришедшие во время загрузки.
Статусы действий независимы: три `*StatusAtom` не делят общий `pending`.

## 6. Интеграция SignalR

Подписки на события живут в `api/` сегментах entities (зона `@ui-builder`) и вызывают
action-атомы из `model/` через `useSetAtom`; в `model/` нет React-хуков и подписок.

| Событие хаба | Action-атом | Эффект |
| --- | --- | --- |
| `ReceiveMessage` | `upsertMessageActionAtom` | Upsert сообщения по `id` в его комнате |
| `MessageHistory` | `upsertMessagesActionAtom` | Batch-merge истории по `id` |
| `UserJoined` | `upsertUserActionAtom` | Upsert участника по `id` |
| `UserLeft` | `removeUserActionAtom` | Удаление участника по `id` |
| `RoomUpdated` | `upsertRoomActionAtom` | Обновление комнаты и `memberCount` |

Подписка использует `useChatEvent` из `@/shared/api/signalr`; обработчик вызывает только действие —
без `invoke`, `fetch`, `useState` и записи primitive-атома. `SignalRStateBridge` из `app/providers/`
ничего не рендерит: читает `useChatConnectionStatus()` и вызывает `setConnectionStatusActionAtom`.

Соединение SignalR живёт в dedicated Web Worker: `SignalRProvider` создаёт `WorkerHubClient`,
хуки получают события и статусы через `SignalRClient`, а `HubConnection` в main thread отсутствует.
Worker стартует в эффекте провайдера после регистрации подписок детей, поэтому стартовые
`RoomUpdated` из `OnConnectedAsync` не теряются.

```tsx
// app/providers/signalr-state-bridge.tsx
export function SignalRStateBridge(): null {
  const { status, error } = useChatConnectionStatus();
  const setConnectionStatus = useSetAtom(setConnectionStatusActionAtom);
  useEffect(() => {
    setConnectionStatus({ status, error });
  }, [status, error, setConnectionStatus]);
  return null;
}
```

Порядок провайдеров: Jotai `Provider` снаружи, `SignalRProvider` внутри, затем Bridge и приложение.

```tsx
<JotaiProvider>
  <SignalRProvider url={env.signalRUrl}>
    <SignalRStateBridge />
    <App />
  </SignalRProvider>
</JotaiProvider>
```

Jotai `Provider` создаёт store, общий для Bridge, подписок и UI; `SignalRProvider` даёт контекст
worker-клиента (`SignalRClient`) для Bridge и `api/`-хуков. Если SignalR поставить снаружи Jotai, Bridge останется без
store. Обработчики стабильны, а актуальные данные действие читает через `get` в момент записи.

## 7. Тестирование

Тесты атомов лежат рядом с `model/`, используют `createStore()` из `jotai/vanilla` и не требуют
React, `Provider` или SignalR. Проверяются успех, ошибка транспорта/валидации, upsert и изоляция.

```ts
// features/send-message/model/send-message.test.ts
import { createStore } from 'jotai/vanilla';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@chat/signalr-client';
import { currentRoomIdAtom } from '@/entities/room';
import { messagesByRoomAtom } from '@/entities/message';
import { messageDraftAtom, sendMessageActionAtom, sendMessageErrorAtom, sendMessageStatusAtom } from './send-message';

const message: ChatMessage = {
  id: 'm-1', roomId: 'room-1', authorId: 'u-1', authorName: 'Анна',
  text: 'Привет', sentAt: '2026-10-22T10:00:00.000Z',
};
describe('sendMessageActionAtom', () => {
  it('успех: пишет сообщение и очищает черновик', async () => {
    const store = createStore();
    store.set(currentRoomIdAtom, 'room-1');
    store.set(messageDraftAtom, 'Привет');
    const invoke = vi.fn(async () => message);
    await store.set(sendMessageActionAtom, { invoke });
    expect(invoke).toHaveBeenCalledWith({ roomId: 'room-1', text: 'Привет' });
    expect(store.get(sendMessageStatusAtom)).toBe('success');
    expect(store.get(sendMessageErrorAtom)).toBeNull();
    expect(store.get(messageDraftAtom)).toBe('');
    expect(store.get(messagesByRoomAtom)['room-1']?.['m-1']).toEqual(message);
  });

  it('ошибка транспорта: статус error, черновик сохранён', async () => {
    const store = createStore();
    store.set(currentRoomIdAtom, 'room-1');
    store.set(messageDraftAtom, 'Привет');
    const invoke = vi.fn(async () => {
      throw new Error('network');
    });
    await expect(store.set(sendMessageActionAtom, { invoke })).resolves.toBeUndefined();
    expect(store.get(sendMessageStatusAtom)).toBe('error');
    expect(store.get(sendMessageErrorAtom)).toBe('network');
    expect(store.get(messageDraftAtom)).toBe('Привет');
    expect(store.get(messagesByRoomAtom)).toEqual({});
  });
});
```

Мост Worker↔main и рантайм воркера тестируются отдельно на фейковом `WorkerLike` и фейковом
соединении (`packages/signalr-client/src/worker/*.test.ts`), без React и без хаба.

Каждый `it` создаёт собственный `createStore()`: глобального store нет, состояние не протекает
между тестами. Family разделяет экземпляры атомов, но состояние хранится в конкретном store.
Фейковый `invoke` проверяет request и возвращает либо бросает подготовленный ответ.

## 8. Антипаттерны и чек-лист code review

Антипаттерны:

- `appStateAtom` или «стор слайса целиком» вместо нормализованных атомов;
- запись primitive-атома из компонента или `api/`-подписки в обход action-атома;
- `status`/`error`, сложенные в один объект с доменными данными;
- derived-атом с побочными эффектами, `fetch` или записью в другие атомы;
- хранение сообщений массивом в feature-слайсе и ручное слияние дублей в UI;
- `push` вместо upsert по `id`; замена истории вместо merge;
- `invoke`/`fetch` внутри подписки на событие хаба;
- импорт runtime `@microsoft/signalr` в main-граф: соединение живёт в Worker;
- действие, выбрасывающее исключение наружу или оставляющее `pending` навсегда;

Чек-лист code review:

1. Атом создан в `model/` своего слайса и экспортирован через `index.ts`; импорт идёт вниз по слоям.
2. Mutating-записи из UI и `api/` выполняются только action-атомами; прямых `set(primitive)` нет.
3. Нет мега-атома; данные нормализованы по `id`, сообщения — по `roomId` и `messageId`.
4. `status`/`error` отделены от data, сбрасываются при старте запроса и не залипают в `pending`.
5. Действие валидирует вход до `invoke`; ошибки проходят через `getErrorMessage` и не летят наружу.
6. Upsert-ы идемпотентны; batch-история не затирает live-сообщения; сортировка детерминирована.
7. `messagesForRoomAtom` стабилен по ссылке для неизменившихся комнат (нет лишних ре-рендеров).
8. Подписки SignalR живут в `api/`, вызывают action-атомы и не содержат транспорта/логики данных.
9. `SignalRStateBridge` обновляет сессию одним действием; порядок провайдеров Jotai → SignalR соблюдён,
   Worker стартует после регистрации подписок.
10. Тест использует `createStore()`, фейковый `invoke` и проверяет success, error и изоляцию store.

## 9. Примеры кода

### 9.1 Primitive + derived + action (`entities/room`)

```ts
// entities/room/model/room.ts
import { atom } from 'jotai';
import type { ChatRoom } from '@chat/signalr-client';

export const roomsByIdAtom = atom<Record<string, ChatRoom>>({});
export const currentRoomIdAtom = atom<string | null>(null);

export const currentRoomAtom = atom((get) => {
  const id = get(currentRoomIdAtom);
  return id ? (get(roomsByIdAtom)[id] ?? null) : null;
});

export const upsertRoomActionAtom = atom(null, (_get, set, room: ChatRoom) => {
  set(roomsByIdAtom, (prev) => ({ ...prev, [room.id]: room }));
});

export const selectCurrentRoomActionAtom = atom(null, (_get, set, roomId: string | null) => {
  set(currentRoomIdAtom, roomId);
});
```

### 9.2 Локальная atom family с Map-кэшем (`entities/message`)

```ts
// entities/message/model/message.ts
import { atom, type Atom } from 'jotai';
import type { ChatMessage } from '@chat/signalr-client';

type RoomMessages = Record<string, ChatMessage>;

export const messagesByRoomAtom = atom<Record<string, RoomMessages>>({});

function createFamily<Value>(factory: (roomId: string) => Atom<Value>): (roomId: string) => Atom<Value> {
  const cache = new Map<string, Atom<Value>>();
  return (roomId) => {
    const cached = cache.get(roomId);
    if (cached) return cached;
    const created = factory(roomId);
    cache.set(roomId, created);
    return created;
  };
}

const bySentAtThenId = (a: ChatMessage, b: ChatMessage): number =>
  a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id);

export const messagesForRoomAtom = createFamily<ChatMessage[]>((roomId) => {
  let lastBucket: RoomMessages | undefined;
  let lastResult: ChatMessage[] = [];
  return atom((get) => {
    const bucket = get(messagesByRoomAtom)[roomId];
    if (bucket === lastBucket) return lastResult;
    lastBucket = bucket;
    lastResult = bucket ? Object.values(bucket).sort(bySentAtThenId) : [];
    return lastResult;
  });
});

export const messageCountForRoomAtom = createFamily<number>((roomId) => atom((get) => get(messagesForRoomAtom(roomId)).length));
```

### 9.3 Подписка на событие хаба (`entities/message/api`)

```tsx
// entities/message/api/use-message-events.ts
import { useSetAtom } from 'jotai';
import { useChatEvent } from '@/shared/api/signalr';
import { upsertMessageActionAtom, upsertMessagesActionAtom } from '../model';

export function useMessageEvents(): void {
  const upsertMessage = useSetAtom(upsertMessageActionAtom);
  const upsertMessages = useSetAtom(upsertMessagesActionAtom);

  useChatEvent('ReceiveMessage', (message) => upsertMessage(message));
  useChatEvent('MessageHistory', (history) => upsertMessages(history.messages));
}
```

Все сниппеты используют имена из замороженного контракта. Поля `ChatMessage`, `ChatRoom`,
`SendMessageRequest` и другие приходят из сгенерированных типов; локальные копии не создаются.
