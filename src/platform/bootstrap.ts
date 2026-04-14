import { initializePersistence } from './persistence/storage';

export async function bootstrapPlatform(): Promise<void> {
  await initializePersistence();
}
