// v7 data model: my symptoms, the daily check-in, medications, coincidences and the doctor summary.
// Coincidences use only days with a check-in, so a missing day is "no data", never "no symptom".
import { GROUPS, inGroup, symName } from '../core/catalog.js';
import { onPeriod, isHot, weatherOn, hsh } from '../core/context.js';
import { DAY, addD, dk, fromDk, fRange, now, todayK } from '../core/dates.js';
import { E } from '../core/entries.js';
import { uid } from '../core/storage.js';
import { L, plRu, EN, cap } from '../core/text.js';
import { ST } from '../state/store.js';

/** Catalog for onboarding, ordered by how often people with MS name it. */
export const CATALOG = [
  'numb',
  'tingle',
  'fatigue',
  'fog',
  'legs',
  'balance',
  'vision',
  'pain',
  'spasm',
  'bladder',
  'sleep',
  'mood',
  'speech',
];
const EXTRA = {
  mood: ['настроение', 'mood'],
  speech: ['речь', 'speech'],
  numb: ['онемение', 'numbness'],
  balance: ['равновесие', 'balance'],
  vision: ['зрение', 'vision'],
  pain: ['боль', 'pain'],
  spasm: ['спазмы', 'spasms'],
  bladder: ['мочевой пузырь', 'bladder'],
  sleep: ['сон', 'sleep'],
  legs: ['слабость в ногах', 'weak legs'],
  tingle: ['покалывание', 'tingling'],
  fatigue: ['усталость', 'fatigue'],
  fog: ['туман в голове', 'brain fog'],
};
export const MAX_MY = 5;

/** Short lowercase name used in v7 lists and questions. */
export function myName(k) {
  if (EXTRA[k]) return L(EXTRA[k][0], EXTRA[k][1]);
  if (ST.custom && ST.custom[k]) return ST.custom[k];
  return symName(k).toLowerCase();
}

export const FEEL = [
  [1, ['тяжело', 'very hard']],
  [2, ['хуже обычного', 'worse than usual']],
  [3, ['как обычно', 'as usual']],
  [4, ['лучше обычного', 'better than usual']],
  [5, ['хорошо', 'good']],
];
export const feelName = v => {
  const f = FEEL.find(x => x[0] === v);
  return f ? L(f[1][0], f[1][1]) : '';
};
export const LEVEL = [
  [0, ['нет', 'no']],
  [1, ['слабо', 'mild']],
  [2, ['заметно', 'noticeable']],
  [3, ['сильно', 'strong']],
];
export const levelName = v => {
  const f = LEVEL.find(x => x[0] === v);
  return f ? L(f[1][0], f[1][1]) : '';
};
export const SCHED = [
  ['daily', ['каждый день', 'every day']],
  ['other', ['через день', 'every other day']],
  ['need', ['по необходимости', 'as needed']],
];
export const schedName = s => {
  const f = SCHED.find(x => x[0] === s);
  return f ? L(f[1][0], f[1][1]) : '';
};

// ---- state helpers ----
export function ensure7() {
  if (!ST.v7)
    ST.v7 = { onboarded: false, my: [], input: 'mixed', simple: false, daily: {}, dismiss: {} };
  if (!ST.v7.daily) ST.v7.daily = {};
  if (!ST.v7.dismiss) ST.v7.dismiss = {};
  if (!Array.isArray(ST.meds)) ST.meds = [];
  if (!Array.isArray(ST.questions)) ST.questions = [];
  return ST.v7;
}
export const V = () => ensure7();
export const day = k => V().daily[k] || null;
export function dayRec(k) {
  const d = V().daily;
  if (!d[k]) d[k] = { feel: null, sym: {}, med: {}, at: null, done: false };
  return d[k];
}
export const myList = () => V().my.slice(0, MAX_MY);
export const medList = () => ST.meds.filter(m => m && m.id);
export function addMed(name, sched) {
  const m = { id: uid(), name: name.trim(), sched: sched || 'daily' };
  ST.meds.push(m);
  return m;
}
export function addCustom(name) {
  const k = 'c_' + uid();
  ST.custom = ST.custom || {};
  ST.custom[k] = name.trim();
  return k;
}

