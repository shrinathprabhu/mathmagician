// Existing files are served by Workers Static Assets before this handler runs.
// Missing paths need a status-aware policy: _headers matches the requested URL,
// so a missing hashed asset would otherwise inherit its immutable cache rule.
const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Robots-Tag', 'noindex');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export default worker;
