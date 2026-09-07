# Security, caching, and Vercel

This is a static browser app without an API or server runtime. `public/_headers` is the shared policy template. After exporting HTML, `scripts/build-security.mjs` adds hashes for the exact inline scripts in that build. It writes Sites/Cloudflare `_headers` and private build metadata; `scripts/build-vercel.mjs` translates the same policy into Vercel Build Output API routes.

## Response headers

- Content Security Policy permits scripts from the app origin and build-specific SHA-256 hashes. It does not allow `unsafe-inline` JavaScript, `unsafe-eval`, or reused nonces. All generated inline scripts, including JSON-LD and hydration data, are checked against the policy.
- Styles allow inline CSS for React, UI primitives, and local font declarations. Fonts, images, and network requests otherwise default to the same origin. No third-party analytics or font origins are allowlisted.
- Framing, embedded objects, media, and base-URL injection are disabled. Workers, manifests, and forms stay on the app origin. `X-Frame-Options: DENY` supplements CSP framing protection.
- HSTS lasts one year on HTTPS responses. It intentionally does not opt other subdomains into HSTS or request preload registration.
- MIME sniffing and cross-origin resource embedding are disabled. Referrers use `strict-origin-when-cross-origin`.
- Permissions Policy disables unused camera, microphone, location, payment, sensor, and USB capabilities while preserving same-origin clipboard writes and Web Share.

The CSP is emitted as two policies to stay below Cloudflare's 2,000-character header-line limit. Browsers enforce both policies together. The build fails if that limit or the 100-rule limit is exceeded. The static 404 page has no hydration scripts, and internal Vite/client-entry manifests are removed from public output.

If adding external scripts, analytics, embedded content, or a platform preview toolbar, review their CSP requirements explicitly. Inline scripts injected after the build will be blocked. Do not solve that by adding a blanket `unsafe-inline` script exception. Provider-generated authentication/error pages can have their own headers.

## Cache policy

| Resource                                                      | HTTP cache policy                        |
| ------------------------------------------------------------- | ---------------------------------------- |
| Homepage, HTML shell, RSC text, manifest, service worker      | Revalidate on every request (`no-cache`) |
| Hashed JavaScript, CSS, and font assets under `_next/static/` | One year, immutable                      |
| Unversioned icons and font license documents                  | One day, then revalidate                 |
| robots.txt, sitemap.xml, llms.txt, Markdown guide             | One hour                                 |
| Missing pages / 404                                           | `no-store`, `noindex`                    |

Vercel supplies CDN compression and its normal conditional response handling. The app does not override these with a separate surrogate cache that could outlive the browser policy.

Offline caching is separate from HTTP caching. The service worker precaches a consistent release and activates after older tabs close. Its version includes response-header rules, so a policy-only change replaces previously cached HTML too. Registration uses `updateViaCache: 'none'` to bypass HTTP caches when checking worker updates. A tab already open offline continues using its installed release until it reconnects and updates.

## Deploy on Vercel

The checked-in `vercel.json` selects the custom static build and runs:

```sh
npm ci
npm run build:vercel
```

The result is `.vercel/output/config.json` plus `.vercel/output/static/`, using Build Output API version 3. Vercel reads this output directly; do not select a Next.js server preset or add an unrelated Output Directory override. Deployment credentials and project linking are separate from this repository configuration.

For a deployment mounted at the canonical path, set the Vercel build environment variable `MATHMAGICIAN_BASE_PATH=/mathmagician`, or build locally with:

```sh
MATHMAGICIAN_BASE_PATH=/mathmagician npm run build:vercel
MATHMAGICIAN_BASE_PATH=/mathmagician npm test
```

The generated files and rules are scoped to `/mathmagician`. Both `/mathmagician` and `/mathmagician/` serve the homepage; metadata consistently identifies `https://lowkey.tools/mathmagician`. Only the homepage rewrites to `index.html`. Files are resolved normally and unknown app paths receive the exported error page with HTTP 404. There is no catch-all rewrite that returns the homepage with status 200.

When integrating into the existing Lowkey Tools deployment, merge the scoped assets and routes into its build output, preserving routes for the other tools. This standalone project's configuration does not alter that other deployment. Keep the root-domain crawler integration in [SEO deployment notes](seo.md).

For Sites, use `npm run build` and deploy `dist/client/` at the preview root. For local HTTP checks, `npm start` applies the generated `_headers` policy; use `MATHMAGICIAN_BASE_PATH=/mathmagician npm start` after a canonical build.

After a real Vercel/canonical deployment, inspect response headers on the homepage, one hashed asset, manifest, service worker, and a missing URL. Confirm the same checks on the public hostname, since a reverse proxy or authentication gateway can change responses. Repository checks validate generated policy and artifacts, not account-level firewall settings.

References: [Vercel security headers](https://vercel.com/docs/cdn-security/security-headers), [Build Output API configuration](https://vercel.com/docs/build-output-api/configuration), [Cloudflare static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).
