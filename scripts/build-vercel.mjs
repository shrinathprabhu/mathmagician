import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { joinHeaders, pathPattern } from './hosting-policy.mjs';

const { basePath, rules } = JSON.parse(
  await readFile('dist/hosting-policy.json', 'utf8'),
);
const output = '.vercel/output';
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'static'), { recursive: true });
const mount = join(output, 'static', basePath.slice(1));
await cp('dist/client', mount, { recursive: true });
await rm(join(mount, '_headers'));

const routes = rules.map((rule) => ({
  src: pathPattern(rule.source),
  headers: joinHeaders(rule.headers),
  continue: true,
}));
const scope = basePath ? `^${basePath}(?:/.*)?$` : '^/.*$';
routes.push(
  // Only the real homepage gets an HTML rewrite. Assets and missing routes
  // retain their own response types/statuses, including within a subpath mount.
  { src: basePath ? `^${basePath}/?$` : '^/$', dest: `${basePath}/index.html` },
  { handle: 'filesystem' },
  {
    src: scope,
    dest: `${basePath}/404.html`,
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  },
);
const config = {
  version: 3,
  routes,
  overrides: {
    [`${basePath.slice(1)}${basePath ? '/' : ''}manifest.webmanifest`]: {
      contentType: 'application/manifest+json',
    },
    [`${basePath.slice(1)}${basePath ? '/' : ''}index.md`]: {
      contentType: 'text/markdown; charset=utf-8',
    },
  },
};
await writeFile(join(output, 'config.json'), JSON.stringify(config, null, 2));
console.log(
  `Vercel: static Build Output API bundle ready at ${output}, mount ${basePath || '/'}.`,
);
