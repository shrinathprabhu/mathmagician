export const DURATIONS = [10, 20, 30, 60, 120] as const;
export type Duration = (typeof DURATIONS)[number];
export const OPERATORS = ['+', '-', '*', '/'] as const;
export type Operator = (typeof OPERATORS)[number];
export const MODES = [
  {
    id: 'quick',
    name: 'Quick start',
    detail: '2 operands · one operator',
    example: '12 + 8',
    operands: 2,
    mixed: false,
  },
  {
    id: 'triple',
    name: 'Triple threat',
    detail: '3 operands · same operator',
    example: '6 + 12 + 3',
    operands: 3,
    mixed: false,
  },
  {
    id: 'mixed-three',
    name: 'Mix it up',
    detail: '3 operands · mixed operators',
    example: '8 + 3 × 4',
    operands: 3,
    mixed: true,
  },
  {
    id: 'four',
    name: 'Four of a kind',
    detail: '4 operands · same operator',
    example: '5 + 8 + 2 + 9',
    operands: 4,
    mixed: false,
  },
  {
    id: 'mixed-four',
    name: 'Full wizard',
    detail: '4 operands · mixed operators',
    example: '12 ÷ 3 + 2 × 5',
    operands: 4,
    mixed: true,
  },
] as const;
export type ModeId = (typeof MODES)[number]['id'];
export const LEVELS = [
  { id: 'kids', name: 'Kids', max: 20, negatives: false, pace: 4 },
  { id: 'adult', name: 'Adult', max: 50, negatives: true, pace: 7 },
  { id: 'legendary', name: 'Legendary', max: 100, negatives: true, pace: 11 },
  { id: 'god', name: 'God', max: 1000, negatives: true, pace: 25 },
] as const;
export type LevelId = (typeof LEVELS)[number]['id'];
export type Config = { mode: ModeId; level: LevelId; duration: Duration };
export const APP_URL = 'https://mathmagician.lowkey.tools/';
export const getLevel = (id: LevelId) =>
  LEVELS.find((level) => level.id === id)!;
export const BENCHMARK_SOURCE =
  'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0168431';

// Editorial training targets, not measured population averages. See
// docs/benchmarks.md for rationale, source limitations, and the complete table.
const CHALLENGE_COST: Record<ModeId, number> = {
  quick: 1,
  triple: 1.9,
  'mixed-three': 2.2,
  four: 3.1,
  'mixed-four': 3.6,
};
export function targetScore(config: Config): number {
  return Math.max(
    1,
    Math.round(
      config.duration /
        (getLevel(config.level).pace * CHALLENGE_COST[config.mode]),
    ),
  );
}
export function isAnswerInput(
  value: string,
  level: LevelId,
  complete = false,
): boolean {
  const pattern = getLevel(level).negatives
    ? complete
      ? /^-?\d{1,13}$/
      : /^-?\d{0,13}$/
    : complete
      ? /^\d{1,13}$/
      : /^\d{0,13}$/;
  return (
    pattern.test(value) && (!complete || Number.isSafeInteger(Number(value)))
  );
}
export type Question = {
  operands: number[];
  operators: Operator[];
  answer: number;
  expression: string;
};
export type Attempt = {
  question: Question;
  answer: number | null;
  correct: boolean;
  elapsedMs: number;
};
export type Round = {
  config: Config;
  phase: 'countdown' | 'playing' | 'result';
  startsAt: number;
  endsAt: number;
  questionStartedAt: number;
  question: Question;
  attempts: Attempt[];
  correct: number;
  streak: number;
  bestStreak: number;
};
export type Result = Config & {
  id: string;
  date: number;
  correct: number;
  wrong: number;
  skipped: number;
  bestStreak: number;
  averageSolveMs: number | null;
  target: number;
};
export const getMode = (id: ModeId) => MODES.find((m) => m.id === id)!;
const choose = <T>(items: readonly T[], random: () => number): T =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))];
const number = (max: number, random: () => number) =>
  Math.min(max, Math.floor(random() * (max + 1)));

function hasNegativeStep(operands: number[], operators: Operator[]): boolean {
  let total = 0,
    term = operands[0],
    sign = 1;
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i],
      next = operands[i + 1];
    if (op === '*') term *= next;
    else if (op === '/') term /= next;
    else {
      total += sign * term;
      if (total < 0) return true;
      term = next;
      sign = op === '+' ? 1 : -1;
    }
  }
  return total + sign * term < 0;
}

