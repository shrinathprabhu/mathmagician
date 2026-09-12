import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
import { resolve } from 'node:path';

const output = resolve('dist/client');
let built = true;
try {
  await access(`${output}/sw.js`);
} catch {
  built = false;
}

void test(
  'production metadata, install icons, static assets, and cache completeness',
  { skip: !built && 'Run npm run build for artifact checks' },
  async () => {
    const html = await readFile(`${output}/index.html`, 'utf8');
    assert.match(html, /<title>Mathmagician/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/mathmagician.lowkey.tools\/"/,
    );
    assert.doesNotMatch(
      html,
      /Untitled site|Your site is taking shape|fonts.googleapis/,
    );
    for (const name of [
      'Kids mode',
      'Adult mode',
      'Legendary mode',
      'God mode',
    ])
      assert.ok(html.includes(name));
    assert.match(html, /href="https:\/\/owleye.dev"/);
    assert.match(html, /href="https:\/\/shrinath.me"/);
    assert.ok(!html.includes('aria-label="Number pad"'));
    const manifest = JSON.parse(
      await readFile(`${output}/manifest.webmanifest`, 'utf8'),
    );
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.id, '/');
    assert.ok(manifest.icons.some((i) => i.sizes === '192x192'));
    assert.ok(
      manifest.icons.some(
        (i) => i.sizes === '512x512' && i.purpose === 'maskable',
      ),
    );
    for (const icon of manifest.icons) {
      const png = await readFile(resolve(output, '.' + icon.src));
      assert.equal(png.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
    }
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const path = match[1];
      if (path.startsWith('/_next/') || path.startsWith('./icons/'))
        await access(
          resolve(output, '.' + (path.startsWith('/') ? path : path.slice(1))),
        );
    }
  },
);

void test(
  'service worker precaches full app, runs offline, isolates scopes, and preserves unrelated caches',
  { skip: !built && 'Run npm run build for artifact checks' },
  async () => {
    const listeners = {},
      stored = new Map();
    let networkCalls = 0,
      claimed = false,
      cacheAssets = [];
    const scope = 'https://mathmagician.example.test/';
    const keyOf = (r) => (typeof r === 'string' ? r : r.url);
    const caches = {
      async open(key) {
        if (!stored.has(key)) stored.set(key, new Map());
        const entries = stored.get(key);
        return {
          async addAll(urls) {
            cacheAssets = urls;
            for (const url of urls) {
              const rel =
                decodeURIComponent(new URL(url).pathname.slice(1)) ||
                'index.html';
              entries.set(url, await readFile(resolve(output, rel), 'utf8'));
            }
          },
          async match(req) {
            return entries.get(keyOf(req));
          },
        };
      },
      async keys() {
        return [...stored.keys()];
      },
      async delete(k) {
        return stored.delete(k);
      },
    };
    stored.set('another-app-v1', new Map());
    stored.set('mathmagician-/-old', new Map());
    stored.set('mathmagician-/different/-old', new Map());
    const context = vm.createContext({
      URL,
      caches,
      self: {
        registration: { scope },
        clients: {
          async claim() {
            claimed = true;
          },
        },
        addEventListener(type, fn) {
          listeners[type] = fn;
        },
      },
      fetch: async () => {
        networkCalls++;
        throw new Error('Offline');
      },
    });
    vm.runInContext(await readFile(`${output}/sw.js`, 'utf8'), context);
    let task = Promise.resolve('');
    listeners.install({
      waitUntil(p) {
        task = p;
      },
    });
    await task;
    assert.ok(cacheAssets.some((p) => p.endsWith('.js')));
    assert.ok(cacheAssets.some((p) => p.endsWith('.css')));
    assert.ok(cacheAssets.includes(scope));
    listeners.activate({
      waitUntil(p) {
        task = p;
      },
    });
    await task;
    assert.ok(claimed);
    assert.ok(stored.has('another-app-v1'));
    assert.ok(stored.has('mathmagician-/different/-old'));
    assert.ok(!stored.has('mathmagician-/-old'));
    listeners.fetch({
      request: {
        url: scope + '?source=installed',
        method: 'GET',
        mode: 'navigate',
      },
      respondWith(p) {
        task = p;
      },
    });
    assert.match(await task, /<title>Mathmagician/);
    const js = cacheAssets.find((p) => p.endsWith('.js'));
    listeners.fetch({
      request: { url: js, method: 'GET', mode: 'cors' },
      respondWith(p) {
        task = p;
      },
    });
    assert.ok((await task).length > 0);
    assert.equal(networkCalls, 0);
    listeners.fetch({
      request: { url: scope + 'llms.txt', method: 'GET', mode: 'navigate' },
      respondWith(p) {
        task = p;
      },
    });
    assert.match(await task, /^# Mathmagician/);
    listeners.fetch({
      request: {
        url: scope + 'does-not-exist',
        method: 'GET',
        mode: 'navigate',
      },
      respondWith(p) {
        task = p;
      },
    });
    await assert.rejects(task, /Offline/);
    assert.equal(
      networkCalls,
      1,
      'Unknown routes must reach the network, not become a soft 404',
    );
    let intercepted = false;
    for (const request of [
      { url: 'https://other.test/', method: 'GET', mode: 'navigate' },
      { url: scope, method: 'POST', mode: 'cors' },
    ])
      listeners.fetch({
        request,
        respondWith() {
          intercepted = true;
        },
      });
    assert.equal(intercepted, false);
  },
);
