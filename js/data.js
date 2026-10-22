/* Programul, transcris din „00 - Program postura - ghid exercitii.pdf”. */

const PROGRAM = {
  title: 'Program corectare posturală',
  start: '2026-10-22',
  days: 182, // 6 luni: 22 oct 2026 – 21 apr 2027
  length: '6 luni',
  reminderHour: 8,
};

// Clipurile YouTube din PDF. La 12, 19 și 23 PDF-ul are butonul, dar nu are link (se pot adăuga din site).
const CLIPS = {
  '01': 'V_j6DSZJXgQ', '02': 'ngBNYxm-GV8', '03': 'Skj91iQDnMo', '04': 'l5VnQ6XGB1E',
  '05': 'FOOzsJNpoNg', '06': 'C4N7UNPIYys', '07': 'C3BpWmc6T7Q', '08': 'RSZ1-BGlmTA',
  '09': 'FN4PF4Zp4KI', '10': 'zj62wgaeKzw', '11': 'vkWKUSSXJ4k', '12': null,
  '13': 'f9fOgJ3l140', '14': 't9VPQ2z-AAU', '15': '8YS2R_XskW0', '16': 'fpAsy-h_JEE',
  '17': 'oE2IFwQCiGs', '18': '7VvSKzoFUOI', '19': null, '20': 'h_7fWi6dUoI',
  '21': 'maS-bpp-sOE', '22': 'ejt55ebHkk0', '23': null, '24': 'Z45qFYrajwU',
};

// O fază = [etichetă, secunde, ton, indicație].
// Ton: effort = încordezi / mergi, release = revii / te relaxezi, hold = stai nemișcat.
const contractStretch = s => [
  ['Contracție', s, 'effort', 'Încordezi mușchiul întins'],
  ['Întindere', s, 'release', 'Te relaxezi și intri mai adânc'],
];
const goBack = (s, a = 'Mergi', b = 'Revii') => [[a, s, 'effort', ''], [b, s, 'release', '']];
const hold = s => [['Ții', s, 'hold', 'Stai nemișcat în întindere']];

