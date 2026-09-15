// The same parsed rules drive Cloudflare/Sites and the local HTTP preview.
// Duplicate CSP headers are separate policies;
// browsers enforce their intersection, including when joined with a comma.
export function parseHeaders(source) {
  const rules = [];
  let rule;
  for (const line of source.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (line.startsWith('/')) {
      rule = { source: line.trim(), headers: [] };
      rules.push(rule);
    } else {
      const match = line.match(/^\s+([^:]+):\s*(.*)$/);
      if (!rule || !match) throw new Error(`Invalid header rule: ${line}`);
      rule.headers.push({ key: match[1], value: match[2] });
    }
  }
  return rules;
}

export function pathPattern(source) {
  return `^${source
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')}$`;
}

export function joinHeaders(entries) {
  const headers = {};
  for (const { key, value } of entries) {
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }
  return headers;
}

export function headersForPath(rules, pathname) {
  return joinHeaders(
    rules
      .filter((rule) => new RegExp(pathPattern(rule.source)).test(pathname))
      .flatMap((rule) => rule.headers),
  );
}

export function renderHeaders(rules) {
  const text = rules
    .map(
      (rule) =>
        `${rule.source}\n${rule.headers.map(({ key, value }) => `  ${key}: ${value}`).join('\n')}`,
    )
    .join('\n');
  if (
    rules.length > 100 ||
    text.split('\n').some((line) => line.length > 2000)
  ) {
    throw new Error(
      'Generated _headers exceeds Cloudflare limits. Reduce inline scripts or header rules before deploying.',
    );
  }
  return `${text}\n`;
}

export function cspPolicies(hashes) {
  return [
    // Fonts and UI primitives require inline styles; executable scripts get
    // build-specific hashes, never unsafe-inline, unsafe-eval, or a fixed nonce.
    `default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'`,
    "base-uri 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'; media-src 'none'",
  ];
}
