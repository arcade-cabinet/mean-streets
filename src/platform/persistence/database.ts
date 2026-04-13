import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'mean_streets';
const DB_VERSION = 1;

const sqlite = new SQLiteConnection(CapacitorSQLite);
let connectionPromise: Promise<SQLiteDBConnection> | null = null;
let webReadyPromise: Promise<void> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS app_kv (
  namespace TEXT NOT NULL,
  item_key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (namespace, item_key)
);
`;

export async function getDatabase(): Promise<SQLiteDBConnection> {
  connectionPromise ??= initializeDatabase();
  return connectionPromise;
}

async function initializeDatabase(): Promise<SQLiteDBConnection> {
  await prepareWebStore();
  await sqlite.checkConnectionsConsistency();
  const existing = await sqlite.isConnection(DB_NAME, false);
  const db = existing.result
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

  await db.open();
  await db.execute(SCHEMA);
  return db;
}

async function prepareWebStore(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') return;
  if (webReadyPromise) return webReadyPromise;

  webReadyPromise = (async () => {
    if (!customElements.get('jeep-sqlite')) {
      await import('jeep-sqlite');
    }

    await customElements.whenDefined('jeep-sqlite');

    if (!document.querySelector('jeep-sqlite')) {
      const element = document.createElement('jeep-sqlite');
      element.setAttribute('auto-save', 'true');
      element.setAttribute('wasm-path', '/assets');
      document.body.appendChild(element);
    }

    await sqlite.initWebStore();
  })();

  return webReadyPromise;
}

export async function saveWebStore(database = DB_NAME): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') return;
  await getDatabase();
  await sqlite.saveToStore(database);
}

export async function closeDatabase(): Promise<void> {
  const existing = await sqlite.isConnection(DB_NAME, false);
  if (existing.result) {
    await sqlite.closeConnection(DB_NAME, false);
  }
  connectionPromise = null;
}
