// Text helpers: non-breaking spaces, escaping, bilingual strings
import { LANG, setLANG } from '../state/store.js';

export const NBSP = ' ';
const SHORT = new Set(
  'в во к ко с со о об у и а но да не ни на по за из до от без для при про под над что как или это'.split(
    ' ',
  ),
);
function nb(s) {
  if (typeof s !== 'string' || s.indexOf(' ') < 0) return s;
  const w = s.split(' ');
  let o = '';
  for (let i = 0; i < w.length; i++) {
    o += w[i];
    if (i < w.length - 1) {
      const cur = w[i].toLowerCase().replace(/^[«„"(]+/, '');
      const nx = w[i + 1];
      const nxc = nx.toLowerCase().replace(/[.,!?:;»")]+$/, '');
      const glue =
        SHORT.has(cur) ||
        nx === '—' ||
        nxc === 'же' ||
        nxc === 'ли' ||
        nxc === 'бы' ||
        (/^\d+([.,]\d+)?$/.test(cur) && nx && !/^[\d–—→]/.test(nx));
      o += glue ? NBSP : ' ';
    }
  }
  return o;
}
function nbE(s) {
  if (typeof s !== 'string') return s;
  let r = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (
      ch === ' ' &&
      i > 0 &&
      /[0-9]/.test(s[i - 1]) &&
      i + 1 < s.length &&
      !/[0-9\s–—→]/.test(s[i + 1])
    )
      r += NBSP;
    else r += ch;
  }
  return r;
}
export const L = (ru, en) => (LANG === 'en' ? nbE(en === undefined ? ru : en) : nb(ru));
export const EN = () => LANG === 'en';
export function withLang(lg, fn) {
  const p = LANG;
  setLANG(lg);
  try {
    return fn();
  } finally {
    setLANG(p);
  }
}
export function plRu(n, a, b, c) {
  const x = Math.abs(n) % 100,
    y = x % 10;
  if (x > 10 && x < 20) return c;
  if (y > 1 && y < 5) return b;
  if (y === 1) return a;
  return c;
}
export const nEnt = n =>
  EN() ? `${n} ${n === 1 ? 'entry' : 'entries'}` : `${n} ${plRu(n, 'запись', 'записи', 'записей')}`;
export const nDay = n =>
  EN() ? `${n} ${n === 1 ? 'day' : 'days'}` : `${n} ${plRu(n, 'день', 'дня', 'дней')}`;

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const qt = s => (LANG === 'en' ? '“' + s + '”' : '«' + s + '»');
export const lc = s => (s ? s[0].toLowerCase() + s.slice(1) : s);
