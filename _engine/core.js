/* 风格库共用引擎：一支 15 秒样片 = draw(ctx, t) + score(S)。
   - 画面是时间 t 的纯函数，1280×720 逻辑坐标，可逐帧导出。
   - 配乐和音效用 Web Audio 合成，事件时间和画面用同一套时间。
   - 导出接口：window.__film = { DUR, frame(t, w, h), audio() }，由 _engine/render.cjs 调用。
   用法：
     Film({ title, DUR: 15, BPM: 96, fonts: [['32px "ZCOOL KuaiLe"', '文字']], draw(c, t, F) {…}, score(S) {…} });
*/
(function () {
  const W = 1280, H = 720;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t * t;
  const back = t => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  function rrect(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function keyframes(list, t) {
    let i = list.findIndex(k => k[0] > t);
    if (i <= 0) return list[i === 0 ? 0 : list.length - 1].slice(1);
    const a = list[i - 1], b = list[i], u = ease(prog(t, a[0], b[0]));
    return a.slice(1).map((v, k) => lerp(v, b[k + 1], u));
  }
  // pre-baked grain tile shared by all films
  let grainTile = null;
  function grain(c, t, alpha = .06) {
    if (!grainTile) {
      grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 180;
      const g = grainTile.getContext('2d'), im = g.createImageData(180, 180);
      for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0);
    }
    const f = Math.floor(t * 12);
    c.save(); c.globalAlpha = alpha; c.translate((f * 37) % 180, (f * 53) % 180);
    c.fillStyle = c.createPattern(grainTile, 'repeat'); c.fillRect(-180, -180, W + 360, H + 360); c.restore();
  }
  function vignette(c, k = .38, col = '40,30,20') {
    const g = c.createRadialGradient(W / 2, H / 2, H * .38, W / 2, H / 2, W * .66);
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${k})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  const F = { W, H, clamp, lerp, prog, ease, easeOut, easeIn, back, hash, rrect, keyframes, grain, vignette };

  /* ---------------- audio ---------------- */
  let AC = null, noiseBuf = null;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, w, a, peak, d) { g.gain.setValueAtTime(.0001, w); g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), w + a); g.gain.exponentialRampToValueAtTime(.0001, w + a + d); }
  function osc(type, f, w, d, peak, out, a = .005, f2) {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = type;
    o.frequency.setValueAtTime(f, w); if (f2) o.frequency.exponentialRampToValueAtTime(f2, w + a + d * .6);
    env(g, w, a, peak, d); o.connect(g); g.connect(out); o.start(w); o.stop(w + a + d + .05); return o;
  }
  function noise(w, d, peak, out, type, f, q = 1, a = .002, f2) {
    const s = AC.createBufferSource(); s.buffer = noiseBuf;
    const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, w); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, w + a + d * .8);
    const g = AC.createGain(); env(g, w, a, peak, d);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(w, Math.random() * .5); s.stop(w + a + d + .05); return fl;
  }
  // instruments: (w = start time, B = buses, ...args)
  const I = {
    kick: (w, B, v = 1) => osc('sine', 130, w, .3, .9 * v, B.drum, .003, 42),
    snare: (w, B, v = 1) => { noise(w, .16, .32 * v, B.drum, 'bandpass', 1900, .8); osc('triangle', 190, w, .08, .14 * v, B.drum); },
    clap: (w, B, v = 1) => { for (let i = 0; i < 3; i++) noise(w + i * .012, .09, .22 * v, B.drum, 'bandpass', 1400, 1.2); },
    rim: (w, B, v = 1) => { noise(w, .025, .2 * v, B.drum, 'bandpass', 3200, 4); osc('square', 1700, w, .015, .04 * v, B.drum, .001); },
    hat: (w, B, v = 1) => noise(w, .035, .07 * v, B.drum, 'highpass', 7500, .7),
    shaker: (w, B, v = 1) => noise(w, .06, .05 * v, B.drum, 'bandpass', 6000, 2, .02),
    tom: (w, B, m = 45, v = 1) => osc('sine', mtof(m), w, .25, .5 * v, B.drum, .003, mtof(m - 7)),
    keys: (w, B, m, v = 1, d = 1.1) => { osc('sine', mtof(m), w, d, .055 * v, B.keys, .01); osc('triangle', mtof(m + 12), w, .35, .012 * v, B.keys, .005); },
    piano: (w, B, m, v = 1, d = 1.6) => { osc('triangle', mtof(m), w, d, .07 * v, B.keys, .004); osc('sine', mtof(m) * 2, w, d * .4, .02 * v, B.keys, .003); },
    pad: (w, B, ch, d, v = 1) => ch.forEach(m => { osc('sawtooth', mtof(m), w, d, .016 * v, B.pad, .6); osc('sawtooth', mtof(m) * 1.004, w, d, .016 * v, B.pad, .6); }),
    strings: (w, B, ch, d, v = 1) => ch.forEach(m => { [0.997, 1.003].forEach(k => osc('sawtooth', mtof(m) * k, w, d, .012 * v, B.pad, .35)); }),
    bass: (w, B, m, d = .4, v = 1) => { osc('triangle', mtof(m), w, d, .26 * v, B.bass, .01); osc('sine', mtof(m - 12), w, d, .2 * v, B.bass, .01); },
    subbass: (w, B, m, d = .5, v = 1) => osc('sine', mtof(m), w, d, .35 * v, B.bass, .01),
    pizz: (w, B, m, v = 1) => osc('triangle', mtof(m), w, .12, .2 * v, B.bass, .003),
    pluck: (w, B, m, v = 1) => { osc('triangle', mtof(m), w, .35, .12 * v, B.lead, .002); osc('sine', mtof(m) * 3, w, .08, .03 * v, B.lead, .001); },
    koto: (w, B, m, v = 1) => { const o = osc('triangle', mtof(m) * 1.02, w, .9, .13 * v, B.lead, .002); o.frequency.exponentialRampToValueAtTime(mtof(m), w + .08); osc('sine', mtof(m) * 2, w, .25, .04 * v, B.lead, .001); },
    lead: (w, B, m, v = 1, d = .26) => { osc('square', mtof(m), w, d, .05 * v, B.lead, .008); osc('sine', mtof(m + 12), w, d * .7, .03 * v, B.lead, .005); },
    chip: (w, B, m, v = 1, d = .14) => osc('square', mtof(m), w, d, .06 * v, B.lead, .002),
    chipTri: (w, B, m, d = .2, v = 1) => osc('triangle', mtof(m), w, d, .22 * v, B.bass, .002),
    brass: (w, B, m, v = 1, d = .5) => { const o = osc('sawtooth', mtof(m), w, d, .06 * v, B.lead, .04); osc('sawtooth', mtof(m) * 1.005, w, d, .04 * v, B.lead, .04); },
    marimba: (w, B, m, v = 1) => { osc('sine', mtof(m), w, .4, .22 * v, B.sfx, .002); osc('sine', mtof(m) * 4, w, .05, .05 * v, B.sfx, .001); },
    mbox: (w, B, m, v = 1) => { osc('sine', mtof(m), w, .9, .09 * v, B.sfx, .002); osc('sine', mtof(m) * 2.01, w, .3, .03 * v, B.sfx, .002); },
    bell: (w, B, m, v = 1) => { [1, 2.76, 5.4].forEach((k, i) => osc('sine', mtof(m) * k, w, 1.8 / (i + 1), .09 * v / (i + 1), B.sfx, .002)); },
    crackle: (w, B) => noise(w, .006, .035, B.out, 'highpass', 3000, .5, .001),
    // sfx
    boop: (w, B, p = 1) => { osc('sine', 700 * p, w, .09, .1, B.sfx, .003, 420 * p); osc('sine', 150, w, .07, .12, B.sfx, .002, 90); },
    boing: (w, B) => { const o = osc('sine', 200, w, .35, .28, B.sfx, .005); o.frequency.linearRampToValueAtTime(560, w + .18); o.frequency.linearRampToValueAtTime(420, w + .35); },
    thud: (w, B, v = 1) => osc('sine', 150, w, .18, .45 * v, B.sfx, .002, 55),
    pop: (w, B, p = 1) => { osc('sine', 900 * p, w, .09, .28, B.sfx, .002, 240 * p); noise(w, .012, .1, B.sfx, 'highpass', 2500); },
    pop2: (w, B) => osc('sine', 1250, w, .08, .2, B.sfx, .002, 520),
    whoosh: (w, B, v = 1) => noise(w, .45, .28 * v, B.sfx, 'bandpass', 300, 1.5, .08, 1900),
    swish: (w, B) => noise(w, .2, .18, B.sfx, 'bandpass', 1200, 2, .03, 4000),
    whip: (w, B) => noise(w, .12, .12, B.sfx, 'bandpass', 2500, 2, .01, 6000),
    tick: (w, B, v = 1) => osc('square', 1600, w, .02, .05 * v, B.sfx, .001),
    click: (w, B) => osc('square', 1100, w, .02, .06, B.sfx, .001),
    key: (w, B) => { osc('square', 2200 + Math.random() * 400, w, .012, .035, B.sfx, .001); noise(w, .015, .05, B.sfx, 'highpass', 4000); },
    blip: (w, B, i = 0) => osc('triangle', mtof(72 + [0, 2, 4, 7, 9, 12, 14, 16, 19][i % 9]), w, .14, .16, B.sfx, .003),
    chime: (w, B) => [84, 88, 91, 96].forEach((m, i) => { osc('sine', mtof(m), w + i * .06, 1.6, .14, B.sfx, .004); osc('triangle', mtof(m + 12), w + i * .06, .5, .03, B.sfx, .003); }),
    ding: (w, B) => osc('sine', 1568, w, .5, .15, B.sfx, .002),
    squash: (w, B) => { osc('sine', 500, w, .12, .35, B.sfx, .002, 120); noise(w, .08, .2, B.sfx, 'lowpass', 1200); },
    coin: (w, B) => { osc('square', 988, w, .06, .06, B.sfx, .001); osc('square', 1319, w + .06, .25, .06, B.sfx, .001); },
    jump: (w, B) => osc('square', 300, w, .16, .06, B.sfx, .002, 900),
    riser: (w, B, d = 1.1) => noise(w, .1, .25, B.sfx, 'bandpass', 300, 2, d, 5000),
    impact: (w, B) => { osc('sine', 90, w, .9, .9, B.sfx, .002, 35); noise(w, 1.2, .35, B.sfx, 'lowpass', 2500, .7); },
    paper: (w, B) => noise(w, .12, .16, B.sfx, 'bandpass', 2400, .8, .01, 900),
    scribble: (w, B, d = .4) => { for (let i = 0; i < d * 18; i++) noise(w + i * .055, .045, .05, B.sfx, 'bandpass', 2600 + (i % 3) * 700, 3, .005); },
    shimmer: (w, B) => [96, 100, 103, 108].forEach((m, i) => osc('sine', mtof(m), w + i * .04, .6, .04, B.sfx, .004))
  };
  // score helper handed to each film: S.at(t, fn), S.bar(i) → start time of bar i, and some pattern shortcuts
  function makeScore(bpm, DUR) {
    const beat = 60 / bpm, bar = beat * 4, E = [];
    const S = {
      bpm, beat, bar, I,
      at: (t, fn, ...args) => { if (t >= 0 && t < DUR + 2) E.push({ t, fn: (w, B) => fn(w, B, ...args) }); },
      bars: n => n * bar,
      // chord progression on the keys, one chord per bar
      comp(prog, fromBar, toBar, inst = 'keys', v = 1, rhythm = [0, 1.5, 3]) {
        for (let b = fromBar; b < toBar; b++) { const ch = prog[b % prog.length]; rhythm.forEach((r, k) => S.at(b * bar + r * beat, (w, B) => ch.forEach((m, i) => I[inst](w, B, k && !i ? m + 12 : m, v * (k ? .6 : 1))))); }
      },
      padBars(prog, fromBar, toBar, inst = 'pad', v = 1) { for (let b = fromBar; b < toBar; b++) S.at(b * bar, (w, B) => I[inst](w, B, prog[b % prog.length], bar + .3, v)); },
      drums(fromBar, toBar, pat = 'groove', v = 1) {
        for (let b = fromBar; b < toBar; b++) {
          const t0 = b * bar;
          if (pat === 'four') { for (let k = 0; k < 4; k++) S.at(t0 + k * beat, I.kick, v); [1, 3].forEach(k => S.at(t0 + k * beat, I.clap, v)); for (let e = 0; e < 8; e++) if (e % 2) S.at(t0 + e * beat / 2, I.hat, v); continue; }
          if (pat === 'soft') { S.at(t0, I.kick, .6 * v); S.at(t0 + 2 * beat, I.kick, .5 * v); for (let e = 0; e < 4; e++) S.at(t0 + e * beat, I.shaker, v); continue; }
          S.at(t0, I.kick, v); S.at(t0 + 2 * beat, I.kick, v); if (b % 2) S.at(t0 + 2.5 * beat, I.kick, .6 * v);
          S.at(t0 + beat, I.snare, v); S.at(t0 + 3 * beat, I.snare, v);
          const n = pat === 'busy' ? 16 : 8; for (let e = 0; e < n; e++) S.at(t0 + e * bar / n + (n === 8 && e % 2 ? .03 : 0), I.hat, (e % 2 ? .6 : 1) * v);
        }
      },
      bassLine(roots, fromBar, toBar, v = 1) {
        for (let b = fromBar; b < toBar; b++) { const r = roots[b % roots.length], t0 = b * bar; S.at(t0, I.bass, r, .5, v); S.at(t0 + 1.5 * beat, I.bass, r, .25, v); S.at(t0 + 2.5 * beat, I.bass, r + 7, .25, v); S.at(t0 + 3.5 * beat, I.bass, r + 12, .2, v); }
      },
      melody(notes, t0, step, inst = 'lead', v = 1) { notes.forEach((m, i) => { if (m) S.at(t0 + i * step, I[inst], m, v); }); },
      events: () => E.sort((a, b) => a.t - b.t)
    };
    return S;
  }
  function makeBus(ctx, master) {
    const out = ctx.createGain(); out.connect(master);
    const mk = g => { const n = ctx.createGain(); n.gain.value = g; return n; };
    const lp = (f, dst) => { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; fl.connect(dst); return fl; };
    // small generated reverb
    const conv = ctx.createConvolver(), len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    conv.buffer = ir; const verb = mk(.22); conv.connect(verb); verb.connect(out);
    const drum = mk(.8), sfx = mk(.9), bass = mk(.8), keys = mk(1), pad = mk(1), lead = mk(1);
    drum.connect(out); sfx.connect(out); sfx.connect(conv);
    bass.connect(lp(700, out));
    const kl = lp(2400, out); keys.connect(kl); keys.connect(conv);
    pad.connect(lp(1000, out)); pad.connect(conv);
    const ll = lp(2800, out); lead.connect(ll); lead.connect(conv);
    const dl = ctx.createDelay(1); dl.delayTime.value = .28; const fb = mk(.28), wet = mk(.3);
    ll.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(out);
    return { out, drum, sfx, bass, keys, pad, lead };
  }
  function makeMaster(ctx) {
    const master = ctx.createGain(); master.gain.value = .85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination); return master;
  }
  function makeNoise(ctx) { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }

  /* ---------------- page + player ---------------- */
  window.Film = function (opts) {
    const DUR = opts.DUR || 15, BPM = opts.BPM || 96;
    document.title = opts.title || document.title;
    const style = document.createElement('style');
    style.textContent = `html,body{margin:0;height:100%;background:#111;color:#eee;font:14px -apple-system,"PingFang SC",sans-serif}
      .stage{position:fixed;inset:0;display:grid;place-items:center}
      canvas{width:min(100vw,177.78vh);height:min(56.25vw,100vh);display:block;cursor:pointer}
      .hud{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;align-items:center;padding:8px 14px;background:linear-gradient(transparent,rgba(0,0,0,.6));opacity:.85}
      .hud input{flex:1;accent-color:#D97652}.hud button{background:#222;color:#eee;border:1px solid #555;border-radius:6px;padding:3px 10px;cursor:pointer}
      .hud span{font-variant-numeric:tabular-nums}`;
    document.head.appendChild(style);
    document.body.innerHTML = `<div class="stage"><canvas></canvas></div><div class="hud"><button type="button">▶</button><input type="range" min="0" max="${DUR * 100}" value="0" aria-label="进度"><span>0.0 / ${DUR.toFixed(1)}</span></div>`;
    const cv = document.querySelector('canvas'), c = cv.getContext('2d');
    const btn = document.querySelector('.hud button'), range = document.querySelector('.hud input'), lbl = document.querySelector('.hud span');
    let scale = 1;
    function fit() { const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); scale = cv.width / W; }
    function draw(t) { c.setTransform(scale, 0, 0, scale, 0, 0); c.save(); opts.draw(c, clamp(t, 0, DUR), F); c.restore(); }
    let events = null;
    function getEvents() { if (!events) { const S = makeScore(BPM, DUR); if (opts.score) opts.score(S, F); events = S.events(); } return events; }
    let playing = false, off = 0, t0 = 0, idx = 0, bus = null, timer = null, raf = 0;
    const now = () => playing ? off + (AC ? Math.max(0, AC.currentTime - t0) : 0) : off;
    function pump() { const ev = getEvents(), hz = now() + .3; while (idx < ev.length && ev[idx].t < hz) { const e = ev[idx++], w = t0 + (e.t - off); if (w >= AC.currentTime - .01) { try { e.fn(Math.max(w, AC.currentTime + .001), bus); } catch (err) { } } } }
    function play() {
      if (off >= DUR - .05) off = 0;
      if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); noiseBuf = makeNoise(AC); AC.__master = makeMaster(AC); }
      AC.resume(); bus = makeBus(AC, AC.__master); t0 = AC.currentTime + .06;
      idx = getEvents().findIndex(e => e.t >= off); if (idx < 0) idx = getEvents().length;
      playing = true; btn.textContent = '❚❚'; timer = setInterval(pump, 25); pump(); loop();
    }
    function pause() { off = now(); playing = false; btn.textContent = '▶'; clearInterval(timer); if (bus) { const o = bus.out; o.gain.setTargetAtTime(0, AC.currentTime, .02); setTimeout(() => o.disconnect(), 300); bus = null; } cancelAnimationFrame(raf); }
    function loop() { const t = now(); if (t >= DUR) { pause(); off = DUR; } draw(t); range.value = Math.round(t * 100); lbl.textContent = `${t.toFixed(1)} / ${DUR.toFixed(1)}`; if (playing) raf = requestAnimationFrame(loop); }
    btn.onclick = () => playing ? pause() : play();
    cv.onclick = btn.onclick;
    range.oninput = () => { const was = playing; if (was) pause(); off = range.value / 100; draw(off); lbl.textContent = `${off.toFixed(1)} / ${DUR.toFixed(1)}`; if (was) play(); };
    addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); btn.onclick(); } });
    addEventListener('resize', () => { fit(); draw(now()); });
    fit(); draw(opts.poster ?? DUR * .6);
    const fontsReady = Promise.all((opts.fonts || []).map(([f, s]) => document.fonts.load(f, s || 'abc'))).catch(() => { }).then(() => document.fonts.ready).then(() => { if (!playing) draw(opts.poster ?? DUR * .6); });
    window.__film = {
      DUR, poster: opts.poster ?? DUR * .6, ready: fontsReady,
      frame(t, w = 1920, h = 1080) { if (cv.width !== w) { cv.width = w; cv.height = h; scale = w / W; } draw(t); return cv.toDataURL('image/jpeg', .92); },
      async audio() {
        const sr = 48000, ctx = new OfflineAudioContext(2, Math.ceil(sr * (DUR + .5)), sr);
        const saved = AC, savedNoise = noiseBuf; AC = ctx; noiseBuf = makeNoise(ctx);
        const B = makeBus(ctx, makeMaster(ctx));
        getEvents().forEach(e => { try { e.fn(e.t + .01, B); } catch (err) { } });
        const buf = await ctx.startRendering(); AC = saved; noiseBuf = savedNoise;
        const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, ab = new ArrayBuffer(44 + n * 4), dv = new DataView(ab);
        const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
        dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
        for (let i = 0, o = 44; i < n; i++, o += 4) { dv.setInt16(o, clamp(L[i], -1, 1) * 32767, true); dv.setInt16(o + 2, clamp(R[i], -1, 1) * 32767, true); }
        const bytes = new Uint8Array(ab); let bin = ''; for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
        return btoa(bin);
      }
    };
  };
})();
