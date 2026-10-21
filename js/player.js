/* Antrenamentul ghidat: transformă exercițiile în pași (pregătire, faze, pauze) și îi rulează cu sunet și voce. */

// Fiecare pas are o durată; pașii „work” sunt fazele unei repetări (ex. Contracție 5 s, Întindere 5 s).
function buildPlan(items, { ready = 10, minimal = false } = {}) {
  const steps = [], entries = [], need = {};
  items.forEach((it, idx) => {
    const { block, ex } = it;
    const entry = { idx, block, ex, lastInBlock: it.lastInBlock, start: steps.length, end: 0 };
    entries.push(entry);
    steps.push({ t: 'ready', dur: ready, entry });

    const mult = ex.alternate ? 2 : 1;
    const base = {
      entry, sMin: ex.sets[0], sMax: ex.sets[1],
      rMin: ex.reps[0] * mult, rMax: ex.reps[1] * mult, rounds: ex.rounds || 1,
    };
    const setLimit = minimal ? base.sMin : base.sMax;
    const repLimit = minimal ? base.rMin : base.rMax;
    const sides = ex.sides ? ['stângă', 'dreaptă'] : [null];

    for (let s = 1; s <= setLimit; s++) {
      if (s > 1) steps.push({ ...base, t: 'rest', dur: block.rest || 30, set: s, optional: s > base.sMin });
      sides.forEach((side, si) => {
        if (si > 0) steps.push({ ...base, t: 'switch', dur: 6, set: s, side });
        for (let r = 1; r <= base.rounds; r++) {
          if (r > 1) steps.push({ ...base, t: 'move', dur: 4, set: s, side, round: r });
          const segStart = steps.length;
          for (let k = 1; k <= repLimit; k++) {
            if (k > 1 && ex.repGap) steps.push({ ...base, t: 'gap', dur: ex.repGap, set: s, side, round: r, rep: k });
            ex.phases.forEach(([label, dur, tone, hint], p) => {
              steps.push({
                ...base, t: 'work', dur, label, tone, hint, set: s, round: r, rep: k, phase: p,
                side: ex.alternate ? (k % 2 ? 'stângă' : 'dreaptă') : side,
              });
              // Minimul obligatoriu (seturi și repetări minime) contează la bifarea blocului.
              if (s <= base.sMin && k <= base.rMin) need[block.id] = (need[block.id] || 0) + dur;
            });
          }
          for (let n = segStart; n < steps.length; n++) steps[n].segEnd = steps.length;
        }
      });
    }
    entry.end = steps.length;
  });
  steps.push({ t: 'done', dur: 0, entry: entries[entries.length - 1] });

  const counts = {};
  entries.forEach(e => { counts[e.block.id] = (counts[e.block.id] || 0) + 1; e.pos = counts[e.block.id]; });
  entries.forEach(e => { e.count = counts[e.block.id]; });

  const plan = { steps, entries, need, total: 0 };
  retime(plan);
  return plan;
}

function retime(plan) {
  let at = 0;
  plan.steps.forEach(st => { st.at = at; at += st.dur; });
  plan.total = at;
}

function itemsFor(blockIds) {
  const items = [];
  blockIds.forEach(id => {
    const b = blockById(id);
    b.exercises.forEach((ex, j) => items.push({ block: b, ex, lastInBlock: j === b.exercises.length - 1 }));
  });
  return items;
}

// [minim, maxim] în secunde: seturile și repetările opționale fac diferența.
function estimate(blockIds) {
  const items = itemsFor(blockIds);
  if (!items.length) return [0, 0];
  const ready = Store.data.settings.ready;
  return [buildPlan(items, { ready, minimal: true }).total, buildPlan(items, { ready }).total];
}

const spokenDur = sec => sec % 60 === 0
  ? (sec === 60 ? 'un minut' : sec === 120 ? 'două minute' : `${sec / 60} minute`)
  : `${sec}${sec >= 20 ? ' de' : ''} secunde`;
