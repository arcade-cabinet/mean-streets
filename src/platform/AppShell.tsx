import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { detectDeviceProfile, type DeviceProfile } from './device';
import { classifyLayout, readViewportSnapshot, type LayoutProfile, type ViewportSnapshot } from './layout';

interface AppShellContextValue {
  device: DeviceProfile;
  viewport: ViewportSnapshot;
  layout: LayoutProfile;
}

const DEFAULT_VIEWPORT = readViewportSnapshot();
const DEFAULT_DEVICE: DeviceProfile = {
  platform: 'web',
  model: 'browser',
  operatingSystem: 'web',
  osVersion: 'unknown',
  isVirtual: false,
};

const AppShellContext = createContext<AppShellContextValue>({
  device: DEFAULT_DEVICE,
  viewport: DEFAULT_VIEWPORT,
  layout: classifyLayout(DEFAULT_VIEWPORT),
});

function isBrowserTestEnv(): boolean {
  return typeof window !== 'undefined' && window.__MEAN_STREETS_TEST__ === true;
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<DeviceProfile>(DEFAULT_DEVICE);
  const [viewport, setViewport] = useState<ViewportSnapshot>(DEFAULT_VIEWPORT);

  useEffect(() => {
    if (isBrowserTestEnv()) return;
    void detectDeviceProfile().then(setDevice);
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setViewport(readViewportSnapshot());
    };

    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (isBrowserTestEnv()) return;
    void configureNativeShell();
    const listener = App.addListener('appStateChange', () => {
      setViewport(readViewportSnapshot());
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);

  const value = useMemo(() => {
    const mergedViewport = { ...viewport, platform: device.platform };
    return {
      device,
      viewport: mergedViewport,
      layout: classifyLayout(mergedViewport),
    };
  }, [device, viewport]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.platform = value.device.platform;
    root.dataset.layout = value.layout.id;
    root.dataset.deviceClass = value.layout.deviceClass;
    root.dataset.posture = value.layout.posture;
    root.style.setProperty('--safe-top', 'env(safe-area-inset-top, 0px)');
    root.style.setProperty('--safe-right', 'env(safe-area-inset-right, 0px)');
    root.style.setProperty('--safe-bottom', 'env(safe-area-inset-bottom, 0px)');
    root.style.setProperty('--safe-left', 'env(safe-area-inset-left, 0px)');
  }, [value]);

  return (
    <AppShellContext.Provider value={value}>
      <div
        className="app-shell"
        data-layout-id={value.layout.id}
        data-device-class={value.layout.deviceClass}
        data-posture={value.layout.posture}
      >
        {children}
      </div>
    </AppShellContext.Provider>
  );
}

export function useAppShell(): AppShellContextValue {
  return useContext(AppShellContext);
}

async function configureNativeShell(): Promise<void> {
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#090909' });
  } catch {
    // Browser and unsupported platforms can ignore native shell decoration.
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Safe on web/test.
  }
}
