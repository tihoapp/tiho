// Dates: app clock (shiftable for testing), day keys, formatting
import { EN, L } from './text.js';
import { ST } from '../state/store.js';

// ---- dates (app clock can be shifted for testing) ----
export const DAY = 864e5;
export const pad = n => String(n).padStart(2, '0');
export const now = () => new Date(Date.now() + ((ST && ST.offset) || 0));
export const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromDk = k => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};
export const addD = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const ddiff = (a, b) => Math.round((fromDk(dk(a)) - fromDk(dk(b))) / DAY);
export const todayK = () => dk(now());
export const MRG = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
export const MRN = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];
export const MEN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const WRU = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];
export const WEN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const fDM = d =>
  EN() ? `${MEN[d.getMonth()]} ${d.getDate()}` : `${d.getDate()} ${MRG[d.getMonth()]}`;
export const fHdr = d =>
  EN()
    ? `${WEN[d.getDay()]}, ${MEN[d.getMonth()].toLowerCase()} ${d.getDate()}`
    : `${WRU[d.getDay()]}, ${d.getDate()} ${MRG[d.getMonth()]}`;

export function fT(d) {
  const h = d.getHours(),
    m = pad(d.getMinutes());
  if (EN()) {
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
  }
  return `${pad(h)}:${m}`;
}
export function fRange(a, b) {
  if (dk(a) === dk(b)) return fDM(a);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
    return EN()
      ? `${MEN[a.getMonth()]} ${a.getDate()}–${b.getDate()}`
      : `${a.getDate()}–${b.getDate()} ${MRG[a.getMonth()]}`;
  return `${fDM(a)} – ${fDM(b)}`;
}

export function relDT(d) {
  const n = ddiff(now(), d);
  const t = fT(d);
  if (n === 0) return L('сегодня', 'today') + ', ' + t;
  if (n === 1) return L('вчера', 'yesterday') + ', ' + t;
  if (n === 2) return L('позавчера', '2 days ago') + ', ' + t;
  return fDM(d) + ', ' + t;
}
export function dayTitle(d) {
  const n = ddiff(now(), d);
  if (n === 0) return L('сегодня', 'today');
  if (n === 1) return L('вчера', 'yesterday');
  if (n === 2) return L('позавчера', '2 days ago');
  return EN() ? WEN[d.getDay()] : WRU[d.getDay()];
}