const spokenName = name => name.replace(/\s*\(.*?\)/g, '').replace(/\s*–\s*/g, ', ');
const sideWord = side => side === 'stângă' ? 'stânga' : 'dreapta';

const Player = (() => {
  const $id = id => document.getElementById(id);
  const CIRC = 2 * Math.PI * 90;
  let root, doneEl, confirmEl, ring;
  let plan = null, i = 0, stepStart = 0, carried = 0, paused = false, lastSec = null;
  let raf = 0, bgTimer = 0, wakeLock = null, wasPlaying = false;
  let single = false, items = null, dayKey = null, startedAt = 0, worked = {}, marked = new Set();
  let shownEntry = null;
  const shown = {};

  function init() {
    root = $id('player');
    doneEl = $id('pl-done');
    confirmEl = $id('pl-confirm');
    ring = $id('pl-ring');
    ring.style.strokeDasharray = CIRC.toFixed(1);
    $id('pl-toggle').addEventListener('click', () => (paused ? resume() : pause()));
    $id('pl-next').addEventListener('click', () => jumpEntry(1));
    $id('pl-prev').addEventListener('click', () => jumpEntry(-1));
    $id('pl-close').addEventListener('click', requestClose);
    $id('pl-sound').addEventListener('click', toggleSound);
    $id('pl-keep').addEventListener('click', keepGoing);
    $id('pl-stop').addEventListener('click', close);
    root.addEventListener('click', e => { if (e.target.closest('a.vid')) pause(); });
    doneEl.addEventListener('click', onDoneAction);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && plan && !root.hidden) lock(); });
  }

  function open(list, opts = {}) {
    Sound.unlock();
    items = list;
    single = !!opts.single;
    plan = buildPlan(items, { ready: Store.data.settings.ready });
    dayKey = todayKey();
    startedAt = Date.now();
    worked = {};
    marked = new Set();
    shownEntry = null;
    for (const k in shown) delete shown[k];
    root.hidden = false;
    doneEl.hidden = true;
    confirmEl.hidden = true;
    document.body.classList.add('playing');
    paused = false;
    i = 0;
    renderToggle();
    renderSound();
    enter(0, 0, true);
    lock();
    loop();
  }

  // ---------- Timp ----------
  const elapsed = () => (paused ? carried : carried + (performance.now() - stepStart) / 1000);

  function enter(idx, over = 0, cue = true) {
    const prev = plan.steps[i];
    if (prev && prev.t === 'work') {
      const id = prev.entry.block.id;
      worked[id] = (worked[id] || 0) + Math.min(elapsed(), prev.dur);
    }
    i = Math.min(idx, plan.steps.length - 1);
    stepStart = performance.now();
    carried = over;
    const s = plan.steps[i];
    lastSec = Math.ceil(s.dur - over);
    if (!single) checkBlocks();
    if (s.t === 'done') return finish();
    if (cue) cueFor(s);
    renderStep();
    renderTime();
  }

  function checkBlocks() {
    plan.entries.forEach(en => {
      const id = en.block.id;
      if (!en.lastInBlock || i < en.end || marked.has(id)) return;
      if ((worked[id] || 0) >= 0.5 * (plan.need[id] || 0)) {
        marked.add(id);
        Days.markBlock(dayKey, id);
      }
    });
  }

  function loop() {
    stopLoop();
    const frame = () => { tick(); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    // În fundal browserul oprește animațiile; intervalul ține timerul la zi.
    bgTimer = setInterval(() => { if (document.hidden) tick(); }, 500);
  }
  function stopLoop() { cancelAnimationFrame(raf); clearInterval(bgTimer); raf = bgTimer = 0; }

  function tick() {
    if (!plan) return;
    let s = plan.steps[i], guard = 0;
    while (!paused && s.t !== 'done' && elapsed() >= s.dur && guard++ < 5000) {
      const over = elapsed() - s.dur;
      enter(i + 1, over, over < 1.5);
      s = plan.steps[i];
    }
    if (s.t === 'done') return;
    if (!paused) countdown(s);
    renderTime();
  }

  function countdown(s) {
    const sec = Math.ceil(s.dur - elapsed());
    if (sec === lastSec) return;
    lastSec = sec;
    if (s.dur >= 8 && sec >= 1 && sec <= 3) { Sound.play('tick'); vib(30); return; }
    if (s.t === 'work' && s.dur >= 120 && sec > 0 && sec < s.dur && sec % 60 === 0) Sound.say(`Încă ${spokenDur(sec)}.`);
    else if (s.t === 'work' && s.dur >= 45 && sec === 30) Sound.say('Încă 30 de secunde.');
    else if (s.dur >= 25 && sec === 10) Sound.say('10 secunde.');
  }

  function pause() {
    if (!plan || paused) return;
    carried = elapsed();
    paused = true;
    Sound.hush();
    renderToggle();
  }
  function resume() {
    if (!plan || !paused) return;
    Sound.unlock();
    stepStart = performance.now();
    paused = false;
    lastSec = Math.ceil(plan.steps[i].dur - carried);
    renderToggle();
  }

  function addTime(sec) {
    plan.steps[i].dur += sec;
    retime(plan);
    lastSec = Math.ceil(plan.steps[i].dur - elapsed());
    renderStep();
  }

  function jumpEntry(dir) {
    const s = plan && plan.steps[i];
    if (!s || s.t === 'done') return;
    const en = s.entry;
    if (dir > 0) return enter(en.end);
    // Înapoi: întâi la începutul exercițiului, apoi la cel dinainte.
    const into = s.at + elapsed() - plan.steps[en.start].at;
    if (into > 3 || en.idx === 0) enter(en.start);
    else enter(plan.entries[en.idx - 1].start);
  }

  // ---------- Sunet ----------
  function vib(pattern) {
    if (Store.data.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch {} }
  }

  function cueFor(s) {
    const ex = s.entry.ex;
    switch (s.t) {
      case 'ready':
        Sound.play(i === 0 ? 'go' : 'exerciseDone');
        vib([80, 60, 80]);
        Sound.say(`${i === 0 ? '' : 'Gata. '}Urmează ${spokenName(ex.name)}.${ex.warn ? ` ${cap(ex.warn.toLowerCase())}.` : ''}`);
        break;
      case 'work': {
        Sound.play(s.tone);
        vib(s.tone === 'effort' ? 120 : 50);
        const words = [];
        if (s.side && !ex.alternate && s.rep === 1 && s.phase === 0 && s.round === 1) words.push(`Partea ${s.side}.`);
        if (s.dur >= 20) words.push(`${s.label}. ${cap(spokenDur(s.dur))}.`);
        else if (ex.timed) { if (s.rep === 1 && s.phase === 0) words.push(`${ex.repsText.replace('min', 'minute')}. ${s.label}.`); }
        else if (ex.alternate) { if (s.phase === 0) words.push(cap(sideWord(s.side))); }
        else if (s.phase === 0 && s.rMax > 1) words.push(s.dur >= 5 ? `${s.rep}. ${s.label}.` : `${s.rep}`);
        else if (s.dur >= 5) words.push(`${s.label}.`);
        Sound.say(words.join(' '));
        break;
      }
      case 'rest':
        Sound.play('rest');
        vib([60, 40, 60]);
        Sound.say(`Pauză ${spokenDur(s.dur)}.${s.optional ? ` Setul ${s.set} e opțional.` : ''}`);
        break;
      case 'switch':
        Sound.play('switch');
        vib([60, 40, 60]);
        Sound.say(`Schimbă pe partea ${s.side}.`);
        break;
      case 'move':
        Sound.play('switch');
        Sound.say(`Mută rolerul. Punctul ${s.round}.`);
        break;
      case 'gap':
        Sound.play('release');
        Sound.say(s.rep > s.rMin ? `Relaxează-te. Repetarea ${s.rep} e opțională.` : 'Relaxează-te.');
        break;
    }
  }

  function toggleSound() {
    Store.data.settings.sound = !Store.data.settings.sound;
    Store.save();
    Sound.configure(Store.data.settings);
    if (Store.data.settings.sound) Sound.unlock(); else Sound.hush();
    renderSound();
  }

  // ---------- Afișare ----------
  function put(id, value, prop = 'textContent') {
    if (shown[id] === value) return;
    shown[id] = value;
    $id(id)[prop] = value;
  }

  function renderToggle() {
    root.classList.toggle('is-paused', paused);
    const b = $id('pl-toggle');
    b.innerHTML = icon(paused ? 'play' : 'pause');
    b.setAttribute('aria-label', paused ? 'Continuă' : 'Pauză');
  }
  function renderSound() {
    const on = Store.data.settings.sound;
    const b = $id('pl-sound');
    b.innerHTML = icon(on ? 'sound' : 'mute');
    b.setAttribute('aria-label', on ? 'Oprește sunetul' : 'Pornește sunetul');
  }

  function renderStep() {
    const s = plan.steps[i];
    const en = s.entry, ex = en.ex, b = en.block;
    root.dataset.c = b.color;
    root.dataset.kind = s.t === 'work' ? s.tone : s.t;

    if (shownEntry !== en) {
      shownEntry = en;
      put('pl-block', single ? `${b.name} · clip ${ex.videos[0]?.[0] || '—'}` : b.name);
      put('pl-count', single ? '' : `${en.pos} / ${en.count}`);
      put('pl-name', ex.name);
      const warn = $id('pl-warn');
      warn.hidden = !ex.warn;
      warn.textContent = ex.warn || '';
      put('pl-dose', `${setsText(ex)} ${ex.sets[1] > 1 ? 'seturi' : 'set'} × ${ex.repsText} · ${ex.tempoText}`);
      put('pl-meta', [ex.equip, ex.note].filter(Boolean).join(' · '));
      $id('pl-videos').innerHTML = videoLinks(ex);
      const w = $id('pl-weight');
      w.hidden = !ex.weight;
      w.innerHTML = ex.weight ? weightWidget(ex) : '';
      const next = plan.entries[en.idx + 1];
      put('pl-upnext', next ? `Urmează: ${next.ex.name}` : single ? '' : 'Ultimul exercițiu');
    }

    const label = { ready: 'Pregătește-te', rest: 'Pauză', switch: 'Schimbă partea', move: `Punctul ${s.round}`, gap: 'Relaxează-te', work: s.label }[s.t];
    const hint = {
      ready: ex.equip ? `Ai nevoie de: ${ex.equip}` : 'Pornește singur în câteva secunde',
      rest: s.optional ? `Urmează setul ${s.set} — opțional` : `Urmează setul ${s.set} din ${s.sMax}`,
      switch: `Acum partea ${s.side}`,
      move: `Mută rolerul la punctul ${s.round} din ${s.rounds}`,
      gap: s.rep > s.rMin ? `Repetarea ${s.rep} e opțională` : `Urmează repetarea ${s.rep}`,
      work: s.hint || '',
    }[s.t];
    put('pl-phase', label);
    put('pl-hint', hint);

    // Contoare: set, parte, punct, repetare
    const chips = [];
    if (s.t !== 'ready') {
      if (s.sMax > 1) chips.push([`Set ${s.set} / ${s.sMax}${s.set > s.sMin ? ' · opțional' : ''}`, '']);
      if (s.side) chips.push([`Partea ${s.side}`, 'hl']);
      if (s.rounds > 1) chips.push([`Punct ${s.round} / ${s.rounds}`, '']);
      if ((s.t === 'work' || s.t === 'gap') && !ex.timed) {
        if (ex.alternate) chips.push([`Rep ${Math.ceil(s.rep / 2)} / ${s.rMax / 2}`, '']);
        else if (s.rMax > 1) chips.push([s.rMax > s.rMin ? `Rep ${s.rep} · țintă ${s.rMin}–${s.rMax}` : `Rep ${s.rep} / ${s.rMax}`, '']);
      }
    }
    put('pl-counters', chips.map(([t, c]) => `<span class="chip ${c}">${esc(t)}</span>`).join(''), 'innerHTML');

    // Tempo-ul repetării, cu faza curentă evidențiată
    const seq = s.t === 'work' && ex.phases.length > 1
      ? ex.phases.map(([l, d], p) => `<span class="${p === s.phase ? 'on' : ''}">${esc(l)} ${d}s</span>`).join('<i>→</i>')
      : '';
    put('pl-seq', seq, 'innerHTML');

    // Bulinele repetărilor
    let dots = '';
    if ((s.t === 'work' || s.t === 'gap') && !ex.timed && s.rMax > 1 && s.rMax <= 30) {
      for (let k = 1; k <= s.rMax; k++) {
        const st = k < s.rep ? 'on' : k === s.rep ? 'cur' : '';
        dots += `<i class="${st}${k > s.rMin ? ' opt' : ''}"></i>`;
      }
    }
    put('pl-dots', dots, 'innerHTML');

    renderActions(s);

    const dial = $id('pl-dial');
    dial.classList.remove('beat');
    void dial.offsetWidth;
    dial.classList.add('beat');
  }

  function renderActions(s) {
    const a = $id('pl-act1'), b = $id('pl-act2');
    a.hidden = b.hidden = true;
    const set = (btn, text, fn, cls) => { btn.hidden = false; btn.textContent = text; btn.onclick = fn; btn.className = `btn ${cls}`; };
    if (s.t === 'ready') {
      set(a, 'Încep acum', () => enter(i + 1), 'primary');
      set(b, '+15 s', () => addTime(15), 'ghost');
    } else if (s.t === 'rest') {
      if (s.optional) {
        set(a, `Fac setul ${s.set}`, () => enter(i + 1), 'primary');
        set(b, 'Mai departe, fără el', () => enter(s.entry.end), 'ghost');
      } else {
        set(a, 'Sari peste pauză', () => enter(i + 1), 'primary');
        set(b, '+15 s', () => addTime(15), 'ghost');
      }
    } else if (s.t === 'switch' || s.t === 'move') {
      set(a, 'Sunt gata', () => enter(i + 1), 'ghost');
    } else if (s.t === 'gap') {
      if (s.rep > s.rMin) {
        set(a, `Fac repetarea ${s.rep}`, () => enter(i + 1), 'primary');
        set(b, 'Mai departe, fără ea', () => enter(s.segEnd), 'ghost');
      } else set(a, 'Sunt gata', () => enter(i + 1), 'ghost');
    } else if (s.t === 'work' && s.rMax > s.rMin && s.rep >= s.rMin) {
      set(a, 'Termină setul', () => enter(s.segEnd), 'ghost');
    }
  }

  function renderTime() {
    const s = plan.steps[i];
    if (s.t === 'done') return;
    const e = Math.min(elapsed(), s.dur);
    const rem = s.dur - e;
    ring.style.strokeDashoffset = (CIRC * (s.dur ? e / s.dur : 1)).toFixed(1);
    put('pl-time', s.dur >= 60 ? clock(rem) : String(Math.max(0, Math.ceil(rem))));
    const now = s.at + e;
    $id('pl-bar').style.width = `${((now / plan.total) * 100).toFixed(2)}%`;
    const exLeft = plan.steps[s.entry.end].at - now;
    put('pl-remain', single ? `Rămas ${clock(exLeft)}` : `Exercițiu ${clock(exLeft)} · Total ${clock(plan.total - now)}`);
  }

  // ---------- Final ----------
  function finish() {
    stopLoop();
    release();
    Sound.play('sessionDone');
    vib([120, 80, 120, 80, 240]);
    const mins = minutes((Date.now() - startedAt) / 1000);
    let title, ok = true;
    const lines = [], notes = [];
    let actions;
    if (single) {
      title = 'Exercițiu terminat';
      Sound.say('Gata. Exercițiu terminat.');
      lines.push(`${mins} min`);
      actions = [['Încă o dată', 'again', 'primary'], ['Închide', 'close', 'ghost']];
    } else {
      const r = Days.get(dayKey);
      const inPlan = [...new Set(plan.entries.map(e => e.block.id))];
      const missed = inPlan.filter(id => !marked.has(id));
      const names = ids => ids.map(id => blockById(id).name).join(', ');
      const pd = programDay(dayKey);
      const st = Days.streaks();
      if (r?.done) { title = 'Gata pe azi!'; Sound.say('Gata pe azi. Felicitări!'); }
      else { title = 'Sesiune terminată'; ok = marked.size > 0; Sound.say('Sesiune terminată.'); }
      if (pd >= 1 && pd <= PROGRAM.days) lines.push(`Ziua ${pd} din ${PROGRAM.days}`);
      if (st.cur > 1) lines.push(`${st.cur} zile la rând`);
      lines.push(`${mins} min`);
      if (r?.done) notes.push('Am bifat ziua în calendar.');
      else if (marked.size) notes.push(`Am bifat în calendar: ${names([...marked])}.`);
      if (missed.length) notes.push(`Ai sărit peste mare parte din ${names(missed)}, așa că nu l-am bifat.`);
      actions = [['Vezi calendarul', 'calendar', 'primary'], ['Închide', 'close', 'ghost']];
      if (missed.length && !r?.done) actions.push(['Bifează ziua oricum', 'force', 'ghost']);
    }
    doneEl.innerHTML = `
      <div class="done-card">
        <div class="done-mark ${ok ? 'ok' : ''}">${icon('check')}</div>
        <h2>${esc(title)}</h2>
        <p class="done-stats">${lines.map(esc).join(' · ')}</p>
        ${notes.map(n => `<p class="done-note">${esc(n)}</p>`).join('')}
        <div class="done-actions">${actions.map(([t, act, cls]) => `<button type="button" class="btn ${cls}" data-act="${act}">${esc(t)}</button>`).join('')}</div>
      </div>`;
    doneEl.hidden = false;
    doneEl.querySelector('button')?.focus();
    App.refresh();
  }

  function onDoneAction(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'again') return open(items, { single: true });
    if (act === 'force') { Days.setDone(dayKey, true); App.toast('Am bifat ziua de azi.'); }
    close();
    if (act === 'calendar') location.hash = '#calendar';
  }

  function requestClose() {
    if (!plan) return;
    const s = plan.steps[i];
    if (single || s.t === 'done' || !doneEl.hidden || (i === 0 && elapsed() < 3)) return close();
    wasPlaying = !paused;
    pause();
    confirmEl.hidden = false;
    $id('pl-keep').focus();
  }
  function keepGoing() {
    confirmEl.hidden = true;
    if (wasPlaying) resume();
  }

  function close() {
    stopLoop();
    release();
    Sound.hush();
    plan = null;
    root.hidden = true;
    confirmEl.hidden = true;
    doneEl.hidden = true;
    document.body.classList.remove('playing');
    App.refresh();
  }

  function onKey(e) {
    if (!plan || root.hidden) return;
    if (!confirmEl.hidden) { if (e.key === 'Escape') keepGoing(); return; }
    if (!doneEl.hidden) { if (e.key === 'Escape') close(); return; }
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === ' ' && !e.target.closest('button, a')) { e.preventDefault(); paused ? resume() : pause(); }
    else if (e.key === 'ArrowRight') jumpEntry(1);
    else if (e.key === 'ArrowLeft') jumpEntry(-1);
    else if (e.key === 'Escape') requestClose();
  }

  // ---------- Ecranul rămâne aprins ----------
  async function lock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch { wakeLock = null; }
  }
  function release() {
    try { wakeLock?.release(); } catch {}
    wakeLock = null;
  }

  return { init, open, get active() { return !!plan; } };
})();