// Multiplication/division have equal precedence and are evaluated left to right,
// followed by addition/subtraction, also left to right. Never execute expressions.
export function evaluate(operands: number[], operators: Operator[]): number {
  if (
    operands.length !== operators.length + 1 ||
    !operands.length ||
    operands.some((n) => !Number.isFinite(n))
  )
    throw new Error('Invalid expression');
  let total = 0,
    term = operands[0],
    sign = 1;
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i],
      next = operands[i + 1];
    if (op === '*') term *= next;
    else if (op === '/') {
      if (next === 0) throw new Error('Division by zero');
      term /= next;
    } else if (op === '+' || op === '-') {
      total += sign * term;
      term = next;
      sign = op === '+' ? 1 : -1;
    } else throw new Error('Unknown operator');
  }
  return total + sign * term;
}

export function generateQuestion(
  modeId: ModeId,
  levelId: LevelId,
  random = Math.random,
  previous?: string,
): Question {
  const mode = getMode(modeId),
    level = getLevel(levelId);
  if (!mode || !level) throw new Error('Invalid challenge or level');
  const first = choose(OPERATORS, random);
  const operators: Operator[] = Array.from(
    { length: mode.operands - 1 },
    () => first,
  );
  if (mode.mixed) {
    for (let i = 1; i < operators.length; i++)
      operators[i] = choose(OPERATORS, random);
    if (new Set(operators).size === 1)
      operators[operators.length - 1] = choose(
        OPERATORS.filter((op) => op !== first),
        random,
      );
  }
  for (let retry = 0; ; retry++) {
    const fallback = retry >= 128;
    const operands = [fallback ? level.max : number(level.max, random)];
    let term = operands[0];
    for (const op of operators) {
      let next = fallback ? 0 : number(level.max, random);
      if (op === '/') {
        // Zero is permitted as a numerator, never as a divisor.
        const divisors = Array.from(
          { length: level.max },
          (_, i) => i + 1,
        ).filter((n) => term % n === 0);
        next = fallback ? 1 : choose(divisors, random);
        term /= next;
      } else if (op === '*') term *= next;
      else term = next;
      operands.push(next);
    }
    if (!level.negatives && hasNegativeStep(operands, operators)) continue;
    const symbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    const expression = operands
      .map((n, i) => (i ? `${symbols[operators[i - 1]]} ${n}` : String(n)))
      .join(' ');
    if (expression === previous && retry < 12) continue;
    return {
      operands,
      operators,
      expression,
      answer: evaluate(operands, operators),
    };
  }
}
export function validConfig(value: unknown): value is Config {
  if (!value || typeof value !== 'object') return false;
  const c = value as Config;
  return (
    MODES.some((m) => m.id === c.mode) &&
    LEVELS.some((l) => l.id === c.level) &&
    DURATIONS.includes(c.duration)
  );
}
export function startRound(
  config: Config,
  now: number,
  random = Math.random,
): Round {
  if (!validConfig(config))
    throw new Error('Choose a supported mode and duration');
  return {
    config: { ...config },
    phase: 'countdown',
    startsAt: now + 3000,
    endsAt: now + 3000 + config.duration * 1000,
    questionStartedAt: now + 3000,
    question: generateQuestion(config.mode, config.level, random),
    attempts: [],
    correct: 0,
    streak: 0,
    bestStreak: 0,
  };
}
export function advanceRound(round: Round, now: number): Round {
  if (round.phase === 'result') return round;
  if (now >= round.endsAt) return { ...round, phase: 'result' };
  if (now >= round.startsAt && round.phase === 'countdown')
    return { ...round, phase: 'playing' };
  return round;
}
export function submitAnswer(
  round: Round,
  rawAnswer: string | null,
  now: number,
  random = Math.random,
): Round {
  const current = advanceRound(round, now);
  if (current.phase !== 'playing') return current;
  if (
    rawAnswer !== null &&
    !isAnswerInput(rawAnswer, current.config.level, true)
  )
    return current;
  const answer = rawAnswer === null ? null : Number(rawAnswer);
  const correct = answer === current.question.answer;
  const streak = correct ? current.streak + 1 : 0;
  return {
    ...current,
    attempts: [
      ...current.attempts,
      {
        question: current.question,
        answer,
        correct,
        elapsedMs: Math.max(0, now - current.questionStartedAt),
      },
    ],
    questionStartedAt: now,
    correct: current.correct + Number(correct),
    streak,
    bestStreak: Math.max(streak, current.bestStreak),
    question: generateQuestion(
      current.config.mode,
      current.config.level,
      random,
      current.question.expression,
    ),
  };
}
export function toResult(round: Round, id: string, date: number): Result {
  return {
    ...round.config,
    id,
    date,
    correct: round.correct,
    wrong: round.attempts.filter((a) => !a.correct && a.answer !== null).length,
    skipped: round.attempts.filter((a) => a.answer === null).length,
    bestStreak: round.bestStreak,
    averageSolveMs: round.correct
      ? round.attempts
          .filter((a) => a.correct)
          .reduce((sum, a) => sum + a.elapsedMs, 0) / round.correct
      : null,
    target: targetScore(round.config),
  };
}
export function accuracy(
  result: Pick<Result, 'correct' | 'wrong' | 'skipped'>,
): number {
  const total = result.correct + result.wrong + result.skipped;
  return total ? Math.round((result.correct / total) * 100) : 0;
}
export function reward(correct: number, target: number) {
  const ratio = correct / target;
  if (!correct)
    return {
      title: 'Every wizard starts somewhere',
      message:
        'Take a breath. A fresh round is another chance to find your rhythm.',
      stars: 0,
    };
  if (ratio >= 2)
    return {
      title: 'You’re a Mathmagician!',
      message: 'At least twice the target. That was a little extraordinary.',
      stars: 3,
    };
  if (ratio > 1)
    return {
      title: 'A little faster than the target',
      message: 'You beat the estimated pace. Keep that magic going.',
      stars: 3,
    };
  if (ratio === 1)
    return {
      title: 'Right on the magic mark',
      message: 'Target matched. One more correct answer will put you ahead.',
      stars: 2,
    };
  if (ratio >= 0.6)
    return {
      title: 'You’re finding your rhythm',
      message:
        'The target is within reach. A steady next round could get you there.',
      stars: 1,
    };
  return {
    title: 'Every spark counts',
    message:
      'Below the target this time. Focus on accuracy; speed comes with practice.',
    stars: 1,
  };
}
export function comparisonText(correct: number, target: number): string {
  if (correct === target) return 'Matched the estimated target';
  const difference = Math.abs(correct - target);
  return `${difference} ${difference === 1 ? 'answer' : 'answers'} ${correct > target ? 'above' : 'below'} the estimated target`;
}
export function shareText(result: Result): string {
  return `✦ ${reward(result.correct, result.target).title}\nI solved ${result.correct} ${result.correct === 1 ? 'calculation' : 'calculations'} in ${result.duration} seconds on Mathmagician!\n${getLevel(result.level).name} mode · ${getMode(result.mode).name} · ${accuracy(result)}% accuracy · ${result.bestStreak} best streak\n${comparisonText(result.correct, result.target)} (${result.target})${result.averageSolveMs === null ? '' : `\n${(result.averageSolveMs / 1000).toFixed(2)}s average per correct answer`}\nThink you can beat that?\n${APP_URL}`;
}
export function parseResults(raw: string | null): Result[] {
  try {
    const list: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) return [];
    return list
      .filter((value): value is Result => {
        if (!validConfig(value)) return false;
        const r = value as Result;
        return (
          typeof r.id === 'string' &&
          Number.isFinite(r.date) &&
          ['correct', 'wrong', 'skipped', 'bestStreak'].every(
            (k) =>
              Number.isSafeInteger(r[k as keyof Result]) &&
              Number(r[k as keyof Result]) >= 0,
          ) &&
          r.bestStreak <= r.correct &&
          Number.isSafeInteger(r.target) &&
          r.target >= 1 &&
          (r.averageSolveMs === null ||
            (Number.isFinite(r.averageSolveMs) &&
              r.averageSolveMs >= 0 &&
              r.averageSolveMs <= r.duration * 1000))
        );
      })
      .slice(0, 100);
  } catch {
    return [];
  }
}
export const recordKey = (c: Config) => `${c.level}:${c.mode}:${c.duration}`;
export function bestResults(results: Result[]): Result[] {
  const best = new Map<string, Result>();
  for (const r of results)
    if (!best.has(recordKey(r)) || r.correct > best.get(recordKey(r))!.correct)
      best.set(recordKey(r), r);
  return [...best.values()];
}

export type LegacyResult = Omit<Result, 'level' | 'target' | 'averageSolveMs'>;
// Preserve earlier scores as an archive, without treating their different rules
// as Kids-mode records or mixing them into the new benchmarks.
export function parseLegacyResults(raw: string | null): LegacyResult[] {
  try {
    const list: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) return [];
    return list
      .filter((value): value is LegacyResult => {
        if (!value || typeof value !== 'object' || 'level' in value)
          return false;
        const r = value as LegacyResult;
        return (
          MODES.some((m) => m.id === r.mode) &&
          DURATIONS.includes(r.duration) &&
          typeof r.id === 'string' &&
          Number.isFinite(r.date) &&
          ['correct', 'wrong', 'skipped', 'bestStreak'].every(
            (k) =>
              Number.isSafeInteger(r[k as keyof LegacyResult]) &&
              Number(r[k as keyof LegacyResult]) >= 0,
          ) &&
          r.bestStreak <= r.correct
        );
      })
      .slice(0, 50);
  } catch {
    return [];
  }
}
