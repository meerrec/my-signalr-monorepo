import type { FormEvent, ReactElement } from 'react';

import { useAtomValue, useSetAtom } from 'jotai';

import { cn } from '@/shared/lib';
import { Badge, Button, Input } from '@/shared/ui';

import {
  changeNameDraftActionAtom,
  nameDraftAtom,
  setNameActionAtom,
  setNameErrorAtom,
  setNameStatusAtom,
} from '../model';
import type { SetNameInvoker } from '../model';
import styles from './SetNameForm.module.css';

export interface SetNameFormProps {
  invoke: SetNameInvoker;
  className?: string | undefined;
}

export function SetNameForm({
  invoke,
  className,
}: SetNameFormProps): ReactElement {
  const name = useAtomValue(nameDraftAtom);
  const status = useAtomValue(setNameStatusAtom);
  const error = useAtomValue(setNameErrorAtom);

  const changeNameDraft = useSetAtom(changeNameDraftActionAtom);
  const setName = useSetAtom(setNameActionAtom);

  const isPending = status === 'pending';
  const isSuccess = status === 'success';
  const isEmpty = name.trim().length === 0;
  const isDisabled = isPending || isEmpty;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isDisabled) {
      return;
    }

    void setName({ invoke });
  };

  return (
    <form className={cn(styles.form, className)} onSubmit={handleSubmit}>
      <Input
        label="Ваше имя"
        placeholder="Как вас представить?"
        value={name}
        onChange={(event) => {
          changeNameDraft(event.target.value);
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
          variant="secondary"
          loading={isPending}
          disabled={isDisabled}
        >
          Сохранить имя
        </Button>
        {isSuccess ? <Badge tone="success">Имя сохранено</Badge> : null}
      </div>
    </form>
  );
}
