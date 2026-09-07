import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES,
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
  bestResults,
} from '../lib/game.ts';
function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
void test('PEMDAS, equal precedence, negative and zero answers', () => {
  assert.equal(evaluate([8, 3, 4], ['+', '*']), 20);
  assert.equal(evaluate([12, 3, 2, 5], ['/', '+', '*']), 14);
  assert.equal(evaluate([20, 5, 2], ['/', '*']), 8);
  assert.equal(evaluate([20, 2, 5], ['/', '/']), 2);
  assert.equal(evaluate([12, 3, 2], ['-', '+']), 11);
  assert.equal(evaluate([1, 20, 20, 20], ['-', '-', '-']), -59);
  assert.equal(evaluate([1, 1], ['-']), 0);
  assert.throws(() => evaluate([1, 0], ['/']));
});
void test('25,000 questions obey operand limits, operator modes, integer answers, and independent precedence evaluation', () => {
  for (const mode of MODES) {
    const random = rng(42),
      seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const q = generateQuestion(mode.id, random);
      assert.equal(q.operands.length, mode.operands);
      assert.ok(
        q.operands.every((n) => Number.isInteger(n) && n >= 1 && n <= 20),
      );
      assert.equal(q.operators.length, mode.operands - 1);
      assert.ok(
        mode.mixed
          ? new Set(q.operators).size >= 2
          : new Set(q.operators).size === 1,
      );
      assert.ok(Number.isSafeInteger(q.answer));
      // Independent stack evaluator, no dynamic execution.
      const values = [q.operands[0]],
        low: string[] = [];
      q.operators.forEach((op, j) => {
        const n = q.operands[j + 1];
        if (op === '*') values[values.length - 1] *= n;
        else if (op === '/') values[values.length - 1] /= n;
        else {
          low.push(op);
          values.push(n);
        }
      });
      assert.equal(
        q.answer,
        values.reduce(
          (sum, n, j) => (j ? (low[j - 1] === '+' ? sum + n : sum - n) : n),
          0,
        ),
      );
      q.operators.forEach((op) => seen.add(op));
    }
    assert.equal(seen.size, 4);
  }
});
void test('only the five durations, default round countdown and hard deadline', () => {
  for (const duration of DURATIONS) {
    const r = startRound({ mode: 'quick', duration }, 1000);
    assert.equal(r.endsAt, 4000 + duration * 1000);
    assert.equal(advanceRound(r, 3999).phase, 'countdown');
    assert.equal(advanceRound(r, 4000).phase, 'playing');
    assert.equal(submitAnswer(r, String(r.question.answer), 3999).correct, 0);
    assert.equal(
      submitAnswer(r, String(r.question.answer), r.endsAt - 1).correct,
      1,
    );
    assert.equal(
      submitAnswer(r, String(r.question.answer), r.endsAt).correct,
      0,
    );
    assert.equal(advanceRound(r, r.endsAt + 1_000_000).phase, 'result');
  }
  assert.throws(() => startRound({ mode: 'quick', duration: 121 as 30 }, 0));
});
void test('correct, wrong, skip, invalid, streak, and sharing counts', () => {
  let r = advanceRound(
    startRound({ mode: 'mixed-four', duration: 30 }, 0, rng(7)),
    3000,
  );
  for (let i = 0; i < 3; i++)
    r = submitAnswer(r, String(r.question.answer), 3100 + i);
  assert.equal(r.correct, 3);
  assert.equal(r.bestStreak, 3);
  for (const s of ['', '-', '3.4', '1e2', '12foo', '12345678'])
    assert.equal(submitAnswer(r, s, 3200), r);
  r = submitAnswer(r, String(r.question.answer + 1), 3300);
  r = submitAnswer(r, null, 3400);
  const result = toResult(r, 'test', 1000);
  assert.equal(result.wrong, 1);
  assert.equal(result.skipped, 1);
  assert.equal(r.streak, 0);
  assert.equal(accuracy(result), 60);
  assert.match(shareText(result), /3 calculations in 30 seconds/);
  assert.match(shareText(result), /Full wizard/);
  assert.equal(parseResults('bad').length, 0);
  assert.equal(
    parseResults(JSON.stringify([{ ...result, duration: 300 }, result])).length,
    1,
  );
  assert.equal(bestResults([result, { ...result, correct: 8 }])[0].correct, 8);
});
