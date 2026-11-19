// Injected at document start (Playwright addInitScript). Records, per animation
// frame, which loading layer is actually on screen, plus boot milestones,
// long tasks and timers. Lives on `window`, so it survives document.open()/write().
(() => {
  if (window.__nxPerf) return;
  const now = () => performance.now();
  const P = window.__nxPerf = {
    marks: {}, events: [], frames: [], longtasks: [], intervals: new Map(), intervalLog: [], writes: 0, oldHomeFrames: 0,
  };
  const mark = (k, t = now()) => { if (!(k in P.marks)) P.marks[k] = Math.round(t); };
  P.mark = mark;

  const ow = Document.prototype.write;
  Document.prototype.write = function (...a) { mark('docWriteStart'); P.writes++; const r = ow.apply(this, a); mark('docWriteEnd'); return r; };
  const oo = Document.prototype.open;
  Document.prototype.open = function (...a) { mark('docOpen'); return oo.apply(this, a); };
  const oc = Document.prototype.close;
  Document.prototype.close = function (...a) { const r = oc.apply(this, a); mark('docClose'); return r; };

  let dcl = 0, load = 0;
  window.addEventListener('DOMContentLoaded', () => mark('dcl' + (++dcl)), true);
  window.addEventListener('load', () => mark('load' + (++load)), true);

  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.longtasks.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.events.push(['paint:' + e.name, Math.round(e.startTime)]); }).observe({ type: 'paint', buffered: true }); } catch {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.lcp = [Math.round(e.startTime), (e.element?.id || e.element?.className || e.element?.tagName || '') + '', e.url || '']; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}

  // Track live intervals (background work that runs for the whole session).
  const si = window.setInterval, ci = window.clearInterval;
  window.setInterval = function (fn, ms, ...a) {
    const id = si.call(this, fn, ms, ...a);
    const src = (new Error().stack || '').split('\n').slice(2, 3).join('').replace(/\?v=[^:]+/, '').replace(/^\s+at\s+/, '').slice(0, 140);
    P.intervals.set(id, { ms, src, at: Math.round(now()) });
    return id;
  };
  window.clearInterval = function (id) { P.intervals.delete(id); return ci.call(this, id); };

  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || el.hidden) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const describe = (el) => {
    if (!el) return 'none';
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.id === 'nxSplashOverlay') return 'splash';
      if (n.id === 'nxEntry') return 'entry';
      if (n.id === 'bootHome') return n.classList.contains('nx-approved-home-v1') ? 'home' : 'OLD-HOME';
      if (n.classList?.contains('boot') && n.parentElement === document.body) return 'index-boot';
      if (n.classList?.contains('nx-social-drawer-layer') || n.classList?.contains('nx-social-shade')) return 'social';
      if (n.id && /Screen$/.test(n.id)) return 'screen:' + n.id;
    }
    if (el === document.body || el === document.documentElement) return document.getElementById('nx-home-boot-guard') ? 'guard' : 'body';
    return 'other:' + (el.id || el.className || el.tagName).toString().slice(0, 40);
  };

  // Sample for up to 120 s: slow profiles reach milestones well after 25 s.
  let last = '', stopAt = 120000;
  const sample = () => {
    const t = now();
    const d = document;
    // document.open() erases window/document listeners, so the core document's
    // DOMContentLoaded is observed through readyState instead.
    if ('docOpen' in P.marks) {
      if (d.readyState === 'interactive' || d.readyState === 'complete') mark('coreParsed');
      if (d.readyState === 'complete') mark('coreComplete');
    }
    if (d.body) {
      const home = d.getElementById('bootHome');
      const splash = d.getElementById('nxSplashOverlay');
      const entry = d.getElementById('nxEntry');
      if (d.getElementById('nx-home-boot-guard')) mark('guardPresent'); else if ('guardPresent' in P.marks) mark('guardRemoved');
      if (splash) mark('splashInserted');
      if ('splashInserted' in P.marks && (!splash || splash.classList.contains('nx-hide'))) mark('splashHidden');
      if (home?.classList.contains('nx-approved-home-v1')) mark('homeApproved');
      if (home?.classList.contains('nx-approved-home-v1') && home.classList.contains('active') && vis(home)) mark('homeActiveVisible');
      if (window.NEON_SOCIAL?.openDrawer) mark('socialDrawerReady');
      if (window.NEON_SOCIAL?.profile) mark('socialProfile');
      if (entry && !entry.hidden && entry.dataset.phase === 'welcome' && vis(entry)) mark('entryWelcome');
      const pts = [[0.5, 0.5], [0.5, 0.2], [0.5, 0.85]].map(([x, y]) => describe(d.elementFromPoint(innerWidth * x, innerHeight * y)));
      const state = pts.join('|') + (splash && vis(splash) ? ' +splash' : '') + (entry && vis(entry) ? ' +entry:' + entry.dataset.phase : '');
      if (pts.includes('OLD-HOME')) { P.oldHomeFrames++; mark('oldHomeFirstSeen'); }
      if (state !== last) { P.frames.push([Math.round(t), state]); last = state; }
      const ready = 'homeActiveVisible' in P.marks && !d.getElementById('nx-home-boot-guard') && (!splash || !vis(splash)) && !(entry && vis(entry)) && window.NEON_SOCIAL?.openDrawer;
      if (ready) mark('homeInteractive');
    }
    if (t < stopAt) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  P.stop = () => { stopAt = 0; };
  P.snapshot = () => ({
    marks: P.marks, frames: P.frames, longtasks: P.longtasks, events: P.events, lcp: P.lcp || null, writes: P.writes, oldHomeFrames: P.oldHomeFrames,
    intervals: [...P.intervals.values()],
  });
})();
