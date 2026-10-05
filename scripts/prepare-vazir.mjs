/**
 * Prepare Vazir static assets for Angular without importing CSS from node_modules.
 * The source archive deliberately does not include font binaries.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'vazir-font', 'dist');
const destination = join(root, 'public', 'fonts');
const names = ['Vazir-Regular.woff2', 'Vazir-Medium.woff2', 'Vazir-Bold.woff2'];

if (!existsSync(source)) {
  console.warn('[fonts] vazir-font is not installed. Run npm install to enable the local Vazir font.');
  process.exit(0);
}

const missing = names.filter(name => !existsSync(join(source, name)));
if (missing.length) {
  console.warn(`[fonts] Incomplete vazir-font package: ${missing.join(', ')}. Reinstall with npm install.`);
  process.exit(0);
}

mkdirSync(destination, { recursive: true });
for (const name of names) copyFileSync(join(source, name), join(destination, name));
console.log('[fonts] Local Vazir font assets prepared.');
