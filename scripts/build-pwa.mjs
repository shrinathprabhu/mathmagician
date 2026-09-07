import {
  readdir,
  readFile,
  writeFile,
  mkdtemp,
  cp,
  copyFile,
  rm,
  rename,
} from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { getBasePath } from '../lib/base-path.mjs';

const output = 'dist/client';
const basePath = getBasePath();
if (basePath) {
  // Vinext exports prefixed assets in a nested directory and the page beside it
  // as mathmagician.html. Normalize to one self-contained directory for mounting
  // at /mathmagician, while retaining the generated prefixed URL references.
  const staged = await mkdtemp('dist/.static-mount-');
  await cp(join(output, basePath.slice(1)), staged, { recursive: true });
  await copyFile(
    join(output, `${basePath.slice(1)}.html`),
    join(staged, 'index.html'),
  );
  await copyFile(join(output, '404.html'), join(staged, '404.html'));
  await rm(output, { recursive: true });
  await rename(staged, output);
}
// Host rules must match the actual deployment mount, including subpath builds.
const headers = await readFile('public/_headers', 'utf8');
await writeFile(
  join(output, '_headers'),
  headers.replace(/^\//gm, `${basePath}/`),
);
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
      !relative(output, path).startsWith('.vite/') &&
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
