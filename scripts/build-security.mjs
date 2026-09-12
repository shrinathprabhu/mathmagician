import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseHeaders, renderHeaders, cspPolicies } from './hosting-policy.mjs';

export function compactRscScripts(html) {
  // Static exports no longer stream. Combine only adjacent, data-only RSC
  // pushes, preserving their order and leaving all other scripts untouched.
  const prefix =
    '((self[Symbol.for("vinext.navigationRuntime")]??={bootstrap:{routeManifest:null},functions:{}}).bootstrap.rsc??={rsc:[]}).rsc.push(';
  let result = '';
  let cursor = 0;
  let previousDataOnly = false;
  for (const match of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    const [tag, attributes, body] = match;
    const between = html.slice(cursor, match.index);
    let dataOnly = false;
    if (!attributes && body.startsWith(prefix) && body.endsWith(')')) {
      try {
        dataOnly =
          typeof JSON.parse(body.slice(prefix.length, -1)) === 'string';
      } catch {
        /* A changed runtime format stays untouched. */
      }
    }
    if (dataOnly && previousDataOnly && !between)
      result = `${result.slice(0, -9)};\n${body}</script>`;
    else result += between + tag;
    previousDataOnly = dataOnly;
    cursor = match.index + tag.length;
  }
  return result + html.slice(cursor);
}

export async function buildSecurity(output) {
  // The error page has no interactive controls. Keep its static HTML and styles,
  // and remove the unnecessary hydration runtime and script preload requests.
  const notFound = await readFile(join(output, '404.html'), 'utf8');
  await writeFile(
    join(output, '404.html'),
    notFound
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<link\b[^>]*rel="modulepreload"[^>]*\/?\s*>/gi, ''),
  );

  // Build-time manifests aren't consumed by this exported frontend.
  await rm(join(output, '.vite'), { recursive: true, force: true });
  await rm(join(output, 'vinext-client-entry-manifest.json'), { force: true });

  const html = compactRscScripts(
    await readFile(join(output, 'index.html'), 'utf8'),
  );
  await writeFile(join(output, 'index.html'), html);
  const hashes = [
    ...new Set(
      [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
        .filter((match) => !/\bsrc\s*=/.test(match[1]) && match[2])
        .map(
          (match) =>
            `'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`,
        ),
    ),
  ];
  const policies = cspPolicies(hashes);
  const rules = parseHeaders(await readFile('public/_headers', 'utf8'));
  const global = rules.find((rule) => rule.source === '/*');
  global.headers.push(
    ...policies.map((value) => ({ key: 'Content-Security-Policy', value })),
  );
  await writeFile(join(output, '_headers'), renderHeaders(rules));
  // Outside the public directory: deployment metadata is never served as a page.
  await writeFile(
    'dist/hosting-policy.json',
    JSON.stringify({ rules }, null, 2),
  );
  console.log(
    `Security: ${hashes.length} inline script hashes allowlisted; error page needs no JavaScript.`,
  );
}
