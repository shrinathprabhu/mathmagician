# Deploy on Cloudflare Workers

Mathmagician deploys with **Workers Static Assets**. It remains a frontend-only PWA with a small hosting-only Worker fallback for error responses. Gameplay, scores, and storage stay in the browser; no server rendering, database, or runtime secrets are required. `cloudflare/wrangler.jsonc` selects the Worker name, the `mathmagician.lowkey.tools` custom domain, and the exported `dist/client` assets. The canonical homepage remains **https://mathmagician.lowkey.tools/**.

## Workers Builds settings

Create a **Worker**, connect its Git repository, and set these values under **Settings → Build**:

| Setting                              | Value                                                             |
| ------------------------------------ | ----------------------------------------------------------------- |
| Worker name                          | `mathmagician` (must match the Wrangler configuration)            |
| Production branch                    | `main`                                                            |
| Root directory                       | Repository root                                                   |
| Build command                        | `npm ci --include=dev && npm run build:workers`                   |
| Deploy command                       | `npm run deploy`                                                  |
| Non-production branch deploy command | `npx wrangler versions upload --config cloudflare/wrangler.jsonc` |
| Build variable                       | `SKIP_DEPENDENCY_INSTALL=1`                                       |
| Node.js                              | `24`, selected by `.node-version`                                 |

The explicit `npm ci --include=dev` installs the checked-in lockfile and build tools, including Tailwind, even if the build environment sets `NODE_ENV=production`; the build variable disables a duplicate automatic install. Set any existing dashboard `NODE_VERSION` override to `24`. Workers Builds uses build and deploy commands; there is no Pages framework preset or build-output-directory setting to enter. The asset directory comes from Wrangler. Non-production uploads create versions without promoting them to production; the configuration explicitly enables Preview URLs and the `workers.dev` hostname.

All Wrangler commands explicitly select the nested configuration. Its `../dist/client` path resolves relative to `cloudflare/wrangler.jsonc`. Keeping the configuration outside the repository root prevents Vinext from switching this static export into its server-side Workers build path. Keep build commands at the repository root. The compatibility date is pinned to `2026-09-10`, supported by the checked-in Wrangler version's local runtime.

References: [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build image and Node version](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/), [Static Assets configuration](https://developers.cloudflare.com/workers/static-assets/binding/).

## Troubleshooting automatic framework setup

Use the deploy command above, not a bare `npx wrangler deploy` from the repository root. Wrangler can automatically configure a framework when it does not find a root configuration; this project intentionally keeps its configuration at `cloudflare/wrangler.jsonc`. Automatic setup can select a different build path or generate a new Vite configuration. See [Cloudflare automatic configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/).

A log saying `Running custom build npm run build` during the deploy step does not match this repository's deployment configuration: the checked-in Wrangler file has no custom build command. Check that the build uses the current commit, the root directory is the repository root, and the deploy command is `npm run deploy` (or `npx wrangler deploy --config cloudflare/wrangler.jsonc`). Set the non-production branch command to the explicit `versions upload --config` command in the table too.

If CSS fails trying to open `<repo>/tailwindcss`, verify that `npm ci --include=dev` ran successfully. Tailwind is configured in the root `postcss.config.mjs`, which Vite loads automatically. Keep that file in the deployment commit; there is no separate file named `tailwindcss` to create in the repository root.

## Local build and preview

```sh
npm ci
npm run build:workers
npm run preview:workers
```

Open the local URL printed by Wrangler. This runs the native Workers static-asset runtime, including the generated security headers, cache policy, and HTML routing. It does not publish anything. Pass `-- --port 8876` if the default port is occupied.

To validate deployment packaging without publishing:

```sh
npx wrangler deploy --config cloudflare/wrangler.jsonc --dry-run
```

`build:workers` generates HTML, discovery files, the complete offline precache, and CSP hashes for that exact HTML. Wrangler uploads **`dist/client` as static assets** and bundles `cloudflare/worker.mjs` as the fallback handler. It reads the generated `_headers` as deployment policy; the file is not publicly served. `dist/server` contains framework intermediates or the separate Sites preview adapter and is never uploaded to this Worker.

## Deploy from a local checkout

Authenticate once with your Cloudflare account, then build and deploy:

```sh
npx wrangler login
npm run deploy:workers
```

The command builds first, then runs `wrangler deploy` with the nested configuration. For non-production versions, build and use `npx wrangler versions upload --config cloudflare/wrangler.jsonc` instead. Use `npm run deploy` as the dashboard deploy command after its build step; it selects the checked-in configuration without rebuilding. `deploy:workers` includes a build for use from a local checkout.

## Production hostname

The checked-in Wrangler configuration declares the domain:

```json
{
  "routes": [{ "pattern": "mathmagician.lowkey.tools", "custom_domain": true }]
}
```

`npm run deploy:workers` builds and deploys the Worker and applies this custom-domain association. You do not need to add it manually in the dashboard. The `lowkey.tools` zone must be active in the deploying Cloudflare account. Cloudflare provisions the DNS record and certificate; resolve any existing conflicting CNAME or domain association during cutover. See [Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

The route pattern is a hostname only, without `https://`, a path, a trailing slash, or a wildcard. This does not change the trailing slash in the canonical URL. `workers_dev` and `preview_urls` are explicitly enabled for the default Cloudflare hostname and version previews. To review a new version without moving production traffic, use the documented `wrangler versions upload` command. Builds, local previews, and `--dry-run` do not deploy or change DNS.

Canonical, Open Graph, JSON-LD, sitemap, share text, and `llms.txt` continue to identify `https://mathmagician.lowkey.tools/`. The manifest and service worker retain scope `/`; there is no `/mathmagician` proxy prefix.

## Routing, security, and caching

`assets.html_handling: "auto-trailing-slash"` normalizes HTML URLs. `assets.not_found_handling: "404-page"` serves the exported error document with HTTP 404 for unknown paths, including missing assets. It does not rewrite every URL to the homepage. Existing assets bypass `cloudflare/worker.mjs`; unmatched requests reach this small handler, which preserves the static error document and security headers while setting `Cache-Control: no-store` and `X-Robots-Tag: noindex`. This prevents a missing hashed file from inheriting the one-year cache rule. `assets_navigation_has_no_effect` ensures missing browser navigations use the same fallback. See [static sites and custom 404 pages](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/).

Workers reads `dist/client/_headers` directly. The policy includes the build-specific CSP, HSTS, framing/MIME protection, permissions, and browser caching. HTML, the service worker, and the manifest revalidate; hashed assets are immutable for one year. Use the generated `_headers`, since its source template does not contain the final CSP hashes. See [shared security policy](security.md) and [Workers headers](https://developers.cloudflare.com/workers/static-assets/headers/).

Keep managed asset caching. Avoid a zone-wide Cache Everything rule or post-build HTML/script transformations that could cache an old shell or invalidate the CSP. The fallback copies the headers from `ASSETS.fetch()` and adjusts only the 404 policy. Any future response generated independently by Worker code will need explicit security headers; `_headers` applies to static asset responses.

After deployment, verify the public hostname serves the homepage, scripts, fonts, manifest, `sw.js`, `og.jpg`, and discovery files without authentication; check CSP/cache headers, a real 404, and installation/offline play on a device. Local validation does not verify account-level rules, DNS, TLS, or a live deployment.
