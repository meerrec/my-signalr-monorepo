import { ChatRoom } from '@/widgets/chat-room';
import styles from './ChatPage.module.css';

/** Страница чата: единственная точка входа пользовательского интерфейса. */
export function ChatPage() {
  return (
    <main className={styles.page} id="main-content" tabIndex={-1}>
      <ChatRoom />
    </main>
  );
}
