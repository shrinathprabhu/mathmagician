'use client';

import { memo, useEffect, useState } from 'react';
import { Check, Clock3, Flame } from 'lucide-react';
import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { ProgressTrack, ProgressIndicator } from '@/components/ui/progress';
import type { Round } from '@/lib/game';

// Only these small displays repaint as time passes. The game engine schedules
// deadlines independently and rechecks them on every submission.
function useClock(readNow: () => number, precision = 100, origin = 0) {
  const [now, setNow] = useState(readNow);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const current = readNow();
      setNow(current);
      const elapsed =
        (((current - origin) % precision) + precision) % precision;
      timeout = setTimeout(refresh, Math.max(1, precision - elapsed));
    };
    const visibility = () => {
      clearTimeout(timeout);
      if (!document.hidden) {
        refresh();
      }
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [readNow, precision, origin]);
  return now;
}

export function CountdownClock({
  startsAt,
  readNow,
}: {
  startsAt: number;
  readNow: () => number;
}) {
  const now = useClock(readNow, 1000, startsAt);
  const count = Math.max(1, Math.ceil((startsAt - now) / 1000));
  return (
    <output className="countdown-number" key={count} aria-live="assertive">
      {count}
    </output>
  );
}

export const RoundClock = memo(function RoundClock({
  round,
  readNow,
}: {
  round: Round;
  readNow: () => number;
}) {
  const now = useClock(readNow);
  const seconds = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
  const progress = Math.max(
    0,
    Math.min(1, (round.endsAt - now) / (round.config.duration * 1000)),
  );
  return (
    <>
      <div className="game-stats">
        <div className={`time-stat ${seconds <= 5 ? 'time-urgent' : ''}`}>
          <span>
            <Clock3 size={14} />
            TIME LEFT
          </span>
          <strong role="timer" aria-label={`${seconds} seconds remaining`}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            <small> / {round.config.duration}s</small>
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
      <ProgressPrimitive.Root
        value={Math.ceil(progress * 100)}
        aria-label="Round time remaining"
        className={seconds <= 5 ? 'timer-progress urgent' : 'timer-progress'}
      >
        <ProgressTrack>
          <ProgressIndicator
            style={{ width: '100%', transform: `scaleX(${progress})` }}
          />
        </ProgressTrack>
      </ProgressPrimitive.Root>
    </>
  );
});

export const QuestionClock = memo(function QuestionClock({
  startedAt,
  endsAt,
  readNow,
}: {
  startedAt: number;
  endsAt: number;
  readNow: () => number;
}) {
  const now = useClock(readNow);
  return (
    <div className="question-time">
      <Clock3 size={14} />
      <span>This question</span>
      <strong>
        {(Math.max(0, Math.min(endsAt, now) - startedAt) / 1000).toFixed(1)}s
      </strong>
    </div>
  );
});