/** Steps of today's check-in: feeling, then each of my symptoms, then each medication. */
export function steps() {
  return [
    { type: 'feel' },
    ...myList().map(k => ({ type: 'sym', k })),
    ...medList().map(m => ({ type: 'med', m })),
  ];
}
/** A day counts as checked once the feeling is set. */
export const isChecked = k => {
  const r = day(k);
  return !!(r && r.feel);
};

export function checkSentence(r) {
  if (!r || !r.feel) return '';
  const parts = [];
  for (const k of myList()) {
    const v = r.sym[k];
    if (typeof v === 'number') parts.push(myName(k) + ': ' + levelName(v));
  }
  const head = feelName(r.feel);
  const tail = parts.join(', ');
  return cap(head) + (tail ? '. ' + cap(tail) : '');
}

/** Copy yesterday's check-in onto today ("as yesterday"). */
export function copyYesterday(k) {
  const y = day(dk(addD(fromDk(k), -1)));
  if (!y || !y.feel) return false;
  const r = dayRec(k);
  r.feel = y.feel;
  r.sym = Object.assign({}, y.sym);
  r.at = Date.now();
  r.done = true;
  return true;
}

// ---- worse than usual ----
export function startWorse(k) {
  if (!ST.worse) ST.worse = { start: k, from: 'v7' };
}
export function worseDay() {
  if (!ST.worse) return 0;
  return Math.round((fromDk(todayK()) - fromDk(ST.worse.start)) / DAY) + 1;
}
export function endWorse() {
  if (ST.worse) {
    ST.worseHist = ST.worseHist || [];
    ST.worseHist.push({ start: ST.worse.start, end: todayK() });
    ST.worse = null;
  }
}
export const BAD_DAY =
  /(плохой день|мне плохо|мне хуже|хуже обычного|тяжел(о|ый) день|совсем плохо|bad day|i feel (bad|awful|terrible|worse)|feeling (bad|awful|worse)|worse than usual|rough day)/;
export const OWN_CAUSE =
  /(из-за|это (овуляц|месячн|жар|стресс|недосып)|потому что|because|due to|it'?s (my )?(ovulation|period|the heat|stress))/;

// ---- coincidences ----
const PERIODS = [7, 14, 30];
export { PERIODS };
function daysBack(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dk(addD(now(), -i)));
  return out;
}
function foodGroupsOn(k) {
  const set = new Set();
  for (const e of E()) {
    if (e.d !== k || e.kind !== 'food' || !e.items) continue;
    for (const g of Object.keys(GROUPS)) if (e.items.some(i => inGroup(i, g))) set.add(g);
  }
  return set;
}
function factors() {
  const f = [];
  if (weatherOn() || ST.demo)
    f.push({
      id: 'heat',
      name: L('жара', 'heat'),
      yes: L('в жаркие дни', 'on hot days'),
      more: L('Совпало чаще в жару', 'Happened more often in the heat'),
      test: hotDay,
    });
  if (ST.cycle && ST.cycle !== 'off')
    f.push({
      id: 'period',
      name: L('месячные', 'period'),
      yes: L('во время месячных', 'during the period'),
      more: L('Совпало чаще во время месячных', 'Happened more often during the period'),
      test: k => onPeriod(fromDk(k)),
    });
  for (const g of Object.keys(GROUPS)) {
    const n = GROUPS[g].n;
    f.push({
      id: 'food_' + g,
      food: true,
      name: L(n[0], n[1]),
      yes: L('в дни, когда было ' + n[0], 'on days with ' + n[1]),
      more: L('Совпало чаще в дни, когда было ' + n[0], 'Happened more often on days with ' + n[1]),
      calm: L(
        'В ваших записях за этот период связи с «' + n[0] + '» не видно',
        'Your entries for this period show no link with ' + n[1],
      ),
      test: k => foodGroupsOn(k).has(g),
    });
  }
  return f;
}
export function coincidences7(n) {
  const all = daysBack(n);
  const checked = all.filter(isChecked);
  const need = Math.min(10, n);
  const res = {
    n,
    checked: checked.length,
    need,
    enough: checked.length >= need,
    found: [],
    calm: [],
    flat: [],
  };
  if (!res.enough) return res;
  for (const s of myList()) {
    const known = checked.filter(k => typeof day(k).sym[s] === 'number');
    if (known.length < need) continue;
    const withS = known.filter(k => day(k).sym[s] > 0);
    if (withS.length === known.length) {
      res.flat.push({ s, days: known.length });
      continue;
    }
    for (const f of factors()) {
      const yes = known.filter(f.test),
        no = known.filter(k => !f.test(k));
      const minN = f.food ? 7 : 5; // food is random day to day, so it needs more days before any card
      if (yes.length < minN || no.length < minN) continue;
      const a = yes.filter(k => day(k).sym[s] > 0).length,
        b = no.filter(k => day(k).sym[s] > 0).length;
      const pa = a / yes.length,
        pb = b / no.length;
      const item = {
        s,
        f,
        a,
        ya: yes.length,
        b,
        nb: no.length,
        diff: pa - pb,
        few: yes.length < 8 || no.length < 8,
      };
      if (pa - pb >= (f.food ? 0.35 : 0.3)) res.found.push(item);
      else if (f.food && Math.abs(pa - pb) < 0.15) res.calm.push(item);
    }
  }
  res.found.sort((x, y) => y.diff - x.diff);
  res.found = res.found.slice(0, 4);
  res.calm = res.calm.slice(0, 1);
  return res;
}

