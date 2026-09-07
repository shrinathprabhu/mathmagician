import { FAQS, HOW_TO_PLAY, RESEARCH_URL, SITE } from '@/lib/site-content';
import { LEVELS, MODES } from '@/lib/game';

// Server content stays readable in the initial HTML and adds no interactive JS.
export default function GameGuide() {
  return (
    <div className="game-guide">
      <nav className="guide-breadcrumb" aria-label="Breadcrumb">
        <a href="https://lowkey.tools">Lowkey Tools</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Mathmagician</span>
      </nav>
      <section aria-labelledby="guide-title" className="guide-intro">
        <div>
          <span className="eyebrow">A LITTLE PRACTICE, EVERY DAY</span>
          <h2 id="guide-title">Your daily mental math sprint.</h2>
          <p>{SITE.summary}</p>
          <p>
            No account. No download required. Just a short round and a new
            personal best to chase.
          </p>
        </div>
        <div className="guide-steps">
          <h3>How to play Mathmagician</h3>
          <ol>
            {HOW_TO_PLAY.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>
      <section className="guide-modes" aria-labelledby="mode-guide-title">
        <h2 id="mode-guide-title">Four modes. Your pace.</h2>
        <div className="guide-mode-grid">
          {LEVELS.map((level) => (
            <div key={level.id}>
              <h3>{level.name} mode</h3>
              <strong>0–{level.max.toLocaleString('en-US')}</strong>
              <p>
                {level.negatives
                  ? 'Negative answers included.'
                  : 'No negative answers or intermediate results.'}
              </p>
            </div>
          ))}
        </div>
        <p>
          All operands are nonnegative. Each mode supports these five
          challenges:
        </p>
        <ul className="guide-challenges">
          {MODES.map((mode) => (
            <li key={mode.id}>
              <strong>{mode.name}</strong>
              <span>{mode.detail}</span>
            </li>
          ))}
        </ul>
      </section>
      <section id="faq" className="game-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">A few things to know.</h2>
        {FAQS.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
        <p className="guide-research">
          Our practice targets use estimates informed by{' '}
          <a href={RESEARCH_URL}>research on typed arithmetic</a>. The study
          does not measure these game modes or establish a Mathmagician player
          average.
        </p>
      </section>
      <section
        id="makers"
        className="makers-section"
        aria-labelledby="makers-title"
      >
        <span className="eyebrow">SMALL TOOLS. THOUGHTFULLY BUILT.</span>
        <h2 id="makers-title">Meet the makers.</h2>
        <p>
          Mathmagician is part of{' '}
          <a href="https://lowkey.tools">Lowkey Tools</a>, built by{' '}
          <a href={SITE.creator.url} rel="author">
            Shrinath Prabhu
          </a>
          , from the makers of <a href={SITE.publisher.url}>OwlEye Analytics</a>
          .
        </p>
        <div className="maker-grid">
          <a className="maker-card" href={SITE.publisher.url}>
            <span className="eyebrow">FOR PEOPLE BUILDING ON THE WEB</span>
            <h3>
              OwlEye Analytics <span aria-hidden="true">↗</span>
            </h3>
            <p>
              Cookie-free web analytics with a TypeScript SDK, funnels, and
              dashboards for your product.
            </p>
            <span className="maker-link">Explore OwlEye at owleye.dev →</span>
          </a>
          <a className="maker-card" href={SITE.creator.url} rel="author">
            <span className="eyebrow">THE PERSON BEHIND THE TOOLS</span>
            <h3>
              Shrinath Prabhu <span aria-hidden="true">↗</span>
            </h3>
            <p>
              Frontend engineer and product builder. Explore Shrinath’s work,
              projects, and writing.
            </p>
            <span className="maker-link">Meet Shrinath at shrinath.me →</span>
          </a>
        </div>
      </section>
    </div>
  );
}
