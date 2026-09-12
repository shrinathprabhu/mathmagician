import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { compactRscScripts } from '../scripts/build-security.mjs';

void test('RSC compaction preserves HTML, script boundaries, and hydration data order', () => {
  const push = (value) =>
    `<script>((self[Symbol.for("vinext.navigationRuntime")]??={bootstrap:{routeManifest:null},functions:{}}).bootstrap.rsc??={rsc:[]}).rsc.push(${JSON.stringify(value)})</script>`;
  const original = `<html><head>${push('head')}</head><body><main><h1>Game</h1></main><script type="application/ld+json">{"name":"Game"}</script>${push('first')}${push('second')}<p>Keep this</p>${push('third')}<script src="/app.js"></script>${push('fourth')}</body></html>`;
  const compact = compactRscScripts(original);
  const stripScripts = (html) =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert.equal(stripScripts(compact), stripScripts(original));
  assert.ok(
    compact.includes(
      '<script type="application/ld+json">{"name":"Game"}</script>',
    ),
  );
  assert.ok(compact.includes('<script src="/app.js"></script>'));
  assert.equal([...compact.matchAll(/<script>/g)].length, 4);
  const data = (html) => {
    const self = {};
    for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
      runInNewContext(body, { self });
    return JSON.stringify(self[Symbol.for('vinext.navigationRuntime')]);
  };
  assert.equal(data(compact), data(original));
  assert.equal(compactRscScripts(compact), compact);
});
