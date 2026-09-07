import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { SITE, FAQS } from '../lib/site-content.ts';
import { getBasePath } from '../lib/base-path.mjs';

const output = 'dist/client';
const base = getBasePath();
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
});

void test('crawler files, Markdown discovery, and asset paths support the selected deployment mount', async () => {
  const [robots, sitemap, llms, markdown, headers] = await Promise.all(
    ['robots.txt', 'sitemap.xml', 'llms.txt', 'index.md', '_headers'].map(
      (name) => readFile(`${output}/${name}`, 'utf8'),
    ),
  );
  assert.ok(robots.includes(`Sitemap: ${SITE.url}/sitemap.xml`));
  assert.match(robots, /User-agent: \*\nAllow: \//);
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, 1);
  assert.ok(sitemap.includes(`<loc>${SITE.url}</loc>`));
  assert.match(llms, /^# Mathmagician\n/);
  assert.ok(llms.includes(`${SITE.url}/index.md`));
  for (const answer of FAQS) assert.ok(markdown.includes(answer.answer));
  assert.ok(html.includes(`href="${SITE.url}/llms.txt"`));
  assert.ok(html.includes(`href="${SITE.url}/index.md"`));
  assert.ok(html.includes(`href="${base}/manifest.webmanifest"`));
  assert.ok(html.includes(`href="${base}/icon.svg"`));
  assert.ok(
    headers.includes(
      `${base}/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable`,
    ),
  );
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const url = match[1];
    if (url.startsWith(`${base}/_next/`))
      await access(`${output}/${url.slice(base.length + 1)}`);
    if (base)
      assert.ok(
        !url.startsWith('/_next/'),
        'No root-only asset references in a subpath build',
      );
  }
  for (const doc of [html, robots, sitemap, llms, markdown])
    assert.ok(!doc.includes('mathmagician.lowkey.tools'));
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
