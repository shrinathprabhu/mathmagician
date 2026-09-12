import { APP_URL, BENCHMARK_SOURCE, DURATIONS, LEVELS, MODES } from './game.ts';

export const SITE = {
  url: APP_URL,
  title: 'Mathmagician — Free Timed Mental Math Game',
  description:
    'Play a free mental math game with four difficulty modes. Solve arithmetic in 10–120 seconds, track your speed, and share your score. Install and play offline.',
  summary:
    'Mathmagician is a free timed mental math game by Lowkey Tools. Practice addition, subtraction, multiplication, and division in 10-second to 2-minute rounds, then review your speed and share your score.',
  image: {
    url: `${APP_URL}/og.jpg`,
    width: 1732,
    height: 908,
    alt: 'Mathmagician. Fast math. Sharp mind. How many can you solve in 30 seconds?',
  },
  creator: {
    name: 'Shrinath Prabhu',
    url: 'https://shrinath.me',
    social: 'https://x.com/shrinath_prabhu',
  },
  publisher: { name: 'OwlEye Analytics', url: 'https://owleye.dev' },
} as const;

export const RELATED_APPS = [
  {
    name: 'SuperSplit',
    url: 'https://supersplit.lowkey.tools',
    cue: 'DIVISION, WITH FRIENDS',
    title: 'A fair split for the whole table.',
    description:
      'Put the mental maths down after dinner. SuperSplit tracks who paid, splits group expenses, and works out who owes whom.',
    action: 'Let SuperSplit handle the bill',
  },
] as const;

export const HOW_TO_PLAY = [
  'Choose Kids, Adult, Legendary, or God mode to set the operand range.',
  'Choose a challenge with two, three, or four operands, then set a 10, 20, 30, 60, or 120-second timer.',
  'After the three-second countdown, type each whole-number answer and press Enter or the submit arrow. Use × and ÷ before + and −, working left to right for operations of equal priority.',
  'Earn one point per correct expression. Review your score, accuracy, streak, and seconds per problem, then replay or share your result.',
];

export const FAQS = [
  {
    question: 'What is Mathmagician?',
    answer: SITE.summary,
  },
  {
    question: 'What are the four difficulty modes?',
    answer:
      'Kids mode uses operands from 0 to 20 and excludes negative answers and intermediate results. Adult uses 0 to 50, Legendary uses 0 to 100, and God uses 0 to 1,000; these three allow negative answers. Operands themselves are always nonnegative. These are difficulty labels, not age-based assessments.',
  },
  {
    question: 'Which timers and expression challenges can I play?',
    answer:
      'Choose 10, 20, 30, 60, or 120 seconds; the default is 30 seconds and the maximum is two minutes. The five challenges use two operands, three with the same operator, three with mixed operators, four with the same operator, or four with mixed operators. Every difficulty supports all five challenges.',
  },
  {
    question: 'Does Mathmagician follow BODMAS or PEMDAS?',
    answer:
      'Yes. Multiplication and division happen before addition and subtraction. Operations of equal priority run left to right: 8 + 3 × 4 = 20, and 12 ÷ 3 × 2 = 8. Only the four basic operations appear; no powers or brackets are generated. Division is exact, answers are whole numbers, and division by zero is excluded.',
  },
  {
    question: 'How are scores, accuracy, and solve times calculated?',
    answer:
      'Each correctly solved expression earns one point, regardless of its number of operators. Wrong answers and skips earn zero, break the streak, and count toward accuracy. Each problem is timed from when it appears until you answer or skip. The average solve time uses correct answers only. The final unfinished problem appears as “Time up” and does not count as an attempt. The timer keeps running when you switch tabs.',
  },
  {
    question: 'Is the score to beat a measured human average?',
    answer:
      'No. It is an estimated practice target that adjusts for difficulty, expression length, mixed operators, and round duration. Kids Quick start has a target of 8 correct answers in 30 seconds. Targets are not measured player averages, age norms, or a test of intelligence. Compare personal bests using the same settings.',
  },
  {
    question: 'Can I play on mobile, install the app, or play offline?',
    answer:
      'Yes. Use the numeric answer field on a phone, tablet, or desktop. A ± button supports negative answers when your phone keyboard has no minus key. Open the app online and wait for “Ready offline” before playing without a connection. Supporting browsers offer installation; on iPhone or iPad, use Safari’s Share menu and Add to Home Screen. JavaScript is required for gameplay.',
  },
  {
    question: 'Do I need an account, and where are my scores stored?',
    answer:
      'The game is free and requires no account. Settings, the last 50 rounds, and personal bests are saved in this browser’s local storage when available. They do not sync between devices and may be lost if browser data is cleared. The app has no analytics SDK or game backend. Scores leave the app only when you choose to share them.',
  },
  {
    question: 'Who built Mathmagician?',
    answer:
      'Mathmagician is part of Lowkey Tools, built by Shrinath Prabhu, from the makers of OwlEye Analytics. Visit shrinath.me for Shrinath’s work and owleye.dev for OwlEye’s cookie-free web analytics.',
  },
];

export const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': `${SITE.creator.url}/#person`,
      name: SITE.creator.name,
      url: SITE.creator.url,
      sameAs: [SITE.creator.social],
    },
    {
      '@type': 'Organization',
      '@id': `${SITE.publisher.url}/#organization`,
      name: SITE.publisher.name,
      url: SITE.publisher.url,
    },
    {
      '@type': 'WebSite',
      '@id': 'https://lowkey.tools/#website',
      name: 'Lowkey Tools',
      url: 'https://lowkey.tools',
      publisher: { '@id': `${SITE.publisher.url}/#organization` },
    },
    {
      '@type': 'WebApplication',
      '@id': `${APP_URL}#app`,
      name: 'Mathmagician',
      url: APP_URL,
      image: SITE.image.url,
      description: SITE.summary,
      applicationCategory: 'GameApplication',
      applicationSubCategory: 'Mental math practice',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript and a modern web browser.',
      isAccessibleForFree: true,
      inLanguage: 'en',
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
      author: { '@id': `${SITE.creator.url}/#person` },
      publisher: { '@id': `${SITE.publisher.url}/#organization` },
      featureList: [
        ...LEVELS.map((l) => `${l.name} mode: operands 0–${l.max}`),
        ...MODES.map((m) => `${m.name}: ${m.detail}`),
        `${DURATIONS.join(', ')}-second rounds`,
        'Per-problem timing, local personal bests, and shareable scores',
        'Installable progressive web app with offline play after initial caching',
      ],
      mainEntityOfPage: { '@id': `${APP_URL}#webpage` },
    },
    {
      '@type': 'WebPage',
      '@id': `${APP_URL}#webpage`,
      url: APP_URL,
      name: SITE.title,
      description: SITE.description,
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: SITE.image.url,
        width: SITE.image.width,
        height: SITE.image.height,
        caption: SITE.image.alt,
      },
      inLanguage: 'en',
      isPartOf: { '@id': 'https://lowkey.tools/#website' },
      mainEntity: { '@id': `${APP_URL}#app` },
      hasPart: { '@id': `${APP_URL}#faq` },
      breadcrumb: { '@id': `${APP_URL}#breadcrumb` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${APP_URL}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Lowkey Tools',
          item: 'https://lowkey.tools',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Mathmagician',
          item: APP_URL,
        },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${APP_URL}#faq`,
      isPartOf: { '@id': `${APP_URL}#webpage` },
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
};

export const RESEARCH_URL = BENCHMARK_SOURCE;
