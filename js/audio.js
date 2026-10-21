/* Sunete generate în browser (fără fișiere) și voce în română. */

const Sound = (() => {
  let ctx = null, master = null, voice = null;
  let on = true, voiceOn = true, volume = 0.8;

  function unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctx && AC) {
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (master) master.gain.value = volume;
    // Pe iPhone, sunetul merge și cu butonul de silențios activat.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    // Safari pornește vocea doar dacă prima rostire vine dintr-un click.
    if ('speechSynthesis' in window && !unlock.spoken) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
      unlock.spoken = true;
    }
  }

  function tone(freq, at, dur, type = 'sine', gain = 0.5) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const cues = {
    tick: () => tone(880, 0, 0.1, 'sine', 0.4),
    go: () => { tone(988, 0, 0.12, 'triangle'); tone(1319, 0.12, 0.28, 'triangle'); },
    effort: () => tone(740, 0, 0.18, 'triangle', 0.55),
    release: () => tone(440, 0, 0.24, 'sine', 0.5),
    hold: () => { tone(587, 0, 0.2, 'triangle', 0.5); tone(587, 0.22, 0.2, 'triangle', 0.4); },
    switch: () => { tone(587, 0, 0.14, 'triangle'); tone(784, 0.15, 0.2, 'triangle'); },
    rest: () => { tone(784, 0, 0.16, 'sine'); tone(523, 0.18, 0.3, 'sine'); },
    exerciseDone: () => { tone(523, 0, 0.16, 'triangle'); tone(659, 0.15, 0.16, 'triangle'); tone(784, 0.3, 0.36, 'triangle'); },
    sessionDone: () => [523, 659, 784, 1047, 784, 1047].forEach((f, n) => tone(f, n * 0.15, n === 5 ? 0.8 : 0.2, 'triangle', 0.5)),
  };

  function play(name) {
    if (!on || !ctx || !cues[name]) return;
    if (ctx.state === 'suspended') ctx.resume();
    cues[name]();
  }

  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const all = speechSynthesis.getVoices();
    voice = all.find(v => /^ro([-_]|$)/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  }

  function say(text) {
    if (!on || !voiceOn || !voice || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 1.05;
    u.volume = Math.min(1, volume + 0.1);
    speechSynthesis.speak(u);
  }

  function hush() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

  function configure(s) {
    on = s.sound; voiceOn = s.voice; volume = s.volume;
    if (master) master.gain.value = volume;
  }

  return { unlock, play, say, hush, configure, hasVoice: () => !!voice, get on() { return on; } };
})();
