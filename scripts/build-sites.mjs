import { readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathPattern, joinHeaders } from './hosting-policy.mjs';

const { basePath, rules } = JSON.parse(
  await readFile('dist/hosting-policy.json', 'utf8'),
);
async function files(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const name = `${prefix}/${entry.name}`;
    if (entry.isDirectory())
      result.push(...(await files(join(dir, entry.name), name)));
    else if (!entry.name.startsWith('.') && entry.name !== '_headers')
      result.push(name);
  }
  return result;
}
const template = await readFile('scripts/sites-worker.template.mjs', 'utf8');
const assetFiles = await files('dist/client');
const notFound = await readFile('dist/client/404.html', 'utf8');
const worker = template
  .replace('__BASE__', () => JSON.stringify(basePath))
  .replace('__RULES__', () =>
    JSON.stringify(
      rules.map((rule) => ({
        pattern: pathPattern(rule.source),
        headers: joinHeaders(rule.headers),
      })),
    ),
  )
  .replace('__FILES__', () => JSON.stringify(assetFiles))
  .replace('__NOT_FOUND__', () => JSON.stringify(notFound));
// Discard the unused Vinext SSR runtime. The exported frontend is served by a
// tiny Worker that adds headers to the provider's ASSETS binding responses.
await rm('dist/server', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', worker);
console.log('Sites: static response header adapter generated.');
