/* Spec → Ship — interaction + motion engine
   window.SpecShip.init(rootEl) → { destroy() }
   Modes and Inspect work everywhere; scroll motion runs only in a real scrolling viewport. */
(function () {
  'use strict';

  function init(root) {
    if (!root) return { destroy: function () {} };
    var gsap = window.gsap, ST = window.ScrollTrigger;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    var off = [], ctx = null, lenis = null, timers = [];
    var q = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
    var one = function (s) { return root.querySelector(s); };
    var on = function (el, ev, fn, opt) { if (!el) return; el.addEventListener(ev, fn, opt); off.push(function () { el.removeEventListener(ev, fn, opt); }); };

    /* ---------------- MODES ---------------- */
    var mode = 'live';
    var userInspect = false;
    var inspectOn = false;
    var modeBtns = q('[data-mode-btn]');
    var inspectBtn = one('[data-inspect-toggle]');
    var wipe = one('[data-wipe]');
    var wipeLabel = one('[data-wipe-label]');

    function setInspect(v) {
      inspectOn = v;
      if (inspectBtn) inspectBtn.setAttribute('aria-pressed', v ? 'true' : 'false');
      if (!v) hideInspect();
    }
    function applyMode(m) {
      mode = m;
      if (m === 'live') root.removeAttribute('data-mode'); else root.setAttribute('data-mode', m);
      modeBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode-btn') === m ? 'true' : 'false'); });
      setInspect(m === 'design' ? true : userInspect);
      if (ST) { requestAnimationFrame(function () { ST.refresh(); }); }
    }
    function setMode(m) {
      if (m === mode) return;
      if (gsap && wipe && !reduced) {
        if (wipeLabel) wipeLabel.textContent = m;
        gsap.timeline()
          .set(wipe, { autoAlpha: 1, clipPath: 'inset(0% 100% 0% 0%)' })
          .to(wipe, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.32, ease: 'power3.in' })
          .add(function () { applyMode(m); })
          .to(wipe, { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.42, ease: 'power3.out', delay: 0.08 })
          .set(wipe, { autoAlpha: 0 });
      } else applyMode(m);
    }
    modeBtns.forEach(function (b) { on(b, 'click', function () { setMode(b.getAttribute('data-mode-btn')); }); });
    if (inspectBtn) on(inspectBtn, 'click', function () { userInspect = !inspectOn; setInspect(userInspect); });
    on(document, 'keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target && e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      var k = (e.key || '').toLowerCase();
      if (k === 'd') setMode('design'); else if (k === 'c') setMode('code'); else if (k === 'l') setMode('live');
      else if (k === 'i') { userInspect = !inspectOn; setInspect(userInspect); }
    });

    /* ---------------- INSPECT ---------------- */
    var box = one('[data-inspect-box]'), tag = one('[data-inspect-tag]');
    var PICK = 'h1, h2, h3, p, a, button, img, dl, li, .panel, .stage, .comp, .chip, .tag, .case__media, .x-box, .deploy, .band';
    function describe(el) {
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      var name = el.tagName.toLowerCase();
      var cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').filter(function (c) { return c && c.indexOf('x-') !== 0 && c.indexOf('is-') !== 0; })[0] : '';
      var label = name + (cls ? '.' + cls : '') + '  ' + Math.round(r.width) + '×' + Math.round(r.height);
      if (/^(h1|h2|h3|p|a|button|li|dd|span)$/.test(name)) {
        var fam = cs.fontFamily.split(',')[0].replace(/["']/g, '');
        label += '  ·  ' + fam + ' ' + cs.fontWeight + ' / ' + Math.round(parseFloat(cs.fontSize)) + 'px';
      }
      return label;
    }
    function showInspect(el) {
      if (!box || !el) return;
      var r = el.getBoundingClientRect();
      box.style.visibility = 'visible';
      box.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px)';
      box.style.width = r.width + 'px';
      box.style.height = r.height + 'px';
      tag.textContent = describe(el);
      if (r.top < 30) tag.classList.add('is-below'); else tag.classList.remove('is-below');
    }
    function hideInspect() { if (box) box.style.visibility = 'hidden'; }
    var lastEl = null;
    on(root, 'pointermove', function (e) {
      if (!inspectOn) return;
      var el = e.target && e.target.closest ? e.target.closest(PICK) : null;
      if (!el || !root.contains(el) || el.closest('.toolbar')) { hideInspect(); lastEl = null; return; }
      lastEl = el;
      showInspect(el);
    });
    on(root, 'pointerleave', hideInspect);
    on(window, 'scroll', function () { if (inspectOn && lastEl) showInspect(lastEl); }, { passive: true });

    /* ---------------- LAYERS INDEX ---------------- */
    var rows = q('[data-layer]'), prevs = q('[data-limg]');
    var cap = one('[data-layer-cap]'), capMeta = one('[data-layer-meta]');
    function selectLayer(i) {
      rows.forEach(function (r, j) { r.classList.toggle('is-on', j === i); });
      prevs.forEach(function (p, j) {
        var onNow = j === i;
        if (gsap && !reduced) gsap.to(p, { opacity: onNow ? 1 : 0, scale: onNow ? 1 : 1.06, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
        else p.style.opacity = onNow ? '1' : '0';
      });
      if (cap && rows[i]) { cap.textContent = rows[i].getAttribute('data-name'); capMeta.textContent = rows[i].getAttribute('data-meta'); }
    }
    rows.forEach(function (r, i) { on(r, 'pointerenter', function () { selectLayer(i); }); on(r, 'focus', function () { selectLayer(i); }); });

    /* ---------------- misc ---------------- */
    var form = one('[data-comment-form]');
    if (form) on(form, 'submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[data-submit]'), note = form.querySelector('[data-form-note]');
      var label = btn ? btn.textContent : '';
      var say = function (t, err) { if (note) { note.textContent = t; note.classList.toggle('is-err', !!err); } };
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }
      say('');
      // Sent as multipart/form-data (no JSON) to avoid a CORS preflight Web3Forms doesn't answer
      fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form) })
        .then(function (r) {
          if (r.status !== 200) throw new Error('status ' + r.status);
          form.reset();
          say('✓ Comment posted — I’ll reply within a day.');
          if (btn) btn.textContent = 'Posted ✓';
        })
        .catch(function () {
          say('Couldn’t send — email hello@shivrajsinh.in instead.', true);
          if (btn) btn.textContent = label;
        })
        .then(function () { if (btn) setTimeout(function () { btn.disabled = false; btn.textContent = label; }, 4000); });
    });

    /* ================= MOTION ================= */
    var vh = window.innerHeight, docH = document.documentElement.scrollHeight;
    var live = !!(gsap && ST) && !reduced && vh < 1500 && docH > vh * 1.4;
    var narrow = window.innerWidth < 1024;

    if (gsap && ST && !reduced) {
      gsap.registerPlugin(ST);
      ctx = gsap.context(function () {
        // Magnetic buttons + tilt (desktop pointer), fine in any view
        if (fine) {
          q('[data-magnetic]').forEach(function (el) {
            var mx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
            var my = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
            on(el, 'mousemove', function (e) { var b = el.getBoundingClientRect(); mx((e.clientX - b.left - b.width / 2) * 0.3); my((e.clientY - b.top - b.height / 2) * 0.3); });
            on(el, 'mouseleave', function () { gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' }); });
          });
          var tilt = one('[data-tilt]');
          if (tilt) {
            gsap.set(tilt, { transformPerspective: 1000 });
            var rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.6, ease: 'power3.out' });
            var ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.6, ease: 'power3.out' });
            on(tilt, 'mousemove', function (e) { var b = tilt.getBoundingClientRect(); ry(((e.clientX - b.left) / b.width - 0.5) * 12); rx(-((e.clientY - b.top) / b.height - 0.5) * 12); });
            on(tilt, 'mouseleave', function () { rx(0); ry(0); });
          }
          // Multiplayer cursors drift around the hero
          q('[data-mp]').forEach(function (c, i) {
            (function drift() {
              var tw = gsap.to(c, { x: gsap.utils.random(-140, 140), y: gsap.utils.random(-70, 90), duration: gsap.utils.random(2.2, 3.6), ease: 'sine.inOut', delay: i * 0.4, onComplete: drift });
              timers.push(tw);
            })();
          });
        }

        if (!live) return;

        /* Smooth scroll */
        if (window.Lenis) {
          lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1.05 });
          lenis.on('scroll', ST.update);
          var raf = function (t) { lenis.raf(t * 1000); };
          gsap.ticker.add(raf);
          off.push(function () { gsap.ticker.remove(raf); });
          gsap.ticker.lagSmoothing(0);
        }
        q('a[href^="#"]').forEach(function (a) {
          on(a, 'click', function (e) {
            var id = a.getAttribute('href'); var t = id && id.length > 1 ? root.querySelector(id) : null;
            if (!t) return; e.preventDefault();
            if (lenis) lenis.scrollTo(t, { offset: -70, duration: 1.4 }); else t.scrollIntoView({ behavior: 'smooth' });
          });
        });

        /* 1. Preloader — "compiling" */
        var pre = one('[data-preloader]');
        var intro = gsap.timeline();
        if (pre) {
          gsap.set(pre, { autoAlpha: 1 });
          if (lenis) lenis.stop();
          var pct = one('[data-pre-pct]'), o = { v: 0 };
          gsap.set(q('[data-pre-line]'), { autoAlpha: 0, x: -10 });
          intro
            .to(o, { v: 100, duration: 1.5, ease: 'power2.inOut', onUpdate: function () { pct.textContent = String(Math.round(o.v)).padStart(3, '0'); } }, 0)
            .to(one('[data-pre-bar]'), { scaleX: 1, duration: 1.5, ease: 'power2.inOut' }, 0)
            .to(q('[data-pre-line]'), { autoAlpha: 1, x: 0, duration: 0.2, stagger: 0.38 }, 0.2)
            .to(pre, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, '+=0.1')
            .set(pre, { autoAlpha: 0 })
            .add(function () { if (lenis) lenis.start(); });
        }

        /* 2. Hero — the name "compiles" from a thin wireframe weight to Archivo Black */
        var name = one('[data-compile]'), dim = one('[data-sel-dim]'), sel = one('[data-sel]');
        var fs = { w: 62, g: 100 };
        var paintDim = function () {
          if (!dim || !sel) return;
          var r = sel.getBoundingClientRect();
          dim.textContent = 'W ' + Math.round(r.width) + ' · H ' + Math.round(r.height) + '  ·  wdth ' + Math.round(fs.w) + ' wght ' + Math.round(fs.g);
        };
        if (name) {
          name.style.fontVariationSettings = "'wdth' 62, 'wght' 100";
          gsap.set(q('[data-sel] .hd'), { scale: 0 });
          gsap.set(sel, { outlineColor: 'rgba(0,0,0,0)' });
          intro
            .from(q('[data-compile] .ln'), { yPercent: 105, duration: 0.9, ease: 'expo.out', stagger: 0.1 }, pre ? '-=0.5' : 0)
            .to(sel, { outlineColor: 'var(--accent)', duration: 0.01 }, '-=0.3')
            .to(q('[data-sel] .hd'), { scale: 1, duration: 0.35, ease: 'back.out(3)', stagger: 0.03 }, '<')
            .to(fs, { w: 112, g: 900, duration: 1.4, ease: 'expo.inOut', onUpdate: function () {
              name.style.fontVariationSettings = "'wdth' " + fs.w.toFixed(1) + ", 'wght' " + fs.g.toFixed(0);
              paintDim();
            }, onComplete: function () { name.style.fontVariationSettings = ''; if (dim) dim.textContent = 'H1 · Archivo 900 · 112%'; } }, '+=0.05')
            .from(q('[data-hero-fade]'), { y: 30, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.07 }, '-=0.9')
            .from(q('[data-mp]'), { autoAlpha: 0, scale: 0.6, duration: 0.5, stagger: 0.2 }, '-=0.4');
        }

        /* 3. Cursor follower with context labels */
        var dot = one('[data-cursor]'), lab = one('[data-cursor-label]');
        if (fine && dot) {
          gsap.set(dot, { autoAlpha: 1, xPercent: -50, yPercent: -50, x: -100, y: -100 });
          var cx = gsap.quickTo(dot, 'x', { duration: 0.25, ease: 'power3.out' });
          var cy = gsap.quickTo(dot, 'y', { duration: 0.25, ease: 'power3.out' });
          on(window, 'mousemove', function (e) { cx(e.clientX); cy(e.clientY); });
          q('a, button').forEach(function (el) {
            on(el, 'mouseenter', function () { if (!el.hasAttribute('data-cursor-text')) gsap.to(dot, { scale: 2.2, duration: 0.25 }); });
            on(el, 'mouseleave', function () { gsap.to(dot, { scale: 1, duration: 0.25 }); });
          });
          q('[data-cursor-text]').forEach(function (el) {
            on(el, 'mouseenter', function () { lab.textContent = el.getAttribute('data-cursor-text'); gsap.to(dot, { width: 88, height: 88, duration: 0.35, ease: 'back.out(2)' }); gsap.to(lab, { opacity: 1, duration: 0.2, delay: 0.08 }); });
            on(el, 'mouseleave', function () { gsap.to(dot, { width: 14, height: 14, duration: 0.3 }); gsap.to(lab, { opacity: 0, duration: 0.1 }); });
          });
          on(document, 'mouseleave', function () { gsap.to(dot, { autoAlpha: 0, duration: 0.2 }); });
          on(document, 'mouseenter', function () { gsap.to(dot, { autoAlpha: 1, duration: 0.2 }); });
        }

        /* 4. Nav hide/show */
        var nav = one('[data-nav]');
        if (nav) ST.create({ start: 240, end: 'max',
          onUpdate: function (s) { gsap.to(nav, { yPercent: s.direction === 1 ? -110 : 0, duration: 0.4, ease: 'power3.out', overwrite: true }); },
          onLeaveBack: function () { gsap.to(nav, { yPercent: 0, duration: 0.3, overwrite: true }); } });

        /* 5. Marquee + scroll velocity */
        var mq = one('[data-marquee]');
        if (mq) {
          var loop = gsap.fromTo(mq, { xPercent: 0 }, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
          ST.create({ start: 0, end: 'max', onUpdate: function (s) {
            var v = s.getVelocity();
            loop.timeScale((s.direction === 1 ? 1 : -1) * (1 + Math.min(Math.abs(v) / 260, 6)));
            gsap.to(loop, { timeScale: s.direction === 1 ? 1 : -1, duration: 1.1, ease: 'power2.out', overwrite: true });
          } });
        }

        /* 6. PROCESS — wireframe → redlines → code → animate → live */
        var stage = one('[data-stage]');
        if (stage) {
          var steps = q('[data-step]');
          var rls = q('[data-rl]'), wbs = q('[data-wb]'), code = one('[data-codepane]'), shot = one('[data-shot]'), badge = one('[data-live-badge]'), url = one('[data-stage-url]');
          gsap.set(rls, { scaleX: 0, scaleY: 0 });
          gsap.set(q('[data-rl] em'), { autoAlpha: 0 });
          gsap.set(code, { xPercent: 105 });
          gsap.set(shot, { clipPath: 'inset(100% 0% 0% 0%)' });
          gsap.set(badge, { scale: 0 });
          gsap.set(steps, { opacity: 0.28 });
          var setUrl = function (t) { return function () { if (url) url.textContent = t; }; };
          var ptl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
          ptl.addLabel('spec')
            .to(steps[0], { opacity: 1, duration: 0.2 }, 'spec')
            .call(setUrl('craftdesign.studio — spec'), null, 'spec')
            .to(rls, { scaleX: 1, scaleY: 1, duration: 0.6, stagger: 0.12 }, 'spec')
            .to(q('[data-rl] em'), { autoAlpha: 1, duration: 0.2, stagger: 0.12 }, 'spec+=0.3')
            .addLabel('build', '+=0.3')
            .to(steps[0], { opacity: 0.28, duration: 0.2 }, 'build')
            .to(steps[1], { opacity: 1, duration: 0.2 }, 'build')
            .call(setUrl('craftdesign.studio — build'), null, 'build')
            .to(code, { xPercent: 0, duration: 0.7 }, 'build')
            .to(wbs, { backgroundColor: '#9F9C93', duration: 0.5, stagger: 0.02 }, 'build+=0.2')
            .addLabel('animate', '+=0.3')
            .to(steps[1], { opacity: 0.28, duration: 0.2 }, 'animate')
            .to(steps[2], { opacity: 1, duration: 0.2 }, 'animate')
            .call(setUrl('craftdesign.studio — motion'), null, 'animate')
            .to(code, { xPercent: 105, duration: 0.6 }, 'animate')
            .to(rls, { autoAlpha: 0, duration: 0.3 }, 'animate')
            .fromTo(wbs, { y: 0 }, { y: -14, duration: 0.25, stagger: { each: 0.03, yoyo: true, repeat: 1 }, ease: 'power1.out' }, 'animate+=0.2')
            .addLabel('ship', '+=0.2')
            .to(steps[2], { opacity: 0.28, duration: 0.2 }, 'ship')
            .to(steps[3], { opacity: 1, duration: 0.2 }, 'ship')
            .call(setUrl('craftdesign.studio'), null, 'ship')
            .to(shot, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut' }, 'ship')
            .to(badge, { scale: 1, duration: 0.4, ease: 'back.out(2.5)' }, 'ship+=0.6')
            .to({}, { duration: 0.4 });
          if (!narrow) {
            ST.create({ trigger: one('[data-process]'), start: 'top top+=40', end: '+=200%', pin: true, scrub: 1, animation: ptl, anticipatePin: 1 });
          } else {
            ptl.pause();
            var loopTl = gsap.timeline({ repeat: -1, repeatDelay: 1.4, paused: true });
            loopTl.add(ptl.tweenFromTo(0, ptl.duration(), { ease: 'none' })).to({}, { duration: 0.01 });
            ST.create({ trigger: stage, start: 'top 80%', end: 'bottom 10%', onToggle: function (s) { if (s.isActive) loopTl.play(); else loopTl.pause(); } });
          }
        }

        /* 7. Case studies: scan-line reveal + inner parallax */
        q('[data-case]').forEach(function (c) {
          var img = c.querySelector('.case__img'), scan = c.querySelector('[data-scan]'), pic = c.querySelector('img');
          var t = gsap.timeline({ scrollTrigger: { trigger: c, start: 'top 78%' } });
          t.set(scan, { opacity: 1, top: '0%' })
           .fromTo(img, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.inOut' }, 0)
           .fromTo(scan, { top: '0%' }, { top: '100%', duration: 1.2, ease: 'power3.inOut' }, 0)
           .to(scan, { opacity: 0, duration: 0.2 });
          if (pic) gsap.fromTo(pic, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true } });
        });

        /* 8. Generic reveals */
        q('[data-reveal]').forEach(function (el) { gsap.from(el, { yPercent: 110, duration: 1.05, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } }); });
        q('[data-fade]').forEach(function (el) { gsap.from(el, { y: 44, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }); });
        q('.case__body').forEach(function (el) { gsap.from(el.children, { y: 30, autoAlpha: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 82%' } }); });
        var comps = one('[data-comps]');
        if (comps) gsap.from(comps.children, { y: 70, rotation: function (i) { return [-3, 2, -2][i] || 0; }, autoAlpha: 0, duration: 1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: comps, start: 'top 82%' } });
        if (rows.length) gsap.from(rows, { x: -24, autoAlpha: 0, duration: 0.5, stagger: 0.04, ease: 'power2.out', scrollTrigger: { trigger: rows[0], start: 'top 85%' } });
        var vhList = one('[data-vh]');
        if (vhList) gsap.from(vhList.children, { x: 30, autoAlpha: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: vhList, start: 'top 85%' } });
        var photo = one('[data-photo]');
        if (photo) gsap.fromTo(photo, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut', scrollTrigger: { trigger: photo, start: 'top 80%' } });

        /* 9. Deploy log types itself out */
        var dls = q('[data-dl]');
        if (dls.length) {
          gsap.set(dls, { autoAlpha: 0 });
          ST.create({ trigger: one('[data-deploy]'), start: 'top 75%', once: true, onEnter: function () {
            gsap.to(dls, { autoAlpha: 1, duration: 0.05, stagger: 0.42, ease: 'none' });
          } });
        }

        /* 10. Footer word scales in */
        var fb = one('[data-foot-big]');
        if (fb) gsap.from(fb, { yPercent: 60, ease: 'none', scrollTrigger: { trigger: fb, start: 'top bottom', end: 'bottom bottom', scrub: true } });
      }, root);

      if (live) {
        ST.sort(); ST.refresh();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
        on(window, 'load', function () { ST.refresh(); });
      }
    }

    return {
      destroy: function () {
        timers.forEach(function (t) { t.kill && t.kill(); });
        if (ctx) ctx.revert();
        if (lenis) lenis.destroy();
        off.forEach(function (f) { f(); });
        off = [];
        root.removeAttribute('data-mode');
      }
    };
  }

  window.SpecShip = { init: init };
})();
