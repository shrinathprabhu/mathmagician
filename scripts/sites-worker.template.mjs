// Hosting adapter only: all gameplay and persistence remain in the browser.
/* oxlint-disable no-undef */
const BASE = __BASE__;
const RULES = __RULES__;
const FILES = new Set(__FILES__);
const NOT_FOUND = __NOT_FOUND__;

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
  async fetch(request, env) {
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
    if (!inScope || !FILES.has(path) || path === '/404.html') {
      headers.set('Cache-Control', 'no-store');
      headers.set('X-Robots-Tag', 'noindex');
      headers.set('Content-Type', 'text/html; charset=utf-8');
      return new Response(request.method === 'HEAD' ? null : NOT_FOUND, {
        status: 404,
        headers,
      });
    }
    url.pathname = home ? '/' : path;
    const asset = await env.ASSETS.fetch(new Request(url, request));
    const result = new Response(asset.body, asset);
    for (const [key, value] of headers) result.headers.set(key, value);
    if (asset.status >= 400) {
      result.headers.set('Cache-Control', 'no-store');
      result.headers.set('X-Robots-Tag', 'noindex');
    }
    return result;
  },
};

export default worker;
