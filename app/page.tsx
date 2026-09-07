'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock3,
  Keyboard,
  Sparkles,
  Trophy,
  WandSparkles,
  Zap,
  Delete,
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
import { Progress } from '@/components/ui/progress';
import {
  MODES,
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
  bestResults,
  recordKey,
  validConfig,
  type Config,
  type Round,
  type Result,
  type ModeId,
  type Duration,
} from '@/lib/game';

const STORAGE = 'mathmagician.v1';
const DEFAULT_CONFIG: Config = { mode: 'quick', duration: 30 };
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

export default function Home() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [round, setRound] = useState<Round | null>(null);
  const roundRef = useRef<Round | null>(null);
  const [now, setNow] = useState(0);
  const [answer, setAnswer] = useState('');
  const answerRef = useRef('');
  const [feedback, setFeedback] = useState<{
    text: string;
    correct: boolean;
  } | null>(null);
  const [history, setHistory] = useState<Result[]>([]);
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
  const [dialog, setDialog] = useState<'help' | 'history' | 'install' | null>(
    null,
  );
  const arenaRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const configRef = useRef(config);
  const recordsRef = useRef({ history, bests });
  const clockRef = useRef({ wall: 0, mono: 0 });
  const resultSaved = useRef(false);
  const isActive = !!round && round.phase !== 'result';
  const mode = getMode(config.mode);
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
      // Relative scope supports either the dedicated domain or a subdirectory build.
      void navigator.serviceWorker
        .register('./sw.js', { scope: './' })
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
    setNow(time);
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
      setNow(time);
      if (next.attempts.length > current.attempts.length) {
        const last = next.attempts[next.attempts.length - 1];
        setFeedback({
          correct: last.correct,
          text: last.correct
            ? `${last.question.expression} = ${last.question.answer} · Nice!`
            : `${skip ? 'Skipped' : 'Not quite'}: ${last.question.expression} = ${last.question.answer}`,
        });
        updateAnswer('');
      }
    },
    [commit, gameNow, updateAnswer],
  );
  const keyInput = useCallback(
    (key: string) => {
      if (roundRef.current?.phase !== 'playing') return;
      if (key === 'Enter') {
        submit();
        return;
      }
      const old = answerRef.current;
      if (key === 'Backspace') updateAnswer(old.slice(0, -1));
      else if (key === 'Escape' || key === 'Clear') updateAnswer('');
      else if (key === '-')
        updateAnswer(old.startsWith('-') ? old.slice(1) : `-${old}`);
      else if (/^\d$/.test(key) && old.replace('-', '').length < 7)
        updateAnswer(`${old}${key}`);
    },
    [submit, updateAnswer],
  );

  useEffect(() => {
    if (!isActive) return;
    const tick = () => {
      const time = gameNow();
      setNow(time);
      const r = roundRef.current;
      if (r) {
        const next = advanceRound(r, time);
        if (next !== r) commit(next);
      }
    };
    const interval = setInterval(tick, 50);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [isActive, commit, gameNow]);
  useEffect(() => {
    if (!isActive) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || dialog) return;
      if (
        /^\d$/.test(event.key) ||
        ['Enter', 'Backspace', 'Escape', '-'].includes(event.key)
      ) {
        event.preventDefault();
        if (!event.repeat || event.key === 'Backspace') keyInput(event.key);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [isActive, keyInput, dialog]);
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
            duration: { type: 'integer', enum: [...DURATIONS] },
          },
          required: ['mode', 'duration'],
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
  const seconds = round
    ? Math.max(0, Math.ceil((round.endsAt - now) / 1000))
    : config.duration;
  const countdown = round
    ? Math.max(1, Math.ceil((round.startsAt - now) / 1000))
    : 3;
  const roundAccuracy = round?.attempts.length
    ? Math.round((round.correct / round.attempts.length) * 100)
    : 0;
  const earned = result ? reward(result.correct, result.duration) : null;

  return (
    <div
      className={`site-shell ${round ? 'has-round' : ''} ${isActive ? 'in-game' : ''}`}
    >
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Mathmagician home">
          <span className="brand-mark">
            <WandSparkles size={23} />
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
      <main className="main-shell">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <Zap size={14} /> THE MENTAL MATH SPRINT
            </div>
            <h1>
              Fast math. <span>Sharp mind.</span>
            </h1>
            <p>Pick your challenge. Beat the clock. Find your magic.</p>
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
        <div className="workspace">
          <aside
            id="top-of-settings"
            tabIndex={-1}
            className={`setup-panel ${isActive ? 'setup-locked' : ''}`}
          >
            <div className="section-label">
              <span>01</span>
              <h2>Choose your mode</h2>
            </div>
            <RadioGroup
              value={config.mode}
              onValueChange={(v) => configure({ ...config, mode: v as ModeId })}
              disabled={isActive}
              aria-label="Game mode"
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
              <span>02</span>
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
          </aside>
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
              <span className="mode-badge">{mode.name}</span>
            </div>
            {!round && (
              <div className="ready-content">
                <div className="ready-icon">
                  <Sparkles size={27} />
                </div>
                <h2>A little focus. A lot of possibility.</h2>
                <p>Your next personal best starts here.</p>
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
                <output
                  className="countdown-number"
                  key={countdown}
                  aria-live="assertive"
                >
                  {countdown}
                </output>
                <h2>You’ve got this.</h2>
                <p>Type your answer. Press Enter. Keep going.</p>
                <span className="countdown-settings">
                  {mode.name} <span>·</span> {config.duration} seconds
                </span>
              </div>
            )}
            {round?.phase === 'playing' && (
              <div className="game-content">
                <div className="game-stats">
                  <div
                    className={`time-stat ${seconds <= 5 ? 'time-urgent' : ''}`}
                  >
                    <span>
                      <Clock3 size={14} />
                      TIME LEFT
                    </span>
                    <strong
                      role="timer"
                      aria-label={`${seconds} seconds remaining`}
                    >
                      {Math.floor(seconds / 60)}:
                      {String(seconds % 60).padStart(2, '0')}
                      <small> / {config.duration}s</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <Check size={14} />
                      SOLVED
                    </span>
                    <strong>{round.correct}</strong>
                  </div>
                  <div>
                    <span>
                      <Flame size={14} />
                      STREAK
                    </span>
                    <strong>
                      {round.streak}
                      <small> best {round.bestStreak}</small>
                    </strong>
                  </div>
                </div>
                <Progress
                  value={Math.max(
                    0,
                    ((round.endsAt - now) / (config.duration * 1000)) * 100,
                  )}
                  aria-label="Round time remaining"
                  className={
                    seconds <= 5 ? 'timer-progress urgent' : 'timer-progress'
                  }
                />
                <div className="question-label">
                  QUESTION {round.attempts.length + 1}
                  <span>{roundAccuracy}% accuracy</span>
                </div>
                <div
                  className={`equation live-equation operands-${mode.operands}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {round.question.expression}
                  <span> = ?</span>
                </div>
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
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="none"
                    value={answer}
                    onChange={(e) => {
                      if (/^-?\d{0,7}$/.test(e.target.value))
                        updateAnswer(e.target.value);
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const value = e.clipboardData.getData('text').trim();
                      if (/^-?\d{1,7}$/.test(value)) updateAnswer(value);
                    }}
                    placeholder="Your answer"
                    aria-describedby="answer-hint"
                  />
                  <button
                    type="submit"
                    className="answer-submit"
                    aria-label="Submit answer"
                    disabled={!/^-?\d+$/.test(answer)}
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
                  ) : (
                    'Whole-number answers. Negative numbers are fair game.'
                  )}
                </div>
                <div className="number-pad" aria-label="Number pad">
                  {[
                    '7',
                    '8',
                    '9',
                    '4',
                    '5',
                    '6',
                    '1',
                    '2',
                    '3',
                    '-',
                    '0',
                    'Backspace',
                  ].map((key) => (
                    <button
                      key={key}
                      className={
                        key === '-' || key === 'Backspace' ? 'utility-key' : ''
                      }
                      onClick={() => keyInput(key)}
                      aria-label={
                        key === '-'
                          ? 'Toggle negative sign'
                          : key === 'Backspace'
                            ? 'Delete last digit'
                            : key
                      }
                    >
                      {key === 'Backspace' ? (
                        <Delete size={20} />
                      ) : key === '-' ? (
                        '±'
                      ) : (
                        key
                      )}
                    </button>
                  ))}
                </div>
                <div className="game-actions">
                  <button className="quiet-button" onClick={() => submit(true)}>
                    <SkipForward size={14} /> Skip
                  </button>
                  <span>Enter ↵ to submit</span>
                  <button
                    className="quiet-button"
                    onClick={() => updateAnswer('')}
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
                    <X size={15} />
                    <strong>{result.wrong + result.skipped}</strong>
                    <span>wrong / skipped</span>
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
                  {round && round.attempts.length > 0 && (
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
                          </small>
                        </li>
                      ))}
                    </ol>
                  )}
                </details>
                <button
                  className="change-settings"
                  onClick={() => {
                    configure(config);
                    document.getElementById('top-of-settings')?.focus();
                  }}
                >
                  Change challenge <ArrowRight size={13} />
                </button>
              </div>
            )}
            {(!isActive || round?.phase === 'countdown') && (
              <div className="arena-footer">
                <span>
                  <Keyboard size={17} />
                  Keyboard or number pad
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
            <span className="rule-symbol">1–20</span>
            <p>
              Small numbers<span>Every operand, every round</span>
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
      </main>
      <footer className="site-footer">
        <span>
          Made for the{' '}
          <span className="footer-highlight">“one more round”</span> in you.
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
              <b>Solve the whole expression.</b> Each operand is 1–20.
              Multiplication and division come first, left to right. Then
              addition and subtraction, left to right.
            </li>
            <li>
              <b>Type, then press Enter.</b> Or use the number pad and ↵ button.
              Answers are always whole numbers and can be negative or zero.
            </li>
            <li>
              <b>Keep moving.</b> Each correct answer earns one point. A wrong
              answer or skip moves on with no point. Both count toward accuracy.
              The clock keeps running when you switch apps.
            </li>
            <li>
              <b>Beat your own best.</b> Records are separate for every mode and
              duration, saved only in this browser. Share your reward after each
              round.
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
            Personal bests stay on this device, separately for every mode and
            duration.
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
                      <strong>{getMode(r.mode).name}</strong>
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
