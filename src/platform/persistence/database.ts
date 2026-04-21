import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';

const DB_NAME = 'mean_streets';
const DB_VERSION = 1;
const JEEP_SQLITE_LOG_PREFIXES = [
  '#### getVersion new res:',
  'Using the File System Access API.',
  'Using the fallback implementation.',
  'jeep-sqlite isStore = false',
] as const;

const sqlite = new SQLiteConnection(CapacitorSQLite);
let connectionPromise: Promise<SQLiteDBConnection> | null = null;
let webReadyPromise: Promise<void> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

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
  if (!connectionPromise) {
    connectionPromise = withSuppressedJeepSqliteLogs(() => initializeDatabase())
      .catch((error) => {
        connectionPromise = null; // allow retries instead of returning a permanently-rejected promise
        throw error;
      });
  }
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
    const basePath = `${import.meta.env.BASE_URL}assets`;
    defineJeepSqlite(window);

    await customElements.whenDefined('jeep-sqlite');

    if (!document.querySelector('jeep-sqlite')) {
      const element = document.createElement('jeep-sqlite');
      element.setAttribute('autosave', 'true');
      element.setAttribute('wasmpath', basePath);
      document.body.appendChild(element);
    }

    await sqlite.initWebStore();
  })();

  return webReadyPromise;
}

export async function saveWebStore(database = DB_NAME): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') return;
  await getDatabase();
  await flushWebStore(database);
}

export async function withDatabaseWriteLock<T>(
  action: (db: SQLiteDBConnection) => Promise<T>,
): Promise<T> {
  const prior = writeQueue.catch(() => undefined);
  const next = prior.then(async () => {
    const db = await getDatabase();
    const result = await action(db);
    if (Capacitor.getPlatform() === 'web') {
      await flushWebStore();
    }
    return result;
  });
  writeQueue = next.catch(() => undefined);
  return next;
}

export async function closeDatabase(): Promise<void> {
  await withSuppressedJeepSqliteLogs(async () => {
    const existing = await sqlite.isConnection(DB_NAME, false);
    if (existing.result) {
      await sqlite.closeConnection(DB_NAME, false);
    }
  });
  connectionPromise = null;
}

async function withSuppressedJeepSqliteLogs<T>(
  action: () => Promise<T>,
): Promise<T> {
  if (Capacitor.getPlatform() !== 'web') {
    return action();
  }

  const previousConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    const [first] = args;
    if (
      typeof first === 'string' &&
      JEEP_SQLITE_LOG_PREFIXES.some((prefix) => first.includes(prefix))
    ) {
      return;
    }
    previousConsoleLog(...args);
  };

  try {
    return await action();
  } finally {
    console.log = previousConsoleLog;
  }
}

async function flushWebStore(database = DB_NAME): Promise<void> {
  await withSuppressedJeepSqliteLogs(() => sqlite.saveToStore(database));
}
