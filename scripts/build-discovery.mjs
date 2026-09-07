import { writeFile } from 'node:fs/promises';
import { SITE, FAQS, HOW_TO_PLAY, RESEARCH_URL } from '../lib/site-content.ts';
import { LEVELS, MODES } from '../lib/game.ts';

const llms = `# Mathmagician

> ${SITE.summary}

Canonical page: ${SITE.url}

The game is free, frontend-only, and needs JavaScript. Four difficulty modes support five expression challenges and 10, 20, 30, 60, or 120-second rounds. Correct whole-number answers earn one point per expression. Targets are editorial practice estimates, not measured human averages. Records stay in this browser; offline play works after the first successful cache.

## Game and rules
- [Play Mathmagician](${SITE.url}): Canonical interactive game with visible rules, FAQs, and creator credits.
- [Complete game guide](${SITE.url}/index.md): Markdown version of the rules, modes, scoring, timing, offline support, and limitations shown on the game page.
- [Frequently asked questions](${SITE.url}#faq): Direct answers about arithmetic, scoring, and installation.

## Makers
- [OwlEye Analytics](${SITE.publisher.url}): Cookie-free web analytics; Mathmagician is from the makers of OwlEye.
- [Shrinath Prabhu](${SITE.creator.url}): Mathmagician’s builder; frontend engineering, projects, and writing.
- [Lowkey Tools](https://lowkey.tools): The collection that includes Mathmagician.

## Reference
- [Arithmetic research](${RESEARCH_URL}): Context for practice-target estimates; it does not measure these game modes or establish a Mathmagician player average.
`;
const guide = `# Mathmagician — game guide

> ${SITE.summary}

Canonical page: ${SITE.url}
This Markdown document mirrors the public game guide and FAQ. The interactive game is at the canonical page.

## How to play
${HOW_TO_PLAY.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Difficulty modes
${LEVELS.map((l) => `- ${l.name} mode: operands 0–${l.max}; ${l.negatives ? 'negative answers allowed' : 'no negative answers or intermediate results'}.`).join('\n')}

All operands are nonnegative. Mode names describe difficulty, not validated age groups.

## Expression challenges
${MODES.map((m) => `- ${m.name}: ${m.detail}. Example: ${m.example}.`).join('\n')}

## Frequently asked questions
${FAQS.map((faq) => `### ${faq.question}\n\n${faq.answer}`).join('\n\n')}

## Makers and references
Built by [Shrinath Prabhu](${SITE.creator.url}), from the makers of [OwlEye Analytics](${SITE.publisher.url}), as part of [Lowkey Tools](https://lowkey.tools).

[Arithmetic research](${RESEARCH_URL}) provides context for estimated practice targets, not population averages for this app.
`;
await Promise.all([
  writeFile('public/llms.txt', llms),
  writeFile('public/index.md', guide),
  writeFile(
    'public/robots.txt',
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`,
  ),
  writeFile(
    'public/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE.url}</loc></url>\n</urlset>\n`,
  ),
]);
console.log(
  'Discovery: canonical sitemap, robots.txt, llms.txt, and Markdown guide generated.',
);
