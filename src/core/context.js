// Context: weather, steps and cycle (simulated outside the sample)
import { addD, ddiff, dk, fromDk, now, todayK } from './dates.js';
import { EN, L, NBSP } from './text.js';
import { ST } from '../state/store.js';

// ---- simulated context (no Apple Health or weather in the prototype) ----
export function hsh(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
export const weatherOn = () => !!(ST.geo || ST.city);
// real temperature from Open-Meteo; the simulated one only for sample data
export function tempFor(d) {
  if (ST.demo) return tempSim(d);
  if (!ST.wx) return null;
  const k = dk(d);
  if (k === todayK() && ST.wx.cur && Date.now() - ST.wx.cur.at < 3 * 36e5) return ST.wx.cur.t;
  const v = ST.wx.days && ST.wx.days[k];
  return v == null ? null : v;
}
function tempSim(d) {
  const base = [6, 8, 12, 17, 22, 27, 30, 30, 25, 18, 12, 7][d.getMonth()];
  return Math.round(base + (hsh('t' + dk(d) + (ST.city || 'geo')) - 0.5) * 9);
}
export const isHot = d => weatherOn() && tempFor(d) >= 26;

export function stepsFor(d) {
  const full = 2500 + Math.round(hsh('s' + dk(d)) * 6500);
  if (dk(d) === todayK()) {
    const h = now().getHours() + now().getMinutes() / 60;
    return Math.round(full * Math.min(1, Math.max(0, (h - 7) / 14)));
  }
  return full;
}
export const sleepFor = d => 5.1 + hsh('z' + dk(d)) * 3.2;
export const fmtNum = n =>
  EN() ? n.toLocaleString('en-US') : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

export function periodStarts() {
  if (ST.cycle === 'off' || ST.cyclePaused) return [];
  if (ST.cycle === 'manual') return ST.periodMarks.slice().sort().reverse();
  if (!ST.health || !ST.seed) return [];
  const seed = fromDk(ST.seed),
    t = fromDk(todayK()),
    out = [];
  let d = seed;
  while (d <= t) {
    out.push(dk(d));
    d = addD(d, 28);
  }
  let b = addD(seed, -28);
  for (let i = 0; i < 5; i++) {
    out.push(dk(b));
    b = addD(b, -28);
  }
  return out.sort().reverse();
}
function cycleDay(d) {
  const k = dk(d);
  const s = periodStarts().find(x => x <= k);
  if (!s) return null;
  const n = ddiff(fromDk(k), fromDk(s)) + 1;
  return n > 45 ? null : n;
}
// period = start..end. Without an end mark: the current period stays open up to 10 days, past ones count as 5 days
export function periodOf(d) {
  const k = dk(d);
  const s = periodStarts().find(x => x <= k);
  if (!s) return null;
  const e = (ST.periodEnds || {})[s] || null;
  const n = ddiff(fromDk(k), fromDk(s)) + 1;
  const open = !e && s === periodStarts()[0] && ddiff(fromDk(todayK()), fromDk(s)) < 10;
  return { s, e, n, open };
}
export const onPeriod = d => {
  const p = periodOf(d);
  if (!p) return false;
  if (p.e) return dk(d) <= p.e;
  if (p.open) return dk(d) <= todayK();
  return p.n <= 5;
};
export const periodLen = s => {
  const e = (ST.periodEnds || {})[s];
  return e ? ddiff(fromDk(e), fromDk(s)) + 1 : null;
};
export function prePeriod(k) {
  const st = periodStarts();
  return st.some(s => {
    const n = ddiff(fromDk(s), fromDk(k));
    return n >= 1 && n <= 3;
  });
}
export function cycleTile() {
  if (ST.cycle === 'off' || ST.cyclePaused) return null;
  const c = cycleDay(now());
  if (c === null) return { v: L('нет', 'none'), l: L('данных', 'data'), none: true };
  if (onPeriod(now())) return { v: String(c), l: L('день месячных', 'period day'), period: true };
  return { v: String(c), l: L('день цикла', 'cycle day') };
}
