// A local static preview only; the deployed app needs no server runtime.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { getBasePath } from '../lib/base-path.mjs';
import { parseHeaders, headersForPath } from './hosting-policy.mjs';
const root = resolve('dist/client');
const basePath = getBasePath();
const rules = parseHeaders(await readFile(resolve(root, '_headers'), 'utf8'));
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.md': 'text/markdown; charset=utf-8',
};
createServer(async (req, res) => {
  let headers = headersForPath(rules, `${basePath}/`);
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    headers = headersForPath(rules, pathname);
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, {
        ...headers,
        Allow: 'GET, HEAD',
        'Cache-Control': 'no-store',
      });
      res.end();
      return;
    }
    if (
      basePath &&
      pathname !== basePath &&
      !pathname.startsWith(basePath + '/')
    )
      throw new Error('Outside app');
    let path = resolve(root, '.' + (pathname.slice(basePath.length) || '/'));
    if (path !== root && !path.startsWith(root + sep))
      throw new Error('Outside app');
    if (
      pathname.split('/').some((part) => part.startsWith('.')) ||
      pathname.endsWith('/_headers')
    )
      throw new Error('Private build file');
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ...headers,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, {
      ...headers,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.end(
      req.method === 'HEAD'
        ? undefined
        : await readFile(resolve(root, '404.html')),
    );
  }
}).listen(Number(process.env.PORT || 4173), 'localhost', () =>
  console.log(
    `Mathmagician: http://localhost:${process.env.PORT || 4173}${basePath}/`,
  ),
);
