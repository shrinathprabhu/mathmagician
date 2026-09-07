# Mathmagician

A frontend-only, installable mental math sprint app. All game state and personal records stay in the browser. No API, account, database, analytics, or runtime server is required.

## Run

Node 22.13+ (Node 22.18+ or 24+ recommended for built-in TypeScript test support).

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm start
```

`npm run build` exports static files to `dist/client/` and generates a versioned service worker with a complete asset precache. Deploy the **contents of dist/client/** to an HTTPS static host. `npm start` serves that output locally on port 4173.

## Gameplay

- Five modes: 2 operands, 3 operands with one repeated operator, 3 with mixed operators, 4 with one repeated operator, and 4 with mixed operators.
- Default 30-second round; only 10, 20, 30, 60, and 120 seconds are supported.
- Three-second preparation countdown, followed by a fixed deadline. Backgrounding the app does not pause or extend the round. Answers at or after the deadline do not count.
- Operands are integers from 1 through 20. Operators are +, −, ×, ÷. Division steps are exact, so answers are integers; negative and zero answers are supported.
- Multiplication and division are evaluated left to right before addition and subtraction, also left to right. No `eval` or dynamic code execution.
- Same-operator questions choose an operator independently for each question and repeat it. Mixed questions guarantee at least two distinct operators.
- Correct answers earn one point. Wrong answers and skips advance the question without a point and break the streak. Accuracy includes skips. Reward text uses correct answers per minute; it does not claim competitive rankings across modes.
- Local storage keeps the last 50 results, best scores per mode/duration, and settings. Clearing browser data resets them. Storage failures do not prevent playing.
- Native Web Share, copyable text, X and WhatsApp share links. Social posting remains a user action.

## PWA and hosting

The manifest includes 192/512 icons, a maskable icon, and an Apple touch icon. No third-party fonts or runtime CDN assets are needed. Open once online to complete precaching; then the full game can load offline. Updates activate after old tabs close, keeping the HTML and hashed assets on the same version.

Brand/share URL: **https://mathmagician.lowkey.tools**. Canonical: **https://lowkey.tools/mathmagician**. These metadata settings do not provision DNS or publish a page at the canonical URL. Connecting the domain requires its DNS owner. Serve `sw.js` without long-lived caching. The `_headers` file provides Cloudflare Pages-compatible defaults; configure equivalent headers on other hosts.

If deploying the app itself under `/mathmagician/`, configure the framework's `basePath` before rebuilding so bundle URLs use that prefix, and serve the directory with its trailing-slash URL. PWA asset URLs are relative to the app's scope.

The optional feature-detected WebMCP surface offers `configure_math_round` and `read_math_progress`. It exposes the same settings and local records as the UI and does not submit answers or post scores. Live WebMCP validation requires a supporting browser; it is not required to play.

## Validation

The test suite checks 25,000 seeded generated questions, independent operator precedence, all deadlines, rejection of late/invalid answers, scoring and sharing, local-record validation, and actual generated service-worker install/offline/update behavior. Production artifact tests run after `npm run build` and check its HTML, PWA manifest, and offline cache. Browser interaction/install testing is a separate manual check.
