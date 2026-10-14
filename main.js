/* Next Stop — motion layer (GSAP + ScrollTrigger + Lenis) */
(function () {
  'use strict';
  var ACCENT = '#FFE900';
  var CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/&';
  var root = document.body;
  var q = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
  var one = function (s) { return root.querySelector(s); };
  var mqNarrow = window.matchMedia('(max-width: 819px)');

  /* ---------- non-motion UI ---------- */
  function tickClock() {
    var t = '--:--';
    try { t = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    q('[data-clock]').forEach(function (el) { el.textContent = t; });
  }
  tickClock();
  setInterval(tickClock, 20000);

  var menu = document.getElementById('mobileMenu');
  var toggle = one('[data-menu-toggle]');
  function setMenu(open) {
    if (!menu || !toggle) return;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (toggle) toggle.addEventListener('click', function () { setMenu(menu.hidden); });
  q('[data-menu-close]').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });

  q('[data-dest]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      q('[data-dest]').forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.style.background = on ? 'var(--accent)' : '#FFFFFF';
      });
    });
  });

  /* ---------- motion ---------- */
  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (!gsap || !ST) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ST);

  var state = { ctx: null, lenis: null, idle: null, off: [] };
  var firstRun = true;

  function on(el, ev, fn, opt) {
    if (!el) return;
    el.addEventListener(ev, fn, opt);
    state.off.push(function () { el.removeEventListener(ev, fn, opt); });
  }

  function kill() {
    if (state.ctx) { state.ctx.revert(); state.ctx = null; }
    if (state.lenis) { state.lenis.destroy(); state.lenis = null; }
    if (state.idle) { clearInterval(state.idle); state.idle = null; }
    state.off.forEach(function (f) { f(); });
    state.off = [];
  }

  // Split-flap: cycle random characters, land on the tile's own letter
  var busy = new WeakSet();
  function flip(tile, delay, steps) {
    var inner = tile.querySelector('[data-flip-ch]');
    var fin = tile.getAttribute('data-char') || ' ';
    if (!inner || busy.has(tile)) return gsap.timeline();
    busy.add(tile);
    var n = steps || 6 + Math.floor(Math.random() * 9);
    var tl = gsap.timeline({ delay: delay || 0, onComplete: function () { busy.delete(tile); } });
    for (var k = 0; k < n; k++) {
      (function (ch) {
        tl.call(function () { inner.textContent = ch; })
          .fromTo(inner, { rotationX: -88 }, { rotationX: 0, duration: 0.065, ease: 'none' });
      })(k === n - 1 ? fin : CH[Math.floor(Math.random() * CH.length)]);
    }
    return tl;
  }

  function init() {
    var narrow = mqNarrow.matches;
    var fine = window.matchMedia('(pointer: fine)').matches;
    var withPreloader = firstRun;
    firstRun = false;

    if (window.Lenis) {
      var lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 1.1 });
      state.lenis = lenis;
      lenis.on('scroll', ST.update);
      var raf = function (t) { lenis.raf(t * 1000); };
      gsap.ticker.add(raf);
      state.off.push(function () { gsap.ticker.remove(raf); });
      gsap.ticker.lagSmoothing(0);
    }
    q('a[href^="#"]').forEach(function (a) {
      on(a, 'click', function (e) {
        var id = a.getAttribute('href');
        var t = id && id.length > 1 ? document.querySelector(id) : null;
        if (!t) return;
        e.preventDefault();
        if (state.lenis) state.lenis.scrollTo(t, { offset: -60, duration: 1.6 });
        else t.scrollIntoView({ behavior: 'smooth' });
      });
    });

    state.ctx = gsap.context(function () {
      /* 1. Preloader */
      var pre = one('[data-preloader]');
      var intro = gsap.timeline();
      if (pre && withPreloader) {
        gsap.set(pre, { autoAlpha: 1 });
        if (state.lenis) state.lenis.stop();
        var digits = q('[data-pre-digit]');
        var o = { v: 0 }, last = '000';
        intro
          .to(o, { v: 100, duration: 1.8, ease: 'power2.inOut', onUpdate: function () {
            var s = String(Math.round(o.v)).padStart(3, '0');
            for (var i = 0; i < 3; i++) if (s[i] !== last[i] && digits[i]) {
              digits[i].textContent = s[i];
              gsap.fromTo(digits[i], { rotationX: -85 }, { rotationX: 0, duration: 0.09, ease: 'none' });
            }
            last = s;
          } })
          .to(pre, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '+=0.15')
          .set(pre, { autoAlpha: 0 })
          .add(function () { if (state.lenis) state.lenis.start(); });
      }

      /* 2. Hero: board wipe, flips, boarding pass + stamp */
      var board = one('[data-board]');
      var heroTiles = q('[data-board] [data-flip]');
      if (withPreloader) {
        intro
          .fromTo(board, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut', clearProps: 'clipPath' }, pre ? '-=0.5' : 0)
          .add(function () { heroTiles.forEach(function (t, i) { flip(t, i * 0.05); }); }, '-=0.2')
          .from(one('[data-board-tag]'), { scaleX: 0, transformOrigin: 'left center', duration: 0.8, ease: 'expo.out' }, '+=0.5')
          .from(q('[data-hero-fade]'), { y: 36, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, '-=0.7')
          .from(one('[data-ticket]'), { x: narrow ? 80 : 260, rotation: 16, autoAlpha: 0, duration: 1.1, ease: 'expo.out' }, '<0.1')
          .from(one('[data-stamp]'), { scale: 2.6, autoAlpha: 0, duration: 0.32, ease: 'power4.in' }, '-=0.25')
          .to(one('[data-ticket]'), { x: '+=5', duration: 0.05, repeat: 3, yoyo: true, ease: 'none' });
      }
      if (fine) q('[data-flip]').forEach(function (t) { on(t, 'mouseenter', function () { flip(t, 0, 5); }); });
      state.idle = setInterval(function () { if (heroTiles.length) flip(heroTiles[Math.floor(Math.random() * heroTiles.length)], 0, 7); }, 2600);

      /* 3. Boarding pass tilt */
      var ticket = one('[data-ticket]');
      if (fine && ticket) {
        gsap.set(ticket, { transformPerspective: 1000 });
        var rx = gsap.quickTo(ticket, 'rotationX', { duration: 0.6, ease: 'power3.out' });
        var ry = gsap.quickTo(ticket, 'rotationY', { duration: 0.6, ease: 'power3.out' });
        on(ticket, 'mousemove', function (e) { var b = ticket.getBoundingClientRect(); ry(((e.clientX - b.left) / b.width - 0.5) * 18); rx(-((e.clientY - b.top) / b.height - 0.5) * 18); });
        on(ticket, 'mouseleave', function () { rx(0); ry(0); });
      }

      /* 4. Magnetic */
      if (fine) q('[data-magnetic]').forEach(function (el) {
        var mx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
        var my = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
        on(el, 'mousemove', function (e) { var b = el.getBoundingClientRect(); mx((e.clientX - b.left - b.width / 2) * 0.32); my((e.clientY - b.top - b.height / 2) * 0.32); });
        on(el, 'mouseleave', function () { gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' }); });
      });

      /* 5. Cursor follower */
      var dot = one('[data-cursor]'), lab = one('[data-cursor-label]');
      if (fine && dot) {
        gsap.set(dot, { autoAlpha: 1, xPercent: -50, yPercent: -50, x: -100, y: -100 });
        var cx = gsap.quickTo(dot, 'x', { duration: 0.28, ease: 'power3.out' });
        var cy = gsap.quickTo(dot, 'y', { duration: 0.28, ease: 'power3.out' });
        on(window, 'mousemove', function (e) { cx(e.clientX); cy(e.clientY); });
        q('a, button').forEach(function (el) {
          on(el, 'mouseenter', function () { gsap.to(dot, { scale: 2.4, duration: 0.3 }); });
          on(el, 'mouseleave', function () { gsap.to(dot, { scale: 1, duration: 0.3 }); });
        });
        q('[data-cursor-view]').forEach(function (el) {
          on(el, 'mouseenter', function () { lab.textContent = el.getAttribute('data-cursor-text') || 'View ↗'; gsap.to(dot, { width: 96, height: 96, duration: 0.4, ease: 'back.out(2)' }); gsap.to(lab, { autoAlpha: 1, duration: 0.2, delay: 0.1 }); });
          on(el, 'mouseleave', function () { gsap.to(dot, { width: 16, height: 16, duration: 0.3 }); gsap.to(lab, { autoAlpha: 0, duration: 0.1 }); });
        });
      }

      /* 6. Nav hide/show */
      var nav = one('[data-nav]');
      if (nav) ST.create({ start: 200, end: 'max',
        onUpdate: function (s) { if (menu && !menu.hidden) return; gsap.to(nav, { yPercent: s.direction === 1 ? -110 : 0, duration: 0.4, ease: 'power3.out', overwrite: true }); },
        onLeaveBack: function () { gsap.to(nav, { yPercent: 0, duration: 0.3, overwrite: true }); } });

      /* 7. Marquees + velocity */
      var loops = q('[data-marquee]').map(function (t, i) {
        return gsap.fromTo(t, { xPercent: i % 2 ? -50 : 0 }, { xPercent: i % 2 ? 0 : -50, duration: [24, 30, 18][i] || 24, ease: 'none', repeat: -1 });
      });
      var band = one('[data-skew]');
      ST.create({ start: 0, end: 'max', onUpdate: function (s) {
        var v = s.getVelocity();
        var boost = 1 + Math.min(Math.abs(v) / 220, 7);
        loops.forEach(function (t) { t.timeScale(boost); gsap.to(t, { timeScale: 1, duration: 1.2, ease: 'power2.out', overwrite: true }); });
        if (band) gsap.to(band, { skewY: gsap.utils.clamp(-5, 5, v / -350), duration: 0.35, ease: 'power3.out', overwrite: 'auto',
          onComplete: function () { gsap.to(band, { skewY: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }); } });
      } });

      /* 8. Sticky grid zoom */
      var gz = one('[data-gz]'), grid = one('[data-gz-grid]'), items = q('[data-gz-item]'), gzTitle = one('[data-gz-title]');
      if (gz && grid && items.length) {
        var cols = [[], [], []];
        items.forEach(function (it, i) { cols[i % 3].push(it); });
        gsap.set(gzTitle, { autoAlpha: 0, scale: 0.85 });
        // columns fly in while the section scrolls into view, then the pinned zoom takes over
        var rev = gsap.timeline({ scrollTrigger: { trigger: gz, start: 'top 85%', end: 'top top', scrub: 1 } });
        cols.forEach(function (col, c) {
          var fromTop = c % 2 === 0;
          rev.from(col, { y: function () { return (fromTop ? -1 : 1) * window.innerHeight * 0.9; }, autoAlpha: 0, ease: 'power2.out', stagger: { each: 0.06, from: fromTop ? 'end' : 'start' }, duration: 1 }, 0);
        });
        var tl = gsap.timeline({ scrollTrigger: { trigger: gz, start: 'top top', end: '+=160%', pin: true, scrub: 1, anticipatePin: 1 } });
        tl.to(grid, { scale: 2.1, duration: 1.2, ease: 'power1.inOut' })
          .to(cols[0], { xPercent: -42, duration: 1.2, ease: 'power1.inOut' }, '<')
          .to(cols[2], { xPercent: 42, duration: 1.2, ease: 'power1.inOut' }, '<')
          .to(cols[1], { yPercent: function (i) { return (i < 2 ? -1 : 1) * 45; }, duration: 1, ease: 'power1.inOut' }, '<0.2')
          .to(items, { filter: 'brightness(0.45) saturate(0.8)', duration: 0.6 }, '-=0.5')
          .to(gzTitle, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(1.6)' }, '-=0.4');
      }

      /* 9. Horizontal boarding passes */
      var hz = one('[data-hz]'), track = one('[data-hz-track]');
      if (hz && track && !narrow) {
        var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
        var hzTween = gsap.to(track, { x: function () { return -dist(); }, ease: 'none',
          scrollTrigger: { trigger: hz, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 } });
        q('[data-hz-frame]').forEach(function (f) {
          var im = f.querySelector('[data-hz-img]');
          if (im) gsap.fromTo(im, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: f, containerAnimation: hzTween, start: 'left right', end: 'right left', scrub: true } });
        });
      } else if (narrow) {
        q('[data-hz-frame]').forEach(function (f) {
          gsap.fromTo(f, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut', scrollTrigger: { trigger: f, start: 'top 85%' } });
        });
      }

      /* 10. Dual-wave index */
      var wave = one('[data-wave]'), L = q('[data-wl]'), R = q('[data-wr]'), wimgs = q('[data-wimg]');
      if (wave && L.length && !narrow) {
        var leftCol = one('[data-wave-left]'), rightCol = one('[data-wave-right]');
        var ls = L.map(function (el) { return gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power4.out' }); });
        var rs = R.map(function (el) { return gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power4.out' }); });
        var lr = [], rr = [];
        var measure = function () {
          lr = L.map(function (el) { return Math.max(0, leftCol.clientWidth - el.offsetWidth); });
          rr = R.map(function (el) { return Math.max(0, rightCol.clientWidth - el.offsetWidth); });
        };
        measure();
        ST.addEventListener('refresh', measure);
        state.off.push(function () { ST.removeEventListener('refresh', measure); });
        var focused = -1;
        ST.create({ trigger: wave, start: 'top bottom', end: 'bottom top', onUpdate: function (self) {
          var p = self.progress;
          L.forEach(function (el, i) { var t = (Math.sin(0.55 * i + 1.1 * p * Math.PI * 2 - Math.PI / 2) + 1) / 2; ls[i](t * lr[i]); });
          R.forEach(function (el, i) { var t = (Math.sin(0.55 * i + 1.1 * p * Math.PI * 2 - Math.PI / 2) + 1) / 2; rs[i](-t * rr[i]); });
          var mid = window.innerHeight / 2, best = 0, bd = Infinity;
          L.forEach(function (el, i) { var b = el.getBoundingClientRect(); var d = Math.abs(b.top + b.height / 2 - mid); if (d < bd) { bd = d; best = i; } });
          if (best !== focused) {
            focused = best;
            L.forEach(function (el, i) { gsap.to(el, { color: i === best ? ACCENT : '#5E5B53', duration: 0.3, overwrite: 'auto' }); });
            R.forEach(function (el, i) { gsap.to(el, { color: i === best ? '#F3F0E6' : '#5E5B53', duration: 0.3, overwrite: 'auto' }); });
            wimgs.forEach(function (im, i) { gsap.to(im, { opacity: i === best ? 1 : 0, scale: i === best ? 1 : 1.08, duration: 0.45, ease: 'power3.out', overwrite: 'auto' }); });
          }
        } });
      }

      /* 11. Venetian blinds photos */
      var blinds = one('[data-blinds]'), layers = q('[data-blind-layer]'), count = one('[data-blind-count]');
      if (blinds && layers.length > 1) {
        gsap.set(blinds, { height: window.innerHeight });
        layers.forEach(function (layer, k) { if (k > 0) gsap.set(layer.querySelectorAll('[data-strip]'), { scaleY: 0 }); });
        if (count) count.textContent = '01';
        var btl = gsap.timeline({ scrollTrigger: { trigger: blinds, start: 'top top', end: '+=' + (layers.length - 1) * 90 + '%', pin: true, scrub: 2,
          onUpdate: function (s) { if (count) count.textContent = String(Math.min(layers.length, 1 + Math.floor(s.progress * (layers.length - 1) + 0.5))).padStart(2, '0'); } } });
        layers.forEach(function (layer, k) {
          if (k === 0) return;
          btl.to(layer.querySelectorAll('[data-strip]'), { scaleY: 1, duration: 1, ease: 'power2.inOut', stagger: { each: 0.08, from: k % 2 ? 'end' : 'start' } });
        });
      }

      /* 12. Route rail */
      var rail = one('[data-rail]');
      if (rail && window.innerWidth >= 1360) {
        gsap.set(rail, { autoAlpha: 1 });
        var bus = one('[data-rail-bus]'), rtrack = one('[data-rail-track]');
        gsap.to(bus, { y: function () { return rtrack.offsetHeight - bus.offsetHeight; }, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.4, invalidateOnRefresh: true } });
        q('[data-stop]').forEach(function (stop) {
          var target = document.querySelector(stop.getAttribute('data-target'));
          var lbl = stop.querySelector('[data-stop-label]');
          if (!target) return;
          ST.create({ trigger: target, start: 'top center', end: 'bottom center', onToggle: function (s) {
            gsap.to(stop, { backgroundColor: s.isActive ? ACCENT : '#F3F0E6', duration: 0.25 });
            gsap.to(lbl, { autoAlpha: s.isActive ? 1 : 0, x: s.isActive ? 0 : 8, duration: 0.25 });
          } });
          if (fine) on(stop, 'mouseenter', function () { gsap.to(lbl, { autoAlpha: 1, x: 0, duration: 0.2 }); });
        });
      }

      /* 13. Reveals */
      q('[data-reveal]').forEach(function (el) { gsap.from(el, { yPercent: 110, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } }); });
      q('[data-fade]').forEach(function (el) { gsap.from(el, { y: 50, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }); });

      /* 14. Luggage tags drop */
      q('[data-chips]').forEach(function (g) {
        gsap.from(g.children, { y: -100, rotation: function () { return gsap.utils.random(-30, 30); }, autoAlpha: 0, duration: 1.1, ease: 'bounce.out', stagger: 0.06, scrollTrigger: { trigger: g, start: 'top 85%' } });
      });

      /* 15. Footer arrivals board */
      var ft = q('[data-foot]');
      if (ft.length) ST.create({ trigger: one('[data-footer]'), start: 'top 80%', once: true, onEnter: function () { ft.forEach(function (t, i) { flip(t, i * 0.06); }); } });
    }, root);

    ST.sort();
    ST.refresh();
  }

  function boot() {
    init();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
    window.addEventListener('load', function () { ST.refresh(); });
  }

  // Rebuild the motion layer when crossing the mobile/desktop breakpoint
  var lastNarrow = mqNarrow.matches;
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (mqNarrow.matches !== lastNarrow) { lastNarrow = mqNarrow.matches; kill(); init(); }
    }, 250);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
