import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES,
  LEVELS,
  DURATIONS,
  evaluate,
  generateQuestion,
  startRound,
  advanceRound,
  submitAnswer,
  toResult,
  accuracy,
  shareText,
  parseResults,
  parseLegacyResults,
  bestResults,
  targetScore,
  reward,
  comparisonText,
  isAnswerInput,
  validConfig,
  type Config,
} from '../lib/game.ts';
function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const config: Config = { mode: 'quick', level: 'kids', duration: 30 };

void test('PEMDAS, equal precedence, zero and negative arithmetic', () => {
  assert.equal(evaluate([8, 3, 4], ['+', '*']), 20);
  assert.equal(evaluate([12, 3, 2, 5], ['/', '+', '*']), 14);
  assert.equal(evaluate([20, 5, 2], ['/', '*']), 8);
  assert.equal(evaluate([20, 2, 5], ['/', '/']), 2);
  assert.equal(evaluate([12, 3, 2], ['-', '+']), 11);
  assert.equal(evaluate([0, 20, 20, 20], ['-', '-', '-']), -60);
  assert.equal(evaluate([0, 20], ['/']), 0);
  assert.throws(() => evaluate([0, 0], ['/']));
});
void test('100,000 questions: all four difficulty ranges, no zero divisors, exact answers, mode structure, and Kids nonnegative steps', () => {
  for (const level of LEVELS) {
    let sawZero = false,
      sawMax = false,
      sawNegative = false;
    for (const mode of MODES) {
      const random = rng(73),
        seen = new Set<string>();
      for (let i = 0; i < 5000; i++) {
        const q = generateQuestion(mode.id, level.id, random);
        assert.equal(q.operands.length, mode.operands);
        assert.ok(
          q.operands.every(
            (n) => Number.isInteger(n) && n >= 0 && n <= level.max,
          ),
        );
        sawZero ||= q.operands.includes(0);
        sawMax ||= q.operands.includes(level.max);
        sawNegative ||= q.answer < 0;
        assert.equal(q.operators.length, mode.operands - 1);
        assert.ok(
          mode.mixed
            ? new Set(q.operators).size >= 2
            : new Set(q.operators).size === 1,
        );
        assert.ok(Number.isSafeInteger(q.answer));
        assert.ok(isAnswerInput(String(q.answer), level.id, true));
        // Independent reduction of high-precedence terms, then running totals.
        const terms = [q.operands[0]],
          low: string[] = [];
        q.operators.forEach((op, j) => {
          const n = q.operands[j + 1];
          seen.add(op);
          if (op === '*') terms[terms.length - 1] *= n;
          else if (op === '/') {
            assert.notEqual(n, 0);
            assert.equal(terms[terms.length - 1] % n, 0);
            terms[terms.length - 1] /= n;
          } else {
            low.push(op);
            terms.push(n);
          }
        });
        let total = terms[0];
        terms.slice(1).forEach((n, j) => {
          total += low[j] === '+' ? n : -n;
          if (!level.negatives) assert.ok(total >= 0);
        });
        assert.equal(q.answer, total);
        if (!level.negatives) assert.ok(q.answer >= 0);
      }
      assert.equal(seen.size, 4);
    }
    assert.ok(sawZero);
    assert.ok(sawMax);
    assert.equal(sawNegative, level.negatives);
  }
});
void test('Kids generator terminates even with repetitive randomness', () => {
  for (const mode of MODES)
    for (const value of [0, 0.3, 0.5, 0.99]) {
      const q = generateQuestion(mode.id, 'kids', () => value);
      assert.ok(q.answer >= 0);
      assert.ok(Number.isInteger(q.answer));
    }
});
void test('all 100 configurations enforce preparation countdown and exact deadline', () => {
  for (const level of LEVELS)
    for (const mode of MODES)
      for (const duration of DURATIONS) {
        const r = startRound(
          { mode: mode.id, level: level.id, duration },
          1000,
        );
        assert.equal(r.endsAt, 4000 + duration * 1000);
        assert.equal(r.questionStartedAt, 4000);
        assert.equal(advanceRound(r, 3999).phase, 'countdown');
        assert.equal(advanceRound(r, 4000).phase, 'playing');
        assert.equal(
          submitAnswer(r, String(r.question.answer), 3999).correct,
          0,
        );
        assert.equal(
          submitAnswer(r, String(r.question.answer), r.endsAt - 1).correct,
          1,
        );
        assert.equal(
          submitAnswer(r, String(r.question.answer), r.endsAt).correct,
          0,
        );
        assert.equal(advanceRound(r, r.endsAt + 1e6).phase, 'result');
      }
  assert.throws(() => startRound({ ...config, duration: 121 as 30 }, 0));
  assert.equal(validConfig({ ...config, level: 'other' }), false);
});
void test('timing excludes countdown and records correct, wrong, skipped, and in-progress question time separately', () => {
  let r = startRound(config, 1000, rng(3));
  r = submitAnswer(r, String(r.question.answer), 5250); // starts at 4000: 1250ms
  r = submitAnswer(r, String(r.question.answer + 1), 7750); // wrong: 2500ms
  r = submitAnswer(r, null, 9750); // skip: 2000ms
  r = submitAnswer(r, String(r.question.answer), 11500); // correct: 1750ms
  assert.deepEqual(
    r.attempts.map((a) => a.elapsedMs),
    [1250, 2500, 2000, 1750],
  );
  assert.equal(r.questionStartedAt, 11500);
  const result = toResult(r, 'timing', Date.now());
  assert.equal(result.averageSolveMs, 1500);
  assert.equal(result.correct, 2);
  assert.equal(result.wrong, 1);
  assert.equal(result.skipped, 1);
  assert.equal(accuracy(result), 50);
  assert.equal(
    toResult(startRound(config, 0), 'empty', 0).averageSolveMs,
    null,
  );
  const ended = submitAnswer(r, '1', r.endsAt);
  assert.equal(ended.attempts.length, 4);
});
void test('native numeric field rejects letters, decimals, exponents and malformed signs while accepting God-size answers', () => {
  for (const level of LEVELS) {
    for (const value of [
      '',
      '-',
      '3.4',
      '1e2',
      '12foo',
      '+3',
      '--1',
      '1-2',
      'NaN',
      'Infinity',
      '10000000000000',
    ])
      assert.equal(isAnswerInput(value, level.id, true), false);
    for (const value of ['0', '123', '1000000000000'])
      assert.ok(isAnswerInput(value, level.id, true));
    assert.equal(isAnswerInput('-123', level.id, true), level.negatives);
    assert.equal(isAnswerInput('-', level.id), level.negatives);
  }
  let r = advanceRound(
    startRound({ ...config, level: 'god', mode: 'four' }, 0),
    3000,
  );
  r = {
    ...r,
    question: {
      operands: [1000, 1000, 1000, 1000],
      operators: ['*', '*', '*'],
      answer: 1e12,
      expression: '1000 × 1000 × 1000 × 1000',
    },
  };
  assert.equal(submitAnswer(r, '1000000000000', 4000).correct, 1);
});
void test('targets scale with duration and difficulty, and all comparison bands have distinct rewards', () => {
  assert.equal(targetScore(config), 8);
  for (const mode of MODES) {
    for (const duration of DURATIONS) {
      let prior = Infinity;
      for (const level of LEVELS) {
        const target = targetScore({
          mode: mode.id,
          level: level.id,
          duration,
        });
        assert.ok(target >= 1);
        assert.ok(target <= prior);
        prior = target;
      }
    }
    for (const level of LEVELS) {
      let prior = 0;
      for (const duration of DURATIONS) {
        const target = targetScore({
          mode: mode.id,
          level: level.id,
          duration,
        });
        assert.ok(target >= prior);
        prior = target;
      }
    }
  }
  const titles = [0, 2, 6, 8, 9, 16].map((score) => reward(score, 8).title);
  assert.equal(new Set(titles).size, 6);
  assert.match(comparisonText(7, 8), /1 answer below/);
  assert.match(comparisonText(8, 8), /Matched/);
  assert.match(comparisonText(9, 8), /1 answer above/);
});
void test('share links, record isolation, storage validation, and preservation of original-rule scores', () => {
  let r = advanceRound(
    startRound({ ...config, mode: 'mixed-four', level: 'adult' }, 0, rng(7)),
    3000,
  );
  for (let i = 0; i < 3; i++)
    r = submitAnswer(r, String(r.question.answer), 4000 + i * 1000);
  const result = toResult(r, 'test', 1000);
  assert.equal(result.bestStreak, 3);
  const text = shareText(result);
  assert.match(text, /3 calculations in 30 seconds/);
  assert.match(text, /Adult mode · Full wizard/);
  assert.match(text, /1.00s average/);
  assert.ok(text.endsWith('https://lowkey.tools/mathmagician'));
  assert.equal(parseResults('bad').length, 0);
  assert.equal(
    parseResults(
      JSON.stringify([
        { ...result, duration: 300 },
        result,
        { ...result, averageSolveMs: -1 },
      ]),
    ).length,
    1,
  );
  const bests = bestResults([
    result,
    { ...result, correct: 8 },
    { ...result, level: 'god', correct: 5 },
  ]);
  assert.equal(bests.length, 2);
  assert.equal(bests.find((b) => b.level === 'adult')?.correct, 8);
  const legacy = {
    id: 'old',
    date: 500,
    mode: 'quick',
    duration: 30,
    correct: 13,
    wrong: 0,
    skipped: 0,
    bestStreak: 13,
  };
  assert.equal(parseLegacyResults(JSON.stringify([legacy, result])).length, 1);
  assert.equal(parseResults(JSON.stringify([legacy])).length, 0);
});
