import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { joinHeaders, pathPattern } from './hosting-policy.mjs';

const { rules } = JSON.parse(
  await readFile('dist/hosting-policy.json', 'utf8'),
);
const output = '.vercel/output';
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'static'), { recursive: true });
const mount = join(output, 'static');
await cp('dist/client', mount, { recursive: true });
await rm(join(mount, '_headers'));

const routes = rules.map((rule) => ({
  src: pathPattern(rule.source),
  headers: joinHeaders(rule.headers),
  continue: true,
}));
routes.push(
  // Serve the exported homepage locally. No proxy or subpath rewrites.
  { src: '^/$', dest: '/index.html' },
  { handle: 'filesystem' },
  {
    src: '^/.*$',
    dest: '/404.html',
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  },
);
const config = {
  version: 3,
  routes,
  overrides: {
    'manifest.webmanifest': {
      contentType: 'application/manifest+json',
    },
    'index.md': {
      contentType: 'text/markdown; charset=utf-8',
    },
  },
};
await writeFile(join(output, 'config.json'), JSON.stringify(config, null, 2));
console.log(`Vercel: root-hosted static bundle ready at ${output}.`);
