/*
 * phaser-optimize — perf-probe.js
 * Framework-agnostic runtime probe. No build step, no deps.
 *
 * Install (pick one):
 *   - <script src="perf-probe.js"></script>  before your game bundle, OR
 *   - import "./perf-probe.js"               (Vite/webpack — side-effect import)
 *
 * The probe attaches window.__PERF__ and, if window.Phaser is present, samples
 * FPS from requestAnimationFrame automatically. Mark lifecycle points from your
 * game code (or let the capture driver mark them). Everything degrades: with no
 * marks you still get FPS + frame-time; with no game hooks you still get boot.
 *
 * API (window.__PERF__):
 *   mark(name)                       // record a performance.mark + timestamp (ms since nav start)
 *   startSampling() / stopSampling() // bound the FPS window (e.g. around gameplay)
 *   note(screen, key, value)         // stash an arbitrary metric under a screen
 *   fps()                            // {avg, low1, min, jank} for the current/last window
 *   dump({screens} = {})             // return the metrics object AND console.log it as JSON
 *   reset()                          // clear marks/samples for a fresh capture
 *
 * Metrics object shape matches references/measurement.md schema (per-screen fields).
 */
(function (global) {
  "use strict";
  if (global.__PERF__) return; // idempotent

  var nowFn =
    (global.performance && global.performance.now)
      ? function () { return global.performance.now(); }
      : function () { return Date.now(); };

  var state = {
    marks: {},            // name -> ms since page start
    notes: {},            // screen -> { key: value }
    frameTimes: [],       // ms per frame during sampling window
    sampling: false,
    rafId: 0,
    lastT: 0,
    JANK_MS: 50           // a frame longer than this counts as jank
  };

  function safeMark(name) {
    try { if (global.performance && global.performance.mark) global.performance.mark("perf:" + name); } catch (e) {}
  }

  function mark(name) {
    state.marks[name] = nowFn();
    safeMark(name);
    return state.marks[name];
  }

  function frameTick(t) {
    if (!state.sampling) return;
    if (state.lastT) state.frameTimes.push(t - state.lastT);
    state.lastT = t;
    state.rafId = global.requestAnimationFrame(frameTick);
  }

  function startSampling() {
    state.frameTimes = [];
    state.lastT = 0;
    state.sampling = true;
    if (global.requestAnimationFrame) state.rafId = global.requestAnimationFrame(frameTick);
  }

  function stopSampling() {
    state.sampling = false;
    if (state.rafId && global.cancelAnimationFrame) global.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  function fps() {
    var ft = state.frameTimes.slice();
    if (ft.length < 2) return { avg: 0, low1: 0, min: 0, jank: 0, frames: ft.length };
    var sum = 0, jank = 0;
    for (var i = 0; i < ft.length; i++) { sum += ft[i]; if (ft[i] > state.JANK_MS) jank++; }
    var avgFrame = sum / ft.length;
    // 1% low FPS = fps at the 99th-percentile (worst) frame time
    var sorted = ft.slice().sort(function (a, b) { return a - b; });
    var p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
    var worst = sorted[sorted.length - 1];
    var toFps = function (msPerFrame) { return msPerFrame > 0 ? Math.round(1000 / msPerFrame) : 0; };
    return {
      avg: toFps(avgFrame),
      low1: toFps(p99),
      min: toFps(worst),
      jank: jank,
      frames: ft.length
    };
  }

  function note(screen, key, value) {
    if (!state.notes[screen]) state.notes[screen] = {};
    state.notes[screen][key] = value;
  }

  function memBytes() {
    try {
      if (global.performance && global.performance.memory) return global.performance.memory.usedJSHeapSize | 0;
    } catch (e) {}
    return 0;
  }

  function firstFrameMs() {
    // Prefer an explicit boot mark; else fall back to first-contentful-paint.
    if (state.marks.boot != null) return Math.round(state.marks.boot);
    try {
      var paints = global.performance.getEntriesByType && global.performance.getEntriesByType("paint");
      if (paints && paints.length) {
        for (var i = 0; i < paints.length; i++) if (paints[i].name === "first-contentful-paint") return Math.round(paints[i].startTime);
      }
    } catch (e) {}
    return 0;
  }

  // Build the per-screen metrics object. Timing values come from marks (ms since
  // start); byte/request counts are filled by the capture driver from Network and
  // merged over anything the game noted. Missing values stay 0 (never crash).
  function dump(opts) {
    opts = opts || {};
    var f = fps();
    var m = state.marks;
    var n = state.notes;
    var pick = function (screen, key) { return (n[screen] && n[screen][key]) || 0; };
    var out = {
      label: opts.label || "capture",
      capturedAt: opts.capturedAt || "", // caller stamps the real time; scripts never generate dates
      global: opts.global || { distBytes: 0, byType: {}, initialJsBytes: 0, fileCount: 0 },
      screens: {
        boot: {
          timeToFirstFrameMs: firstFrameMs(),
          transferredBytes: pick("boot", "transferredBytes"),
          requests: pick("boot", "requests")
        },
        main: {
          timeToInteractiveMs: Math.round(m.main || 0),
          bootToHomeBytes: pick("main", "bootToHomeBytes"),
          heapBytes: pick("main", "heapBytes") || memBytes()
        },
        game: {
          gameplayReadyMs: Math.round(m.game || 0),
          fpsAvg: f.avg,
          fps1pctLow: f.low1,
          fpsMin: f.min,
          jankCount: f.jank,
          toLevel1Bytes: pick("game", "toLevel1Bytes"),
          heapPeakBytes: pick("game", "heapPeakBytes") || memBytes()
        },
        settingMain: { packBytes: pick("settingMain", "packBytes"), openMs: Math.round(m.settingMain || 0) },
        settingGame: { packBytes: pick("settingGame", "packBytes"), openMs: Math.round(m.settingGame || 0) },
        win: { showMs: Math.round(m.win || 0), jankOnShow: pick("win", "jankOnShow") },
        lose: { showMs: Math.round(m.lose || 0), jankOnShow: pick("lose", "jankOnShow") },
        tutorial: { showMs: Math.round(m.tutorial || 0), packBytes: pick("tutorial", "packBytes") }
      },
      _fps: f,
      _marks: m
    };
    try { console.log("__PERF_DUMP__" + JSON.stringify(out)); } catch (e) {}
    return out;
  }

  function reset() {
    state.marks = {};
    state.notes = {};
    state.frameTimes = [];
    state.sampling = false;
    state.lastT = 0;
  }

  global.__PERF__ = {
    mark: mark,
    startSampling: startSampling,
    stopSampling: stopSampling,
    note: note,
    fps: fps,
    dump: dump,
    reset: reset,
    _state: state
  };

  // Auto-mark boot as soon as the probe loads (first frame after script parse).
  if (global.requestAnimationFrame) global.requestAnimationFrame(function () { if (state.marks.boot == null) mark("boot"); });
})(typeof window !== "undefined" ? window : this);
