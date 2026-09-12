# Search and answer-engine readiness

The canonical URL is **https://mathmagician.lowkey.tools/**. The Sites deployment remains an owner-only preview; search engines cannot index an authenticated preview. These changes prepare the app for public deployment on the canonical host, but do not configure Lowkey Tools, its CDN, DNS, or search-engine accounts.

## Implemented

- One canonical URL across HTML, Open Graph, sharing, sitemap, JSON-LD, and Markdown documents.
- Descriptive title and description, authorship, Open Graph/X metadata, language, and index/follow directives.
- A matching 1732 × 908 social card at `/og.jpg` (about 242 kB), with an absolute canonical image URL, alt text, dimensions, X large-image metadata, and JSON-LD image references. The image uses a one-day revalidated cache policy.
- Static HTML instructions, mode descriptions, example arithmetic, scoring definitions, local-storage/offline limitations, and native FAQ disclosures. These remain readable without JavaScript; gameplay requires it.
- A connected JSON-LD graph describing the WebApplication, WebPage, Lowkey Tools WebSite, breadcrumb, FAQPage, Shrinath Prabhu, and OwlEye. FAQ answers come from the same data as the visible page. No invented ratings, reviews, measured averages, or performance claims.
- Sitemap, robots.txt, llms.txt, and an alternate Markdown guide at `index.md`. Discovery links appear in the document head. The Markdown copy gets an HTTP `noindex` header to avoid competing with the interactive canonical page; it is still publicly fetchable.
- Contextual links to OwlEye and Shrinath in creator cards, the introduction to the makers, and the footer, plus explicit authorship and publisher relationships. Links are ordinary crawlable anchors without `nofollow`.
- A manifest, normal/maskable/Apple icons, isolated service-worker scope, offline precaching, no-cache rules for the app shell/worker, and immutable caching for hashed assets.
- One main landmark and H1, labeled sections and controls, a skip link, keyboard support, reduced motion, mobile numeric input with a minus-sign control, safe-area insets, and viewport resizing for the keyboard. Pinch zoom stays enabled.
- Timer display updates isolated from the game page and paused while the page is hidden; actual game deadlines never pause. Tailwind scans only authored pages and the primitives the app uses.
- Real missing routes remain missing: the service worker does not replace every navigation with the app shell.

## Deploy on the app subdomain

```sh
npm ci
npm run build:vercel
npm test
```

Attach **mathmagician.lowkey.tools** to this Vercel project. The generated `.vercel/output/static/` files are served from the domain root. The manifest lives at `/manifest.webmanifest`, the service worker at `/sw.js` with scope `/`, and scripts/styles/fonts at `/_next/static/`. No proxy rewrite, base-path environment variable, or merge into another app’s deployment is required. See [security and caching](security.md) for the generated Vercel rules.

The generated discovery endpoints are:

- [robots.txt](https://mathmagician.lowkey.tools/robots.txt)
- [sitemap.xml](https://mathmagician.lowkey.tools/sitemap.xml)
- [llms.txt](https://mathmagician.lowkey.tools/llms.txt)
- [Markdown game guide](https://mathmagician.lowkey.tools/index.md)

This hostname has its own robots.txt and sitemap; the root Lowkey Tools site does not control crawling on the app subdomain. Its directory can link directly to the app. The page returns contextual links to Lowkey Tools, Shrinath Prabhu and his X profile, OwlEye Analytics, and a single related tool, SuperSplit.

The Sites URL remains a separate private preview. Its authentication and hostname do not change the app’s public canonical metadata.

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
