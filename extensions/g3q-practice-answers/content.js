// Runs in the page's own JS world so it can wrap window.fetch before the app loads.
// Only the practice quiz endpoint is captured; weekly/prize quizzes are never touched.
(() => {
  const PRACTICE_API = '/api/practice-quiz';
  const PRACTICE_PATH = '/practice-quiz';
  let questions = null;
  let panel = null;

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const res = origFetch.apply(this, args);
    try {
      const url = String(args[0] && args[0].url ? args[0].url : args[0]);
      if (url.includes(PRACTICE_API)) {
        res.then((r) => r.clone().json()).then((j) => {
          if (j && Array.isArray(j.questions)) { questions = j.questions; render(); }
        }).catch(() => {});
      }
    } catch (e) { /* never break the app */ }
    return res;
  };

  const el = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // Human-readable answer lines for one question (always textContent, never innerHTML).
  function answerLines(q) {
    const a = q.answer && q.answer.value;
    const o = q.options || {};
    switch (q.type) {
      case 'single_choice':
      case 'true_false':
        return [o[a] ?? String(a)];
      case 'drag_drop':
        return a.map((id, i) => `${i + 1}. ${o[id]}`);
      case 'match_following':
        return Object.keys(a).map((l) => `${(q.targets || {})[l]}  →  ${o[a[l]]}`);
      case 'drag_into_blanks':
        return Object.keys(a).map((b) => `ખાલી જગ્યા ${b.replace(/\D/g, '')}  →  ${o[a[b]]}`);
      default:
        return [JSON.stringify(a)];
    }
  }

  function currentIndex() {
    const h = document.querySelector('header');
    const m = h && h.innerText.match(/(\d+)\s*\/\s*(\d+)/);
    return m ? Number(m[1]) - 1 : -1;
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = el('div', 'position:fixed;z-index:2147483647;right:12px;bottom:12px;width:340px;max-height:70vh;' +
      'overflow:auto;background:#0f172a;color:#f8fafc;font:13px/1.45 system-ui,sans-serif;border-radius:12px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,.45);padding:10px 12px;');
    panel.id = 'g3q-answers-panel';
    document.documentElement.appendChild(panel);
    return panel;
  }

  let collapsed = false;
  let lastKey = '';
  function render() {
    const onPractice = location.pathname.startsWith(PRACTICE_PATH);
    if (!onPractice || !questions) { if (panel) panel.style.display = 'none'; return; }
    const idx = currentIndex();
    const key = `${questions[0] && questions[0].id}|${idx}|${collapsed}`;
    if (key === lastKey && panel && panel.style.display !== 'none') return;
    lastKey = key;
    const p = ensurePanel();
    p.style.display = 'block';
    p.replaceChildren();

    const bar = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;');
    bar.appendChild(el('strong', 'color:#fbbf24', 'Practice answers'));
    const btn = el('button', 'background:#334155;color:#fff;border:0;border-radius:6px;padding:2px 8px;cursor:pointer;', collapsed ? 'Show' : 'Hide');
    btn.onclick = () => { collapsed = !collapsed; render(); };
    bar.appendChild(btn);
    p.appendChild(bar);
    if (collapsed) return;

    questions.forEach((q, i) => {
      const cur = i === idx;
      const box = el('div', 'padding:6px 8px;margin-bottom:6px;border-radius:8px;' +
        (cur ? 'background:#1e3a8a;outline:2px solid #fbbf24;' : 'background:#1e293b;opacity:.85;'));
      box.appendChild(el('div', 'font-weight:700;margin-bottom:2px;', `Q${q.order || i + 1}${cur ? '  ◀ current' : ''}`));
      answerLines(q).forEach((line) => box.appendChild(el('div', 'padding-left:6px;', line)));
      p.appendChild(box);
      if (cur) setTimeout(() => box.scrollIntoView({ block: 'nearest' }), 0);
    });
  }

  // The app is a single-page app: follow question changes and route changes.
  setInterval(render, 300);
})();
