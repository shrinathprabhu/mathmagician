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
export type Config = { mode: ModeId; duration: Duration };
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
};
export type Round = {
  config: Config;
  phase: 'countdown' | 'playing' | 'result';
  startsAt: number;
  endsAt: number;
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
};
export const getMode = (id: ModeId) => MODES.find((m) => m.id === id)!;
const choose = <T>(items: readonly T[], random: () => number): T =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))];
const number = (random: () => number) =>
  Math.min(20, 1 + Math.floor(random() * 20));

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
  random = Math.random,
  previous?: string,
): Question {
  const mode = getMode(modeId);
  if (!mode) throw new Error('Invalid mode');
  let result: Question;
  for (let retry = 0; ; retry++) {
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
    const operands = [number(random)];
    let term = operands[0];
    for (const op of operators) {
      let next = number(random);
      if (op === '/') {
        // An exact divisor keeps every division step (and final answer) whole.
        const divisors = Array.from({ length: 20 }, (_, i) => i + 1).filter(
          (n) => term % n === 0,
        );
        next = choose(divisors, random);
        term /= next;
      } else if (op === '*') term *= next;
      else term = next;
      operands.push(next);
    }
    const symbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    const expression = operands
      .map((n, i) => (i ? `${symbols[operators[i - 1]]} ${n}` : String(n)))
      .join(' ');
    result = {
      operands,
      operators,
      expression,
      answer: evaluate(operands, operators),
    };
    if (expression !== previous || retry >= 12) return result;
  }
}
export function validConfig(value: unknown): value is Config {
  if (!value || typeof value !== 'object') return false;
  const c = value as Config;
  return MODES.some((m) => m.id === c.mode) && DURATIONS.includes(c.duration);
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
    question: generateQuestion(config.mode, random),
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
  if (rawAnswer !== null && !/^-?\d{1,7}$/.test(rawAnswer)) return current;
  const answer = rawAnswer === null ? null : Number(rawAnswer);
  const correct = answer === current.question.answer;
  const streak = correct ? current.streak + 1 : 0;
  return {
    ...current,
    attempts: [
      ...current.attempts,
      { question: current.question, answer, correct },
    ],
    correct: current.correct + Number(correct),
    streak,
    bestStreak: Math.max(streak, current.bestStreak),
    question: generateQuestion(
      current.config.mode,
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
  };
}
export function accuracy(
  result: Pick<Result, 'correct' | 'wrong' | 'skipped'>,
): number {
  const total = result.correct + result.wrong + result.skipped;
  return total ? Math.round((result.correct / total) * 100) : 0;
}
export function reward(correct: number, duration: Duration) {
  const rate = (correct * 60) / duration;
  if (!correct)
    return {
      title: 'Every wizard starts somewhere',
      message: 'Take a breath. Your next round is a fresh start.',
      stars: 0,
    };
  if (rate >= 60)
    return {
      title: 'You’re a Mathmagician!',
      message: 'Your numbers are moving at the speed of magic.',
      stars: 3,
    };
  if (rate >= 30)
    return {
      title: 'Lightning brain',
      message: 'Quick thinking. Sharp instincts. That was electric.',
      stars: 3,
    };
  if (rate >= 15)
    return {
      title: 'Number sorcerer',
      message: 'You’ve got a little magic in those mental muscles.',
      stars: 2,
    };
  return {
    title: 'Sparks are flying',
    message: 'A little sharper, one calculation at a time.',
    stars: 1,
  };
}
export function shareText(result: Result): string {
  return `✦ ${reward(result.correct, result.duration).title}\nI solved ${result.correct} ${result.correct === 1 ? 'calculation' : 'calculations'} in ${result.duration} seconds on Mathmagician!\n${getMode(result.mode).name} · ${accuracy(result)}% accuracy · ${result.bestStreak} best streak\nThink you can beat that?\nhttps://mathmagician.lowkey.tools`;
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
          r.bestStreak <= r.correct
        );
      })
      .slice(0, 100);
  } catch {
    return [];
  }
}
export const recordKey = (c: Config) => `${c.mode}:${c.duration}`;
export function bestResults(results: Result[]): Result[] {
  const best = new Map<string, Result>();
  for (const r of results)
    if (!best.has(recordKey(r)) || r.correct > best.get(recordKey(r))!.correct)
      best.set(recordKey(r), r);
  return [...best.values()];
}
