import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseHeaders, renderHeaders, cspPolicies } from './hosting-policy.mjs';

export async function buildSecurity(output, basePath) {
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

  const html = await readFile(join(output, 'index.html'), 'utf8');
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
  const rules = parseHeaders(await readFile('public/_headers', 'utf8')).map(
    (rule) => ({
      ...rule,
      source: `${basePath}${rule.source}`,
      headers: rule.headers.map((header) =>
        header.key === 'Service-Worker-Allowed'
          ? { ...header, value: `${basePath}/` }
          : header,
      ),
    }),
  );
  const global = rules.find((rule) => rule.source === `${basePath}/*`);
  global.headers.push(
    ...policies.map((value) => ({ key: 'Content-Security-Policy', value })),
  );
  if (basePath) {
    rules.push({
      source: basePath,
      headers: [...global.headers, { key: 'Cache-Control', value: 'no-cache' }],
    });
  }
  await writeFile(join(output, '_headers'), renderHeaders(rules));
  // Outside the public directory: deployment metadata is never served as a page.
  await writeFile(
    'dist/hosting-policy.json',
    JSON.stringify({ basePath, rules }, null, 2),
  );
  console.log(
    `Security: ${hashes.length} inline script hashes allowlisted; error page needs no JavaScript.`,
  );
}
