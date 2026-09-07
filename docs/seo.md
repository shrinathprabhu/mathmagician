# Search and answer-engine readiness

The canonical URL is **https://lowkey.tools/mathmagician**. The Sites deployment remains an owner-only preview; search engines cannot index an authenticated preview. These changes prepare the app for public deployment on the canonical host, but do not configure Lowkey Tools, its CDN, DNS, or search-engine accounts.

## Implemented

- One canonical URL across HTML, Open Graph, sharing, sitemap, JSON-LD, and Markdown documents.
- Descriptive title and description, authorship, Open Graph/X metadata, language, and index/follow directives.
- Static HTML instructions, mode descriptions, example arithmetic, scoring definitions, local-storage/offline limitations, and native FAQ disclosures. These remain readable without JavaScript; gameplay requires it.
- A connected JSON-LD graph describing the WebApplication, WebPage, Lowkey Tools WebSite, breadcrumb, FAQPage, Shrinath Prabhu, and OwlEye. FAQ answers come from the same data as the visible page. No invented ratings, reviews, measured averages, or performance claims.
- Sitemap, robots.txt, llms.txt, and an alternate Markdown guide at `index.md`. Discovery links appear in the document head. The Markdown copy gets an HTTP `noindex` header to avoid competing with the interactive canonical page; it is still publicly fetchable.
- Contextual links to OwlEye and Shrinath in creator cards, the introduction to the makers, and the footer, plus explicit authorship and publisher relationships. Links are ordinary crawlable anchors without `nofollow`.
- A manifest, normal/maskable/Apple icons, isolated service-worker scope, offline precaching, no-cache rules for the app shell/worker, and immutable caching for hashed assets.
- One main landmark and H1, labeled sections and controls, a skip link, keyboard support, reduced motion, mobile numeric input with a minus-sign control, safe-area insets, and viewport resizing for the keyboard. Pinch zoom stays enabled.
- Timer display updates isolated from the game page and paused while the page is hidden; actual game deadlines never pause. Tailwind scans only authored pages and the primitives the app uses.
- Real missing routes remain missing: the service worker does not replace every navigation with the app shell.

## Deploy at the canonical path

```sh
npm ci
npm run build:canonical
MATHMAGICIAN_BASE_PATH=/mathmagician npm test
MATHMAGICIAN_BASE_PATH=/mathmagician npm start
```

Serve **the contents** of `dist/client/` under `/mathmagician/`. Static assets are physically stored under `_next/` in that directory, and references are prefixed `/mathmagician/_next/`. The build also prefixes `_headers` rules. The normal `npm run build` creates the separate root-hosted Sites preview; do not upload the subpath variant to the preview root.

Serve `/mathmagician` and `/mathmagician/` using the exported index.html. The canonical tag selects the exact URL without the trailing slash. The manifest and worker use explicit prefixed URLs, so either document address works. Preserve genuine 404 status codes for unknown paths; do not configure an unrestricted SPA fallback. If the hosting platform does not consume `_headers`, translate those rules into its native response-header configuration. Enable gzip or Brotli at the host.

### Root-domain crawler integration

Crawlers read **https://lowkey.tools/robots.txt**, not `/mathmagician/robots.txt`. Merge the following sitemap declaration into the existing root file without replacing rules for other tools:

```text
Sitemap: https://lowkey.tools/mathmagician/sitemap.xml
```

Ensure existing root rules and CDN controls allow the app HTML, `/mathmagician/_next/`, images, manifest, and public documents. The app's generated `robots.txt` is suitable for the standalone root deployment; its subpath copy alone cannot change main-host crawl policy. Keep private or unrelated paths protected.

Also add the app sitemap to the existing root sitemap index if that is how Lowkey Tools lists its tools:

```xml
<sitemap>
  <loc>https://lowkey.tools/mathmagician/sitemap.xml</loc>
</sitemap>
```

Add a contextual Mathmagician link to the Lowkey Tools directory and append this entry to the root site's llms.txt, preserving its other content:

```markdown
- [Mathmagician](https://lowkey.tools/mathmagician/llms.txt): Free timed mental math game, rules, scoring, and creator information.
```

### Public launch verification

After the canonical host is deployed, check that the canonical page and its assets/docs return 200 without authentication or an HTTP `noindex` directive; check an unknown route returns 404. Verify the canonical, manifest, SW scope, and cache rules on that actual host. Submit the app sitemap to the existing verified Google Search Console and Bing Webmaster Tools properties, then inspect the canonical URL. No verification tokens or account registrations are fabricated in this project.

Run mobile interaction, on-device installation/offline checks, Google Rich Results Test or Schema Markup Validator, and Lighthouse on the public URL. Automated repository checks cover generated artifacts, core game behavior, and worker logic; they are not a browser, device, Core Web Vitals, or indexing measurement.

## AEO/GEO scope and references

The strongest support for answer and generative engines is clear, useful text, consistent identity, accurate structured data, ordinary links, and a crawlable public site. `llms.txt` is an optional discovery proposal for services that support it; Google says it does not use these files for visibility or rankings. FAQ markup describes the visible FAQ using Schema.org; Google retired FAQ rich results in May 2026.

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: robots.txt introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Google: generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google: FAQ feature retirement](https://developers.google.com/search/updates#may-2026)
- [Schema.org: WebApplication](https://schema.org/WebApplication)
- [The llms.txt proposal](https://llmstxt.org/)

No implementation can guarantee indexing, rankings, citations, or AI answer inclusion.
