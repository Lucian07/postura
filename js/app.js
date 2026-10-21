/* Interfața: Azi, Exerciții, Calendar, Setări și memento-ul de la 8:00. */

const ICONS = {
  play: '<path d="M8 5.2v13.6L19 12z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  prev: '<path d="M6 5.5v13"/><path d="M19 5.5v13L9 12z" fill="currentColor" stroke="none"/>',
  next: '<path d="M18 5.5v13"/><path d="M5 5.5v13L15 12z" fill="currentColor" stroke="none"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5M12 2.5V6"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1" fill="currentColor"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.3a8 8 0 0 1 0 11.4"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.3 2.3 0 0 0 4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevL: '<path d="M14.5 6l-6 6 6 6"/>',
  chevR: '<path d="M9.5 6l6 6-6 6"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
};

function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const minRange = ([lo, hi]) => minutes(lo) === minutes(hi) ? `≈ ${minutes(lo)} min` : `${minutes(lo)}–${minutes(hi)} min`;
const fmtKg = kg => String(kg).replace('.', ',');

const Weights = {
  get: (id, def) => Store.data.weights[id]?.kg ?? def,
  set(id, kg) {
    const w = (Store.data.weights[id] ||= { log: {} });
    w.kg = kg;
    w.log[todayKey()] = kg;
    Store.save();
  },
};

function videoLinks(ex) {
  if (!ex.videos.length) return '<span class="vid none">Fără clip pentru acest exercițiu</span>';
  return ex.videos.map(([clip, label]) => {
    const url = videoUrl(clip);
    const text = `Clip ${clip}${label ? ` · ${esc(label)}` : ''}`;
    return url
      ? `<a class="vid" href="${esc(url)}" target="_blank" rel="noopener">${icon('play')}${text}</a>`
      : `<span class="vid missing">${text}: linkul lipsește</span>`;
  }).join('');
}

function weightWidget(ex) {
  const kg = Weights.get(ex.id, ex.weight);
  return `<div class="weight" data-ex="${ex.id}" data-def="${ex.weight}">
    <span class="weight-label">Greutate</span>
    <button type="button" class="wbtn" data-wstep="-2.5" aria-label="Scade 2,5 kg">−</button>
    <output>${fmtKg(kg)} kg</output>
    <button type="button" class="wbtn" data-wstep="2.5" aria-label="Crește 2,5 kg">+</button>
  </div>`;
}

const findEx = key => {
  const [bid, eid] = key.split(':');
  const block = blockById(bid);
  return { block, ex: block.exercises.find(e => e.id === eid) };
};

// ---------- Memento ----------
const Reminder = (() => {
  const supported = () => 'Notification' in window && location.protocol !== 'file:';

  async function enable() {
    if (!supported()) {
      App.toast(location.protocol === 'file:'
        ? 'Notificările din browser merg doar după ce site-ul e publicat. Până atunci, folosește memento-ul din calendar.'
        : 'Browserul acesta nu suportă notificări. Folosește memento-ul din calendar.');
      return;
    }
    const p = await Notification.requestPermission();
    Store.data.settings.notify = p === 'granted';
    Store.save();
    App.toast(p === 'granted' ? 'Notificările sunt pornite.' : 'Browserul a refuzat notificările.');
    App.refresh();
  }

  async function show(title, body) {
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) return reg.showNotification(title, { body, icon: 'icon.svg', tag: 'postura-8am' });
      new Notification(title, { body, icon: 'icon.svg', tag: 'postura-8am' });
    } catch {}
  }

  // Merge cât timp site-ul e deschis (sau instalat pe ecranul telefonului).
  function check() {
    const s = Store.data.settings, t = todayKey(), pd = programDay(t);
    if (!s.notify || !supported() || Notification.permission !== 'granted') return;
    if (new Date().getHours() < PROGRAM.reminderHour || Store.data.lastNotified === t || Days.isDone(t)) return;
    if (pd < 1 || pd > PROGRAM.days) return;
    if (!document.hidden && document.hasFocus()) return;
    Store.data.lastNotified = t;
    Store.save();
    show('E ora exercițiilor', `Ziua ${pd} din ${PROGRAM.days} · Stretching + Activare`);
  }

  function start() {
    check();
    setInterval(check, 60 * 1000);
  }

  return { supported, enable, check, start };
})();

