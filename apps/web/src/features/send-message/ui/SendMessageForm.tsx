import type { FormEvent, KeyboardEvent, ReactElement } from 'react';

import { useAtomValue, useSetAtom } from 'jotai';

import { cn } from '@/shared/lib';
import { Button, Textarea } from '@/shared/ui';

import {
  changeMessageDraftActionAtom,
  messageDraftAtom,
  sendMessageActionAtom,
  sendMessageErrorAtom,
  sendMessageStatusAtom,
} from '../model';
import type { SendMessageInvoker } from '../model';
import styles from './SendMessageForm.module.css';

export interface SendMessageFormProps {
  invoke: SendMessageInvoker;
  className?: string | undefined;
}

export function SendMessageForm({
  invoke,
  className,
}: SendMessageFormProps): ReactElement {
  const draft = useAtomValue(messageDraftAtom);
  const status = useAtomValue(sendMessageStatusAtom);
  const error = useAtomValue(sendMessageErrorAtom);

  const changeMessageDraft = useSetAtom(changeMessageDraftActionAtom);
  const sendMessage = useSetAtom(sendMessageActionAtom);

  const isPending = status === 'pending';
  const isDraftEmpty = draft.trim().length === 0;
  const isDisabled = isPending || isDraftEmpty;
  const errorText = status === 'error' ? (error ?? undefined) : undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isDisabled) {
      return;
    }

    void sendMessage({ invoke });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form className={cn(styles.form, className)} onSubmit={handleSubmit}>
      <Textarea
        label="Сообщение"
        placeholder="Напишите сообщение…"
        value={draft}
        onChange={(event) => {
          changeMessageDraft(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        error={errorText}
      />
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          loading={isPending}
          disabled={isDisabled}
        >
          Отправить
        </Button>
      </div>
    </form>
  );
}
