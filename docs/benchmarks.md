# Score-to-beat targets

These are editorial training targets, **not measured human averages, population percentiles, age norms, or intelligence scores**. The app has no analytics backend or representative player dataset. Kids is a ruleset name, not an age-specific assessment.

## Research context

Zimmerman et al. (2016), [Arithmetic on Your Phone](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0168431), measured typed responses in a mobile arithmetic game. Its single-digit analysis predicts about 3.39 seconds for 7 + 8 and finds longer response times for larger problems. Those results do not establish averages for Mathmagician’s multi-operand, subtraction/division, or larger-number modes. We use the findings only to motivate several seconds per question and higher targets for easier challenges.

## Product estimates

Base seconds per Quick start answer: Kids 4, Adult 7, Legendary 11, God 25. Challenge multipliers: Quick start 1, Triple threat 1.9, Mix it up 2.2, Four of a kind 3.1, Full wizard 3.6.

`target = max(1, round(durationSeconds / (baseSeconds × challengeMultiplier)))`

The one-answer minimum gives even the hardest short round a concrete goal. Larger multiplication chains can take much longer than that; targets are intentionally approximate. They depend on level, expression challenge, and duration, never on an invented user cohort. Future calibration should use representative first-session data for this exact generator and input method, with informed consent, rather than copying norms from a different task.

A 30-second round uses:

| Mode | Quick start | Triple threat | Mix it up | Four of a kind | Full wizard |
| --- | ---: | ---: | ---: | ---: | ---: |
| Kids | 8 | 4 | 3 | 2 | 2 |
| Adult | 4 | 2 | 2 | 1 | 1 |
| Legendary | 3 | 1 | 1 | 1 | 1 |
| God | 1 | 1 | 1 | 1 | 1 |

## Feedback

Distinct messages cover no correct answers, below 60% of target, 60–99%, exactly matching, beating, and at least doubling the target. They compare performance with the estimated target, not with other people. Shared results state the target, difficulty, challenge, accuracy, streak, and average time per correct answer.

Per-question time includes reading and entering the answer. The preparation countdown is excluded. Wrong answers and skips have their own recorded duration; average solve time includes only correct answers. The final unanswered question is shown separately without being added to attempts or accuracy.
