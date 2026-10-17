# G3Q Practice Answers

Chrome extension (Manifest V3) that shows the answers for the **practice** quiz at
`https://quiz.g3q.ai/practice-quiz` in an on-screen panel, with the current question highlighted.

## Install
1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and pick this folder (`extensions/g3q-practice-answers`).
3. Open the practice quiz (reload the page if it was already open).

Practice mode only: the extension reads `/api/practice-quiz` and does nothing on other quizzes.
See `docs/g3q-practice-quiz-context.md` for how the quiz works.
