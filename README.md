# Mathmagician

A frontend-only, installable mental math sprint app. Game state and personal records stay in the browser. No API, account, database, analytics, or runtime server is required.

## Run

Use Node 22.18+ or 24+ for built-in TypeScript test support.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
npm test
npm start
```

The build exports static files to `dist/client/` and generates a versioned service worker with a full asset precache. Deploy the contents of that directory to an HTTPS static host. `npm start` serves the output locally on port 4173.

## Gameplay

Four difficulty modes set operand ranges: Kids 0–20, Adult 0–50, Legendary 0–100, and God 0–1,000. Operands themselves are nonnegative; Adult, Legendary, and God allow negative answers. Kids also excludes negative intermediate calculations. Division never has a zero divisor and always produces an integer.

Each difficulty supports the same five expression challenges: two operands, three with a repeated operator, three with mixed operators, four with a repeated operator, and four with mixed operators. The repeated operator is randomly selected per question; mixed challenges guarantee at least two different operators. Normal multiplication/division and addition/subtraction precedence applies, left to right within each level.

Rounds default to 30 seconds; only 10, 20, 30, 60, and 120 seconds are supported. The three-second countdown is excluded from the game clock. Backgrounding does not pause or extend the round; submissions at the deadline do not count.

A numeric input replaces the custom number pad. Letters, decimal fractions, exponents, and malformed signs are rejected. Signed integers are accepted outside Kids mode, with a single ± control for mobile keyboards that lack a minus key. The field supports every possible generated result, including the 13-digit maximum in God mode.

Each correct expression earns one point. Wrong answers and skips earn none, advance the question, break the streak, and count toward accuracy. Live question timing, per-attempt seconds, and average time per correct answer show pace. Prominent replay and change-challenge controls sit directly below results.

A score-to-beat target scales with difficulty, challenge, and duration. Six message bands compare the result with that target. Targets are clearly labeled estimates, not population averages. See [benchmark rationale and research](docs/benchmarks.md).

The last 50 results and best scores are stored separately for each difficulty/challenge/duration under `mathmagician.v2`. Original `v1` data remains untouched; earlier rounds appear in an archive using their original rules. Unavailable browser storage does not prevent gameplay.

## Sharing and credits

All app, social-share, Open Graph, canonical, footer, and sitemap references use **https://lowkey.tools/mathmagician**. Native Web Share, clipboard, X, and WhatsApp remain user-triggered actions. The footer matches [Lowkey Tools](https://lowkey.tools): links to [OwlEye Analytics](https://owleye.dev) and [Shrinath](https://shrinath.me).

## PWA and deployment

The manifest contains 192/512 icons, a maskable icon, and an Apple touch icon. No runtime third-party fonts or CDN assets are required. Open once online to precache; then the game works offline. Updates activate after old tabs close so HTML and its hashed assets stay on one version.

The Sites preview is hosted at its own root. Use `npm run build:canonical` for **lowkey.tools/mathmagician**, then serve the contents of `dist/client/` at that prefix. The build sets script, stylesheet, icon, manifest, service-worker, and response-header paths automatically. `MATHMAGICIAN_BASE_PATH=/mathmagician npm start` previews that variant locally. Link metadata alone does not publish into the existing Lowkey Tools website, and a URL path does not require a separate DNS record.

## Search and answer engines

The page includes static rules and FAQs, linked JSON-LD entities, search/social metadata, and prominent OwlEye and Shrinath creator links. `lib/site-content.ts` supplies both the visible guide and structured data. The build generates matching `robots.txt`, `sitemap.xml`, `llms.txt`, and `index.md` files. The game remains the primary page content.

See [SEO and canonical deployment notes](docs/seo.md) for the root-domain robots/sitemap/llms integration, public indexing requirements, and verification steps. An authenticated Sites preview is not search-indexable. `llms.txt` is optional discovery support, not a guarantee of AI citations.

The optional WebMCP surface exposes the same settings and local record state via `configure_math_round` (mode, level, duration) and `read_math_progress`. Live contract validation requires a supporting browser and is not needed for gameplay.

## Checks

Tests cover 100,000 seeded questions across all difficulty/challenge combinations, zero and negative handling, division safety, 100 timed configurations, per-question timing, numeric-only input and large answers, comparison bands, separate personal bests, original-rule archives, metadata/JSON-LD consistency, crawl files, deployment asset paths, a compressed CSS budget, and generated-service-worker offline/cache/404 behavior. Run artifact tests after a production build; use `MATHMAGICIAN_BASE_PATH=/mathmagician npm test` for the canonical build. Lint targets authored application code; vendored starter components remain unchanged. Browser interaction and on-device PWA installation are separate manual checks.
