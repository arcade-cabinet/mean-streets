import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

export interface DeviceProfile {
  platform: 'web' | 'ios' | 'android';
  model: string;
  operatingSystem: string;
  osVersion: string;
  isVirtual: boolean;
}

export async function detectDeviceProfile(): Promise<DeviceProfile> {
  const platform = Capacitor.getPlatform() as DeviceProfile['platform'];

  try {
    const info = await Device.getInfo();
    return {
      platform,
      model: info.model ?? 'unknown',
      operatingSystem: info.operatingSystem ?? platform,
      osVersion: info.osVersion ?? 'unknown',
      isVirtual: info.isVirtual ?? false,
    };
  } catch {
    return {
      platform,
      model: 'browser',
      operatingSystem: platform,
      osVersion: 'unknown',
      isVirtual: platform === 'web',
    };
  }
}
