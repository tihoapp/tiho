// Local storage: load and save state on the device

// ---- storage ----
const KEY = 'msapp.v5';
let MEM = null;
export function defaults() {
  return {
    v: 1,
    onboarded: false,
    lang: 'en',
    theme: 'system',
    ai: 'device',
    symptoms: ['numb', 'fatigue', 'fog'],
    custom: {},
    main: 'numb',
    health: false,
    cycle: 'off',
    cyclePaused: false,
    periodMarks: [],
    seed: null,
    city: null,
    geo: false,
    photosKeep: true,
    comfort: { haptic: true, sound: false, badDay: true, morning: false },
    entries: [],
    worse: null,
    worseHist: [],
    worsePrompt: null,
    check: null,
    checks: [],
    visit: { date: null, noDate: false, notes: [] },
    questions: [],
    meds: [],
    dismiss: {},
    offset: 0,
    firstDay: null,
    voiceLang: 'ui',
    sumLang: 'ui',
    icloud: true,
    healthMed: false,
  };
}
export function loadS() {
  try {
    const r = localStorage.getItem(KEY);
    if (r) {
      const o = JSON.parse(r);
      return Object.assign(defaults(), o, {
        comfort: Object.assign(defaults().comfort, o.comfort || {}),
      });
    }
  } catch (e) {}
  return MEM || defaults();
}
export function saveS(s) {
  MEM = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch (e) {
    return false;
  }
}
let idc = 0;
export const uid = () =>
  'e' + Date.now().toString(36) + (idc++).toString(36) + Math.random().toString(36).slice(2, 5);
