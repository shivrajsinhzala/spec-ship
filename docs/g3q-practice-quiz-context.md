# G3Q Practice Quiz — context & findings

Shared knowledge file. Everything here was observed on **2026-10-17** by driving the live page
(`https://quiz.g3q.ai/practice-quiz#gb2`) with Playwright + Chromium from a cloud session.
Nothing here comes from the site's source code — only from network traffic and the rendered UI —
so treat internals as "observed", not "documented". Add to this file as you learn more.

## What the thing is

- **G3Q 2026 – ગુજરાત જ્ઞાન ગુરુ ક્વિઝ** (Gujarat Gyan Guru Quiz). Gujarati-language quiz on government
  schemes; weekly quizzes carry cash prizes + certificates (from the page's meta description).
- `/practice-quiz` is the **practice mode**: "G3Q Practice – Random practice set", 10 mixed-type questions
  drawn from a practice pool. `quiz.durationMinutes` is `0` (no time limit), `totalPoints` is 10.
- Frontend: Next.js (Turbopack build), mobile-first; on desktop it renders as a centred phone-sized frame.
  Backend: Express API at `https://api.g3q.ai`. Analytics: Google Analytics `G-336NLT6KGC` + own events endpoint.
- Other routes seen in the nav: `/home`, `/practice-quiz`, `/g3q-ai`, `/leaderboard`, `/profile`,
  `/result/practice-quiz`.

## Network behaviour

| Call | When | Notes |
|---|---|---|
| `GET api.g3q.ai/api/practice-quiz?language=gu` | page load | Returns a **fresh random set of 10 questions every call** (different ETag/body each time). |
| `POST api.g3q.ai/api/v1/analytics/events` `{eventType:"practice_quiz_start", deviceFingerprint, occurredAt}` | right after quiz loads | 202 response. |
| `POST …/analytics/events` `{eventType:"practice_quiz_complete", …}` | on the last "see result" click | Only start + complete are sent. **No per-answer request and no submit request.** |

**Grading is entirely client-side.** The quiz response includes the correct answer and an explanation for
every question, so the browser already holds all answers before the first one is shown:

```jsonc
{ "success": true,
  "quiz": { "id": "practice", "title": "G3Q Practice", "totalQuestions": 10, "durationMinutes": 0, "week": 4, … },
  "questions": [ {
      "id": "practice_2311", "order": 1, "type": "single_choice",
      "question": "…", "department": "Roads, Highways & Transport Infrastructure",
      "bg": "https://…cloudfront.net/g3q/QuizBackgrounds/9/….jpg",
      "options": { "a": "…", "b": "…", "c": "…", "d": "…" },
      "answer": { "mode": "single", "value": "c" },
      "explanation": "…" } ] }
```

## Question types (`type` → `answer`)

| `type` | UI | `answer.mode` / `value` |
|---|---|---|
| `single_choice` | tap one of 4 pills | `single` / option key, e.g. `"c"` |
| `true_false` | tap સાચું / ખોટું | `single` / `"a"` (true) or `"b"` (false) |
| `match_following` | rows on left (`targets` L1..L4), tap an option below then tap the slot (or drag) | `map` / `{L1:"R1",…}` |
| `drag_into_blanks` | sentence with `___ 1`, `___ 2` slots; tap a word, then tap the slot (or drag) | `map` / `{B1:"W1",…}` |
| `drag_drop` | ordering list, drag handle on the right ("ખેંચીને ક્રમ બદલો") | `sequence` / ordered ids `["I1","I2",…]` |

Option/target objects are keyed by id and are **shuffled in display**, so ids ≠ screen position.

## UI flow

1. Header pill: close (✕) · `પ્રશ્ન N/10` · timer. Submit button is disabled until the question is fully answered.
2. Tap **સબમિટ કરો** → button shows "જવાબ ચકાસી રહ્યા છીએ..." for ~2.8–3.9 s (no network call happens, so
   this looks like a deliberate fixed delay) → bottom sheet opens with "શું તમે જાણો છો?" (the explanation),
   "સાચો જવાબ: …" (correct answer) and a ✓ સાચો જવાબ! / ✗ ખોટા banner + **આગલો પ્રશ્ન**.
3. Last question's button reads **પરિણામ જુઓ** → `/result/practice-quiz`.
4. Result page: "Well Done !" + percentage, સાચા / ખોટા counts, સમય (seconds), buttons *હોમ પેજ* and *G3Q AI*.
   No per-question review.

## Behaviours worth knowing (verified)

- **Timer is per question, not total.** It resets to ~00:01 on every question, despite the tooltip text "કુલ સમય"
  (total time). It has **no timeout**: left idle it reached 01:17 with no auto-submit. After ~30 s it turns red and
  the clock icon changes. The result page's total (21 s in our run) appears to be the sum of answer times and
  excludes the ~3 s "checking" delay.
- **`#gb1` / `#gb2` hash** is a history guard. Loading with `#gb2` is rewritten to `#gb1`. Clicking ✕ opens a
  "quit?" confirmation (રદ કરો / હા) and moves to `#gb2`; browser Back returns to `#gb1`. After the first
  explanation sheet the hash stays at `#gb2` for the rest of the quiz (not investigated further).
- **Reload mid-quiz restarts** with a brand-new random set and a new `practice_quiz_start` event (tested on Q1).
  `localStorage` holds `ggq:v1:quiz-progress` (`quizId`, `attemptId`, …) and `ggq:v1:device-fingerprint`, but the
  progress is not resumed after reload.
- **Visiting `/result/practice-quiz` with no completed attempt** shows "માહિતી મળી નથી. ફરી પ્રયત્ન કરો"
  (no info found, try again) — handled gracefully.
- Ordering questions use pointer-based drag (items are `li[data-item-id]`, **not** HTML5 `draggable`), so
  automation needs `mouse.down/move/up` on the `li`, not `dragTo`.
- Result copy "Well Done !" is English inside an otherwise Gujarati UI (cosmetic).

## Observations / possible issues (not acted on)

- Answers + explanations are shipped to the client before the user answers. For a prize quiz that would matter; for
  practice mode it's low impact, but anyone could read answers from DevTools → Network. If answers should be
  hidden, grading would need to move server-side (e.g. POST the answer, return correctness + explanation).
- Fixed ~3 s "checking" delay on every submit (≈30 s per 10-question run) with no network activity behind it.
- No timeout despite a visible timer; "કુલ સમય" label doesn't match a per-question timer.
- History hash stays at `#gb2`, so Back behaviour after the first question is unclear.

## Test method (reproducible)

Playwright 1.56 with the pre-installed Chromium (`/opt/pw-browsers/chromium`, `--no-sandbox`), 430×900 viewport.
The API response was captured with `page.on('response')` to know the right answers. Useful selectors:

- Submit: `[data-testid=quiz-submit-button]` (two exist — mobile/desktop; use `:visible`)
- Match rows' slots: `.grid-cols-2 > button` (nth = row order); options below: `button` by exact name
- Blank slots: buttons named `___ N`; ordering rows: `li[data-item-id]`
- Next after submit: button text `આગલો પ્રશ્ન` / `પરિણામ જુઓ`
- Header text for progress/timer: `header`

To force an ordering question first, route `**/api/practice-quiz*` and reorder `questions` before fulfilling.

## Chrome extension — `extensions/g3q-practice-answers/`

Manifest V3 content script (`world: "MAIN"`, `document_start`). It wraps `window.fetch`, keeps the practice quiz
response, then **answers the quiz through the normal UI** and shows the answers in a panel (bottom-left, with a
status line, elapsed seconds, ▶ Auto-answer / ■ Stop, Hide, and an "Auto-start on page load" checkbox,
default on, stored in `localStorage` key `g3q-auto-start`).

How it answers (all via DOM events, no API calls of its own):
- single choice / true-false: click the option button whose text equals the answer.
- match: tap mode — click the option pill, then the slot next to the row's label.
- blanks: tap mode — click the word pill, then the `___ N` slot.
- ordering: **no tap mode** (tapping rows does nothing; verified), so it drags. The list is a custom drag, not a
  library: each row's inner `div` has `onPointerDown`; only after React re-renders does the component add
  `window` `pointermove`/`pointerup` listeners (checking `pointerId`), and it picks the drop slot by comparing the
  pointer's Y with the other rows' centres via `getBoundingClientRect`, while rows animate for 280 ms after each
  swap. The extension therefore: pointerdown on the row's div → wait 2 frames + 30 ms → 4 moves to a quarter-row
  past the target's centre → wait 320 ms for the animation → one more move → pointerup. One drag per misplaced
  item (selection-sort order), up to 3 tries each.
- then click the visible, enabled submit button, wait for the sheet, click `આગલો પ્રશ્ન` / `પરિણામ જુઓ`.
- Visibility check uses `getClientRects()` + computed style. Using `offsetParent` was a bug: it is `null` for
  `position: fixed` elements, so at some window sizes the sheet's "next" button looked hidden and the run stalled.

Timing: the site holds every submit for ~2.8–3.9 s ("checking…", no network). That is ~33 s of a run and the
extension does **not** bypass it.

Tested in **Chrome for Testing 155.0.8059.84** (official Chrome automation build; branded Chrome ignores
`--load-extension`), page load → result page:

| Window | Quiz | Result | Time |
|---|---|---|---|
| 430×900 | random set (2 ordering) | 10/10 | 38.1 s |
| 1280×720 | random set (2 ordering) | 10/10 | 37.1 s |
| 1920×1080 | random set (1 ordering) | 10/10 | 35.4 s |
| 1280×720 | ordering questions first | 10/10 | 39.4 s |
| 1366×768 | 5 ordering questions only | 5/5 | 26.4 s |

~1.3 s fill per ordering question → worst case of 10 ordering questions ≈ 46 s.

- **Scope: practice quiz only.** Runs on `https://quiz.g3q.ai/*` so it survives client-side navigation, but only
  captures `/api/practice-quiz` and only acts on `/practice-quiz`. Weekly/prize quiz endpoints are not read.
- Practice results are not sent to the server (only start/complete analytics events with no score).
- All panel text is inserted with `textContent`.
- If the site changes the endpoint, the response shape (`questions[].answer.value`) or the DOM hooks above
  (`[data-quiz-question-card]`, `li[data-item-id]`, `[data-testid=quiz-submit-button]`, `.grid-cols-2`), update
  `content.js`.

Install: `chrome://extensions` → Developer mode → **Load unpacked** → select `extensions/g3q-practice-answers`.

## Changelog

- 2026-10-17 — Initial exploration; documented API, question types, flow, edge cases; built the answer-overlay
  extension.
- 2026-10-17 — Extension upgraded from answer overlay to auto-answer (fills + submits), 38.3 s full run.
- 2026-10-17 — Fixed stalled "next" (offsetParent bug) and flaky ordering drags; tested in Chrome for Testing 155.
