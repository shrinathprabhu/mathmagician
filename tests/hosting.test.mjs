import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sitesWorker from '../dist/server/index.js';
import { getBasePath } from '../lib/base-path.mjs';
import {
  parseHeaders,
  headersForPath,
  renderHeaders,
} from '../scripts/hosting-policy.mjs';

const base = getBasePath();
const output = 'dist/client';
const raw = await readFile(`${output}/_headers`, 'utf8');
const rules = parseHeaders(raw);
const headers = (path) => headersForPath(rules, `${base}${path}`);

void test('every app response has security headers while clipboard and sharing remain permitted', () => {
  for (const path of [
    '/',
    '/index.html',
    '/sw.js',
    '/manifest.webmanifest',
    '/_next/static/test.js',
    '/missing',
  ]) {
    const response = headers(path);
    assert.equal(response['Strict-Transport-Security'], 'max-age=31536000');
    assert.equal(response['X-Content-Type-Options'], 'nosniff');
    assert.equal(response['X-Frame-Options'], 'DENY');
    assert.equal(
      response['Referrer-Policy'],
      'strict-origin-when-cross-origin',
    );
    assert.equal(response['Cross-Origin-Resource-Policy'], 'same-origin');
    assert.match(response['Permissions-Policy'], /camera=\(\)/);
    assert.match(response['Permissions-Policy'], /clipboard-write=\(self\)/);
    assert.match(response['Permissions-Policy'], /web-share=\(self\)/);
    assert.match(response['Content-Security-Policy'], /frame-ancestors 'none'/);
    assert.match(response['Content-Security-Policy'], /object-src 'none'/);
  }
  if (base)
    assert.deepEqual(
      headers(''),
      headers('/'),
      'Both homepage addresses get the same protection',
    );
  assert.ok(raw.split('\n').every((line) => Buffer.byteLength(line) <= 2000));
  assert.ok(rules.length <= 100);
  assert.throws(
    () =>
      renderHeaders([
        {
          source: '/*',
          headers: [{ key: 'Example', value: 'x'.repeat(2000) }],
        },
      ]),
    /exceeds/,
  );
});

void test('CSP authorizes every exported inline script without allowing arbitrary inline JavaScript or eval', async () => {
  const html = await readFile(`${output}/index.html`, 'utf8');
  const csp = headers('/')['Content-Security-Policy'];
  const policies = csp.split(',').map(
    (policy) =>
      new Map(
        policy
          .trim()
          .split(';')
          .map((directive) => {
            const [name, ...values] = directive.trim().split(/\s+/);
            return [name, values];
          }),
      ),
  );
  assert.equal(policies.length, 2);
  let scripts = 0;
  for (const [, attrs, body] of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    const src = attrs.match(/\bsrc="([^"]+)"/);
    if (src) {
      assert.ok(
        src[1].startsWith(`${base}/_next/static/`),
        `Unexpected script origin: ${src[1]}`,
      );
      continue;
    }
    if (!body) continue;
    scripts++;
    const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
    for (const policy of policies) {
      const allowed = policy.get('script-src') || policy.get('default-src');
      if (allowed)
        assert.ok(
          allowed.includes(hash),
          `CSP would block inline script ${scripts}`,
        );
    }
  }
  assert.ok(scripts > 0);
  for (const policy of policies) {
    assert.ok(!policy.get('script-src')?.includes("'unsafe-inline'"));
    assert.ok(!policy.get('script-src')?.includes("'unsafe-eval'"));
  }
  const notFound = await readFile(`${output}/404.html`, 'utf8');
  assert.doesNotMatch(notFound, /<script\b|rel="modulepreload"/i);
  assert.match(notFound, /404/);
});

