// Runs in the page's own JS world so it can wrap window.fetch before the app loads.
// Only the practice quiz is handled; weekly/prize quizzes are never read or touched.
// It (1) captures the practice quiz response, (2) shows the answers in a panel and
// (3) fills in + submits every question through the normal UI, like a user would.
(() => {
  const PRACTICE_API = '/api/practice-quiz';
  const PRACTICE_PATH = '/practice-quiz';
  const RESULT_PATH = '/result/practice-quiz';
  const AUTO_KEY = 'g3q-auto-start';

  let questions = null;
  let panel = null;
  let runId = 0;          // bumps on every new quiz payload; a running loop stops when it changes
  let status = '';
  let startedAt = 0;
  let finishedIn = null;
  let stopRequested = false;
  let running = false;

  const store = {
    get: () => { try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch (e) { return true; } },
    set: (v) => { try { localStorage.setItem(AUTO_KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } },
  };

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const res = origFetch.apply(this, args);
    try {
      const url = String(args[0] && args[0].url ? args[0].url : args[0]);
      if (url.includes(PRACTICE_API)) {
        res.then((r) => r.clone().json()).then((j) => {
          if (j && Array.isArray(j.questions)) {
            questions = j.questions; runId++; finishedIn = null; stopRequested = false;
            render(true);
            if (store.get()) start();
          }
        }).catch(() => {});
      }
    } catch (e) { /* never break the app */ }
    return res;
  };

  // ---------- small helpers ----------
  const el = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  // Not offsetParent: it is null for position:fixed elements such as the answer sheet's buttons.
  const visible = (e) => {
    if (!e || !e.isConnected || e.getClientRects().length === 0) return false;
    const cs = getComputedStyle(e);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };

  async function waitFor(fn, timeout = 8000, step = 25) {
    const t0 = performance.now();
    for (;;) {
      const v = fn();
      if (v) return v;
      if (performance.now() - t0 > timeout) throw new Error('timeout');
      await sleep(step);
    }
  }

  function currentIndex() {
    const h = document.querySelector('header');
    const m = h && h.innerText.match(/(\d+)\s*\/\s*(\d+)/);
    return m ? Number(m[1]) - 1 : -1;
  }
  const card = () => document.querySelector('[data-quiz-question-card]');
  const buttonsIn = (root) => Array.from(root.querySelectorAll('button'));
  const submitBtn = () => Array.from(document.querySelectorAll('[data-testid=quiz-submit-button]'))
    .find((b) => visible(b) && !b.disabled);
  const nextBtn = () => Array.from(document.querySelectorAll('button'))
    .find((b) => visible(b) && /આગલો પ્રશ્ન|પરિણામ જુઓ/.test(b.textContent));

  // Last button whose text equals `text` (slots show placed text first, option pills come last).
  const optionButton = (root, text) => {
    const t = norm(text);
    const all = buttonsIn(root).filter((b) => norm(b.textContent) === t);
    return all[all.length - 1];
  };

  // ---------- answering ----------
  async function fillSimple(q) {
    const root = card();
    const b = optionButton(root, q.options[q.answer.value]);
    if (!b) throw new Error('option not found');
    b.click();
  }

  async function fillMatch(q) {
    const root = card();
    const a = q.answer.value;
    for (const l of Object.keys(a)) {
      const row = Array.from(root.querySelectorAll('.grid-cols-2 > div'))
        .find((d) => norm(d.textContent) === norm(q.targets[l]));
      const slot = row && row.nextElementSibling;
      const opt = Array.from(root.querySelectorAll('button[draggable=true]'))
        .find((b) => norm(b.textContent) === norm(q.options[a[l]]));
      if (!slot || !opt) throw new Error('match element not found');
      opt.click(); await frame();
      slot.click(); await frame();
    }
  }

  async function fillBlanks(q) {
    const root = card();
    const a = q.answer.value;
    for (const b of Object.keys(a)) {
      const n = b.replace(/\D/g, '');
      const word = optionButton(root, q.options[a[b]]);
      const slot = buttonsIn(root).find((x) => new RegExp('^_+\\s*' + n + '$').test(norm(x.textContent)));
      if (!word || !slot) throw new Error('blank element not found');
      word.click(); await frame();
      slot.click(); await frame();
    }
  }

  // The ordering list has no tap mode; it is a custom pointer drag. Its row reacts to pointerdown,
  // but only starts listening for window pointermove after React re-renders, and it picks the drop
  // slot by comparing the pointer's Y with the other rows' centres (which animate for 280 ms).
  // So: press, wait for the listener, move to the slot, let the rows settle, nudge, release.
  async function dragRow(row, x, y1, y2) {
    const fire = (target, type, y, buttons) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y }));
    const handle = row.firstElementChild || row;
    fire(handle, 'pointerdown', y1, 1);
    await frame(); await frame(); await sleep(30);
    for (let i = 1; i <= 4; i++) { fire(window, 'pointermove', y1 + ((y2 - y1) * i) / 4, 1); await frame(); }
    await sleep(320);
    fire(window, 'pointermove', y2, 1);
    await frame();
    fire(window, 'pointerup', y2, 0);
  }

  async function fillOrder(q) {
    const want = q.answer.value;
    const rows = () => Array.from(document.querySelectorAll('li[data-item-id]'));
    const ids = () => rows().map((li) => li.dataset.itemId);
    for (let i = 0; i < want.length; i++) {
      for (let attempt = 0; attempt < 3 && ids()[i] !== want[i]; attempt++) {
        if (attempt > 0) await sleep(300); // a failed try may leave rows mid-animation
        const items = rows();
        const j = ids().indexOf(want[i]);
        const from = items[j].getBoundingClientRect();
        const to = items[i].getBoundingClientRect();
        // A quarter-row past the target's centre lands in slot i and not beyond it.
        const y2 = to.top + to.height / 2 + (j > i ? -to.height / 4 : to.height / 4);
        await dragRow(items[j], from.left + from.width / 2, from.top + from.height / 2, y2);
        await waitFor(() => ids()[i] === want[i], 800, 25).catch(() => {});
      }
      if (ids()[i] !== want[i]) throw new Error('could not reorder');
    }
  }

  async function answer(q) {
    switch (q.type) {
      case 'single_choice':
      case 'true_false': return fillSimple(q);
      case 'match_following': return fillMatch(q);
      case 'drag_into_blanks': return fillBlanks(q);
      case 'drag_drop': return fillOrder(q);
      default: throw new Error('unknown question type ' + q.type);
    }
  }

  async function start() {
    if (running) return;
    running = true; stopRequested = false;
    const myRun = runId;
    startedAt = performance.now();
    const tick = setInterval(() => render(), 200);
    try {
      await waitFor(() => location.pathname.startsWith(PRACTICE_PATH) && currentIndex() === 0 && card(), 15000);
      for (let idx = 0; idx < questions.length; idx++) {
        if (stopRequested || myRun !== runId) { status = 'Stopped'; return; }
        status = `Answering ${idx + 1}/${questions.length}…`;
        await waitFor(() => currentIndex() === idx && card() && !nextBtn(), 8000);
        await answer(questions[idx]);
        status = `Submitted ${idx + 1}/${questions.length}, waiting for the site's check…`;
        await waitFor(submitBtn, 4000);
        submitBtn().click();
        const nb = await waitFor(nextBtn, 15000);
        nb.click();
      }
      await waitFor(() => location.pathname.startsWith(RESULT_PATH), 8000).catch(() => {});
      finishedIn = (performance.now() - startedAt) / 1000;
      status = `Done in ${finishedIn.toFixed(1)} s`;
    } catch (e) {
      status = 'Stopped: ' + e.message;
    } finally {
      clearInterval(tick); running = false; render(true);
    }
  }

  // ---------- panel ----------
  function answerLines(q) {
    const a = q.answer && q.answer.value;
    const o = q.options || {};
    switch (q.type) {
      case 'single_choice':
      case 'true_false': return [o[a] ?? String(a)];
      case 'drag_drop': return a.map((id, i) => `${i + 1}. ${o[id]}`);
      case 'match_following': return Object.keys(a).map((l) => `${(q.targets || {})[l]}  →  ${o[a[l]]}`);
      case 'drag_into_blanks': return Object.keys(a).map((b) => `ખાલી જગ્યા ${b.replace(/\D/g, '')}  →  ${o[a[b]]}`);
      default: return [JSON.stringify(a)];
    }
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = el('div', 'position:fixed;z-index:2147483647;left:12px;bottom:12px;width:320px;max-height:70vh;' +
      'overflow:auto;background:#0f172a;color:#f8fafc;font:13px/1.45 system-ui,sans-serif;border-radius:12px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,.45);padding:10px 12px;');
    panel.id = 'g3q-answers-panel';
    document.documentElement.appendChild(panel);
    return panel;
  }

  let collapsed = false;
  let lastKey = '';
  function render(force) {
    const path = location.pathname;
    const onQuiz = path.startsWith(PRACTICE_PATH);
    const onResult = path.startsWith(RESULT_PATH) && finishedIn !== null;
    if (!questions || !(onQuiz || onResult)) { if (panel) panel.style.display = 'none'; return; }
    const idx = onQuiz ? currentIndex() : -1;
    const secs = running ? Math.floor((performance.now() - startedAt) / 1000) : '';
    const key = `${runId}|${idx}|${collapsed}|${status}|${secs}|${running}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    const p = ensurePanel();
    p.style.display = 'block';
    p.replaceChildren();

    const bar = el('div', 'display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;');
    bar.appendChild(el('strong', 'color:#fbbf24', 'G3Q practice'));
    const btnCss = 'background:#334155;color:#fff;border:0;border-radius:6px;padding:3px 9px;cursor:pointer;';
    const actions = el('div', 'display:flex;gap:6px;');
    if (onQuiz) {
      const run = el('button', btnCss, running ? '■ Stop' : '▶ Auto-answer');
      run.onclick = () => { if (running) stopRequested = true; else { runId++; start(); } };
      actions.appendChild(run);
    }
    const hide = el('button', btnCss, collapsed ? 'Show' : 'Hide');
    hide.onclick = () => { collapsed = !collapsed; render(true); };
    actions.appendChild(hide);
    bar.appendChild(actions);
    p.appendChild(bar);

    const line = el('div', 'margin-bottom:6px;color:#93c5fd;', (running && secs !== '' ? `${secs}s · ` : '') + (status || 'Ready'));
    p.appendChild(line);

    const label = el('label', 'display:flex;gap:6px;align-items:center;margin-bottom:6px;cursor:pointer;');
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = store.get();
    cb.onchange = () => store.set(cb.checked);
    label.appendChild(cb); label.appendChild(el('span', '', 'Auto-start on page load'));
    p.appendChild(label);
    if (collapsed || !onQuiz) return;

    questions.forEach((q, i) => {
      const cur = i === idx;
      const box = el('div', 'padding:6px 8px;margin-bottom:6px;border-radius:8px;' +
        (cur ? 'background:#1e3a8a;outline:2px solid #fbbf24;' : 'background:#1e293b;opacity:.85;'));
      box.appendChild(el('div', 'font-weight:700;margin-bottom:2px;', `Q${q.order || i + 1}${cur ? '  ◀ current' : ''}`));
      answerLines(q).forEach((l) => box.appendChild(el('div', 'padding-left:6px;', l)));
      p.appendChild(box);
    });
  }

  // The app is a single-page app: follow question changes and route changes.
  setInterval(() => render(), 300);
})();
