import { readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
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
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};
const assets = {};
for (const file of assetFiles) {
  const bytes = await readFile(join('dist/client', file));
  assets[file] = {
    body: bytes.toString('base64'),
    type: types[extname(file)] || 'application/octet-stream',
    etag: `"${createHash('sha256').update(bytes).digest('hex')}"`,
  };
}
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
  .replace('__FILES__', () => JSON.stringify(assets));
if (gzipSync(worker).length > 3_000_000)
  throw new Error(
    'Sites response bundle exceeds the compressed script budget.',
  );
// Sites serves uploaded assets before Workers, bypassing response headers.
// Its dedicated archive therefore embeds these small static files in one
// portable Worker. Vercel and ordinary static hosts use dist/client directly.
await rm('dist/server', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', worker);
const stage = 'work/sites-deploy';
await rm(stage, { recursive: true, force: true });
await mkdir(join(stage, 'dist/server'), { recursive: true });
await mkdir(join(stage, '.openai'), { recursive: true });
await writeFile(join(stage, 'dist/server/index.js'), worker);
await writeFile(
  join(stage, '.openai/hosting.json'),
  await readFile('.openai/hosting.json'),
);
console.log(
  `Sites: standalone static response bundle prepared (${gzipSync(worker).length} bytes compressed).`,
);
