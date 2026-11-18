// Actions: sheets, toasts and logging
import { ctxText, mealByTime, mealName, norm, sName, symName } from '../core/catalog.js';
import { DAY, addD, dk, fDM, fT, now, relDT } from '../core/dates.js';
import { E, symEnts } from '../core/entries.js';
import { analyze, parseCtx, parseWhen, strengthOf } from '../core/lexicon.js';
import { saveS, uid } from '../core/storage.js';
import { L, cap, lc, qt } from '../core/text.js';
import { html, useEffect } from '../lib/preact.js';
import { RR, ST, UI, setUI } from '../state/store.js';
import { answer } from '../ui/answers.js';
import { I } from '../ui/components.js';
import { toast } from '../ui/feedback.js';
import { openSheet } from '../ui/frame.js';
import { card, newSymptomAsk, notUnderstood } from '../ui/states.js';

export const rr = () => {
  if (RR) RR();
};
export function save() {
  const ok = saveS(ST);
  rr();
  return ok;
}
export function openSheetBase(name, p) {
  UI.sheet = Object.assign({ name, k: uid() }, p || {});
  if (UI.toast && UI.toast.where === 'main') UI.toast = null;
  rr();
}
export function closeSheetBase() {
  UI.sheet = null;
  if (UI.toast && UI.toast.where === 'sheet') UI.toast = null;
  rr();
}
function hideToast() {
  UI.toast = null;
  rr();
}
export function SheetToast() {
  const t = UI.toast;
  useEffect(() => {
    if (!t || (t.acts && t.acts.length)) return;
    const id = t.id;
    const h = setTimeout(() => {
      if (UI.toast && UI.toast.id === id) {
        UI.toast = null;
        rr();
      }
    }, 5000);
    return () => clearTimeout(h);
  }, [t && t.id]);
  if (!t) return null;
  return html`<div class="toast" role="status">
    <div class="tr">
      <span class="tic"><${I} n=${t.icon} /></span>
      <div class="tt">
        <p class="bs">${t.title}</p>
        ${t.sub ? html`<p class="c">${t.sub}</p>` : null}
      </div>
      <button class="tx" aria-label=${L('Скрыть', 'Dismiss')} onClick=${hideToast}>
        <${I} n="close" s=${20} />
      </button>
    </div>
    ${
      t.acts && t.acts.length
        ? html`<div class="ta">
            ${t.acts.map(
              a =>
                html`<button
                  class="tb"
                  onClick=${() => {
                    UI.toast = null;
                    a.fn();
                    rr();
                  }}
                >
                  ${a.l}
                </button>`,
            )}
          </div>`
        : null
    }
  </div>`;
}
export function sortE() {
  ST.entries.sort((a, b) => b.at - a.at);
}
export function addEntries(list) {
  for (const x of list) {
    x.id = x.id || uid();
    x.d = dk(new Date(x.at));
    x.made = Date.now();
    ST.entries.push(x);
  }
  sortE();
  return list.map(x => x.id);
}
export function removeIds(ids) {
  ST.entries = ST.entries.filter(x => !ids.includes(x.id));
}
export const undoAct = ids => ({
  l: L('отменить', 'undo'),
  fn: () => {
    removeIds(ids);
    save();
    toast({ title: L('Отменила, записи нет', 'Undone, nothing saved'), icon: 'undo' });
  },
});
export const fixAct = id => ({ l: L('исправить', 'edit'), fn: () => openSheet('rec', { id }) });
export const justNow = x => x.made && Date.now() - x.made < 120000;
export function whenOpts() {
  const n = now(),
    o = [
      { id: 'now', l: L('сейчас', 'now'), d: n },
      { id: 'hour', l: L('час назад', 'an hour ago'), d: new Date(n.getTime() - 36e5) },
    ];
  const at = (h, dd) => {
    const d = addD(n, -(dd || 0));
    d.setHours(h, 0, 0, 0);
    return d;
  };
  if (n.getHours() >= 10) o.push({ id: 'morning', l: L('утром', 'this morning'), d: at(9) });
  if (n.getHours() >= 15) o.push({ id: 'day', l: L('днем', 'this afternoon'), d: at(14) });
  if (n.getHours() >= 21) o.push({ id: 'eve', l: L('вечером', 'this evening'), d: at(20) });
  o.push({ id: 'yday', l: L('вчера вечером', 'last night'), d: at(20, 1) });
  return o;
}

