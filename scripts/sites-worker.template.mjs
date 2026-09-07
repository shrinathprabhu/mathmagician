// Hosting adapter only: all gameplay and persistence remain in the browser.
/* oxlint-disable no-undef */
const BASE = __BASE__;
const RULES = __RULES__;
const FILES = __FILES__;
const decoded = new Map();

function body(path) {
  if (!decoded.has(path))
    decoded.set(
      path,
      Uint8Array.from(atob(FILES[path].body), (char) => char.charCodeAt(0)),
    );
  return decoded.get(path);
}

function responseHeaders(pathname) {
  const headers = new Headers();
  for (const { pattern, headers: values } of RULES) {
    if (new RegExp(pattern).test(pathname))
      for (const [key, value] of Object.entries(values))
        headers.set(key, value);
  }
  return headers;
}

const worker = {
  fetch(request) {
    const url = new URL(request.url);
    const headers = responseHeaders(url.pathname);
    if (!['GET', 'HEAD'].includes(request.method)) {
      headers.set('Allow', 'GET, HEAD');
      headers.set('Cache-Control', 'no-store');
      return new Response(null, { status: 405, headers });
    }
    const home =
      url.pathname === BASE ||
      url.pathname === `${BASE}/` ||
      url.pathname === `${BASE}/index.html`;
    const path = home ? '/index.html' : url.pathname.slice(BASE.length);
    const inScope =
      !BASE || url.pathname === BASE || url.pathname.startsWith(`${BASE}/`);
    if (!inScope || !Object.hasOwn(FILES, path) || path === '/404.html') {
      headers.set('Cache-Control', 'no-store');
      headers.set('X-Robots-Tag', 'noindex');
      headers.set('Content-Type', 'text/html; charset=utf-8');
      return new Response(
        request.method === 'HEAD' ? null : body('/404.html'),
        {
          status: 404,
          headers,
        },
      );
    }
    const file = FILES[path];
    if (!headers.has('Content-Type')) headers.set('Content-Type', file.type);
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-cache');
    headers.set('ETag', file.etag);
    const tags = request.headers.get('If-None-Match')?.split(',') || [];
    if (
      tags.some(
        (tag) =>
          tag.trim() === '*' || tag.trim().replace(/^W\//, '') === file.etag,
      )
    )
      return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : body(path), {
      headers,
    });
  },
};

export default worker;
