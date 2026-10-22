import { ChatPage } from '@/pages/chat';

/** Корневой компонент приложения. */
export function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        К содержимому
      </a>
      <ChatPage />
    </>
  );
}