const BLOCKS = [
  {
    id: 'stretch', num: 1, name: 'Stretching', full: 'Stretching și mobilizări corective', color: 'teal',
    when: 'Zilnic', clips: '01–11', rest: 0, restText: 'Fără pauză — treci direct la următorul exercițiu',
    exercises: [
      { id: '01', name: 'Piriformis – self massage cu minge', equip: 'Minge de masaj',
        sets: [1, 1], reps: [1, 1], sides: true, repsText: '4 min / parte', tempoText: 'Lent',
        phases: [['Masaj lent', 240, 'hold', 'Rulezi mingea lent']], videos: [['01']] },
      { id: '02', name: 'Foam roller coapse – față și lateral', equip: 'Foam roller',
        sets: [1, 1], reps: [12, 12], sides: true, repsText: '12 rulări / parte', tempoText: '5 sec – 5 sec',
        phases: goBack(5, 'Rulezi', 'Revii'), videos: [['02']] },
      { id: '03', name: 'Mobilizare toracică pe foam roller', equip: 'Foam roller',
        sets: [1, 1], reps: [3, 3], rounds: 6, repsText: '3 rep × 6 puncte', tempoText: '3 sec – 3 sec',
        phases: goBack(3), videos: [['03']] },
      { id: '04', name: 'Neck extensors stretch (suboccipitali)',
        sets: [1, 1], reps: [5, 5], repsText: '5', tempoText: '5 sec contracție → 5 sec întindere',
        phases: contractStretch(5), videos: [['04']] },
      { id: '05', name: 'Pec minor stretch pe saltea', equip: 'Saltea',
        sets: [1, 1], reps: [5, 5], sides: true, repsText: '5 / parte', tempoText: '5 sec contracție → 5 sec întindere',
        phases: contractStretch(5), videos: [['05']] },
      { id: '06', name: 'Trapez', warn: 'Doar partea STÂNGĂ',
        sets: [1, 1], reps: [5, 5], repsText: '5', tempoText: '5 sec contracție → 5 sec întindere',
        phases: contractStretch(5), videos: [['06']] },
      { id: '07', name: 'QL stretch pe swissball', warn: 'Doar partea STÂNGĂ', equip: 'Swissball',
        sets: [1, 1], reps: [1, 2], repGap: 10, repsText: '1–2', tempoText: 'Ții 60 sec',
        phases: hold(60), videos: [['07']] },
      { id: '08', name: 'Hip flexor stretch la perete', note: 'La perete sau pe canapea',
        sets: [1, 1], reps: [1, 1], sides: true, repsText: '1 / parte', tempoText: 'Ții 60 sec',
        phases: hold(60), videos: [['08']] },
      { id: '09', name: 'Adductor stretch',
        sets: [1, 1], reps: [20, 20], sides: true, repsText: '20 / parte', tempoText: '3 sec',
        phases: [['Întindere', 3, 'effort', '']], videos: [['09']] },
      { id: '10', name: 'Pigeon stretch',
        sets: [1, 1], reps: [5, 5], repsText: '5', tempoText: '10 sec contracție → 10 sec întindere',
        phases: contractStretch(10), videos: [['10']] },
      { id: '11', name: 'Butterfly stretch',
        sets: [1, 1], reps: [5, 5], repsText: '5', tempoText: '10 sec contracție → 10 sec întindere',
        phases: contractStretch(10), videos: [['11']] },
    ],
  },
  {
    id: 'activare', num: 2, name: 'Activare', full: 'Activare', color: 'orange',
    when: 'Zilnic · după stretching / înainte de antrenament', clips: '12–18', rest: 30, restText: 'Pauză 30 sec între seturi',
    exercises: [
      { id: '12', name: 'Rotat umeri în perete',
        sets: [1, 2], reps: [5, 5], sides: true, repsText: '5 / parte', tempoText: '5 sec – 5 sec',
        phases: goBack(5), videos: [['12']] },
      { id: '13', name: 'Vacuum abdominal',
        sets: [1, 2], reps: [10, 10], repsText: '10', tempoText: '5 sec tragi – 5 sec menții – 5 sec relaxare',
        phases: [['Tragi', 5, 'effort', 'Tragi abdomenul'], ['Menții', 5, 'hold', 'Ții abdomenul tras'], ['Relaxare', 5, 'release', 'Te relaxezi']],
        videos: [['13']] },
      { id: '14', name: 'Lower abdominal', note: 'Variantă la perete: clipul 15',
        sets: [1, 2], reps: [15, 20], repsText: '15–20', tempoText: '3 sec – 3 sec',
        phases: goBack(3), videos: [['14', 'Varianta 1'], ['15', 'La perete']] },
      { id: 'adductori', name: 'Adductori – strângi mingea între genunchi', note: 'Nu ai clip pentru acest exercițiu',
        sets: [1, 2], reps: [10, 10], repsText: '10', tempoText: '5 sec contracție → 5 sec relaxare',
        phases: [['Strângi mingea', 5, 'effort', 'Mingea între genunchi'], ['Relaxare', 5, 'release', '']], videos: [] },
      { id: '16', name: 'Retracții omoplați – spatele pe foam roller', equip: 'Foam roller',
        sets: [1, 1], reps: [30, 30], timed: true, repsText: '3 min', tempoText: '3 sec contracție → 3 sec relaxare',
        phases: [['Contracție', 3, 'effort', 'Strângi omoplații'], ['Relaxare', 3, 'release', '']], videos: [['16']] },
      { id: '17', name: 'Ramat cu baston de lemn', equip: 'Baston de lemn',
        sets: [1, 2], reps: [10, 10], repsText: '10', tempoText: '3 sec – 3 sec – 3 sec',
        phases: [['Tragi', 3, 'effort', ''], ['Ții', 3, 'hold', ''], ['Revii', 3, 'release', '']], videos: [['17']] },
      { id: '18', name: 'Forward ball roll', equip: 'Swissball',
        sets: [1, 2], reps: [10, 10], repsText: '10', tempoText: '3 sec – 3 sec',
        phases: goBack(3, 'Rulezi înainte', 'Revii'), videos: [['18']] },
    ],
  },
  {
    id: 's1', num: 3, name: 'Strength 1', full: 'Strength 1', color: 'blue', strength: true,
    when: 'Zi de forță · după stretching + activare', clips: '19–23', rest: 120, restText: 'Pauză 2 min între seturi',
    exercises: [
      { id: '19', name: 'Wall squat pe swissball', note: 'Variantă cu bandă elastică: clipul 20', equip: 'Swissball',
        sets: [2, 2], reps: [10, 12], repsText: '10–12', tempoText: '3 sec – 3 sec',
        phases: goBack(3, 'Cobori', 'Urci'), videos: [['19', 'Swissball'], ['20', 'Cu bandă elastică']] },
      { id: '21', name: 'Low bar pull ups', note: 'La bară: clipul 21 · la TRX: clipul 22', equip: 'Bară sau TRX',
        sets: [2, 2], reps: [10, 10], repsText: '10', tempoText: '3 sec – 3 sec',
        phases: goBack(3, 'Tragi', 'Cobori'), videos: [['21', 'La bară'], ['22', 'La TRX']] },
      { id: '23', name: 'Dead bug pe swissball', equip: 'Swissball',
        sets: [2, 2], reps: [12, 12], alternate: true, repsText: '12 / parte', tempoText: '3 sec – 3 sec',
        phases: goBack(3), videos: [['23']] },
    ],
  },
  {
    id: 's2', num: 3, name: 'Strength 2', full: 'Strength 2', color: 'purple', strength: true,
    when: 'Zi de forță · după stretching + activare', clips: '24 și 18', rest: 120, restText: 'Pauză 2 min între seturi',
    exercises: [
      { id: 'fandare', name: 'Fandare statică', note: 'Bodyweight · nu ai clip pentru acest exercițiu',
        sets: [2, 2], reps: [5, 5], repsText: '5', tempoText: '3 sec – 3 sec',
        phases: goBack(3, 'Cobori', 'Urci'), videos: [] },
      { id: '24', name: 'Fluturări la cable machine', note: '15–20 kg sau mai mult', equip: 'Cable machine',
        sets: [2, 2], reps: [10, 12], weight: 15, repsText: '10–12', tempoText: '3 sec – 3 sec',
        phases: goBack(3), videos: [['24']] },
      { id: '18b', name: 'Forward ball roll', note: 'Același clip ca la Activare', equip: 'Swissball',
        sets: [2, 2], reps: [10, 10], repsText: '10', tempoText: '3 sec – 3 sec',
        phases: goBack(3, 'Rulezi înainte', 'Revii'), videos: [['18']] },
    ],
  },
];

const EQUIPMENT = [
  'Minge de masaj', 'Foam roller', 'Swissball', 'Saltea',
  'Baston de lemn', 'Bară sau TRX', 'Cable machine', 'Bandă elastică (doar clipul 20)',
];

const TEMPO_LEGEND = [
  ['Contracție → întindere', 'încordezi mușchiul întins (5 sau 10 sec), apoi te relaxezi și intri mai adânc în întindere (5 sau 10 sec) = 1 repetare'],
  ['3 sec – 3 sec', '3 sec la mers, 3 sec la revenire'],
  ['3 sec – 3 sec – 3 sec', 'tragi 3 sec · ții 3 sec · revii 3 sec'],
  ['Ții 60 sec', 'stai nemișcat în întindere 60 sec'],
  ['/ parte', 'pe fiecare parte (stânga și dreapta)'],
];

const blockById = id => BLOCKS.find(b => b.id === id);
const setsText = ex => ex.sets[0] === ex.sets[1] ? `${ex.sets[0]}` : `${ex.sets[0]}–${ex.sets[1]}`;
