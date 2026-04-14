import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './ui/theme/tokens.css';
import App from './App.tsx';
import { AppShellProvider, bootstrapPlatform } from './platform';
import { FixtureApp } from './test/FixtureApp.tsx';

const fixture = new URLSearchParams(window.location.search).get('fixture');

async function mount(): Promise<void> {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppShellProvider>
        {fixture ? <FixtureApp fixture={fixture} /> : <App />}
      </AppShellProvider>
    </StrictMode>,
  );

  void bootstrapPlatform().catch((error) => {
    console.error('Platform bootstrap failed', error);
  });
}

void mount();
