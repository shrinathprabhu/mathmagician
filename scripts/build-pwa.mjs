import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const output = 'dist/client';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : [join(dir, entry.name)],
    ),
  );
  return nested.flat();
}
const files = (await walk(output))
  .filter(
    (path) =>
      !path.endsWith('.map') &&
      !['sw.js', '_headers'].includes(relative(output, path)),
  )
  .sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const version = hash.digest('hex').slice(0, 16);
const assets = [
  './',
  ...files
    .filter((file) => relative(output, file) !== 'index.html')
    .map(
      (file) =>
        `./${relative(output, file).split('/').map(encodeURIComponent).join('/')}`,
    ),
];
const source = await readFile('scripts/service-worker.template.txt', 'utf8');
await writeFile(
  join(output, 'sw.js'),
  source
    .replace('__VERSION__', version)
    .replace('__ASSETS__', JSON.stringify(assets)),
);
console.log(`PWA: ${assets.length} local files precached, version ${version}.`);
