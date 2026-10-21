/* Date, salvare locală și evidența zilelor. */

// ---------- Date (mereu în ora locală, nu UTC) ----------
const pad2 = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (aKey, bKey) => Math.round((parseKey(bKey) - parseKey(aKey)) / 864e5);
const todayKey = () => keyOf(new Date());
const programDay = key => daysBetween(PROGRAM.start, key) + 1;
const programKeys = () => Array.from({ length: PROGRAM.days }, (_, n) => keyOf(addDays(parseKey(PROGRAM.start), n)));
const programEnd = () => programKeys()[PROGRAM.days - 1];

const fmt = (d, opts) => new Intl.DateTimeFormat('ro-RO', opts).format(d);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const longDate = key => cap(fmt(parseKey(key), { weekday: 'long', day: 'numeric', month: 'long' }));
const shortDate = key => fmt(parseKey(key), { day: 'numeric', month: 'short' }).replace('.', '');
const clock = sec => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${pad2(sec % 60)}`; };
const minutes = sec => Math.max(1, Math.round(sec / 60));

// ---------- Salvare ----------
const Store = (() => {
  const KEY = 'postura.v1';
  const defaults = () => ({
    days: {},
    settings: { sound: true, voice: true, vibrate: true, volume: 0.8, ready: 10, theme: 'auto', notify: false, reminderSet: false, reminderFor: null },
    videos: {},
    weights: {},
    stamps: {},
    sync: { token: '', dirty: false, lastSync: null },
    lastNotified: null,
  });
  const merge = d => {
    const def = defaults();
    return { ...def, ...d, settings: { ...def.settings, ...(d && d.settings) }, sync: { ...def.sync, ...(d && d.sync) } };
  };
  let data = defaults();
  let ok = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = merge(JSON.parse(raw));
  } catch { ok = false; }

  return {
    get data() { return data; },
    get ok() { return ok; },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(data)); ok = true; } catch { ok = false; }
      return ok;
    },
    replace(d) { data = merge(d); return this.save(); },
    reset() { data = defaults(); return this.save(); },
  };
})();

// ---------- Zilele ----------
const Days = {
  get: key => Store.data.days[key] || null,
  ensure: key => (Store.data.days[key] ||= { stretch: false, activare: false, strength: null, done: false }),
  isDone: key => !!Store.data.days[key]?.done,
  isPartial(key) {
    const r = this.get(key);
    return !!r && !r.done && (r.stretch || r.activare || !!r.strength);
  },
  // O zi debifată rămâne în listă (cu „at”), ca debifarea să ajungă și pe celelalte dispozitive.
  markBlock(key, blockId) {
    const r = this.ensure(key);
    if (blockById(blockId).strength) r.strength = blockId; else r[blockId] = true;
    if (r.stretch && r.activare) r.done = true;
    r.at = Date.now();
    Sync.changed('days');
  },
  setDone(key, done) {
    const r = this.ensure(key);
    r.done = done;
    r.at = Date.now();
    Sync.changed('days');
  },
  toggleBlock(key, blockId) {
    const r = this.ensure(key);
    if (blockById(blockId).strength) r.strength = r.strength === blockId ? null : blockId;
    else r[blockId] = !r[blockId];
    r.at = Date.now();
    Sync.changed('days');
  },
  streaks() {
    const done = Object.keys(Store.data.days).filter(k => this.isDone(k)).sort();
    let best = 0, run = 0, prev = null;
    done.forEach(k => {
      run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    });
    // Seria rămâne vie până la finalul zilei de azi.
    let d = new Date();
    if (!this.isDone(keyOf(d))) d = addDays(d, -1);
    let cur = 0;
    while (this.isDone(keyOf(d))) { cur++; d = addDays(d, -1); }
    const inProgram = programKeys().filter(k => this.isDone(k)).length;
    const strength = Object.values(Store.data.days).filter(r => r.strength).length;
    return { cur, best, inProgram, strength };
  },
  // Forța alternează S1 / S2, cu cel puțin o zi de refacere între ele.
  strengthAdvice(today = todayKey()) {
    const r = this.get(today);
    if (r?.strength) return { pick: null, next: r.strength, text: `Azi ai făcut deja ${blockById(r.strength).name}.` };
    const past = Object.keys(Store.data.days).filter(k => k < today && Store.data.days[k].strength).sort();
    const lastKey = past[past.length - 1];
    if (!lastKey) return { pick: 's1', next: 's1', text: 'Nu ai încă nicio zi de forță. Începe cu Strength 1.' };
    const last = Store.data.days[lastKey].strength;
    const next = last === 's1' ? 's2' : 's1';
    const gap = daysBetween(lastKey, today);
    if (gap < 2) {
      return { pick: null, next, text: `Ieri ai făcut ${blockById(last).name}. Azi lasă mușchii să se refacă: stretching și activare ajung.` };
    }
    const when = gap === 2 ? 'alaltăieri' : gap < 7 ? fmt(parseKey(lastKey), { weekday: 'long' }) : shortDate(lastKey);
    return { pick: next, next, text: `Ultima zi de forță a fost ${when} (${blockById(last).name}). Azi urmează ${blockById(next).name}.` };
  },
};

// ---------- Clipuri ----------
const videoUrl = clip => {
  const custom = Store.data.videos[clip];
  if (custom) return custom;
  return CLIPS[clip] ? `https://www.youtube.com/watch?v=${CLIPS[clip]}` : null;
};
