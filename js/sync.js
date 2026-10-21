/* Sincronizare prin GitHub: progresul stă în progres.json, pe ramura „progres” a repo-ului.
   Oricine îl poate citi; doar dispozitivele cu cheie (token GitHub) îl pot modifica. */

const Sync = (() => {
  const REPO = 'Lucian07/postura';
  const BRANCH = 'progres';
  const FILE = 'progres.json';
  const API = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const SECTIONS = ['weights', 'videos'];

  let sha = null, busy = null, timer = 0;
  let state = 'idle', error = '';

  const cfg = () => (Store.data.sync ||= { token: '', dirty: false, lastSync: null });
  const token = () => cfg().token || '';
  const canWrite = () => !!token();

  const b64encode = str => {
    let bin = '';
    new TextEncoder().encode(str).forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  };
  const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

  // JSON cu cheile sortate, ca două variante cu același conținut să arate identic.
  const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]`
    : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
    : JSON.stringify(v);

  const payload = d => ({ version: 1, days: d.days || {}, weights: d.weights || {}, videos: d.videos || {}, stamps: d.stamps || {} });

  function headers() {
    const h = { Accept: 'application/vnd.github+json' };
    if (token()) h.Authorization = `Bearer ${token()}`;
    return h;
  }

  function failure(res) {
    if (res.status === 401) return 'Cheia nu e validă sau a expirat. Fă una nouă și lipește-o în Setări.';
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') return 'GitHub a limitat temporar citirile. Reîncerc în câteva minute.';
    if (res.status === 403 || res.status === 404) return canWrite()
      ? 'Cheia nu are acces de scriere la repo-ul postura (Contents: Read and write).'
      : 'Nu pot citi progresul de pe GitHub.';
    return `GitHub a răspuns cu eroarea ${res.status}.`;
  }

  async function fetchRemote() {
    const res = await fetch(`${API}?ref=${BRANCH}`, { headers: headers(), cache: 'no-store' });
    if (res.status === 404 && !canWrite()) { sha = null; return null; }
    if (!res.ok) throw new Error(failure(res));
    const j = await res.json();
    sha = j.sha;
    return JSON.parse(b64decode(j.content));
  }

  // Zilele: câștigă varianta modificată ultima (câmpul „at”). Greutăți și linkuri: secțiunea cea mai nouă.
  function merge(local, remote) {
    const out = payload(local);
    if (!remote) return out;
    const days = { ...(remote.days || {}) };
    Object.entries(out.days).forEach(([k, r]) => {
      if (!days[k] || (r.at || 0) > (days[k].at || 0)) days[k] = r;
    });
    out.days = days;
    out.stamps = { ...out.stamps };
    SECTIONS.forEach(name => {
      const mine = out.stamps[name] || 0, theirs = remote.stamps?.[name] || 0;
      if (theirs > mine) { out[name] = remote[name] || {}; out.stamps[name] = theirs; }
    });
    return out;
  }

  function apply(merged) {
    const before = stable(payload(Store.data));
    Store.data.days = merged.days;
    Store.data.weights = merged.weights;
    Store.data.videos = merged.videos;
    Store.data.stamps = merged.stamps;
    Store.save();
    if (stable(payload(Store.data)) !== before) App.refresh();
  }

  async function push() {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await fetchRemote();
      const merged = merge(Store.data, remote);
      apply(merged);
      if (remote && stable(payload(remote)) === stable(merged)) return;
      const res = await fetch(API, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Progres ${todayKey()}`,
          content: b64encode(JSON.stringify(merged, null, 1)),
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
      if (res.ok) { sha = (await res.json()).content.sha; return; }
      // Altcineva (alt dispozitiv) a scris între timp: citesc din nou și reîncerc.
      if (res.status === 409 || res.status === 422) continue;
      throw new Error(failure(res));
    }
    throw new Error('Nu am reușit să salvez pe GitHub. Reîncerc mai târziu.');
  }

  async function pull() {
    const remote = await fetchRemote();
    apply(merge(Store.data, remote));
  }

  function run() {
    if (busy) return busy;
    if (!navigator.onLine) { state = 'offline'; badge(); return Promise.resolve(); }
    busy = (async () => {
      state = 'syncing';
      badge();
      try {
        if (canWrite() && cfg().dirty) {
          await push();
          cfg().dirty = false;
        } else {
          await pull();
        }
        cfg().lastSync = Date.now();
        Store.save();
        state = 'ok';
        error = '';
      } catch (e) {
        state = navigator.onLine ? 'error' : 'offline';
        error = e.message || 'Eroare de rețea.';
      } finally {
        busy = null;
        badge();
        App.refreshSettings?.();
      }
    })();
    return busy;
  }

  // Apelat după fiecare bifă, greutate sau link schimbat.
  function changed(section) {
    if (section && section !== 'days') (Store.data.stamps ||= {})[section] = Date.now();
    cfg().dirty = true;
    Store.save();
    badge();
    if (!canWrite()) return;
    clearTimeout(timer);
    timer = setTimeout(run, 1500);
  }

  async function setToken(value) {
    cfg().token = value.trim();
    cfg().dirty = true;
    Store.save();
    await run();
    return state === 'ok';
  }

  function forget() {
    cfg().token = '';
    Store.save();
    state = 'idle';
    error = '';
    badge();
  }

  function badge() {
    const el = document.getElementById('sync-badge');
    if (!el) return;
    const s = status();
    el.hidden = false;
    el.dataset.state = s.state;
    el.textContent = s.short;
    el.title = s.long;
  }

  function status() {
    const writable = canWrite();
    const pending = writable && cfg().dirty;
    let short, long;
    if (state === 'syncing') { short = 'Se sincronizează…'; long = 'Se sincronizează cu GitHub.'; }
    else if (state === 'offline') { short = 'Offline'; long = pending ? 'Fără internet. Bifele se trimit când revii online.' : 'Fără internet. Vezi ultima variantă salvată.'; }
    else if (state === 'error') { short = 'Eroare sincronizare'; long = error; }
    else if (!writable) { short = 'Doar citire'; long = 'Vezi progresul de pe GitHub. Ca să bifezi de aici, adaugă cheia în Setări.'; }
    else if (pending) { short = 'Nesalvat'; long = 'Bifele așteaptă să fie trimise pe GitHub.'; }
    else { short = 'Sincronizat'; long = 'Bifele sunt salvate pe GitHub și apar pe orice dispozitiv.'; }
    const shown = state === 'idle' || state === 'ok' ? (writable ? 'ok' : 'read') : state;
    return { state: shown, writable, pending, short, long, error, lastSync: cfg().lastSync };
  }

  function start() {
    badge();
    run();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
    window.addEventListener('online', run);
    window.addEventListener('offline', () => { state = 'offline'; badge(); });
    setInterval(() => { if (!document.hidden) run(); }, 5 * 60 * 1000);
  }

  return { start, run, changed, setToken, forget, status, canWrite, repo: REPO };
})();
