import { StrictMode } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './ui/theme/tokens.css';
import App from './App.tsx';
import { AppShellProvider, bootstrapPlatform } from './platform';

const fixture = new URLSearchParams(window.location.search).get('fixture');

async function mount(): Promise<void> {
  let RootComponent: ComponentType;
  if (fixture) {
    const mod = await import('./test/FixtureApp.tsx');
    RootComponent = () => <mod.FixtureApp fixture={fixture} />;
  } else {
    RootComponent = App;
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppShellProvider>
        <RootComponent />
      </AppShellProvider>
    </StrictMode>,
  );

  void bootstrapPlatform().catch((error) => {
    console.error('Platform bootstrap failed', error);
  });
}

void mount();