// ---- doctor summary ----
function ranges(keys) {
  const out = [];
  let cur = null;
  for (const k of keys) {
    if (cur && Math.round((fromDk(k) - fromDk(cur[1])) / DAY) === 1) cur[1] = k;
    else {
      cur = [k, k];
      out.push(cur);
    }
  }
  return out;
}
export function summary7(n) {
  const all = daysBack(n);
  const checked = all.filter(isChecked);
  const feel = {};
  for (const k of checked) feel[day(k).feel] = (feel[day(k).feel] || 0) + 1;
  const worse = ranges(checked.filter(k => day(k).feel <= 2)).map(r =>
    fRange(fromDk(r[0]), fromDk(r[1])),
  );
  const meds = medList().map(m => {
    let took = 0,
      due = 0;
    for (const k of checked) {
      const st = day(k).med[m.id];
      if (!st || st.st === 'need') continue;
      due++;
      if (st.st === 'took') took++;
    }
    return { m, took, due };
  });
  const sym = myList()
    .map(s => ({ s, days: checked.filter(k => day(k).sym[s] > 0).length }))
    .sort((a, b) => b.days - a.days);
  const notes = E().filter(
    e => all.includes(e.d) && (e.kind === 'sym' || e.kind === 'note'),
  ).length;
  return {
    n,
    from: fromDk(all[0]),
    to: fromDk(all[all.length - 1]),
    checked: checked.length,
    feel,
    worse,
    meds,
    sym,
    notes,
    questions: (ST.questions || []).filter(q => !q.done).map(q => q.text || q),
  };
}
export const nDays = n =>
  EN() ? n + (n === 1 ? ' day' : ' days') : n + ' ' + plRu(n, 'день', 'дня', 'дней');
export function summaryText7(s) {
  const lines = [];
  lines.push(L('Сводка ', 'Summary ') + fRange(s.from, s.to) + ', ' + nDays(s.n));
  const f = FEEL.slice()
    .reverse()
    .filter(x => s.feel[x[0]])
    .map(x => L(x[1][0], x[1][1]) + ' ' + s.feel[x[0]]);
  if (f.length) lines.push(L('Самочувствие (дней): ', 'Feeling (days): ') + f.join(', '));
  if (s.worse.length) lines.push(L('Хуже обычного: ', 'Worse than usual: ') + s.worse.join(', '));
  for (const m of s.meds)
    if (m.due)
      lines.push(
        m.m.name +
          ': ' +
          L('принято ' + m.took + ' из ' + m.due, 'taken ' + m.took + ' of ' + m.due),
      );
  lines.push(
    L('Дней с отметкой: ', 'Days with a check-in: ') + s.checked + L(' из ', ' of ') + s.n,
  );
  for (const x of s.sym)
    lines.push(myName(x.s) + ': ' + x.days + L(' из ', ' of ') + s.checked + L(' дней', ' days'));
  if (s.questions.length) {
    lines.push('');
    lines.push(L('Вопросы к врачу:', 'Questions for the doctor:'));
    for (const q of s.questions) lines.push('– ' + q);
  }
  lines.push('');
  lines.push(
    L(
      'Из записей в приложении Tiho. Не медицинский вывод',
      'From entries in the Tiho app. Not a medical conclusion',
    ),
  );
  return lines.join('\n');
}