void test('cache policies keep mutable files fresh, hashed assets immutable, and 404s uncacheable', () => {
  for (const path of [
    '/',
    '/index.html',
    '/index.txt',
    '/manifest.webmanifest',
    '/sw.js',
  ])
    assert.equal(headers(path)['Cache-Control'], 'no-cache', path);
  for (const path of [
    '/_next/static/chunks/app-abc.js',
    '/_next/static/css/app-abc.css',
    '/_next/static/media/geist-abc.woff2',
  ])
    assert.equal(
      headers(path)['Cache-Control'],
      'public, max-age=31536000, immutable',
      path,
    );
  for (const path of ['/mathmagician.svg', '/icons/mathmagician-192.png'])
    assert.equal(
      headers(path)['Cache-Control'],
      'public, max-age=86400, must-revalidate',
      path,
    );
  for (const path of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/index.md'])
    assert.equal(headers(path)['Cache-Control'], 'public, max-age=3600', path);
  assert.equal(headers('/404.html')['Cache-Control'], 'no-store');
  assert.equal(headers('/404.html')['X-Robots-Tag'], 'noindex');
  assert.equal(headers('/index.md')['X-Robots-Tag'], 'noindex');
  assert.equal(
    headers('/manifest.webmanifest')['Content-Type'],
    'application/manifest+json',
  );
  assert.equal(headers('/sw.js')['Service-Worker-Allowed'], `${base}/`);
});

void test('build metadata is excluded from public files and the offline precache', async () => {
  for (const path of [
    '.vite/manifest.json',
    'vinext-client-entry-manifest.json',
    'hosting-policy.json',
  ])
    await assert.rejects(access(`${output}/${path}`), { code: 'ENOENT' });
  const worker = await readFile(`${output}/sw.js`, 'utf8');
  assert.doesNotMatch(
    worker,
    /vinext-client-entry-manifest|hosting-policy\.json|\.vite\/|"\.\/_headers"/,
  );
  const source = await readFile('components/game/math-game.tsx', 'utf8');
  assert.match(source, /updateViaCache: 'none'/);
});

void test('Sites adapter enforces the same headers, preserves conditional responses, and rejects missing files', async () => {
  let fetches = 0;
  const env = {
    ASSETS: {
      async fetch(request) {
        fetches++;
        const conditional = request.headers.has('if-none-match');
        return new Response(
          conditional || request.method === 'HEAD' ? null : 'static file',
          {
            status: conditional ? 304 : 200,
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=0',
              ETag: '"test"',
            },
          },
        );
      },
    },
  };
  for (const path of [
    '/',
    '/sw.js',
    '/manifest.webmanifest',
    '/mathmagician.svg',
  ]) {
    const response = await sitesWorker.fetch(
      new Request(`https://example.com${base}${path}`),
      env,
    );
    assert.equal(response.status, 200);
    for (const [key, value] of Object.entries(headers(path)))
      assert.equal(response.headers.get(key), value, `${path}: ${key}`);
    assert.equal(response.headers.get('etag'), '"test"');
  }
  const conditional = await sitesWorker.fetch(
    new Request(`https://example.com${base}/`, {
      headers: { 'If-None-Match': '"test"' },
    }),
    env,
  );
  assert.equal(conditional.status, 304);
  assert.equal(conditional.headers.get('Cache-Control'), 'no-cache');
  const count = fetches;
  for (const path of [
    '/unknown',
    '/_headers',
    '/hosting-policy.json',
    '/_next/static/missing.js',
  ]) {
    const response = await sitesWorker.fetch(
      new Request(`https://example.com${base}${path}`),
      env,
    );
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
    assert.equal(
      response.headers.get('Content-Security-Policy'),
      headers('/')['Content-Security-Policy'],
    );
    assert.doesNotMatch(await response.text(), /<script\b/i);
  }
  const post = await sitesWorker.fetch(
    new Request(`https://example.com${base}/`, { method: 'POST' }),
    env,
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
  assert.equal(
    fetches,
    count,
    'Missing routes and unsupported methods never hit the asset binding',
  );
});
