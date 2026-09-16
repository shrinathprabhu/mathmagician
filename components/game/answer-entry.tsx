'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CornerDownLeft, SkipForward, X } from 'lucide-react';
import { getLevel, isAnswerInput, type LevelId } from '@/lib/game';

export type AnswerFeedback = { text: string; correct: boolean } | null;

// Keep keystrokes local: typing must not rerender the game, settings, or dialogs.
export function AnswerEntry({
  levelId,
  feedback,
  onSubmit,
}: {
  levelId: LevelId;
  feedback: AnswerFeedback;
  onSubmit: (answer: string | null) => void;
}) {
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const level = getLevel(levelId);
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const clear = () => {
    setAnswer('');
    inputRef.current?.focus({ preventScroll: true });
  };
  const submit = (value: string | null) => {
    onSubmit(value);
    clear();
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isAnswerInput(answer, levelId, true)) submit(answer);
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
          onChange={(event) => {
            if (isAnswerInput(event.target.value, levelId))
              setAnswer(event.target.value);
          }}
          onPaste={(event) => {
            event.preventDefault();
            const value = event.clipboardData.getData('text').trim();
            if (isAnswerInput(value, levelId, true)) setAnswer(value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              clear();
            }
            if (event.key === 'Enter' && event.repeat) event.preventDefault();
          }}
          placeholder="Your answer"
          aria-describedby="answer-hint"
        />
        {level.negatives && (
          <button
            type="button"
            className="sign-toggle"
            aria-label="Toggle negative answer"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              setAnswer(
                answer.startsWith('-') ? answer.slice(1) : `-${answer}`,
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
          disabled={!isAnswerInput(answer, levelId, true)}
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
            <span>{feedback.text}</span>
          </>
        ) : level.negatives ? (
          'Whole numbers only. Use ± for a negative answer.'
        ) : (
          'Whole numbers only. No negative answers in Kids mode.'
        )}
      </div>
      <div className="game-actions">
        <button className="quiet-button" onClick={() => submit(null)}>
          <SkipForward size={14} /> Skip
        </button>
        <span>Enter ↵ to submit</span>
        <button
          className="quiet-button"
          onClick={clear}
          aria-label="Clear answer"
        >
          Clear <X size={13} />
        </button>
      </div>
    </>
  );
}
