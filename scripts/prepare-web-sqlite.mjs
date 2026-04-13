import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const source = resolve(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
const destination = resolve(root, 'public/assets/sql-wasm.wasm');

await mkdir(resolve(root, 'public/assets'), { recursive: true });
await copyFile(source, destination);