// ---- sample data ----
/** Well-mixed 0..1 value for sample data (FNV alone barely changes between neighbouring dates). */
function rnd(str) {
  let h = Math.floor(hsh(str) * 4294967295) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
/** In the sample, hot days are simulated; outside it only real weather counts. */
export const hotDay = k => (ST.demo ? rnd('hot' + k) < 0.45 : isHot(fromDk(k)));
const BACKUP = 'msapp.v7.backup';
export function enterSample() {
  try {
    localStorage.setItem(BACKUP, JSON.stringify(ST));
  } catch (e) {}
  const v = ensure7();
  ST.demo = true;
  ST.city = ST.city || 'Tbilisi';
  v.onboarded = true;
  v.my = ['fatigue', 'numb', 'fog'];
  ST.meds = [
    { id: 'm_cop', name: L('копаксон', 'Copaxone'), sched: 'other' },
    { id: 'm_d', name: L('витамин D', 'vitamin D'), sched: 'daily' },
  ];
  v.daily = {};
  ST.entries = [];
  ST.worse = null;
  ST.worseHist = [];
  ST.cycle = 'manual';
  ST.cyclePaused = false;
  ST.periodMarks = [dk(addD(now(), -24)), dk(addD(now(), -2))];
  const food = EN()
    ? [
        ['oatmeal', 'latte'],
        ['eggs', 'tea'],
        ['pasta', 'salad'],
        ['soup', 'bread'],
        ['rice', 'fish'],
        ['yogurt', 'banana'],
      ]
    : [
        ['овсянка', 'кофе с молоком'],
        ['яйца', 'чай'],
        ['паста', 'салат'],
        ['суп', 'хлеб'],
        ['рис', 'рыба'],
        ['йогурт', 'банан'],
      ];
  for (let i = 27; i >= 0; i--) {
    const d = addD(now(), -i),
      k = dk(d);
    const r = dayRec(k);
    if (i > 0 && rnd('skip' + k) < 0.12) {
      delete v.daily[k];
      continue;
    }
    const hot = hotDay(k);
    const bad = i >= 5 && i <= 7;
    r.feel = bad ? (i === 6 ? 1 : 2) : rnd('f' + k) < 0.2 ? 4 : 3;
    r.sym.fatigue = bad ? 3 : rnd('a' + k) < 0.6 ? 2 : 1;
    r.sym.numb = hot ? (rnd('n' + k) < 0.85 ? 2 : 0) : rnd('n' + k) < 0.1 ? 1 : 0;
    r.sym.fog = onPeriod(d) ? (rnd('g' + k) < 0.8 ? 2 : 0) : rnd('g' + k) < 0.2 ? 1 : 0;
    r.med.m_cop = { st: i % 2 ? 'need' : 'took', at: d.setHours(8, 10, 0, 0) };
    r.med.m_d = { st: 'took', at: d.getTime() };
    r.at = d.setHours(8, 10, 0, 0);
    r.done = true;
    if (i === 0 && now().getHours() < 14) continue;
    const f = food[Math.floor(rnd('m' + k) * food.length)];
    ST.entries.push({
      id: uid(),
      kind: 'food',
      items: f,
      meal: 'lunch',
      words: f.join(', '),
      at: d.setHours(13, 40, 0, 0),
      d: k,
    });
  }
  ST.worseHist.push({ start: dk(addD(now(), -7)), end: dk(addD(now(), -5)) });
  ST.entries.push({
    id: uid(),
    kind: 'sym',
    key: 'numb',
    s: 1,
    ctx: ['shower'],
    words: L('после душа немеют кончики', 'fingertips go numb after a shower'),
    at: addD(now(), 0).setHours(9, 30, 0, 0),
    d: todayK(),
  });
  ST.entries.sort((a, b) => b.at - a.at);
}
export function leaveSample() {
  let o = null;
  try {
    o = JSON.parse(localStorage.getItem(BACKUP) || 'null');
    localStorage.removeItem(BACKUP);
  } catch (e) {}
  return o;
}
