import type { FormEvent, ReactElement } from 'react';

import { useAtomValue, useSetAtom } from 'jotai';

import { cn } from '@/shared/lib';
import { Button, Input } from '@/shared/ui';

import {
  changeJoinRoomIdActionAtom,
  changeJoinRoomUserNameActionAtom,
  joinRoomActionAtom,
  joinRoomErrorAtom,
  joinRoomIdDraftAtom,
  joinRoomStatusAtom,
  joinRoomUserNameDraftAtom,
} from '../model';
import type { JoinRoomInvoker } from '../model';
import styles from './JoinRoomForm.module.css';

export interface JoinRoomFormProps {
  invoke: JoinRoomInvoker;
  className?: string | undefined;
}

export function JoinRoomForm({
  invoke,
  className,
}: JoinRoomFormProps): ReactElement {
  const roomId = useAtomValue(joinRoomIdDraftAtom);
  const userName = useAtomValue(joinRoomUserNameDraftAtom);
  const status = useAtomValue(joinRoomStatusAtom);
  const error = useAtomValue(joinRoomErrorAtom);

  const changeRoomId = useSetAtom(changeJoinRoomIdActionAtom);
  const changeUserName = useSetAtom(changeJoinRoomUserNameActionAtom);
  const joinRoom = useSetAtom(joinRoomActionAtom);

  const isPending = status === 'pending';
  const isEmpty = roomId.trim().length === 0 || userName.trim().length === 0;
  const isDisabled = isPending || isEmpty;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isDisabled) {
      return;
    }

    void joinRoom({ invoke });
  };

  return (
    <form className={cn(styles.form, className)} onSubmit={handleSubmit}>
      <Input
        label="Комната"
        placeholder="Название или идентификатор комнаты"
        value={roomId}
        onChange={(event) => {
          changeRoomId(event.target.value);
        }}
        autoComplete="off"
        required
      />
      <Input
        label="Ваше имя"
        placeholder="Как вас представить?"
        value={userName}
        onChange={(event) => {
          changeUserName(event.target.value);
        }}
        autoComplete="nickname"
        required
      />
      {error !== null ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          loading={isPending}
          disabled={isDisabled}
        >
          Войти в комнату
        </Button>
      </div>
    </form>
  );
}
