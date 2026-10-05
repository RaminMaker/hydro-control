/** Verify the npm package that Angular copies to /fonts (no shipping binaries). */
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'node_modules', 'vazir-font', 'dist');
const names = ['Vazir-Regular.woff2', 'Vazir-Medium.woff2', 'Vazir-Bold.woff2'];
const missing = names.filter(name => {
  const path = join(dist, name);
  return !existsSync(path) || statSync(path).size < 1000;
});
if (missing.length) {
  console.error(`[FONT ERROR] Vazir files are missing from ${dist}: ${missing.join(', ')}`);
  console.error('Run npm install in this project folder (do not use --omit dependencies).');
  process.exit(1);
}
console.log('[fonts] Vazir npm assets verified. Angular copies them to /fonts.');