// ---- logging ----
function symNameFrom(v) {
  let t = ' ' + v.replace(/[.!?]+$/, '') + ' ';
  t = t.replace(/\s(после|after|из-за|because)\s.*$/i, ' ');
  t = t.replace(
    /(^|\s)(сегодня|вчера|позавчера|утром|с утра|днем|вечером|ночью|сейчас|опять|снова|немного|чуть|слегка|слабо|заметно|сильно|очень|жутко|ужасно|today|yesterday|this morning|morning|afternoon|evening|tonight|now|again|a bit|slightly|mildly|noticeably|really|very|badly)(?=\s)/gi,
    ' ',
  );
  t = t.replace(/\s+/g, ' ').trim();
  return (t || v.trim()).slice(0, 40);
}
export function foodBefore(at) {
  const f = E().find(e => e.kind === 'food' && e.at <= at && at - e.at <= 3 * 36e5);
  if (!f) return null;
  const m = Math.max(5, Math.round((at - f.at) / 6e4 / 5) * 5);
  const lab = f.items && f.items.length ? f.items.slice(0, 2).join(', ') : mealName(f.meal);
  return 'food:' + m + '|' + lab;
}
function isNewLong(k, at) {
  const prior = symEnts(k).filter(e => e.at < at);
  if (!prior.length) return false;
  const first = prior[prior.length - 1];
  if (at - first.at < DAY || at - first.at > 14 * DAY) return false;
  if (ST.firstDay && first.d <= ST.firstDay) return false;
  const before = symEnts(k).some(e => e.at < first.at);
  if (before) return false;
  if (E().some(e => e.kind === 'gone' && e.key === k && e.at > first.at && e.at < at)) return false;
  return true;
}
export function logSym(items, when, words) {
  const at = (when || now()).getTime();
  const fc = foodBefore(at);
  const list = items.map(it => ({
    kind: 'sym',
    key: it.key,
    s: it.s || null,
    ctx: (it.ctx || []).concat(
      fc && !(it.ctx || []).some(c => c.indexOf('food:') === 0) ? [fc] : [],
    ),
    words: words || null,
    at,
  }));
  const nl = list.find(x => isNewLong(x.key, at));
  const ids = addEntries(list);
  save();
  if (nl) {
    const first = symEnts(nl.key)
      .filter(e => e.at < at)
      .slice(-1)[0];
    toast({
      title: L('Записала: ', 'Saved: ') + lc(symName(nl.key)) + (nl.s ? ', ' + sName(nl.s) : ''),
      sub:
        L(
          'Это новое в ваших записях и держится больше суток, с ',
          'This is new in your entries and has lasted over a day, since ',
        ) + relDT(new Date(first.at)),
      icon: 'info',
      acts: [
        {
          l: L('к врачу', 'ask doctor'),
          fn: () =>
            addQuestion(
              L('Новое: ', 'New: ') +
                lc(symName(nl.key)) +
                L(', держится с ', ', since ') +
                fDM(new Date(first.at)),
            ),
        },
        undoAct(ids),
      ],
    });
    return ids;
  }
  const what = list.map(x => lc(symName(x.key)) + (x.s ? ', ' + sName(x.s) : '')).join('; ');
  const ctx = (list[0].ctx || []).map(c => ctxText(c)).join(', ');
  toast({
    title: L('Записала: ', 'Saved: ') + what,
    sub: cap(relDT(new Date(at))) + (ctx ? ', ' + ctx : ''),
    acts: [fixAct(ids[0]), undoAct(ids)],
  });
  return ids;
}
export function logFood(o) {
  const x = {
    kind: 'food',
    items: o.items || [],
    meal: o.meal || mealByTime(o.when || now()),
    words: o.words || null,
    photo: o.photo || null,
    at: (o.when || now()).getTime(),
  };
  const ids = addEntries([x]);
  if (x.photo) ST.photoUsed = true;
  let ok = saveS(ST);
  if (!ok && x.photo) {
    x.photo = null;
    saveS(ST);
    rr();
    toast({
      title: L('Записала без фото', 'Saved without the photo'),
      sub: L(
        'Память браузера заполнена, фото не поместилось',
        'Browser storage is full, the photo did not fit',
      ),
      icon: 'info',
      acts: [undoAct(ids)],
    });
    return ids;
  }
  rr();
  const what = x.items.length
    ? x.items.join(', ')
    : x.photo
      ? L('фото без подписи', 'photo, no caption')
      : '';
  const firstPhoto = x.photo && E().filter(e => e.photo).length === 1;
  toast({
    title: L('Записала: ', 'Saved: ') + mealName(x.meal),
    sub:
      cap(what) +
      (what ? ', ' : '') +
      relDT(new Date(x.at)) +
      (firstPhoto
        ? L('. Совпадения покажу через пару недель', '. Coincidences in a couple of weeks')
        : ''),
    acts: [fixAct(ids[0]), undoAct(ids)],
  });
  return ids;
}
export function logNote(words, hint) {
  const ids = addEntries([{ kind: 'note', words, at: now().getTime() }]);
  save();
  toast({
    title: L('Записала', 'Saved'),
    sub: hint || qt(words),
    acts: [fixAct(ids[0]), undoAct(ids)],
  });
}
export function addQuestion(text) {
  const q = { id: uid(), text: cap(text), status: 'open', at: Date.now() };
  ST.questions.unshift(q);
  save();
  toast({
    title: L('Добавила вопрос к врачу', 'Added a question for the doctor'),
    sub: qt(q.text),
    acts: [
      {
        l: L('отменить', 'undo'),
        fn: () => {
          ST.questions = ST.questions.filter(x => x.id !== q.id);
          save();
          toast({ title: L('Убрала вопрос', 'Question removed'), icon: 'undo' });
        },
      },
    ],
  });
}
export function handleText(v) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const ids = addEntries([{ kind: 'note', words: v, raw: true, at: now().getTime() }]);
    save();
    return toast({
      title: L('Записала как есть', 'Saved as is'),
      sub: L(
        'Связи нет. Запись сохранена на телефоне, разберу, когда появится сеть',
        'No connection. The entry is kept on your phone, I will sort it when the network is back',
      ),
      icon: 'info',
      acts: [undoAct(ids)],
    });
  }
  const a = analyze(v);
  if (a.kind === 'safety') return openSheet('safety', { v });
  if (a.kind === 'medical') return answer(v, a.keys, true);
  if (a.kind === 'query') return answer(v, a.keys, false);
  if (a.kind === 'doctorq') return addQuestion(a.q);
  if (a.kind === 'sym' && !a.when) {
    const it = a.items[0];
    const rec = symEnts(it.key).find(e => Date.now() - e.at < 30 * 6e4);
    if (rec && it.key !== 'fever') {
      return card({
        body:
          L('Это похоже на запись ', 'This looks like the ') +
          fT(new Date(rec.at)) +
          ': ' +
          lc(symName(rec.key)) +
          (rec.s ? ', ' + sName(rec.s) : '') +
          L('. Обновить ее или записать отдельно?', '. Update it or save separately?'),
        chips: [
          {
            l: L('обновить', 'update'),
            fn: () => {
              if (it.s) rec.s = it.s;
              rec.at = now().getTime();
              rec.words = v;
              rec.edited = Date.now();
              sortE();
              save();
              UI.resp = null;
              toast({
                title:
                  L('Обновила: ', 'Updated: ') +
                  lc(symName(rec.key)) +
                  (rec.s ? ', ' + sName(rec.s) : ''),
                acts: [fixAct(rec.id)],
              });
            },
          },
          {
            l: L('записать отдельно', 'save separately'),
            fn: () => {
              UI.resp = null;
              logSym(a.items, a.when, v);
            },
          },
        ],
      });
    }
  }
  if (a.kind === 'sym') {
    const ids = logSym(a.items, a.when, v);
    if (a.items.some(i => i.key === 'fever')) {
      toast({
        title: L('Записала: температура или болезнь', 'Saved: fever or illness'),
        sub: L(
          'При болезни ухудшение бывает из-за нее. Суток не ждите',
          'Illness itself can make things worse. Do not wait a day',
        ),
        icon: 'info',
        acts: [
          {
            l: L('к врачу', 'ask doctor'),
            fn: () =>
              addQuestion(
                L('Температура или болезнь, ', 'Fever or illness, ') +
                  fDM(now()) +
                  L(', стало хуже', ', got worse'),
              ),
          },
          undoAct(ids),
        ],
      });
    }
    return ids;
  }
  if (a.kind === 'food') return logFood({ items: a.items, meal: a.meal, when: a.when, words: v });
  if (a.kind === 'med')
    return logNote(v, L('Терапия идет из Здоровья', 'Therapy comes from Health'));
  const name = symNameFrom(v);
  let key = Object.keys(ST.custom).find(k => norm(ST.custom[k]) === norm(name));
  const SYMPTOMISH =
    /(неме|боли|болит|двоит|кружит|шата|слабост|тошн|тянет|дрож|жж[её]т|покалыва|спазм|судорог|зрени|numb|pain|ache|double|dizz|weak|nause|tingl|burn|shak|spasm|cramp|vision)/i;
  if (!key && !SYMPTOMISH.test(v) && (v.trim().split(/\s+/).length >= 3 || !strengthOf(v)))
    return notUnderstood(v);
  if (!key) {
    key = 'c_' + uid();
    ST.custom[key] = lc(name);
    save();
    if (!a.when && !parseWhen(v)) return newSymptomAsk(v, key, strengthOf(v));
  }
  return logSym([{ key, s: strengthOf(v), ctx: parseCtx(v) }], a.when || parseWhen(v), v);
}
export function readPhoto(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const m = 520,
            sc = Math.min(1, m / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * sc));
          c.height = Math.max(1, Math.round(img.height * sc));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.72));
        } catch (e) {
          rej(e);
        }
      };
      img.onerror = rej;
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/** Runs once at startup, called from main.js in a fixed order. */
export function initUiState() {
  setUI({ tab: 'today', sheet: null, toast: null, filter: 'all', draft: '' });
}
