import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, '../functions/scripts/seed-emulator.js');

const result = spawnSync(process.execPath, [target], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
