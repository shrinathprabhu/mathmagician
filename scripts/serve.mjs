// A local static preview only; the deployed app needs no server runtime.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { getBasePath } from '../lib/base-path.mjs';
const root = resolve('dist/client');
const basePath = getBasePath();
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.md': 'text/markdown; charset=utf-8',
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (
      basePath &&
      pathname !== basePath &&
      !pathname.startsWith(basePath + '/')
    )
      throw new Error('Outside app');
    let path = resolve(root, '.' + (pathname.slice(basePath.length) || '/'));
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    res.writeHead(200, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
      'Cache-Control':
        extname(path) === '.html' || path.endsWith('sw.js')
          ? 'no-cache'
          : 'public,max-age=3600',
    });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(Number(process.env.PORT || 4173), 'localhost', () =>
  console.log(
    `Mathmagician: http://localhost:${process.env.PORT || 4173}${basePath}/`,
  ),
);
