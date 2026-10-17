# G3Q Practice Answers

Chrome extension (Manifest V3) for the **practice** quiz at `https://quiz.g3q.ai/practice-quiz`.
It answers all 10 questions for you through the normal UI and shows the answers in a panel.

## Install
1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and pick this folder (`extensions/g3q-practice-answers`).
3. Open the practice quiz. It starts automatically (untick "Auto-start on page load" in the panel to use the
   ▶ Auto-answer button instead; ■ Stop halts it).

A full run takes about 35–40 s, mostly the site's own ~3 s pause after each submit.
Practice mode only: it does nothing on other quizzes. See `docs/g3q-practice-quiz-context.md`.