// ---------- Aplicația ----------
const App = (() => {
  const VIEWS = ['azi', 'exercitii', 'calendar', 'setari'];
  const $ = s => document.querySelector(s);
  let view = 'azi';
  let sel = null, selDay = null;
  let calMonth = null;
  let openEx = null;
  let toastTimer = 0;

  function init() {
    applyTheme();
    Sound.configure(Store.data.settings);
    document.querySelectorAll('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
    Player.init();
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('submit', onSubmit);
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (!Player.active) refresh();
    });
    route();
    Reminder.start();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    if (!Store.ok) toast('Browserul nu permite salvarea. Bifele nu vor rămâne după ce închizi pagina.');
  }

  function route() {
    const h = location.hash.slice(1);
    view = VIEWS.includes(h) ? h : 'azi';
    VIEWS.forEach(v => { document.getElementById(`view-${v}`).hidden = v !== view; });
    document.querySelectorAll('.nav a').forEach(a => {
      if (a.getAttribute('href') === `#${view}`) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const focusId = document.activeElement?.id;
    ({ azi: renderAzi, exercitii: renderExercitii, calendar: renderCalendar, setari: renderSetari })[view]();
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  }

  const refresh = () => render();

  // ---------- Azi ----------
  const selectedIds = () => ['stretch', 'activare'].filter(id => sel[id]).concat(sel.strength ? [sel.strength] : []);

  function renderAzi() {
    const t = todayKey();
    const pd = programDay(t);
    const r = Days.get(t) || {};
    const adv = Days.strengthAdvice(t);
    if (selDay !== t || !sel) {
      selDay = t;
      sel = { stretch: !r.stretch, activare: !r.activare, strength: r.strength ? null : adv.pick };
    }
    const st = Days.streaks();

    let title;
    if (pd < 1) title = pd === 0 ? 'Programul începe mâine' : `Programul începe în ${1 - pd} zile`;
    else if (pd <= PROGRAM.days) title = `Ziua ${pd} <span>din ${PROGRAM.days}</span>`;
    else title = 'Program încheiat';

    const doneNames = BLOCKS.filter(b => (b.strength ? r.strength === b.id : r[b.id])).map(b => b.name);
    const leftNames = ['stretch', 'activare'].filter(id => !r[id]).map(id => blockById(id).name);
    let status;
    if (r.done) status = `<p class="status ok">${icon('check')}<span>Ziua de azi e bifată. Bravo!</span></p>`;
    else if (doneNames.length) status = `<p class="status part"><span>Ai făcut: ${doneNames.join(', ')}.${leftNames.length ? ` Mai ai ${leftNames.join(' și ')}.` : ''}</span></p>`;
    else if (pd < 1) status = '<p class="status"><span>Poți face azi o sesiune de probă, ca să te obișnuiești cu timerul. Se salvează în calendar, dar nu intră în cele 30 de zile.</span></p>';
    else status = '<p class="status"><span>Nu ai bifat încă ziua de azi.</span></p>';

    const rows = ['stretch', 'activare'].map(id => {
      const b = blockById(id);
      return `<label class="plan-row ${sel[id] ? 'on' : ''}" data-c="${b.color}" for="sel-${id}">
        <input type="checkbox" id="sel-${id}" data-sel="${id}" ${sel[id] ? 'checked' : ''}>
        <span class="num">${b.num}</span>
        <span class="plan-text"><strong>${b.name}${r[id] ? ` <em class="tag">${icon('check')}făcut azi</em>` : ''}</strong>
          <small>${b.exercises.length} exerciții · ${minRange(estimate([id]))} · clipurile ${b.clips}</small></span>
        <span class="tick">${icon('check')}</span>
      </label>`;
    }).join('');

    const sb = sel.strength ? blockById(sel.strength) : null;
    const strengthRow = `<div class="plan-row strength ${sb ? 'on' : ''}" data-c="${sb ? sb.color : 'blue'}">
      <span class="num">3</span>
      <span class="plan-text"><strong>Forță${r.strength ? ` <em class="tag">${icon('check')}${blockById(r.strength).name} făcut azi</em>` : ''}</strong>
        <small>${esc(adv.text)}</small></span>
      <div class="seg" role="group" aria-label="Ziua de forță">
        ${[[null, 'Fără'], ['s1', 'Strength 1'], ['s2', 'Strength 2']].map(([v, l]) => `
          <button type="button" data-strength="${v || ''}" aria-pressed="${sel.strength === v}">${l}${v && v === adv.pick ? '<em>recomandat</em>' : ''}${v ? `<small>${minRange(estimate([v]))}</small>` : ''}</button>`).join('')}
      </div>
    </div>`;

    const ids = selectedIds();
    const equip = [...new Set(ids.flatMap(id => blockById(id).exercises.map(e => e.equip).filter(Boolean)))];
    const est = estimate(ids);

    const strip = programKeys().map(k => {
      const cls = Days.isDone(k) ? 'done' : Days.isPartial(k) ? 'partial' : k < t ? 'missed' : 'future';
      return `<i class="${cls}${k === t ? ' today' : ''}" title="${shortDate(k)} · ziua ${programDay(k)}"></i>`;
    }).join('');

    const reminder = Store.data.settings.reminderSet ? '' : `
      <div class="card reminder">
        <span class="reminder-ico">${icon('bell')}</span>
        <div>
          <h3>Memento la 8:00</h3>
          <p>Pune în calendarul telefonului un memento zilnic la 8:00, pe toate cele 30 de zile ale programului.</p>
          <div class="row">
            <a class="btn primary" href="memento-exercitii-8am.ics" data-action="ics">${icon('calendar')}Adaugă în calendar</a>
            <button type="button" class="btn ghost" data-action="hide-reminder">Am setat deja</button>
          </div>
        </div>
      </div>`;

    $('#view-azi').innerHTML = `
      <div class="hero">
        <p class="eyebrow">${longDate(t)}</p>
        <h1>${title}</h1>
        <p class="hero-sub">${PROGRAM.title} · ${shortDate(PROGRAM.start)} – ${shortDate(programEnd())} ${parseKey(programEnd()).getFullYear()}</p>
        <div class="strip" aria-hidden="true">${strip}</div>
        <div class="strip-labels"><span>Start ${shortDate(PROGRAM.start)}</span><span>${st.inProgram} din ${PROGRAM.days} zile făcute</span><span>Final ${shortDate(programEnd())}</span></div>
      </div>
      <div class="azi-grid">
        <div class="card today-card">
          ${status}
          <h2 class="card-title">Sesiunea de azi</h2>
          <div class="plan">${rows}${strengthRow}</div>
          ${equip.length ? `<p class="equip-line"><b>Pregătește:</b> ${equip.map(esc).join(' · ')}</p>` : ''}
          <button type="button" class="btn primary big" data-action="start" ${ids.length ? '' : 'disabled'}>
            ${icon('play')}${ids.length ? `Începe · ${minRange(est)}` : 'Alege cel puțin un bloc'}
          </button>
          <p class="today-foot">Timerul te duce pas cu pas: îți spune ce faci, numără repetările, pune pauzele și sună la final. La sfârșit bifează singur ziua.</p>
          <button type="button" class="btn link" data-action="toggle-today">${r.done ? 'Debifează ziua de azi' : 'Am făcut exercițiile fără timer: bifează ziua'}</button>
        </div>
        <aside class="side">
          <div class="card stats">
            <div><b>${st.cur}</b><span>zile la rând</span></div>
            <div><b>${st.inProgram}<small>/${PROGRAM.days}</small></b><span>zile făcute</span></div>
            <div><b>${st.best}</b><span>cea mai lungă serie</span></div>
          </div>
          ${reminder}
          <div class="card order-mini">
            <h3>Ordinea într-o zi</h3>
            <ol>
              <li data-c="teal"><span class="num">1</span><span><b>Stretching</b> · zilnic · clipurile 01–11</span></li>
              <li data-c="orange"><span class="num">2</span><span><b>Activare</b> · zilnic · clipurile 12–18</span></li>
              <li data-c="blue"><span class="num">3</span><span><b>Strength 1 sau 2</b> · doar în zilele de forță</span></li>
            </ol>
          </div>
        </aside>
      </div>`;
  }

  // ---------- Exerciții ----------
  function clipBadge(b, ex, key) {
    if (!ex.videos.length) return '<span class="clip none">fără<br>clip</span>';
    const [clip] = ex.videos[0];
    const url = videoUrl(clip);
    const alt = ex.videos[1]
      ? (videoUrl(ex.videos[1][0])
        ? `<a class="clip-alt" href="${esc(videoUrl(ex.videos[1][0]))}" target="_blank" rel="noopener" aria-label="Clipul ${ex.videos[1][0]} pe YouTube">sau <b>${ex.videos[1][0]}</b></a>`
        : `<span class="clip-alt">sau <b>${ex.videos[1][0]}</b></span>`)
      : '';
    const main = url
      ? `<a class="clip" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Clipul ${clip} pe YouTube">${icon('play')}${clip}</a>`
      : `<button type="button" class="clip missing" data-edit-ex="${key}" aria-label="Adaugă linkul pentru clipul ${clip}">${icon('plus')}${clip}</button>`;
    return main + alt;
  }

  function exDetail(b, ex, key) {
    const repSec = ex.phases.reduce((a, p) => a + p[1], 0);
    const notes = [];
    if (ex.phases.length > 1) notes.push(`O repetare durează ${repSec} secunde.`);
    if (ex.sides) notes.push('Faci pe ambele părți: întâi stânga, apoi dreapta.');
    if (ex.alternate) notes.push('Alternezi stânga și dreapta, câte 12 pe fiecare parte.');
    if (ex.rounds) notes.push(`Pe ${ex.rounds} puncte, câte ${ex.reps[0]} repetări pe fiecare.`);
    if (ex.sets[1] > 1) notes.push(`${b.restText}.${ex.sets[0] < ex.sets[1] ? ' Al doilea set e opțional.' : ''}`);
    if (ex.reps[0] < ex.reps[1]) notes.push(`Ținta e ${ex.reps[0]}–${ex.reps[1]} repetări: după ${ex.reps[0]} poți opri setul.`);
    const single = [{ block: b, ex, lastInBlock: false }];
    const ready = Store.data.settings.ready;
    const dur = [buildPlan(single, { ready, minimal: true }).total, buildPlan(single, { ready }).total];
    const missing = ex.videos.filter(([clip]) => !CLIPS[clip]).map(([clip]) => `
      <form class="link-form" data-clip="${clip}">
        <label for="link-${clip}">Clipul ${clip} nu are link în PDF. Lipește aici linkul de YouTube:</label>
        <div class="row">
          <input id="link-${clip}" type="url" inputmode="url" placeholder="https://youtu.be/…" value="${esc(Store.data.videos[clip] || '')}">
          <button type="submit" class="btn ghost">Salvează</button>
        </div>
      </form>`).join('');
    return `
      <div class="tempo-track" aria-label="Tempo">
        ${ex.phases.map(([l, d, tone]) => `<span class="ph ${tone}" style="flex:${Math.min(d, 20)} 1 0"><b>${esc(l)}</b><small>${d >= 60 ? clock(d) : `${d} s`}</small></span>`).join('')}
      </div>
      <p class="detail-notes">${notes.map(esc).join(' ')} Cu timerul: ${minRange(dur)}.</p>
      <div class="detail-videos">${videoLinks(ex)}</div>
      ${missing}
      ${ex.weight ? weightWidget(ex) : ''}
      <button type="button" class="btn primary" data-timer="${key}">${icon('timer')}Pornește timerul</button>`;
  }

  function exItem(b, ex) {
    const key = `${b.id}:${ex.id}`;
    const open = openEx === key;
    const sub = ex.warn
      ? `<span class="ex-warn">${esc([ex.warn, ex.equip].filter(Boolean).join(' · '))}</span>`
      : (ex.equip || ex.note) ? `<span class="ex-sub">${esc(ex.note || ex.equip)}</span>` : '';
    return `<li class="ex ${open ? 'open' : ''}" id="ex-${b.id}-${ex.id}">
      <div class="ex-row">
        <div class="ex-clip">${clipBadge(b, ex, key)}</div>
        <button type="button" class="ex-main" data-toggle-ex="${key}" aria-expanded="${open}">
          <strong>${esc(ex.name)}</strong>${sub}
        </button>
        <div class="ex-dose">
          <span class="ex-sets"><b>${setsText(ex)}</b> ${ex.sets[1] > 1 ? 'seturi' : 'set'}</span>
          <span class="ex-reps">${esc(ex.repsText)}</span>
          <span class="ex-tempo">${esc(ex.tempoText)}</span>
        </div>
        <button type="button" class="timer-btn" data-timer="${key}" aria-label="Pornește timerul: ${esc(ex.name)}">${icon('timer')}</button>
      </div>
      ${open ? `<div class="ex-detail">${exDetail(b, ex, key)}</div>` : ''}
    </li>`;
  }

  function renderExercitii() {
    $('#view-exercitii').innerHTML = `
      <div class="page-head">
        <h1>Exerciții</h1>
        <p>Apasă pe numărul colorat ca să deschizi clipul pe YouTube. Apasă pe nume pentru tempo și detalii, sau pe ${icon('timer')} ca să pornești timerul doar pentru exercițiul acela.</p>
      </div>
      <div class="guide-grid">
        <div class="card">
          <h3>Cum citești tempo-ul</h3>
          <dl class="legend">${TEMPO_LEGEND.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        </div>
        <div class="card">
          <h3>Echipament</h3>
          <ul class="equip">${EQUIPMENT.map(e => `<li>${esc(e)}</li>`).join('')}</ul>
        </div>
      </div>
      ${BLOCKS.map(b => `
        <section class="block" data-c="${b.color}" id="bloc-${b.id}">
          <header class="block-head">
            <span class="num">${b.num}</span>
            <div class="block-title"><h2>${esc(b.full)}</h2><p>${esc(b.when)} · Clipurile ${b.clips}</p></div>
            <span class="block-rest">${esc(b.restText)}</span>
            <button type="button" class="btn on-c" data-start-block="${b.id}">${icon('play')}Pornește blocul · ${minRange(estimate([b.id]))}</button>
          </header>
          <div class="ex-cols" aria-hidden="true"><span>Clip</span><span>Exercițiu</span><span>Seturi</span><span>Repetări</span><span>Tempo</span><span></span></div>
          <ul class="ex-list">${b.exercises.map(ex => exItem(b, ex)).join('')}</ul>
        </section>`).join('')}`;
  }

  // ---------- Calendar ----------
  function renderCalendar() {
    const t = todayKey();
    if (!calMonth) {
      const base = programDay(t) < 1 ? parseKey(PROGRAM.start) : new Date();
      calMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    }
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const count = new Date(y, m + 1, 0).getDate();
    let cells = '<span class="day blank"></span>'.repeat(offset);
    for (let d = 1; d <= count; d++) {
      const key = keyOf(new Date(y, m, d));
      const pd = programDay(key);
      const inProg = pd >= 1 && pd <= PROGRAM.days;
      const r = Days.get(key);
      const done = Days.isDone(key), part = Days.isPartial(key);
      const cls = [inProg && 'prog', done && 'done', part && 'partial', key === t && 'today', key > t && 'future'].filter(Boolean).join(' ');
      const state = done ? ', făcută' : part ? ', parțial' : '';
      cells += `<button type="button" class="day ${cls}" data-day="${key}" ${key > t ? 'disabled' : ''} aria-label="${longDate(key)}${inProg ? `, ziua ${pd}` : ''}${state}">
        ${inProg ? `<span class="pd">${pd}</span>` : ''}<span class="dn">${d}</span>${r?.strength ? `<i class="sdot ${r.strength}"></i>` : ''}
      </button>`;
    }
    const st = Days.streaks();
    const left = Math.max(0, Math.min(PROGRAM.days, PROGRAM.days - Math.max(0, programDay(t))));
    $('#view-calendar').innerHTML = `
      <div class="page-head">
        <h1>Calendar</h1>
        <p>Apasă pe o zi ca s-o bifezi sau să schimbi ce ai făcut. Cele 30 de zile ale programului au fundal gri.</p>
      </div>
      <div class="cal-layout">
        <div class="card cal-card">
          <div class="cal-head">
            <button type="button" class="icon-btn" data-cal="-1" aria-label="Luna anterioară">${icon('chevL')}</button>
            <h2>${cap(fmt(calMonth, { month: 'long', year: 'numeric' }))}</h2>
            <button type="button" class="icon-btn" data-cal="1" aria-label="Luna următoare">${icon('chevR')}</button>
          </div>
          <div class="cal">
            ${['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map(d => `<span class="dow">${d}</span>`).join('')}
            ${cells}
          </div>
          <div class="cal-legend">
            <span><i class="lg done"></i>Făcută</span>
            <span><i class="lg partial"></i>Parțial</span>
            <span><i class="lg prog"></i>Zi din program</span>
            <span><i class="lg dot s1"></i>Strength 1</span>
            <span><i class="lg dot s2"></i>Strength 2</span>
          </div>
        </div>
        <div class="card cal-stats">
          <div class="big-progress">
            <b>${st.inProgram}<small> / ${PROGRAM.days}</small></b>
            <span>zile făcute din program</span>
            <div class="bar"><i style="width:${(st.inProgram / PROGRAM.days) * 100}%"></i></div>
          </div>
          <dl class="kv">
            <div><dt>Serie curentă</dt><dd>${st.cur} ${st.cur === 1 ? 'zi' : 'zile'}</dd></div>
            <div><dt>Cea mai lungă serie</dt><dd>${st.best} ${st.best === 1 ? 'zi' : 'zile'}</dd></div>
            <div><dt>Zile de forță</dt><dd>${st.strength}</dd></div>
            <div><dt>Zile rămase din program</dt><dd>${left}</dd></div>
          </dl>
        </div>
      </div>`;
  }

  function openDay(key) {
    const sheet = $('#sheet');
    const r = Days.get(key) || {};
    const pd = programDay(key);
    sheet.innerHTML = `
      <div class="sheet-in">
        <p class="eyebrow">${pd >= 1 && pd <= PROGRAM.days ? `Ziua ${pd} din ${PROGRAM.days}` : 'În afara programului'}</p>
        <h3>${longDate(key)}</h3>
        <button type="button" class="btn big ${r.done ? 'is-done' : 'primary'}" data-day-done="${key}">
          ${r.done ? `${icon('check')}Zi făcută · apasă ca s-o debifezi` : 'Bifează ziua ca făcută'}
        </button>
        <p class="sheet-sub">Ce ai făcut în ziua asta</p>
        <div class="picks">
          ${BLOCKS.map(b => `<button type="button" class="pick" data-c="${b.color}" data-day-block="${key}|${b.id}" aria-pressed="${b.strength ? r.strength === b.id : !!r[b.id]}">${icon('check')}${b.name}</button>`).join('')}
        </div>
        <button type="button" class="btn ghost" data-action="close-sheet">Închide</button>
      </div>`;
    if (!sheet.open) sheet.showModal();
  }

  // ---------- Setări ----------
  function renderSetari() {
    const s = Store.data.settings;
    const notifyState = !Reminder.supported()
      ? (location.protocol === 'file:' ? 'Merg după ce site-ul e publicat.' : 'Browserul acesta nu le suportă.')
      : Notification.permission === 'granted' && s.notify ? 'Pornite.' : Notification.permission === 'denied' ? 'Blocate din setările browserului.' : 'Oprite.';
    const missing = Object.keys(CLIPS).filter(c => !CLIPS[c]);
    const exFor = clip => BLOCKS.flatMap(b => b.exercises).find(e => e.videos.some(v => v[0] === clip));
    $('#view-setari').innerHTML = `
      <div class="page-head"><h1>Setări</h1></div>
      <div class="settings">
        <section class="card">
          <h2>Sunet și voce</h2>
          <label class="set-row" for="set-sound"><span><b>Sunete</b><small>Bip la fiecare fază, numărătoare 3-2-1 și semnal la final.</small></span><input type="checkbox" class="switch" id="set-sound" ${s.sound ? 'checked' : ''}></label>
          <label class="set-row" for="set-voice"><span><b>Voce în română</b><small>${Sound.hasVoice() ? 'Anunță exercițiul, repetările, partea și pauzele.' : 'Dispozitivul nu are voce românească instalată; rămân sunetele.'}</small></span><input type="checkbox" class="switch" id="set-voice" ${s.voice ? 'checked' : ''}></label>
          <label class="set-row" for="set-vibrate"><span><b>Vibrații</b><small>Pe telefoanele Android.</small></span><input type="checkbox" class="switch" id="set-vibrate" ${s.vibrate ? 'checked' : ''}></label>
          <label class="set-row" for="set-volume"><span><b>Volum</b></span><input type="range" id="set-volume" min="0.2" max="1" step="0.1" value="${s.volume}"></label>
          <label class="set-row" for="set-ready"><span><b>Pregătire între exerciții</b><small>Timp să schimbi poziția și echipamentul.</small></span>
            <select id="set-ready">${[5, 10, 15, 20, 30].map(n => `<option value="${n}" ${s.ready === n ? 'selected' : ''}>${n} sec</option>`).join('')}</select></label>
          <button type="button" class="btn ghost" data-action="test-sound">${icon('sound')}Testează sunetul</button>
        </section>
        <section class="card">
          <h2>Memento la 8:00</h2>
          <p>Cel mai sigur e memento-ul din calendar: îl adaugi o dată și primești notificare în fiecare dimineață la 8:00, între ${shortDate(PROGRAM.start)} și ${shortDate(programEnd())}, chiar dacă site-ul e închis.</p>
          <a class="btn primary" href="memento-exercitii-8am.ics" data-action="ics">${icon('calendar')}Adaugă în calendar (iPhone, Mac, Google)</a>
          <div class="set-row"><span><b>Notificări în browser</b><small>Sună la 8:00 doar dacă site-ul e deschis sau instalat pe telefon. ${notifyState}</small></span>
            <button type="button" class="btn ghost" data-action="notify" ${s.notify && Reminder.supported() && Notification.permission === 'granted' ? 'disabled' : ''}>${icon('bell')}Activează</button></div>
        </section>
        <section class="card">
          <h2>Clipuri fără link</h2>
          <p>În PDF, clipurile ${missing.join(', ')} au buton, dar nu au link. Dacă le găsești pe YouTube, lipește linkul aici.</p>
          ${missing.map(clip => `
            <form class="link-form" data-clip="${clip}">
              <label for="set-link-${clip}">Clipul ${clip} · ${esc(exFor(clip)?.name || '')}</label>
              <div class="row">
                <input id="set-link-${clip}" type="url" inputmode="url" placeholder="https://youtu.be/…" value="${esc(Store.data.videos[clip] || '')}">
                <button type="submit" class="btn ghost">Salvează</button>
              </div>
            </form>`).join('')}
        </section>
        <section class="card">
          <h2>Aspect</h2>
          <div class="seg" role="group" aria-label="Temă">
            ${[['auto', 'Automat'], ['light', 'Luminos'], ['dark', 'Întunecat']].map(([v, l]) => `<button type="button" data-theme-set="${v}" aria-pressed="${s.theme === v}">${l}</button>`).join('')}
          </div>
        </section>
        <section class="card">
          <h2>Datele tale</h2>
          <p>Bifele se salvează în browserul acesta, pe dispozitivul acesta. Fă din când în când un backup.</p>
          <div class="row wrap">
            <button type="button" class="btn ghost" data-action="export">${icon('download')}Exportă backup</button>
            <label class="btn ghost" for="import-file">Importă backup<input type="file" id="import-file" accept="application/json,.json" hidden></label>
            <button type="button" class="btn ghost danger" data-action="reset">Șterge tot</button>
          </div>
        </section>
      </div>`;
  }

  function applyTheme() {
    const t = Store.data.settings.theme;
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }

  // ---------- Evenimente ----------
  function onClick(e) {
    const el = e.target.closest('button, a, [data-day]');
    if (!el) return;
    const d = el.dataset;
    const t = todayKey();

    if (d.action === 'start') {
      const ids = selectedIds();
      if (ids.length) Player.open(itemsFor(ids));
    } else if (d.strength !== undefined) {
      sel.strength = d.strength || null;
      renderAzi();
    } else if (d.action === 'toggle-today') {
      const was = Days.isDone(t);
      Days.setDone(t, !was);
      render();
      toast(was ? 'Am debifat ziua de azi.' : 'Am bifat ziua de azi.', { label: 'Anulează', fn: () => { Days.setDone(t, was); render(); } });
    } else if (d.action === 'ics') {
      Store.data.settings.reminderSet = true;
      Store.save();
      setTimeout(render, 300);
    } else if (d.action === 'hide-reminder') {
      Store.data.settings.reminderSet = true;
      Store.save();
      render();
    } else if (d.toggleEx) {
      openEx = openEx === d.toggleEx ? null : d.toggleEx;
      renderExercitii();
      document.querySelector(`[data-toggle-ex="${d.toggleEx}"]`)?.focus({ preventScroll: true });
    } else if (d.editEx) {
      openEx = d.editEx;
      renderExercitii();
      document.querySelector(`#view-exercitii .ex.open input`)?.focus();
    } else if (d.timer) {
      const { block, ex } = findEx(d.timer);
      Player.open([{ block, ex, lastInBlock: false }], { single: true });
    } else if (d.startBlock) {
      Player.open(itemsFor([d.startBlock]));
    } else if (d.day) {
      openDay(d.day);
    } else if (d.dayDone) {
      Days.setDone(d.dayDone, !Days.isDone(d.dayDone));
      openDay(d.dayDone);
      render();
    } else if (d.dayBlock) {
      const [key, bid] = d.dayBlock.split('|');
      Days.toggleBlock(key, bid);
      openDay(key);
      render();
    } else if (d.action === 'close-sheet') {
      $('#sheet').close();
    } else if (d.cal) {
      calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + Number(d.cal), 1);
      renderCalendar();
    } else if (d.wstep) {
      const box = el.closest('.weight');
      const kg = Math.max(0, Weights.get(box.dataset.ex, Number(box.dataset.def)) + Number(d.wstep));
      Weights.set(box.dataset.ex, kg);
      box.querySelector('output').textContent = `${fmtKg(kg)} kg`;
    } else if (d.action === 'test-sound') {
      Sound.unlock();
      Sound.play('exerciseDone');
      setTimeout(() => Sound.say('Așa sună vocea în timpul exercițiilor.'), 700);
    } else if (d.action === 'notify') {
      Reminder.enable();
    } else if (d.themeSet) {
      Store.data.settings.theme = d.themeSet;
      Store.save();
      applyTheme();
      renderSetari();
    } else if (d.action === 'export') {
      exportBackup();
    } else if (d.action === 'reset') {
      confirmReset();
    } else if (d.action === 'confirm-reset') {
      Store.reset();
      sel = null;
      $('#sheet').close();
      applyTheme();
      Sound.configure(Store.data.settings);
      render();
      toast('Am șters toate datele.');
    }
  }

  function onChange(e) {
    const el = e.target;
    const s = Store.data.settings;
    if (el.dataset.sel) {
      sel[el.dataset.sel] = el.checked;
      renderAzi();
      return;
    }
    if (el.id === 'set-sound') s.sound = el.checked;
    else if (el.id === 'set-voice') s.voice = el.checked;
    else if (el.id === 'set-vibrate') s.vibrate = el.checked;
    else if (el.id === 'set-ready') s.ready = Number(el.value);
    else if (el.id === 'import-file') return importBackup(el.files[0]);
    else return;
    Store.save();
    Sound.configure(s);
  }

  function onInput(e) {
    if (e.target.id !== 'set-volume') return;
    Store.data.settings.volume = Number(e.target.value);
    Store.save();
    Sound.configure(Store.data.settings);
  }

  function onSubmit(e) {
    const form = e.target.closest('.link-form');
    if (!form) return;
    e.preventDefault();
    const clip = form.dataset.clip;
    const value = form.querySelector('input').value.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      toast('Linkul trebuie să înceapă cu https://');
      return;
    }
    if (value) Store.data.videos[clip] = value; else delete Store.data.videos[clip];
    Store.save();
    toast(value ? `Am salvat linkul pentru clipul ${clip}.` : `Am șters linkul pentru clipul ${clip}.`);
    render();
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `postura-backup-${todayKey()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || typeof d.days !== 'object') throw new Error();
        Store.replace(d);
        sel = null;
        applyTheme();
        Sound.configure(Store.data.settings);
        render();
        toast(`Am importat backup-ul: ${Object.keys(d.days).length} zile.`);
      } catch {
        toast('Fișierul nu e un backup valid al acestui site.');
      }
    };
    reader.readAsText(file);
  }

  function confirmReset() {
    const sheet = $('#sheet');
    sheet.innerHTML = `
      <div class="sheet-in">
        <h3>Ștergi toate datele?</h3>
        <p>Dispar bifele din calendar, linkurile adăugate și setările. Nu se poate anula.</p>
        <div class="row">
          <button type="button" class="btn primary danger-fill" data-action="confirm-reset">Șterge tot</button>
          <button type="button" class="btn ghost" data-action="close-sheet">Renunță</button>
        </div>
      </div>`;
    sheet.showModal();
  }

  function toast(msg, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.fn(); };
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 3500);
  }

  return { init, refresh, toast };
})();

document.addEventListener('DOMContentLoaded', App.init);
