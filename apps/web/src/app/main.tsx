import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/ui/styles/tokens.css';
import '@/app/styles/global.css';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Не найден элемент #root');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
