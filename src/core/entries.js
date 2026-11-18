// Entries: create, sort and query diary records
import { RES, cmpName, ctxText, mealName, moveName, norm, sName, symName } from './catalog.js';
import { ddiff, fromDk, now, todayK } from './dates.js';
import { EN, L, cap, plRu, qt } from './text.js';
import { ST } from '../state/store.js';

// ---- entries ----
export const E = () => ST.entries;
export const symEnts = k => E().filter(e => e.kind === 'sym' && (!k || e.key === k));
export const onDay = k => E().filter(e => e.d === k);

export function inWorse(k) {
  if (ST.worseHist.some(w => k >= w.start && k <= w.end)) return true;
  return !!(ST.worse && k >= ST.worse.start && k <= todayK());
}

export const worseDayN = () => (ST.worse ? ddiff(now(), fromDk(ST.worse.start)) + 1 : 0);
export function entrySub(e) {
  if (e.kind === 'sym') {
    const p = [];
    if (e.cmp) p.push(cap(cmpName(e.cmp)));
    else if (e.s) p.push(cap(sName(e.s)));
    if (e.better) p.push(L('лучше, чем вчера', 'better than yesterday'));
    for (const c of e.ctx || []) p.push(ctxText(c));
    if (!p.length && e.words && norm(e.words) !== norm(symName(e.key))) return qt(e.words);
    if (!p.length) return L('Сила не указана', 'Strength not set');
    return cap(p.join(', '));
  }
  if (e.kind === 'food') return mealName(e.meal);
  if (e.kind === 'move')
    return e.src === 'health' ? L('из Apple Health', 'from Apple Health') : L('вручную', 'manual');
  if (e.kind === 'med')
    return e.src === 'health'
      ? L('принято, из Apple Health', 'taken, from Apple Health')
      : L('принято', 'taken');
  if (e.kind === 'res') return L(RES[e.v][0], RES[e.v][1]);
  if (e.kind === 'gone') return L('прошло', 'gone');
  if (e.kind === 'period') return L('отмечено вручную', 'marked manually');
  if (e.kind === 'pause') return L('без записей по вашему выбору', 'no entries, your call');
  return e.words ? qt(e.words) : '';
}
export function entryTitle(e) {
  if (e.kind === 'sym' || e.kind === 'gone') return symName(e.key);
  if (e.kind === 'food')
    return e.items && e.items.length
      ? e.items.join(', ')
      : e.words
        ? qt(e.words)
        : L('без подписи', 'no caption');
  if (e.kind === 'move')
    return (
      moveName(e.what) +
      (e.min
        ? EN()
          ? `, ${e.min} min`
          : `, ${e.min} ${plRu(e.min, 'минута', 'минуты', 'минут')}`
        : '')
    );
  if (e.kind === 'med') return e.name;
  if (e.kind === 'res') return L('ресурс', 'energy');
  if (e.kind === 'period') return L('месячные начались', 'period started');
  if (e.kind === 'pause') return L('пауза', 'pause');
  return L('заметка', 'note');
}
