'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Keyboard,
  Sparkles,
  Trophy,
  Zap,
  CornerDownLeft,
  RotateCcw,
  Share2,
  Copy,
  Download,
  CircleHelp,
  Flame,
  SkipForward,
  X,
  CheckCheck,
  WifiOff,
  Target,
  Star,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CountdownClock, RoundClock, QuestionClock } from './round-clock';
import {
  MODES,
  LEVELS,
  getLevel,
  targetScore,
  comparisonText,
  isAnswerInput,
  BENCHMARK_SOURCE,
  type LevelId,
  DURATIONS,
  getMode,
  startRound,
  advanceRound,
  submitAnswer,
  toResult,
  accuracy,
  reward,
  shareText,
  parseResults,
  parseLegacyResults,
  type LegacyResult,
  bestResults,
  recordKey,
  validConfig,
  type Config,
  type Round,
  type Result,
  type ModeId,
  type Duration,
} from '@/lib/game';

const STORAGE = 'mathmagician.v2';
const DEFAULT_CONFIG: Config = { mode: 'quick', level: 'kids', duration: 30 };
type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
type ModelContext = {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute(input: unknown): unknown;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
};

export default function MathGame({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [round, setRound] = useState<Round | null>(null);
  const roundRef = useRef<Round | null>(null);
  const [answer, setAnswer] = useState('');
  const answerRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{
    text: string;
    correct: boolean;
  } | null>(null);
  const [history, setHistory] = useState<Result[]>([]);
  const [legacyHistory, setLegacyHistory] = useState<LegacyResult[]>([]);
  const [bests, setBests] = useState<Result[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);
  const [offline, setOffline] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [dialog, setDialog] = useState<
    'help' | 'history' | 'install' | 'benchmark' | null
  >(null);
  const arenaRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const configRef = useRef(config);
  const recordsRef = useRef({ history, bests });
  const clockRef = useRef({ wall: 0, mono: 0 });
  const resultSaved = useRef(false);
  const isActive = !!round && round.phase !== 'result';
  const mode = getMode(config.mode);
  const level = getLevel(config.level);
  const target = targetScore(config);
  const best = bests.find((r) => recordKey(r) === recordKey(config));

  // Use monotonic elapsed time, with wall time covering device sleep. Background
  // throttling never extends a round and submissions recheck the same deadline.
  const gameNow = useCallback(() => {
    const clock = clockRef.current;
    return (
      clock.wall +
      Math.max(performance.now() - clock.mono, Date.now() - clock.wall)
    );
  }, []);
  const updateAnswer = useCallback((value: string) => {
    answerRef.current = value;
    setAnswer(value);
  }, []);
  const commit = useCallback((next: Round) => {
    roundRef.current = next;
    setRound(next);
    if (next.phase !== 'result' || resultSaved.current) return;
    resultSaved.current = true;
    const r = toResult(next, crypto.randomUUID(), Date.now());
    const old = recordsRef.current;
    const previous = old.bests.find((b) => recordKey(b) === recordKey(r));
    setNewBest(r.correct > (previous?.correct || 0));
    const h = [r, ...old.history].slice(0, 50),
      b = bestResults([...old.bests, r]);
    recordsRef.current = { history: h, bests: b };
    setHistory(h);
    setBests(b);
    setResult(r);
    try {
      localStorage.setItem(`${STORAGE}.history`, JSON.stringify(h));
      localStorage.setItem(`${STORAGE}.bests`, JSON.stringify(b));
    } catch {
      setToast(
        'This browser couldn’t save your score. You can still share it.',
      );
    }
    requestAnimationFrame(() =>
      resultRef.current?.focus({ preventScroll: true }),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const h = parseResults(localStorage.getItem(`${STORAGE}.history`));
        setLegacyHistory(
          parseLegacyResults(localStorage.getItem('mathmagician.v1.history')),
        );
        const b = bestResults(
          parseResults(localStorage.getItem(`${STORAGE}.bests`)),
        );
        recordsRef.current = { history: h, bests: b };
        setHistory(h);
        setBests(b);
        const saved: unknown = JSON.parse(
          localStorage.getItem(`${STORAGE}.config`) || 'null',
        );
        if (validConfig(saved)) {
          configRef.current = saved;
          setConfig(saved);
        }
      } catch {
        /* A private or storage-restricted browser can still play. */
      }
      setOffline(!navigator.onLine);
      setInstalled(
        window.matchMedia('(display-mode: standalone)').matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    });
    const syncOnline = () => setOffline(!navigator.onLine);
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    window.addEventListener('beforeinstallprompt', captureInstall);
    window.addEventListener('appinstalled', onInstalled);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      // Explicit scope is safe with or without a trailing slash in the page URL.
      void navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() => {
          /* Gameplay remains usable if caching is unavailable. */
        });
    }
    return () => {
      cancelled = true;
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
      window.removeEventListener('beforeinstallprompt', captureInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const configure = useCallback((next: Config) => {
    if (roundRef.current && roundRef.current.phase !== 'result')
      throw new Error('Finish the current round before changing settings');
    if (!validConfig(next)) throw new Error('Unsupported mode or duration');
    configRef.current = next;
    setConfig(next);
    setRound(null);
    roundRef.current = null;
    setResult(null);
    try {
      localStorage.setItem(`${STORAGE}.config`, JSON.stringify(next));
    } catch {
      /* Optional local preference. */
    }
  }, []);
  const start = useCallback(() => {
    if (roundRef.current && roundRef.current.phase !== 'result') return;
    clockRef.current = { wall: Date.now(), mono: performance.now() };
    const time = gameNow();
    resultSaved.current = false;
    setResult(null);
    setFeedback(null);
    updateAnswer('');
    setCopied(false);
    setNewBest(false);
    commit(startRound(configRef.current, time));
    requestAnimationFrame(() => {
      arenaRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      arenaRef.current?.focus({ preventScroll: true });
    });
  }, [commit, gameNow, updateAnswer]);
  const submit = useCallback(
    (skip = false) => {
      const current = roundRef.current;
      if (!current) return;
      const time = gameNow();
      const next = submitAnswer(current, skip ? null : answerRef.current, time);
      commit(next);
      if (next.attempts.length > current.attempts.length) {
        const last = next.attempts[next.attempts.length - 1];
        setFeedback({
          correct: last.correct,
          text: last.correct
            ? `${last.question.expression} = ${last.question.answer} · ${(last.elapsedMs / 1000).toFixed(2)}s · Nice!`
            : `${skip ? 'Skipped' : 'Not quite'}: ${last.question.expression} = ${last.question.answer} · ${(last.elapsedMs / 1000).toFixed(2)}s`,
        });
        updateAnswer('');
        inputRef.current?.focus({ preventScroll: true });
      }
    },
    [commit, gameNow, updateAnswer],
  );
  useEffect(() => {
    if (!isActive) return;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timeout);
      const time = gameNow();
      const current = roundRef.current;
      if (!current) return;
      const next = advanceRound(current, time);
      if (next !== current) commit(next);
      if (next.phase !== 'result') {
        const deadline =
          next.phase === 'countdown' ? next.startsAt : next.endsAt;
        timeout = setTimeout(tick, Math.max(1, deadline - time));
      }
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [isActive, commit, gameNow]);
  useEffect(() => {
    if (round?.phase === 'playing')
      inputRef.current?.focus({ preventScroll: true });
  }, [round?.phase]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  // Optional progressive enhancement: the visible setup and local record state
  // are the same ones available to supported browser agents.
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'configure_math_round',
        description:
          'Select a Mathmagician mode and duration. Does not start the timer.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: MODES.map((m) => m.id) },
            level: { type: 'string', enum: LEVELS.map((l) => l.id) },
            duration: { type: 'integer', enum: [...DURATIONS] },
          },
          required: ['mode', 'level', 'duration'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input: unknown) => {
          if (!validConfig(input)) throw new Error('Unsupported game settings');
          configure(input);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          return { ...configRef.current, status: 'ready' };
        },
      },
      {
        name: 'read_math_progress',
        description:
          'Read selected settings and this device’s saved personal bests and recent round results.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({
          config: configRef.current,
          phase: roundRef.current?.phase || 'ready',
          bests: recordsRef.current.bests,
          recent: recordsRef.current.history.slice(0, 5),
        }),
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Experimental API is optional. */
      }
    }
    return () => lifecycle.abort();
  }, [configure]);

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(shareText(result));
      setCopied(true);
      setToast('Score copied. Go spread a little magic.');
    } catch {
      setToast(
        'Copy isn’t available here. Select the result text below to share it.',
      );
    }
  }
  async function shareResult() {
    if (!result) return;
    if (!navigator.share) {
      await copyResult();
      return;
    }
    try {
      await navigator.share({
        title: 'My Mathmagician score',
        text: shareText(result),
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        await copyResult();
    }
  }
  async function install() {
    if (!installPrompt) {
      setDialog('install');
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted')
        setToast('Mathmagician is ready for your home screen.');
    } catch {
      setInstallPrompt(null);
      setDialog('install');
    }
  }
  const roundAccuracy = round?.attempts.length
    ? Math.round((round.correct / round.attempts.length) * 100)
    : 0;
  const earned = result ? reward(result.correct, result.target) : null;

  return (
    <div
      className={`site-shell ${round ? 'has-round' : ''} ${isActive ? 'in-game' : ''}`}
    >
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Mathmagician home">
          <span className="brand-mark">
            <Image
              src="/mathmagician.svg"
              width={38}
              height={38}
              alt=""
              unoptimized
              loading="eager"
            />
          </span>
          mathmagician<span className="brand-dot">.</span>
        </Link>
        <div className="header-links">
          {!installed && (
            <button
              className="quiet-button install-button"
              onClick={install}
              disabled={isActive}
            >
              <Download size={15} />
              <span>Install app</span>
            </button>
          )}
          <a
            className="lowkey-link"
            href="https://lowkey.tools"
            target="_blank"
            rel="noreferrer"
          >
            by lowkey.tools <ArrowRight size={14} />
          </a>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="main-shell">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <Zap size={14} /> THE MENTAL MATH SPRINT
            </div>
            <h1>
              <span className="sr-only">Mathmagician — </span>
              Fast math. <span>Sharp mind.</span>
            </h1>
            <p>A free mental math game. Pick your challenge. Beat the clock.</p>
          </div>
          <button
            className="best-pill"
            onClick={() => setDialog('history')}
            disabled={isActive}
          >
            <Trophy size={19} />
            <span>
              <small>PERSONAL BEST</small>
              <strong>
                {best
                  ? `${best.correct} solved in ${config.duration}s`
                  : 'Your first record awaits'}
              </strong>
            </span>
          </button>
        </div>
        <section
          className={`level-panel ${isActive ? 'setup-locked' : ''}`}
          aria-labelledby="level-label"
        >
          <div className="section-label">
            <span>01</span>
            <h2 id="level-label">Choose your mode</h2>
          </div>
          <RadioGroup
            value={config.level}
            onValueChange={(value) =>
              configure({ ...config, level: value as LevelId })
            }
            disabled={isActive}
            aria-label="Difficulty mode"
            className="level-list"
          >
            {LEVELS.map((l) => (
              <label
                key={l.id}
                htmlFor={`level-${l.id}`}
                className={`level-card ${l.id === config.level ? 'selected' : ''}`}
              >
                <span>
                  <strong>{l.name} mode</strong>
                  <small>
                    0–{l.max.toLocaleString('en-US')} ·{' '}
                    {l.negatives
                      ? 'Negative answers too'
                      : 'No negative answers'}
                  </small>
                </span>
                <RadioGroupItem
                  id={`level-${l.id}`}
                  value={l.id}
                  aria-label={`${l.name} mode`}
                />
              </label>
            ))}
          </RadioGroup>
        </section>
        <div className="workspace">
          <section
            aria-labelledby="challenge-title"
            id="top-of-settings"
            tabIndex={-1}
            className={`setup-panel ${isActive ? 'setup-locked' : ''}`}
          >
            <div className="section-label">
              <span>02</span>
              <h2 id="challenge-title">Choose your challenge</h2>
            </div>
            <RadioGroup
              value={config.mode}
              onValueChange={(v) => configure({ ...config, mode: v as ModeId })}
              disabled={isActive}
              aria-label="Expression challenge"
              className="mode-list"
            >
              {MODES.map((m, i) => (
                <label
                  className={`mode-card ${config.mode === m.id ? 'selected' : ''}`}
                  key={m.id}
                >
                  <span className="mode-number">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="mode-copy">
                    <strong>{m.name}</strong>
                    <small>{m.detail}</small>
                  </span>
                  <RadioGroupItem value={m.id} aria-label={m.name} />
                </label>
              ))}
            </RadioGroup>
            <div className="section-label duration-label">
              <span>03</span>
              <h2>Set the clock</h2>
              <Clock3 size={16} />
            </div>
            <RadioGroup
              value={String(config.duration)}
              onValueChange={(v) =>
                configure({ ...config, duration: Number(v) as Duration })
              }
              disabled={isActive}
              aria-label="Round duration"
              className="duration-list"
            >
              {DURATIONS.map((t) => (
                <label
                  key={t}
                  className={`duration-option ${config.duration === t ? 'selected' : ''}`}
                >
                  <RadioGroupItem
                    value={String(t)}
                    aria-label={`${t} seconds`}
                  />
                  <span>{t < 60 ? `${t}s` : `${t / 60}m`}</span>
                </label>
              ))}
            </RadioGroup>
            <p className="setting-note">
              {isActive
                ? 'Stay focused. Settings unlock after your round.'
                : 'A quick reset for your brain. Max 2 minutes.'}
            </p>
            <button
              className="how-button"
              onClick={() => setDialog('help')}
              disabled={isActive}
            >
              <CircleHelp size={14} /> How to play <ArrowRight size={13} />
            </button>
          </section>
          <section
            className={`arena ${isActive ? 'active-arena' : ''}`}
            ref={arenaRef}
            tabIndex={-1}
            aria-label="Math game"
          >
            <div className="arena-topline">
              <span>
                <i />
                {round?.phase === 'playing'
                  ? 'MAKE IT COUNT'
                  : result
                    ? 'YOUR MOMENT OF MAGIC'
                    : 'THE PLAYGROUND'}
              </span>
              <span className="mode-badge">
                {level.name} · {mode.name}
              </span>
            </div>
            {!round && (
              <div className="ready-content">
                <div className="ready-icon">
                  <Sparkles size={27} />
                </div>
                <h2>A little focus. A lot of possibility.</h2>
                <p>Your next personal best starts here.</p>
                <button
                  className="target-card"
                  onClick={() => setDialog('benchmark')}
                >
                  <Target size={18} />
                  <span>
                    <strong>Score to beat: {target}</strong>
                    <small>
                      Correct answers in {config.duration}s · estimated target
                    </small>
                  </span>
                  <CircleHelp size={14} />
                </button>
                <div
                  className={`equation preview-equation operands-${mode.operands}`}
                >
                  {mode.example}
                  <span> = ?</span>
                </div>
                <button className="primary-button start-button" onClick={start}>
                  <Zap size={18} fill="currentColor" /> Let’s play{' '}
                  <ArrowRight size={19} />
                </button>
                <span className="start-caption">
                  {config.duration} seconds. How far can you go?
                </span>
              </div>
            )}
            {round?.phase === 'countdown' && (
              <div className="countdown-content">
                <span className="eyebrow">FIND YOUR FOCUS</span>
                <CountdownClock startsAt={round.startsAt} readNow={gameNow} />
                <h2>You’ve got this.</h2>
                <p>Type your answer. Press Enter. Keep going.</p>
                <span className="countdown-settings">
                  {level.name} · {mode.name} <span>·</span> {config.duration}{' '}
                  seconds
                </span>
              </div>
            )}
            {round?.phase === 'playing' && (
              <div className="game-content">
                <RoundClock round={round} readNow={gameNow} />
                <div className="question-label">
                  QUESTION {round.attempts.length + 1}
                  <span>
                    {roundAccuracy}% accuracy · target {target}
                  </span>
                </div>
                <div
                  className={`equation live-equation operands-${mode.operands}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {round.question.expression}
                  <span> = ?</span>
                </div>
                <QuestionClock
                  startedAt={round.questionStartedAt}
                  endsAt={round.endsAt}
                  readNow={gameNow}
                />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  className="answer-form"
                >
                  <label className="sr-only" htmlFor="answer">
                    Your answer
                  </label>
                  <input
                    id="answer"
                    ref={inputRef}
                    type="text"
                    enterKeyHint="done"
                    maxLength={14}
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="numeric"
                    value={answer}
                    onChange={(e) => {
                      if (isAnswerInput(e.target.value, config.level))
                        updateAnswer(e.target.value);
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const value = e.clipboardData.getData('text').trim();
                      if (isAnswerInput(value, config.level, true))
                        updateAnswer(value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        updateAnswer('');
                      }
                      if (e.key === 'Enter' && e.repeat) e.preventDefault();
                    }}
                    placeholder="Your answer"
                    aria-describedby="answer-hint"
                  />
                  {level.negatives && (
                    <button
                      type="button"
                      className="sign-toggle"
                      aria-label="Toggle negative answer"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        updateAnswer(
                          answer.startsWith('-')
                            ? answer.slice(1)
                            : `-${answer}`,
                        );
                        inputRef.current?.focus({ preventScroll: true });
                      }}
                    >
                      ±
                    </button>
                  )}
                  <button
                    type="submit"
                    className="answer-submit"
                    aria-label="Submit answer"
                    disabled={!isAnswerInput(answer, config.level, true)}
                  >
                    <CornerDownLeft size={21} />
                  </button>
                </form>
                <div
                  className={`answer-feedback ${feedback ? (feedback.correct ? 'correct' : 'incorrect') : ''}`}
                  aria-live="polite"
                  id="answer-hint"
                >
                  {feedback ? (
                    <>
                      {feedback.correct ? <Check size={14} /> : <span>↳</span>}
                      {feedback.text}
                    </>
                  ) : level.negatives ? (
                    'Whole numbers only. Use ± for a negative answer.'
                  ) : (
                    'Whole numbers only. No negative answers in Kids mode.'
                  )}
                </div>
                <div className="game-actions">
                  <button className="quiet-button" onClick={() => submit(true)}>
                    <SkipForward size={14} /> Skip
                  </button>
                  <span>Enter ↵ to submit</span>
                  <button
                    className="quiet-button"
                    onClick={() => {
                      updateAnswer('');
                      inputRef.current?.focus({ preventScroll: true });
                    }}
                    aria-label="Clear answer"
                  >
                    Clear <X size={13} />
                  </button>
                </div>
              </div>
            )}
            {result && earned && (
              <div className="result-content">
                <div className="reward-icon">
                  <Trophy size={30} />
                  <div>
                    {Array.from({ length: earned.stars }, (_, i) => (
                      <Star size={12} fill="currentColor" key={i} />
                    ))}
                  </div>
                </div>
                <span className="result-tag">
                  {newBest ? '✦ NEW PERSONAL BEST' : 'ROUND COMPLETE'}
                </span>
                <h2 tabIndex={-1} ref={resultRef}>
                  {earned.title}
                </h2>
                <p>{earned.message}</p>
                <div className="result-score">
                  <strong>{result.correct}</strong>
                  <span>
                    calculations solved
                    <br />
                    in <b>{result.duration} seconds</b>
                  </span>
                </div>
                <div className="target-comparison">
                  <span>{comparisonText(result.correct, result.target)}</span>
                  <button onClick={() => setDialog('benchmark')}>
                    Target: {result.target} <CircleHelp size={13} />
                  </button>
                </div>
                <div className="result-stats">
                  <div>
                    <Target size={15} />
                    <strong>{accuracy(result)}%</strong>
                    <span>accuracy</span>
                  </div>
                  <div>
                    <Flame size={15} />
                    <strong>{result.bestStreak}</strong>
                    <span>best streak</span>
                  </div>
                  <div>
                    <Clock3 size={15} />
                    <strong>
                      {result.averageSolveMs === null
                        ? '—'
                        : `${(result.averageSolveMs / 1000).toFixed(2)}s`}
                    </strong>
                    <span>avg. correct answer</span>
                  </div>
                </div>
                <div className="result-actions">
                  <button className="primary-button" onClick={start}>
                    <RotateCcw size={16} /> Play again
                  </button>
                  <button className="secondary-button" onClick={shareResult}>
                    <Share2 size={16} /> Share score
                  </button>
                </div>
                <button
                  className="secondary-button change-challenge-button"
                  onClick={() => {
                    configure(config);
                    requestAnimationFrame(() => {
                      document.getElementById('top-of-settings')?.focus();
                      document.getElementById('level-label')?.scrollIntoView({
                        block: 'start',
                        behavior: 'instant',
                      });
                    });
                  }}
                >
                  Change challenge <ArrowRight size={17} />
                </button>
                <div className="share-links">
                  <button onClick={copyResult}>
                    {copied ? <CheckCheck size={14} /> : <Copy size={14} />}{' '}
                    {copied ? 'Copied!' : 'Copy result'}
                  </button>
                  <span>·</span>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(result))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Share on X ↗
                  </a>
                  <span>·</span>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareText(result))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp ↗
                  </a>
                </div>
                <details className="result-details">
                  <summary>Result text & round review</summary>
                  <textarea
                    aria-label="Shareable result text"
                    readOnly
                    value={shareText(result)}
                    onFocus={(e) => e.target.select()}
                  />
                  {round && (
                    <ol className="round-review">
                      {round.attempts.map((attempt, i) => (
                        <li
                          key={i}
                          className={
                            attempt.correct ? 'review-correct' : 'review-wrong'
                          }
                        >
                          <span>
                            {attempt.correct ? '✓' : '↳'}{' '}
                            {attempt.question.expression} ={' '}
                            <b>{attempt.question.answer}</b>
                          </span>
                          <small>
                            {attempt.correct
                              ? 'Correct'
                              : attempt.answer === null
                                ? 'Skipped'
                                : `You: ${attempt.answer}`}
                            <span className="attempt-time">
                              {(attempt.elapsedMs / 1000).toFixed(2)}s
                            </span>
                          </small>
                        </li>
                      ))}
                      <li className="review-timeout">
                        <span>
                          {round.question.expression} ={' '}
                          <b>{round.question.answer}</b>
                        </span>
                        <small>
                          Time up
                          <span className="attempt-time">
                            {(
                              Math.max(
                                0,
                                round.endsAt - round.questionStartedAt,
                              ) / 1000
                            ).toFixed(2)}
                            s
                          </span>
                        </small>
                      </li>
                    </ol>
                  )}
                </details>
              </div>
            )}
            {(!isActive || round?.phase === 'countdown') && (
              <div className="arena-footer">
                <span>
                  <Keyboard size={17} />
                  Type your answer. Press Enter.
                </span>
                <span>
                  <Check size={15} />
                  No sign-up. Just you vs. you.
                </span>
              </div>
            )}
          </section>
        </div>
        <div className="rules-strip">
          <div>
            <span className="rule-symbol">
              0–{level.max.toLocaleString('en-US')}
            </span>
            <p>
              {level.name} mode
              <span>
                {level.negatives
                  ? 'Negative answers included'
                  : 'No negative answers'}
              </span>
            </p>
          </div>
          <div>
            <span className="rule-symbol">+ − × ÷</span>
            <p>
              Four operations<span>Endless ways to get faster</span>
            </p>
          </div>
          <div>
            <span className="rule-symbol precedence">× ÷ → + −</span>
            <p>
              Order matters<span>BODMAS / PEMDAS always applies</span>
            </p>
          </div>
        </div>
        {children}
      </main>
      <footer className="site-footer">
        <span className="creator-credit">
          <span>
            One small spark in <a href="https://lowkey.tools">Lowkey Tools</a>.
          </span>
          <span>
            From the makers of{' '}
            <a
              href="https://owleye.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              OwlEye Analytics
            </a>
            .
          </span>
          <span>
            Built by{' '}
            <a
              href="https://shrinath.me"
              target="_blank"
              rel="author noopener noreferrer"
            >
              Shrinath Prabhu
            </a>
            .
          </span>
          <span>
            <a
              className="source-link"
              href="https://github.com/shrinathprabhu/mathmagician"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source on GitHub
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </span>
        </span>
        <div className="footer-actions">
          <button onClick={() => setDialog('history')} disabled={isActive}>
            Your progress
          </button>
          <span className="connection-status">
            {offline ? (
              <>
                <WifiOff size={12} /> Offline
              </>
            ) : offlineReady ? (
              <>
                <Check size={12} /> Ready offline
              </>
            ) : (
              <>
                <span className="footer-star">✦</span> mathmagician.lowkey.tools
              </>
            )}
          </span>
        </div>
      </footer>
      {!round && (
        <button className="mobile-start primary-button" onClick={start}>
          <Zap size={17} fill="currentColor" /> Play {config.duration}-second
          sprint <ArrowRight size={17} />
        </button>
      )}
      <Dialog
        open={dialog === 'benchmark'}
        onOpenChange={(open) => setDialog(open ? 'benchmark' : null)}
      >
        <DialogContent className="info-dialog">
          <DialogTitle>A target, not a test of you</DialogTitle>
          <DialogDescription>
            A manageable score to aim for in this challenge.
          </DialogDescription>
          <div className="benchmark-number">
            <Target size={24} />
            <strong>{target}</strong>
            <span>
              correct answers in {config.duration}s<br />
              {level.name} · {mode.name}
            </span>
          </div>
          <p className="dialog-note">
            These are estimated training targets, not measured player averages
            or age norms. They allow more time for bigger numbers, longer
            expressions, and mixed operators.
          </p>
          <p className="dialog-note">
            Research on typed arithmetic shows that even simple sums take
            several seconds and vary with the problem. It does not measure these
            exact game modes. Our targets use that as context, with conservative
            estimates for harder challenges.
          </p>
          <a
            className="benchmark-source"
            href={BENCHMARK_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the arithmetic study ↗
          </a>
          <p className="dialog-note">
            A score below the target is a starting point. Compare your own
            rounds in the same mode and challenge as you practice.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === 'help'}
        onOpenChange={(open) => setDialog(open ? 'help' : null)}
      >
        <DialogContent className="info-dialog">
          <DialogTitle>Small numbers. Simple rules.</DialogTitle>
          <DialogDescription>
            All you need for your next mental math sprint.
          </DialogDescription>
          <ol className="help-list">
            <li>
              <b>Choose a challenge and a clock.</b> Play for 10, 20, 30, 60, or
              120 seconds. A three-second countdown gets you ready.
            </li>
            <li>
              <b>Solve the whole expression.</b> Operands run from zero to 20 in
              Kids, 50 in Adult, 100 in Legendary, or 1,000 in God mode. Kids
              mode never produces negative intermediate or final answers; the
              other modes can produce negative answers. Division never uses a
              zero divisor. Multiplication and division come first, left to
              right. Then addition and subtraction, left to right.
            </li>
            <li>
              <b>Type, then press Enter.</b> The input accepts only whole
              numbers, with an optional minus sign outside Kids mode. Use ± when
              your phone keyboard has no minus key. Each question shows elapsed
              seconds; the review includes reading and typing time for every
              answer and skip.
            </li>
            <li>
              <b>Keep moving.</b> Each correct answer earns one point. A wrong
              answer or skip moves on with no point. Both count toward accuracy.
              The clock keeps running when you switch apps.
            </li>
            <li>
              <b>Beat your own best.</b> Records are separate for every
              difficulty, challenge, and duration, saved only in this browser.
              Share your reward after each round.
            </li>
          </ol>
          <div className="help-example">
            8 + 3 × 4 = <strong>20</strong>
            <span>Multiply first: 3 × 4 = 12. Then add 8.</span>
          </div>
          <p className="dialog-note">
            “Same operator” repeats one randomly chosen operator within a
            question. “Mixed operators” uses at least two different operators.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === 'history'}
        onOpenChange={(open) => setDialog(open ? 'history' : null)}
      >
        <DialogContent className="info-dialog history-dialog">
          <DialogTitle>Your little victories</DialogTitle>
          <DialogDescription>
            Personal bests stay on this device, separately for every difficulty,
            challenge, and duration.
          </DialogDescription>
          {history.length === 0 ? (
            <div className="empty-history">
              <Trophy size={36} />
              <h3>Your first record awaits.</h3>
              <p>Play a round. Give your future self something to beat.</p>
            </div>
          ) : (
            <>
              <div className="history-heading">
                <span>RECENT ROUNDS</span>
                <span>
                  {history.length === 50 ? 'Last 50' : 'On this device'}
                </span>
              </div>
              <div className="history-list">
                {history.map((r) => (
                  <div className="history-row" key={r.id}>
                    <span>
                      <strong>
                        {getLevel(r.level).name} · {getMode(r.mode).name}
                      </strong>
                      <small>
                        {r.duration}s ·{' '}
                        {new Date(r.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        · {accuracy(r)}% accuracy
                      </small>
                    </span>
                    <b>
                      {r.correct}
                      <small>solved</small>
                    </b>
                  </div>
                ))}
              </div>
            </>
          )}
          {legacyHistory.length > 0 && (
            <section className="legacy-history">
              <div className="history-heading">
                <span>EARLIER ROUNDS</span>
                <span>Original rules</span>
              </div>
              <p className="dialog-note">
                Kept for you. New personal bests are tracked separately for the
                four difficulty modes.
              </p>
              <div className="history-list">
                {legacyHistory.map((r) => (
                  <div className="history-row" key={r.id}>
                    <span>
                      <strong>{getMode(r.mode).name}</strong>
                      <small>
                        {r.duration}s · {accuracy(r)}% accuracy
                      </small>
                    </span>
                    <b>
                      {r.correct}
                      <small>solved</small>
                    </b>
                  </div>
                ))}
              </div>
            </section>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === 'install'}
        onOpenChange={(open) => setDialog(open ? 'install' : null)}
      >
        <DialogContent className="info-dialog">
          <DialogTitle>A little magic on your home screen</DialogTitle>
          <DialogDescription>
            Install Mathmagician for a focused, full-screen game.
          </DialogDescription>
          <div className="install-guide">
            <p>
              <b>iPhone & iPad</b>In Safari, open the Share menu, choose “Add to
              Home Screen”, then tap Add.
            </p>
            <p>
              <b>Android</b>In Chrome, open the ⋮ menu and choose “Install app”
              or “Add to Home screen”.
            </p>
            <p>
              <b>Desktop</b>In Chrome or Edge, use the install icon in the
              address bar, or the browser menu’s app installation option.
            </p>
          </div>
          <p className="dialog-note">
            Open the app online once so it can save everything needed for
            offline play. If you don’t see an install option, you can still play
            in this browser.
          </p>
        </DialogContent>
      </Dialog>
      {toast && (
        <output className="toast">
          <Check size={16} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </output>
      )}
    </div>
  );
}
