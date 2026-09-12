import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { SITE, FAQS, RELATED_APPS } from '../lib/site-content.ts';

const output = 'dist/client';
const html = await readFile(`${output}/index.html`, 'utf8');
const plain = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"');

void test('canonical identity, connected JSON-LD, and FAQs agree with the static HTML', () => {
  assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
  assert.ok(html.includes(`rel="canonical" href="${SITE.url}"`));
  assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1);
  assert.equal([...html.matchAll(/<main[ >]/g)].length, 1);
  assert.match(html, /href="#main-content"/);
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /<html[^>]*lang="en"/);
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /maximum-scale=1|user-scalable=no/);
  const data = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  const graph = data['@graph'];
  const ids = graph.map((node) => node['@id']);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    graph.find((node) => node['@type'] === 'WebApplication').url,
    SITE.url,
  );
  assert.equal(
    graph.find((node) => node['@type'] === 'WebApplication').offers.price,
    0,
  );
  const faq = graph.find((node) => node['@type'] === 'FAQPage');
  const section = html.match(/<section id="faq"[\s\S]*?<\/section>/)[0];
  assert.equal([...section.matchAll(/<details[ >]/g)].length, FAQS.length);
  for (const question of faq.mainEntity) {
    assert.ok(plain(section).includes(question.name));
    assert.ok(plain(section).includes(question.acceptedAnswer.text));
  }
  for (const url of [SITE.creator.url, SITE.publisher.url]) {
    const anchors = [
      ...html.matchAll(
        new RegExp(`<a[^>]*href="${url.replaceAll('.', '\\.')}"[^>]*>`, 'g'),
      ),
    ];
    assert.ok(
      anchors.length >= 3,
      `${url} has visible contextual links and credit`,
    );
    assert.ok(anchors.every(([tag]) => !tag.includes('nofollow')));
  }
  for (const url of [
    SITE.creator.social,
    'https://lowkey.tools',
    ...RELATED_APPS.map((app) => app.url),
  ])
    assert.ok(html.includes(`href="${url}"`), `Visible backlink: ${url}`);
  assert.deepEqual(graph.find((node) => node['@type'] === 'Person').sameAs, [
    SITE.creator.social,
  ]);
  assert.equal(RELATED_APPS.length, 1);
  assert.equal(
    graph.find((node) => node['@type'] === 'WebApplication').image,
    SITE.image.url,
  );
  assert.equal(
    graph.find((node) => node['@type'] === 'WebPage').primaryImageOfPage.url,
    SITE.image.url,
  );
  assert.ok(html.includes(`property="og:image" content="${SITE.image.url}"`));
  assert.ok(
    html.includes(`property="og:image:width" content="${SITE.image.width}"`),
  );
  assert.ok(
    html.includes(`property="og:image:height" content="${SITE.image.height}"`),
  );
  assert.ok(html.includes(`name="twitter:image" content="${SITE.image.url}"`));
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

void test('crawler files, Markdown discovery, and asset paths use the standalone subdomain root', async () => {
  const [robots, sitemap, llms, markdown, headers] = await Promise.all(
    ['robots.txt', 'sitemap.xml', 'llms.txt', 'index.md', '_headers'].map(
      (name) => readFile(`${output}/${name}`, 'utf8'),
    ),
  );
  assert.ok(
    robots.includes('Sitemap: https://mathmagician.lowkey.tools/sitemap.xml'),
  );
  assert.match(robots, /User-agent: \*\nAllow: \//);
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, 1);
  assert.ok(sitemap.includes(`<loc>${SITE.url}</loc>`));
  assert.match(llms, /^# Mathmagician\n/);
  assert.ok(llms.includes('https://mathmagician.lowkey.tools/index.md'));
  for (const answer of FAQS) assert.ok(markdown.includes(answer.answer));
  assert.ok(html.includes('href="https://mathmagician.lowkey.tools/llms.txt"'));
  assert.ok(html.includes('href="https://mathmagician.lowkey.tools/index.md"'));
  assert.ok(html.includes('href="/manifest.webmanifest"'));
  assert.ok(html.includes('href="/mathmagician.svg"'));
  assert.ok(
    headers.includes(
      '/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable',
    ),
  );
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const url = match[1];
    if (url.startsWith('/_next/')) await access(`${output}${url}`);
    assert.ok(
      !url.startsWith('/mathmagician/'),
      'No obsolete subpath asset references',
    );
  }
  for (const doc of [html, robots, sitemap, llms, markdown]) {
    assert.ok(!doc.includes('lowkey.tools/mathmagician'));
    assert.ok(
      !doc.includes('mathmagician.lowkey.tools//'),
      'No doubled URL path separators',
    );
  }
  assert.equal(SITE.url, 'https://mathmagician.lowkey.tools/');
  assert.equal(
    SITE.url,
    new URL(SITE.url).href,
    'Canonical uses normalized root URL',
  );
  assert.equal(SITE.image.url, 'https://mathmagician.lowkey.tools/og.jpg');
  const socialImage = await readFile(`${output}/og.jpg`);
  assert.equal(socialImage.subarray(0, 3).toString('hex'), 'ffd8ff');
  assert.ok(socialImage.length < 400_000, 'Social image stays below 400 kB');
  for (const app of RELATED_APPS)
    assert.ok(llms.includes(app.url) && markdown.includes(app.url));
});

void test('stylesheet budget excludes unused starter components', async () => {
  const files = await readdir(`${output}/_next/static/css`);
  let bytes = 0;
  for (const file of files.filter((name) => name.endsWith('.css')))
    bytes += gzipSync(
      await readFile(`${output}/_next/static/css/${file}`),
    ).length;
  assert.ok(bytes < 16000, `Compressed CSS budget: ${bytes} bytes`);
});
