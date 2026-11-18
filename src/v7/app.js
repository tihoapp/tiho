// v7: the hybrid. A short daily check-in of the person's own symptoms and medications,
// next to the free input line. Three labelled sections in a bottom bar; every other
// screen has a back button that names where it goes.
import { analyze } from '../core/lexicon.js';
import { addD, dk, fDM, fHdr, fT, fromDk, now, todayK } from '../core/dates.js';
import { entrySub, entryTitle, onDay } from '../core/entries.js';
import { defaults, saveS, uid } from '../core/storage.js';
import { L, cap, lc, qt } from '../core/text.js';
import { html, useEffect, useRef, useState } from '../lib/preact.js';
import { LANG, ST, setLANG, setST } from '../state/store.js';
import { Mascot } from '../ui/components.js';
import { haptic } from '../ui/haptics.js';
import { fetchWx } from '../services/weather.js';
import {
  BAD_DAY,
  CATALOG,
  FEEL,
  LEVEL,
  MAX_MY,
  OWN_CAUSE,
  PERIODS,
  SCHED,
  V,
  addCustom,
  addMed,
  checkSentence,
  coincidences7,
  copyYesterday,
  day,
  dayRec,
  endWorse,
  enterSample,
  feelName,
  isChecked,
  leaveSample,
  levelName,
  medList,
  myList,
  myName,
  nDays,
  schedName,
  startWorse,
  steps,
  summary7,
  summaryText7,
  worseDay,
} from './model.js';

// ---- view state (not stored) ----
const U = {
  tab: 'today',
  page: null,
  flow: null, // { k: day key, i: step index, short: bool }
  card: null, // a one-off answer card on today: { type, ... }
  toast: null,
  coinN: 14,
  docN: 14,
  ob: 'welcome',
  focus: null,
};
let RERENDER = () => {};
const rr = () => RERENDER();
const save = () => saveS(ST);
let TT = null;

/** Announce to screen readers through the polite live region. */
function announce(text) {
  const el = document.getElementById('v7-live');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => (el.textContent = text), 30);
}
function toast(t) {
  U.toast = Object.assign({ id: uid() }, t);
  haptic(t.warn ? 'warn' : 'save');
  announce(t.title + (t.sub ? '. ' + t.sub : ''));
  clearTimeout(TT);
  TT = setTimeout(hideToast, 8000);
  rr();
}
function hideToast() {
  U.toast = null;
  rr();
}
function holdToast() {
  clearTimeout(TT);
}
function go(tab) {
  if (tab !== U.tab) U.toast = null;
  U.tab = tab;
  U.page = null;
  U.focus = 'h1';
  rr();
}
function open(page) {
  U.page = page;
  U.focus = 'h1';
  rr();
}
function back() {
  U.page = U.page && U.page.startsWith('set-') ? 'settings' : null;
  U.focus = 'h1';
  rr();
}

// ---- small building blocks ----
const B = (cls, onClick, label, extra = {}) =>
  html`<button type="button" class=${'v7b ' + cls} onClick=${onClick} ...${extra}>
    ${label}
  </button>`;

function Head({ title, sub, backTo, right }) {
  return html`<header class="v7-head">
    ${
      backTo
        ? html`<button type="button" class="v7b v7-back" onClick=${back}>
            <span aria-hidden="true">‹</span> ${backTo}
          </button>`
        : null
    }
    <div class="v7-head-row">
      <div class="v7-grow">
        <h1 class="v7-h1" tabindex="-1">${title}</h1>
        ${sub ? html`<p class="v7-sub">${sub}</p>` : null}
      </div>
      ${right || null}
    </div>
  </header>`;
}
function MenuButton() {
  return html`<button type="button" class="v7b v7-menu" onClick=${() => open('settings')}>
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
    <span>${L('настройки', 'settings')}</span>
  </button>`;
}
function Seg({ label, items, val, set }) {
  return html`<div class="v7-seg" role="group" aria-label=${label}>
    ${items.map(
      ([v, t]) =>
        html`<button
          type="button"
          class=${'v7b v7-segb' + (v === val ? ' on' : '')}
          aria-pressed=${v === val ? 'true' : 'false'}
          onClick=${() => set(v)}
        >
          ${v === val ? html`<span aria-hidden="true">✓ </span>` : null}${t}
        </button>`,
    )}
  </div>`;
}
function Switch({ label, sub, on, set }) {
  return html`<button
    type="button"
    class="v7b v7-row v7-switchrow"
    role="switch"
    aria-checked=${on ? 'true' : 'false'}
    onClick=${() => set(!on)}
  >
    <span class="v7-grow"
      ><span class="v7-row-t">${label}</span
      >${sub ? html`<span class="v7-row-s">${sub}</span>` : null}</span
    >
    <span class="v7-switch" aria-hidden="true"><span></span></span>
    <span class="v7-sr">${on ? L('включено', 'on') : L('выключено', 'off')}</span>
  </button>`;
}

// ---- the daily check-in ----
function startFlow(k, short) {
  U.flow = { k, i: 0, short: !!short };
  U.card = null;
  U.focus = 'q';
  rr();
}
function advance() {
  const f = U.flow;
  const st = steps();
  f.i++;
  if (f.short || f.i >= st.length) {
    const r = dayRec(f.k);
    r.done = true;
    r.at = r.at || Date.now();
    U.flow = null;
    save();
    toast({
      title:
        f.k === todayK()
          ? L('Отметка за сегодня готова', 'Today’s check-in is done')
          : L('Отметка за вчера готова', 'Yesterday’s check-in is done'),
      sub: L('Ее можно изменить в карточке дня', 'You can change it on the day card'),
    });
    U.focus = 'h1';
    return;
  }
  save();
  U.focus = 'q';
  rr();
}
function setFeel(v) {
  const f = U.flow;
  const r = dayRec(f.k);
  r.feel = v;
  r.at = Date.now();
  if (v === 1) {
    if (f.k === todayK()) startWorse(f.k);
    f.short = true;
    U.flow = { k: f.k, i: 0, short: true, hard: true };
    save();
    U.focus = 'q';
    announce(
      L(
        'Записала: тяжело. День помечен «хуже обычного»',
        'Saved: very hard. The day is marked worse than usual',
      ),
    );
    rr();
    return;
  }
  if (v === 2 && f.k === todayK()) startWorse(f.k);
  if (v >= 3 && f.k === todayK() && ST.worse && worseDay() > 1) endWorse();
  advance();
}

function CheckCard() {
  const f = U.flow;
  const r = dayRec(f.k);
  const st = steps();
  const total = st.length;
  const isToday = f.k === todayK();
  const qRef = useRef(null);
  useEffect(() => {
    if (U.focus === 'q' && qRef.current) {
      qRef.current.focus();
      U.focus = null;
    }
  });
  const progress = (n, of) =>
    html`<div class="v7-prog">
      <p class="v7-sub" aria-live="polite">
        ${L(n + ' из ' + of, n + ' of ' + of)}${n === 1 ? L(', меньше минуты', ', under a minute') : ''}
      </p>
      <div class="v7-bar" aria-hidden="true">
        <span style=${'width:' + Math.round((n / of) * 100) + '%'}></span>
      </div>
    </div>`;
  if (f.hard) {
    return html`<section class="v7-card v7-check" aria-labelledby="v7q">
      <div class="v7-state" role="status">
        <strong
          >${L('хуже обычного, день ', 'worse than usual, day ') + Math.max(1, worseDay())}</strong
        >
        <span
          >${L('С сегодня. Попадет в сводку к врачу', 'From today. It goes into the doctor summary')}</span
        >
      </div>
      <h2 id="v7q" class="v7-q" tabindex="-1" ref=${qRef}>
        ${L('Что сильнее всего?', 'What is strongest?')}
      </h2>
      <p class="v7-sub">
        ${L('Одно касание. Остальное можно не отмечать', 'One tap. You can skip the rest')}
      </p>
      <div class="v7-opts">
        ${myList().map(k =>
          B(
            'v7-opt',
            () => {
              r.sym[k] = 3;
              advance();
            },
            myName(k),
          ),
        )}
        ${B('v7-opt v7-quiet', () => advance(), L('ничего не отмечать', 'don’t mark anything'))}
      </div>
    </section>`;
  }
  const s = st[f.i];
  let q, body;
  if (s.type === 'feel') {
    q = isToday
      ? L('как вы сегодня?', 'how are you today?')
      : L('как вы были вчера?', 'how were you yesterday?');
    const y = day(dk(addD(fromDk(f.k), -1)));
    body = html`<div class="v7-opts">
      ${FEEL.map(([v, n]) =>
        B(
          'v7-opt' + (r.feel === v ? ' on' : ''),
          () => setFeel(v),
          html`${r.feel === v ? html`<span aria-hidden="true">✓ </span>` : null}${L(n[0], n[1])}`,
          {
            'aria-pressed': r.feel === v ? 'true' : 'false',
          },
        ),
      )}
      ${
        y && y.feel && isToday
          ? B(
              'v7-opt v7-quiet',
              () => {
                copyYesterday(f.k);
                U.flow = null;
                save();
                toast({
                  title: L('Записала как вчера', 'Saved as yesterday'),
                  sub: checkSentence(day(f.k)),
                  undo: () => {
                    delete V().daily[f.k];
                    save();
                  },
                });
              },
              L('как вчера', 'same as yesterday'),
            )
          : null
      }
    </div>`;
  } else if (s.type === 'sym') {
    q = isToday
      ? L(myName(s.k) + ' сегодня?', myName(s.k) + ' today?')
      : L(myName(s.k) + ' вчера?', myName(s.k) + ' yesterday?');
    q = cap(q);
    body = html`<div class="v7-opts v7-opts-2">
        ${LEVEL.map(([v]) =>
          B(
            'v7-opt' + (r.sym[s.k] === v ? ' on' : ''),
            () => {
              r.sym[s.k] = v;
              advance();
            },
            html`${r.sym[s.k] === v ? html`<span aria-hidden="true">✓ </span>` : null}${levelName(v)}`,
            { 'aria-pressed': r.sym[s.k] === v ? 'true' : 'false' },
          ),
        )}
      </div>
      ${B(
        'v7-link',
        () => {
          delete r.sym[s.k];
          advance();
        },
        L('пропустить: нет данных', 'skip: no data'),
      )}`;
  } else {
    const m = s.m;
    q = cap(
      isToday
        ? L(m.name + ' сегодня?', m.name + ' today?')
        : L(m.name + ' вчера?', m.name + ' yesterday?'),
    );
    const cur = r.med[m.id] && r.med[m.id].st;
    const set = st2 => {
      r.med[m.id] = { st: st2, at: Date.now() };
      advance();
    };
    body = html`<div class="v7-opts">
      ${B('v7-opt' + (cur === 'took' ? ' on' : ''), () => set('took'), L('приняла', 'taken'), { 'aria-pressed': cur === 'took' ? 'true' : 'false' })}
      ${B('v7-opt' + (cur === 'not' ? ' on' : ''), () => set('not'), L('еще нет', 'not yet'), { 'aria-pressed': cur === 'not' ? 'true' : 'false' })}
      ${B('v7-opt' + (cur === 'need' ? ' on' : ''), () => set('need'), L('не нужно сегодня', 'not needed today'), { 'aria-pressed': cur === 'need' ? 'true' : 'false' })}
    </div>`;
  }
  return html`<section class="v7-card v7-check" aria-labelledby="v7q">
    ${progress(f.i + 1, total)}
    <h2 id="v7q" class="v7-q" tabindex="-1" ref=${qRef}>${q}</h2>
    ${body}
    <div class="v7-flowfoot">
      ${
        f.i > 0
          ? B(
              'v7-link',
              () => {
                f.i--;
                U.focus = 'q';
                rr();
              },
              html`<span aria-hidden="true">‹ </span>${L('назад', 'back')}`,
            )
          : B(
              'v7-link',
              () => {
                U.flow = null;
                if (!day(f.k) || !day(f.k).feel) delete V().daily[f.k];
                save();
                rr();
              },
              L('отметить позже', 'check in later'),
            )
      }
    </div>
  </section>`;
}

function medTap(m) {
  const r = dayRec(todayK());
  const cur = r.med[m.id];
  if (cur && cur.st === 'took') {
    U.card = { type: 'medagain', m, at: cur.at };
    rr();
    return;
  }
  r.med[m.id] = { st: 'took', at: Date.now() };
  save();
  toast({
    title: L('Записала: ' + m.name + ', приняла', 'Saved: ' + m.name + ', taken'),
    sub: L('Сегодня, ', 'Today, ') + fT(new Date()),
    undo: () => {
      delete r.med[m.id];
      save();
    },
  });
}

function DayCard() {
  const k = todayK();
  const r = day(k);
  const meds = medList();
  return html`<section class="v7-card" aria-labelledby="v7-day">
    <div class="v7-row-head">
      <h2 id="v7-day" class="v7-h2">${L('отметка за сегодня', 'today’s check-in')}</h2>
      ${B('v7-small', () => startFlow(k), L('изменить', 'change'))}
    </div>
    <p class="v7-body">${checkSentence(r)}</p>
    ${
      meds.length
        ? html`<ul class="v7-meds" aria-label=${L('Лекарства сегодня', 'Medications today')}>
            ${meds.map(m => {
              const st = r && r.med[m.id];
              const took = st && st.st === 'took';
              const txt = took
                ? L('приняла в ', 'taken at ') + fT(new Date(st.at))
                : st && st.st === 'need'
                  ? L('не нужно сегодня', 'not needed today')
                  : L('еще нет, нажмите, если приняли', 'not yet, tap when taken');
              return html`<li>
                ${B(
                  'v7-med' + (took ? ' on' : ''),
                  () => medTap(m),
                  html`<span class="v7-med-n">${m.name}</span
                    ><span class="v7-med-s"
                      >${took ? html`<span aria-hidden="true">✓ </span>` : null}${txt}</span
                    >`,
                )}
              </li>`;
            })}
          </ul>`
        : null
    }
  </section>`;
}

function TodayEntries() {
  const k = todayK();
  const list = onDay(k)
    .slice()
    .sort((a, b) => b.at - a.at);
  const r = day(k);
  const meds = r ? Object.values(r.med).filter(x => x.st === 'took').length : 0;
  const count = list.length + (r && r.feel ? 1 : 0) + meds;
  if (!count) return null;
  const last = list[0];
  return html`<section
    class="v7-card v7-tight"
    aria-label=${L('Записи за сегодня', 'Today’s entries')}
  >
    ${
      last
        ? html`<div class="v7-entry">
            <span class="v7-time">${fT(new Date(last.at))}</span>
            <span class="v7-grow"
              ><span class="v7-entry-t">${last.words ? qt(last.words) : entryTitle(last)}</span
              ><span class="v7-entry-s"
                >${last.words ? entryLine(last) : entrySub(last)}</span
              ></span
            >
          </div>`
        : null
    }
    ${B(
      'v7-row v7-chev',
      () => open('all'),
      html`<span class="v7-grow"
          ><span class="v7-row-t">${L('все записи за сегодня', 'all entries today')}</span
          ><span class="v7-row-s">${countLine(r, list.length, meds)}</span></span
        ><span aria-hidden="true" class="v7-chev-i">›</span>`,
    )}
  </section>`;
}
function entryLine(e) {
  const t = entryTitle(e);
  const s = entrySub(e);
  return (
    cap([t, s].filter(Boolean).map(lc).join(', ')) +
    (e.cause ? L('. Причина с ваших слов: ', '. Cause in your words: ') + e.cause : '')
  );
}
function countLine(r, n, meds) {
  const parts = [];
  if (r && r.feel) parts.push(L('отметка', 'check-in'));
  if (meds) parts.push(L('лекарства ' + meds, 'medications ' + meds));
  if (n)
    parts.push(
      L(
        n + ' ' + (n === 1 ? 'запись' : n < 5 ? 'записи' : 'записей'),
        n + (n === 1 ? ' entry' : ' entries'),
      ),
    );
  return parts.join(L(' и ', ' and ').length ? ', ' : ', ');
}

let LASTCARD = null;
function AnswerCard() {
  const c = U.card;
  const ref = useRef(null);
  useEffect(() => {
    if (c && c !== LASTCARD && ref.current) {
      LASTCARD = c;
      const h = ref.current.querySelector('h2');
      if (h) {
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
      ref.current.scrollIntoView({
        block: 'center',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }
  });
  if (!c) return null;
  return html`<div ref=${ref}><${AnswerBody} c=${c} /></div>`;
}
function AnswerBody({ c }) {
  const close = () => {
    U.card = null;
    rr();
  };
  if (c.type === 'medagain')
    return html`<section class="v7-card v7-answer" role="status">
      <h2 class="v7-h2">
        ${L('Уже отмечено сегодня в ', 'Already marked today at ') + fT(new Date(c.at))}
      </h2>
      <p class="v7-body">${L('Отметить еще один прием?', 'Mark another dose?')}</p>
      <div class="v7-pair">
        ${B('v7-btn v7-pri', close, L('все верно', 'that’s right'))}
        ${B(
          'v7-btn v7-sec',
          () => {
            addEntriesLocal([{ kind: 'med', name: c.m.name, at: Date.now() }]);
            close();
            toast({ title: L('Записала еще один прием', 'Saved another dose'), sub: c.m.name });
          },
          L('еще прием', 'another dose'),
        )}
      </div>
    </section>`;
  if (c.type === 'voice')
    return html`<section class="v7-card v7-answer" role="status">
      <h2 class="v7-h2">${L('голос здесь не работает', 'voice doesn’t work here')}</h2>
      <p class="v7-body">
        ${L('В приложении с экрана «Домой» iPhone не дает распознавать речь. Это ограничение Apple, а не ваших настроек', 'In a Home Screen app the iPhone doesn’t allow speech recognition. This is an Apple limit, not your settings')}
      </p>
      <p class="v7-body">
        ${L('Нажмите на строку и наговорите через микрофон на клавиатуре', 'Tap the line and dictate with the microphone on the keyboard')}
      </p>
      <div class="v7-pair">
        ${B(
          'v7-btn v7-pri',
          () => {
            close();
            setTimeout(() => {
              const i = document.getElementById('v7-line');
              if (i) i.focus();
            }, 30);
          },
          L('открыть клавиатуру', 'open the keyboard'),
        )}
        ${B(
          'v7-btn v7-sec',
          () => {
            V().input = 'tap';
            save();
            close();
          },
          L('отмечать нажатиями', 'mark by tapping'),
        )}
      </div>
    </section>`;
  if (c.type === 'note')
    return html`<section class="v7-card v7-answer" role="status">
      <h2 class="v7-h2">${L('Записала заметкой: ', 'Saved as a note: ') + qt(c.words)}</h2>
      <p class="v7-body">
        ${L('Это про самочувствие? Тогда учту в отметке дня', 'Is this about how you feel? Then I’ll count it in the day’s check-in')}
      </p>
      <div class="v7-pair">
        ${B(
          'v7-btn v7-pri',
          () => {
            close();
            startFlow(todayK());
          },
          L('это самочувствие', 'it’s how I feel'),
        )}
        ${B('v7-btn v7-sec', close, L('оставить заметкой', 'keep as a note'))}
      </div>
    </section>`;
  if (c.type === 'question')
    return html`<section class="v7-card v7-answer" role="status">
      <h2 class="v7-h2">${L('Это вопрос', 'This is a question')}</h2>
      <p class="v7-body">
        ${
          c.medical
            ? L(
                'Я не отвечаю на медицинские вопросы. Добавить его в вопросы к врачу?',
                'I don’t answer medical questions. Add it to your questions for the doctor?',
              )
            : L(
                'Ответы из ваших записей собраны в двух разделах',
                'Answers from your entries are in two sections',
              )
        }
      </p>
      <div class="v7-pair">
        ${
          c.medical
            ? B(
                'v7-btn v7-pri',
                () => {
                  addQuestion(c.words);
                  close();
                },
                L('добавить в вопросы', 'add to questions'),
              )
            : B('v7-btn v7-pri', () => go('coin'), L('совпадения', 'coincidences'))
        }
        ${c.medical ? B('v7-btn v7-sec', close, L('не нужно', 'no thanks')) : B('v7-btn v7-sec', () => go('doc'), L('к врачу', 'for the doctor'))}
      </div>
    </section>`;
  if (c.type === 'safety')
    return html`<section class="v7-card v7-answer v7-alert" role="alert">
      <h2 class="v7-h2">
        ${L('Если это началось внезапно, обратитесь за помощью', 'If this started suddenly, get help')}
      </h2>
      <p class="v7-body">
        ${L('Резкое ухудшение зрения, речи или силы в руке или ноге требует срочной помощи. Позвоните 112 или своему врачу', 'A sudden change in vision, speech or strength in an arm or leg needs urgent care. Call your local emergency number or your doctor')}
      </p>
      <div class="v7-pair">
        <a class="v7b v7-btn v7-pri" href="tel:112">${L('позвонить 112', 'call 112')}</a>
        ${B(
          'v7-btn v7-sec',
          () => {
            addEntriesLocal([{ kind: 'note', words: c.words, at: Date.now() }]);
            close();
            toast({ title: L('Записала как есть', 'Saved as is'), sub: qt(c.words) });
          },
          L('просто записать', 'just save it'),
        )}
      </div>
    </section>`;
  return null;
}

function YesterdayCard() {
  const v = V();
  const yk = dk(addD(now(), -1));
  if (isChecked(yk) || v.dismiss['y' + yk] || !v.start || v.start >= todayK() || U.flow)
    return null;
  return html`<section class="v7-card v7-answer" aria-labelledby="v7-y">
    <h2 id="v7-y" class="v7-h2">${L('вчера отметки не было', 'no check-in yesterday')}</h2>
    <p class="v7-body">
      ${L('Можно отметить сейчас или пропустить. Пропуск не страшен: этот день просто не попадет в совпадения', 'You can check in now or skip it. Skipping is fine: that day just won’t count in coincidences')}
    </p>
    <div class="v7-pair">
      ${B('v7-btn v7-sec', () => startFlow(yk), L('отметить вчера', 'check in for yesterday'))}
      ${B(
        'v7-btn v7-sec',
        () => {
          v.dismiss['y' + yk] = 1;
          save();
          rr();
        },
        L('пропустить', 'skip'),
      )}
    </div>
  </section>`;
}

function WorseBanner() {
  if (!ST.worse) return null;
  return html`<div class="v7-state" role="note">
    <strong
      >${L('хуже обычного, день ', 'worse than usual, day ') + Math.max(1, worseDay())}</strong
    >
    <span>${L('Попадет в сводку к врачу', 'It goes into the doctor summary')}</span>
    ${B(
      'v7-small',
      () => {
        endWorse();
        save();
        toast({ title: L('Отметила: стало как обычно', 'Marked: back to usual') });
      },
      L('стало как обычно', 'back to usual'),
    )}
  </div>`;
}

// ---- free text ----
function addEntriesLocal(list) {
  for (const x of list) {
    x.id = x.id || uid();
    x.d = dk(new Date(x.at));
    x.made = Date.now();
    ST.entries.push(x);
  }
  ST.entries.sort((a, b) => b.at - a.at);
  save();
  return list.map(x => x.id);
}
function removeEntries(ids) {
  ST.entries = ST.entries.filter(e => !ids.includes(e.id));
  save();
}
function addQuestion(text) {
  ST.questions.push({ id: uid(), text, at: Date.now() });
  save();
  toast({
    title: L('Добавила в вопросы к врачу', 'Added to questions for the doctor'),
    sub: qt(text),
  });
}
function handle(text) {
  const t = text.trim();
  if (!t) return;
  U.card = null;
  const n = t.toLowerCase().replace(/ё/g, 'е');
  const a = analyze(t);
  if (a.kind === 'safety') {
    U.card = { type: 'safety', words: t };
    haptic('warn');
    rr();
    return;
  }
  if (BAD_DAY.test(n)) {
    const k = todayK();
    const r = dayRec(k);
    const prev = { feel: r.feel, worse: ST.worse };
    if (!r.feel || r.feel > 2) r.feel = 2;
    r.at = r.at || Date.now();
    startWorse(k);
    const ids = addEntriesLocal([{ kind: 'note', words: t, at: Date.now(), worse: true }]);
    toast({
      title:
        L('Записала: хуже обычного, день ', 'Saved: worse than usual, day ') +
        Math.max(1, worseDay()),
      sub: L(
        'Из ваших слов ' + qt(t) + '. Попадет в сводку к врачу',
        'From your words ' + qt(t) + '. It goes into the doctor summary',
      ),
      undoLabel: L('это не так', 'that’s not right'),
      undo: () => {
        r.feel = prev.feel;
        ST.worse = prev.worse;
        removeEntries(ids);
      },
    });
    return;
  }
  if (a.kind === 'doctorq') return addQuestion(a.q);
  if (a.kind === 'query' || a.kind === 'medical') {
    if (/(совпад|связ|coincid|link|affect)/.test(n)) return go('coin');
    if (/(сводк|врач|summary|doctor)/.test(n)) return go('doc');
    U.card = { type: 'question', words: t, medical: a.kind === 'medical' };
    rr();
    return;
  }
  if (a.kind === 'med') {
    const meds = medList();
    if (meds.length === 1) return medTap(meds[0]);
  }
  const at = (a.when && a.when.at) || Date.now();
  if (a.kind === 'food') {
    const ids = addEntriesLocal([{ kind: 'food', items: a.items, meal: a.meal, words: t, at }]);
    return toast({
      title: L('Записала: ', 'Saved: ') + a.items.join(', '),
      sub: L('Сегодня, ', 'Today, ') + fT(new Date(at)),
      undo: () => removeEntries(ids),
    });
  }
  if (a.kind === 'sym' && a.items && a.items.length) {
    const cm = n.match(OWN_CAUSE);
    const cause = cm
      ? t
          .slice(cm.index)
          .replace(/^(из-за|потому что|because|due to|это|it'?s)\s*/i, '')
          .replace(/[.!]+$/, '')
      : null;
    const ids = addEntriesLocal(
      a.items.map(i => ({
        kind: 'sym',
        key: i.key,
        s: i.s,
        ctx: cause ? [] : i.ctx,
        words: t,
        cause,
        at,
      })),
    );
    const names = a.items.map(i => myName(i.key) + (i.s ? ', ' + levelName(i.s) : '')).join('; ');
    return toast({
      title: L('Записала: ', 'Saved: ') + names,
      sub: cause
        ? L(
            'Причину вы назвали сами: ' + cause + '. Не связываю эту запись с едой и другим',
            'You named the cause yourself: ' +
              cause +
              '. I won’t link this entry with food or anything else',
          )
        : L('Сегодня, ', 'Today, ') + fT(new Date(at)),
      undo: () => removeEntries(ids),
    });
  }
  addEntriesLocal([{ kind: 'note', words: t, at: Date.now() }]);
  U.card = { type: 'note', words: t };
  haptic('save');
  announce(L('Записала заметкой', 'Saved as a note'));
  rr();
}

function startVoice(setText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const standalone =
    window.navigator.standalone ||
    (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!SR || standalone) {
    U.card = { type: 'voice' };
    rr();
    return;
  }
  try {
    const rec = new SR();
    rec.lang = LANG === 'en' ? 'en-US' : 'ru-RU';
    rec.interimResults = false;
    rec.onresult = e => setText(e.results[0][0].transcript);
    rec.onerror = () => {
      U.card = { type: 'voice' };
      rr();
    };
    rec.start();
    announce(L('Слушаю', 'Listening'));
  } catch (e) {
    U.card = { type: 'voice' };
    rr();
  }
}
function readPhotoFile(file, cb) {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => cb(null);
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}

function InputLine({ placeholder }) {
  const [t, setT] = useState('');
  const send = e => {
    if (e) e.preventDefault();
    const v = t;
    setT('');
    handle(v);
  };
  const photo = e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    readPhotoFile(f, url => {
      const ids = addEntriesLocal([
        { kind: 'food', items: [], words: '', photo: url, at: Date.now() },
      ]);
      toast({
        title: L('Записала фото еды', 'Saved a food photo'),
        sub: L('Сегодня, ', 'Today, ') + fT(new Date()),
        undo: () => removeEntries(ids),
      });
    });
  };
  return html`<form class="v7-line" onSubmit=${send}>
    <label class="v7b v7-cam" title=${L('фото еды', 'food photo')}>
      <input type="file" accept="image/*" class="v7-sr" onChange=${photo} />
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linejoin="round"
      >
        <path d="M4 8h3.2L9 5.5h6L16.8 8H20v11H4z" />
        <circle cx="12" cy="13.2" r="3.4" />
      </svg>
      <span class="v7-sr">${L('Добавить фото еды', 'Add a food photo')}</span>
    </label>
    <label for="v7-line" class="v7-sr"
      >${L('Что записать или спросить', 'What to save or ask')}</label
    >
    <input
      id="v7-line"
      class="v7-input"
      value=${t}
      onInput=${e => setT(e.target.value)}
      placeholder=${placeholder || L('что-нибудь еще?', 'anything else?')}
      enterkeyhint="send"
      autocomplete="off"
    />
    ${
      t.trim()
        ? html`<button type="submit" class="v7b v7-mic v7-send">${L('записать', 'save')}</button>`
        : html`<button type="button" class="v7b v7-mic" onClick=${() => startVoice(setT)}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
            >
              <rect x="9" y="3.5" width="6" height="11" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
            </svg>
            <span class="v7-sr">${L('Сказать голосом', 'Speak')}</span>
          </button>`
    }
  </form>`;
}

function TapPad() {
  const [pick, setPick] = useState(null);
  const meds = medList();
  if (pick === 'food')
    return html`<div class="v7-pad" role="group" aria-label=${L('Какая еда', 'Which meal')}>
      ${[
        ['breakfast', L('завтрак', 'breakfast')],
        ['lunch', L('обед', 'lunch')],
        ['dinner', L('ужин', 'dinner')],
        ['snack', L('перекус', 'snack')],
      ].map(([m, n]) =>
        B(
          'v7-padb',
          () => {
            const ids = addEntriesLocal([
              { kind: 'food', items: [], meal: m, words: n, at: Date.now() },
            ]);
            setPick(null);
            toast({
              title: L('Записала: ', 'Saved: ') + n,
              sub: L('Сегодня, ', 'Today, ') + fT(new Date()),
              undo: () => removeEntries(ids),
            });
          },
          n,
        ),
      )}
      ${B('v7-padb v7-quiet', () => setPick(null), L('отмена', 'cancel'))}
    </div>`;
  if (pick && pick.sym)
    return html`<div class="v7-pad" role="group" aria-label=${cap(myName(pick.sym))}>
      ${[1, 2, 3].map(v =>
        B(
          'v7-padb',
          () => {
            const ids = addEntriesLocal([
              { kind: 'sym', key: pick.sym, s: v, ctx: [], at: Date.now() },
            ]);
            setPick(null);
            toast({
              title: L('Записала: ', 'Saved: ') + myName(pick.sym) + ', ' + levelName(v),
              sub: L('Сегодня, ', 'Today, ') + fT(new Date()),
              undo: () => removeEntries(ids),
            });
          },
          cap(myName(pick.sym)) + ', ' + levelName(v),
        ),
      )}
      ${B('v7-padb v7-quiet', () => setPick(null), L('отмена', 'cancel'))}
    </div>`;
  return html`<div class="v7-pad" role="group" aria-label=${L('Записать сейчас', 'Save now')}>
    <h2 class="v7-h2 v7-padh">${L('записать сейчас', 'save now')}</h2>
    ${myList().map(k => B('v7-padb', () => setPick({ sym: k }), cap(myName(k))))}
    ${B('v7-padb', () => setPick('food'), L('еда', 'food'))}
    ${meds.map(m => B('v7-padb', () => medTap(m), m.name + L(': приняла', ': taken')))}
  </div>`;
}

// ---- screens ----
function Today() {
  const v = V();
  const k = todayK();
  const r = day(k);
  const checked = !!(r && r.done && r.feel);
  const tapOnly = v.input === 'tap';
  if (v.simple && !checked && !U.flow) startFlowSilently(k);
  const main = U.flow
    ? html`<${CheckCard} />`
    : checked
      ? html`<${DayCard} />`
      : html`<section class="v7-card" aria-labelledby="v7-start">
          <h2 id="v7-start" class="v7-h2">${L('как вы сегодня?', 'how are you today?')}</h2>
          <p class="v7-body">
            ${L('Отметка займет меньше минуты: самочувствие, ваши симптомы и лекарства', 'The check-in takes under a minute: how you feel, your symptoms and medications')}
          </p>
          ${B('v7-btn v7-pri', () => startFlow(k), L('отметить сегодня', 'check in for today'))}
        </section>`;
  return html`<${Head}
      title=${L('сегодня', 'today')}
      sub=${cap(fHdr(now()))}
      right=${html`<${MenuButton} />`}
    />
    <div class="v7-stack v7-bottom">
      ${ST.demo ? html`<${SampleBanner} />` : null} ${U.flow ? null : html`<${WorseBanner} />`}
      ${v.simple ? null : html`<${YesterdayCard} />`} ${main}
      <${AnswerCard} />
      ${v.simple || U.flow ? null : html`<${TodayEntries} />`}
    </div>
    ${
      v.simple
        ? html`<div class="v7-dock">
            ${B(
              'v7-btn v7-sec v7-wide',
              () => {
                v.simple = false;
                save();
                rr();
              },
              L('сказать или написать', 'say or write'),
            )}
          </div>`
        : tapOnly
          ? U.flow
            ? null
            : html`<div class="v7-padwrap"><${TapPad} /></div>`
          : html`<div class="v7-dock">
              <${InputLine}
                placeholder=${U.flow ? L('или скажите своими словами', 'or say it in your own words') : null}
              />
            </div>`
    }`;
}
function startFlowSilently(k) {
  U.flow = { k, i: 0, short: false };
}

function SampleBanner() {
  return html`<div class="v7-sample" role="note">
    <span class="v7-grow"
      ><strong>${L('это пример данных', 'this is sample data')}</strong
      ><span
        >${L('Ваших записей здесь нет. Выйдите, чтобы начать свой дневник', 'Your entries aren’t here. Leave to start your own diary')}</span
      ></span
    >
    ${B('v7-btn v7-pri v7-fit', exitSample, L('выйти из примера', 'leave the sample'))}
  </div>`;
}
function exitSample() {
  const o = leaveSample();
  const s = o && o.v7 ? o : defaults();
  s.demo = false;
  setST(s);
  U.flow = null;
  U.card = null;
  U.page = null;
  U.tab = 'today';
  if (!s.v7 || !s.v7.onboarded) U.ob = 'welcome';
  save();
  toast({
    title: L('Вышла из примера', 'Left the sample'),
    sub: L('Это ваш дневник', 'This is your diary'),
  });
}

function AllToday() {
  const k = todayK();
  const r = day(k);
  const rows = [];
  if (r && r.feel)
    rows.push({
      at: r.at || Date.now(),
      t: L('отметка: ', 'check-in: ') + feelName(r.feel),
      s: checkSentence(r).split('. ').slice(1).join('. '),
    });
  if (r)
    for (const m of medList()) {
      const st = r.med[m.id];
      if (st && st.st === 'took') rows.push({ at: st.at, t: m.name, s: L('приняла', 'taken') });
    }
  const [del, setDel] = useState(null);
  for (const e of onDay(k))
    rows.push({
      at: e.at,
      id: e.id,
      t: e.words ? qt(e.words) : entryTitle(e),
      s: e.words ? entryLine(e) : entrySub(e),
      photo: e.photo,
    });
  rows.sort((a, b) => a.at - b.at);
  return html`<${Head}
      title=${L('все записи за сегодня', 'all entries today')}
      sub=${cap(fHdr(now()))}
      backTo=${L('сегодня', 'today')}
    />
    <div class="v7-stack">
      <section class="v7-card v7-tight">
        ${
          rows.length
            ? html`<ul class="v7-list">
                ${rows.map(
                  x =>
                    html`<li class="v7-entry">
                      <span class="v7-time">${fT(new Date(x.at))}</span>
                      ${x.photo ? html`<img class="v7-thumb" src=${x.photo} alt=${L('Фото еды', 'Food photo')} />` : null}
                      <span class="v7-grow"
                        ><span class="v7-entry-t">${x.t}</span
                        >${x.s ? html`<span class="v7-entry-s">${x.s}</span>` : null}</span
                      >
                      ${
                        x.id
                          ? del === x.id
                            ? html`<span
                                class="v7-confirm"
                                role="group"
                                aria-label=${L('Удалить запись?', 'Delete entry?')}
                              >
                                ${B(
                                  'v7-small v7-danger',
                                  () => {
                                    removeEntries([x.id]);
                                    setDel(null);
                                    announce(L('Запись удалена', 'Entry deleted'));
                                  },
                                  L('удалить', 'delete'),
                                )}
                                ${B('v7-small', () => setDel(null), L('оставить', 'keep'))}
                              </span>`
                            : B(
                                'v7-small v7-ghost',
                                () => setDel(x.id),
                                html`<span class="v7-sr">${L('Удалить: ', 'Delete: ') + x.t}</span
                                  ><span aria-hidden="true">${L('удалить', 'delete')}</span>`,
                              )
                          : null
                      }
                    </li>`,
                )}
              </ul>`
            : html`<p class="v7-body">${L('Сегодня записей пока нет', 'No entries today yet')}</p>`
        }
      </section>
    </div>
    <div class="v7-dock"><${InputLine} /></div>`;
}

function Bar({ label, value, part }) {
  return html`<div class="v7-barrow">
    <div class="v7-barhead"><span>${label}</span><strong>${value}</strong></div>
    <div class="v7-meter" role="img" aria-label=${label + ': ' + value}>
      <span style=${'width:' + Math.round(part * 100) + '%'}></span>
    </div>
  </div>`;
}
const ofTxt = (a, b) => L(a + ' из ' + b, a + ' of ' + b);

function Coincidences() {
  const c = coincidences7(U.coinN);
  const seg = html`<${Seg}
    label=${L('Период', 'Period')}
    val=${U.coinN}
    set=${v => {
      U.coinN = v;
      rr();
    }}
    items=${PERIODS.map(p => [p, p === 7 ? L('неделя', 'week') : p === 14 ? L('2 недели', '2 weeks') : L('месяц', 'month')])}
  />`;
  let body;
  if (!myList().length)
    body = html`<section class="v7-card">
      <h2 class="v7-h2">${L('нет своих симптомов', 'no symptoms chosen')}</h2>
      <p class="v7-body">
        ${L('Совпадения считаются по симптомам, которые вы отмечаете каждый день', 'Coincidences use the symptoms you mark every day')}
      </p>
      ${B('v7-btn v7-pri', () => open('set-sym'), L('выбрать симптомы', 'choose symptoms'))}
    </section>`;
  else if (!c.enough)
    body = html`<section class="v7-card" aria-labelledby="v7-few">
      <h2 id="v7-few" class="v7-h2">${L('пока мало данных', 'not enough data yet')}</h2>
      <p class="v7-body">
        ${L('Нужно хотя бы ' + c.need + ' дней с отметкой, чтобы сравнение что-то значило', 'At least ' + c.need + ' days with a check-in are needed for the comparison to mean anything')}
      </p>
      <${Bar}
        label=${L('дней с отметкой', 'days with a check-in')}
        value=${ofTxt(c.checked, c.need)}
        part=${c.checked / c.need}
      />
    </section>`;
  else if (!c.found.length && !c.calm.length && !c.flat.length)
    body = html`<section class="v7-card">
      <h2 class="v7-h2">${L('совпадений не видно', 'no coincidences seen')}</h2>
      <p class="v7-body">
        ${L('За этот период ваши симптомы не появлялись чаще рядом с жарой, циклом или едой', 'In this period your symptoms didn’t show up more often with heat, the cycle or food')}
      </p>
    </section>`;
  else
    body = html`${c.found.map(
      x =>
        html`<section class="v7-card" aria-label=${cap(x.f.name) + L(' и ', ' and ') + myName(x.s)}>
          <h2 class="v7-h2">${cap(x.f.name) + L(' и ', ' and ') + myName(x.s)}</h2>
          <${Bar} label=${x.f.yes} value=${ofTxt(x.a, x.ya)} part=${x.a / x.ya} />
          <${Bar}
            label=${L('в остальные дни', 'on other days')}
            value=${ofTxt(x.b, x.nb)}
            part=${x.b / x.nb}
          />
          <p class="v7-note">
            ${x.f.more}${x.few ? L('. Дней пока мало, это может быть случайностью', '. There are few days so far, this may be chance') : ''}
          </p>
        </section>`,
    )}
    ${c.calm.map(
      x =>
        html`<section class="v7-card">
          <h2 class="v7-h2">${cap(x.f.name) + L(' и ', ' and ') + myName(x.s)}</h2>
          <${Bar} label=${x.f.yes} value=${ofTxt(x.a, x.ya)} part=${x.a / x.ya} />
          <${Bar}
            label=${L('в остальные дни', 'on other days')}
            value=${ofTxt(x.b, x.nb)}
            part=${x.b / x.nb}
          />
          <p class="v7-note">${L('Разницы почти нет. ', 'Almost no difference. ') + x.f.calm}</p>
        </section>`,
    )}
    ${c.flat.map(
      x =>
        html`<section class="v7-card">
          <h2 class="v7-h2">${cap(myName(x.s))}</h2>
          <${Bar}
            label=${L('дней с ним', 'days with it')}
            value=${ofTxt(x.days, x.days)}
            part=${1}
          />
          <p class="v7-note">
            ${L('Был каждый день, поэтому сравнить не с чем. Покажу совпадения, когда появятся дни без него', 'It was there every day, so there’s nothing to compare. I’ll show coincidences when there are days without it')}
          </p>
        </section>`,
    )}`;
  return html`<${Head}
      title=${L('совпадения', 'coincidences')}
      sub=${L('Из ваших отметок. Совпадения, не причины', 'From your check-ins. Coincidences, not causes')}
      right=${html`<${MenuButton} />`}
    />
    <div class="v7-stack">
      ${seg}${body}
      <p class="v7-foot">
        ${L('Пропущенные дни не считаются. Не медицинский вывод', 'Skipped days don’t count. Not a medical conclusion')}
      </p>
    </div>`;
}

function Doctor() {
  const s = summary7(U.docN);
  const [shown, setShown] = useState(false);
  const txt = summaryText7(s);
  const copy = () => {
    const ok = () => {
      setShown(true);
      toast({
        title: L('Скопировала обычным текстом', 'Copied as plain text'),
        sub: L(
          'Можно вставить в сообщение врачу или в заметки',
          'You can paste it into a message to your doctor or into notes',
        ),
      });
    };
    try {
      navigator.clipboard.writeText(txt).then(ok, () => setShown(true));
    } catch (e) {
      setShown(true);
    }
  };
  const feelRows = FEEL.slice()
    .reverse()
    .filter(x => s.feel[x[0]]);
  return html`<${Head}
      title=${L('к врачу', 'for the doctor')}
      sub=${L('Сводка: ', 'Summary: ') + fDM(s.from) + ' – ' + fDM(s.to) + ', ' + nDays(s.n)}
      right=${html`<${MenuButton} />`}
    />
    <div class="v7-stack">
      <${Seg}
        label=${L('Период сводки', 'Summary period')}
        val=${U.docN}
        set=${v => {
          U.docN = v;
          setShown(false);
          rr();
        }}
        items=${[
          [14, L('2 недели', '2 weeks')],
          [30, L('месяц', 'month')],
          [90, L('3 месяца', '3 months')],
        ]}
      />
      ${
        s.checked
          ? html`<section class="v7-card v7-tight" aria-labelledby="v7-fact">
                <h2 id="v7-fact" class="v7-h2">
                  ${L('самочувствие и лекарства', 'feeling and medications')}
                </h2>
                <dl class="v7-facts">
                  ${feelRows.map(
                    x =>
                      html`<div>
                        <dt>${L(x[1][0], x[1][1])}</dt>
                        <dd>${nDays(s.feel[x[0]])}</dd>
                      </div>`,
                  )}
                  ${
                    s.worse.length
                      ? html`<div>
                          <dt>${L('период хуже обычного', 'worse-than-usual period')}</dt>
                          <dd>${s.worse.join(', ')}</dd>
                        </div>`
                      : null
                  }
                  ${s.meds
                    .filter(m => m.due)
                    .map(
                      m =>
                        html`<div>
                          <dt>${m.m.name}</dt>
                          <dd>${L('принято ', 'taken ') + ofTxt(m.took, m.due)}</dd>
                        </div>`,
                    )}
                  <div>
                    <dt>${L('дней с отметкой', 'days with a check-in')}</dt>
                    <dd>${ofTxt(s.checked, s.n)}</dd>
                  </div>
                </dl>
              </section>
              ${
                s.sym.length
                  ? html`<section class="v7-card" aria-labelledby="v7-sd">
                      <h2 id="v7-sd" class="v7-h2">
                        ${L('симптомы, дней из ', 'symptoms, days out of ') + s.checked}
                      </h2>
                      ${s.sym.map(x => html`<${Bar} label=${myName(x.s)} value=${String(x.days)} part=${x.days / s.checked} />`)}
                    </section>`
                  : null
              }
              ${
                s.questions.length
                  ? html`<section class="v7-card v7-tight">
                      <h2 class="v7-h2">${L('вопросы к врачу', 'questions for the doctor')}</h2>
                      <ul class="v7-qs">
                        ${s.questions.map(q => html`<li>${q}</li>`)}
                      </ul>
                    </section>`
                  : null
              }
              <p class="v7-foot">
                ${L('Только из ваших записей. Не медицинский вывод', 'Only from your entries. Not a medical conclusion')}
              </p>
              <div class="v7-pair">
                ${B('v7-btn v7-pri', copy, L('скопировать текстом', 'copy as text'))}
                ${B('v7-btn v7-sec', () => open('big'), L('показать крупно', 'show large'))}
              </div>
              ${
                shown
                  ? html`<section class="v7-card v7-tight" aria-labelledby="v7-txt">
                      <h2 id="v7-txt" class="v7-h2">
                        ${L('так вставится', 'this is what gets pasted')}
                      </h2>
                      <pre class="v7-pre" tabindex="0">${txt}</pre>
                    </section>`
                  : null
              }`
          : html`<section class="v7-card">
              <h2 class="v7-h2">${L('пока пусто', 'nothing yet')}</h2>
              <p class="v7-body">
                ${L('Сводка собирается из ежедневных отметок. Начните с отметки за сегодня', 'The summary is built from daily check-ins. Start with today’s check-in')}
              </p>
              ${B(
                'v7-btn v7-pri',
                () => {
                  go('today');
                  startFlow(todayK());
                },
                L('отметить сегодня', 'check in for today'),
              )}
            </section>`
      }
    </div>`;
}

function BigSummary() {
  const s = summary7(U.docN);
  return html`<${Head}
      title=${L('сводка', 'summary')}
      sub=${fDM(s.from) + ' – ' + fDM(s.to)}
      backTo=${L('к врачу', 'for the doctor')}
    />
    <div class="v7-stack"><pre class="v7-pre v7-huge" tabindex="0">${summaryText7(s)}</pre></div>`;
}

// ---- settings ----
function Settings() {
  const v = V();
  const row = (t, s, fn) =>
    B(
      'v7-row v7-chev',
      fn,
      html`<span class="v7-grow"
          ><span class="v7-row-t">${t}</span
          >${s ? html`<span class="v7-row-s">${s}</span>` : null}</span
        ><span aria-hidden="true" class="v7-chev-i">›</span>`,
    );
  return html`<${Head}
      title=${L('настройки', 'settings')}
      backTo=${U.tab === 'today' ? L('сегодня', 'today') : U.tab === 'coin' ? L('совпадения', 'coincidences') : L('к врачу', 'for the doctor')}
    />
    <div class="v7-stack">
      <section class="v7-card v7-tight" aria-label=${L('Отметка', 'Check-in')}>
        ${row(L('мои симптомы', 'my symptoms'), myList().map(myName).join(', ') || L('не выбраны', 'none chosen'), () => open('set-sym'))}
        ${row(
          L('лекарства', 'medications'),
          medList()
            .map(m => m.name)
            .join(', ') || L('нет', 'none'),
          () => open('set-med'),
        )}
      </section>
      <section class="v7-card v7-tight" aria-labelledby="v7-comf">
        <h2 id="v7-comf" class="v7-h2">${L('удобство', 'comfort')}</h2>
        <p class="v7-row-s">${L('как удобнее отмечать', 'how you prefer to mark')}</p>
        <${InputMode} />
        <${Switch}
          label=${L('простой экран', 'simple screen')}
          sub=${L('Для тяжелых дней: только отметка и одна кнопка', 'For hard days: only the check-in and one button')}
          on=${v.simple}
          set=${x => {
            v.simple = x;
            save();
            rr();
          }}
        />
        <${Switch}
          label=${L('крупный текст', 'large text')}
          on=${!!ST.bigText}
          set=${x => {
            ST.bigText = x;
            save();
            rr();
          }}
        />
        <${Switch}
          label=${L('вибрация при нажатии', 'vibration on tap')}
          on=${ST.comfort.haptic}
          set=${x => {
            ST.comfort.haptic = x;
            save();
            rr();
          }}
        />
      </section>
      <section class="v7-card v7-tight" aria-labelledby="v7-look">
        <h2 id="v7-look" class="v7-h2">${L('вид и язык', 'look and language')}</h2>
        <${Seg}
          label=${L('Тема', 'Theme')}
          val=${ST.theme}
          set=${x => {
            ST.theme = x;
            save();
            applyTheme7();
            rr();
          }}
          items=${[
            ['system', L('как в системе', 'system')],
            ['light', L('светлая', 'light')],
            ['dark', L('темная', 'dark')],
          ]}
        />
        <${Seg}
          label=${L('Язык', 'Language')}
          val=${ST.lang}
          set=${x => {
            ST.lang = x;
            save();
            rr();
          }}
          items=${[
            ['ru', 'Русский'],
            ['en', 'English'],
          ]}
        />
      </section>
      <section class="v7-card v7-tight" aria-labelledby="v7-data">
        <h2 id="v7-data" class="v7-h2">${L('данные', 'data')}</h2>
        <p class="v7-row-s">
          ${L('Все записи хранятся только на этом устройстве', 'All entries are stored only on this device')}
        </p>
        ${
          ST.demo
            ? B('v7-btn v7-sec', exitSample, L('выйти из примера', 'leave the sample'))
            : B(
                'v7-btn v7-sec',
                () => {
                  enterSample();
                  save();
                  U.page = null;
                  U.tab = 'today';
                  rr();
                },
                L('посмотреть пример данных', 'view sample data'),
              )
        }
        <${DeleteAll} />
      </section>
      <section class="v7-card v7-tight" aria-labelledby="v7-ver">
        <h2 id="v7-ver" class="v7-h2">${L('версия прототипа', 'prototype version')}</h2>
        <${Seg}
          label=${L('Версия прототипа', 'Prototype version')}
          val="7"
          set=${x => {
            try {
              localStorage.setItem('msapp.mode', x);
            } catch (e) {}
            location.replace(location.pathname + '?v=' + x + '&lang=' + (ST.lang || 'en'));
          }}
          items=${[
            ['5b', 'v5b'],
            ['6', 'v6'],
            ['7', 'v7'],
          ]}
        />
      </section>
      <p class="v7-foot">
        ${L('Не медицинское приложение. Не ставит диагнозы', 'Not a medical app. It makes no diagnoses')}
      </p>
    </div>`;
}
function DeleteAll() {
  const [ask, setAsk] = useState(false);
  if (!ask)
    return B(
      'v7-link v7-dangerlink',
      () => setAsk(true),
      L('удалить все записи', 'delete all entries'),
    );
  return html`<div class="v7-alertbox" role="alertdialog" aria-labelledby="v7-del">
    <p id="v7-del" class="v7-body">
      <strong>${L('Удалить все записи?', 'Delete all entries?')}</strong>
      ${L('Это нельзя отменить', 'This can’t be undone')}
    </p>
    ${B(
      'v7-btn v7-dangerbtn',
      () => {
        const keepLang = ST.lang;
        const s = defaults();
        s.lang = keepLang;
        setST(s);
        U.ob = 'welcome';
        U.page = null;
        U.tab = 'today';
        save();
        rr();
      },
      L('удалить все', 'delete all'),
    )}
    ${B('v7-btn v7-pri', () => setAsk(false), L('оставить записи', 'keep entries'))}
  </div>`;
}
function InputMode() {
  const v = V();
  return html`<${Seg}
    label=${L('Как удобнее отмечать', 'How you prefer to mark')}
    val=${v.input}
    set=${x => {
      v.input = x;
      save();
      rr();
    }}
    items=${[
      ['mixed', L('по-разному', 'mixed')],
      ['tap', L('только нажимать', 'tap only')],
      ['voice', L('больше голосом', 'mostly voice')],
      ['text', L('больше текстом', 'mostly text')],
    ]}
  />`;
}

function SymPicker({ onDone, inOnboarding }) {
  const v = V();
  const [own, setOwn] = useState(null);
  const sel = v.my;
  const full = sel.length >= MAX_MY;
  const toggle = k => {
    const i = sel.indexOf(k);
    if (i >= 0) sel.splice(i, 1);
    else if (!full) sel.push(k);
    else {
      announce(L('Это максимум, 5 из 5', 'That’s the maximum, 5 of 5'));
      return;
    }
    save();
    rr();
  };
  if (own !== null)
    return html`<${OwnSymptom}
      text=${own}
      setText=${setOwn}
      onAdd=${name => {
        const k = addCustom(name);
        if (!full) sel.push(k);
        setOwn(null);
        save();
      }}
    />`;
  const keys = [...CATALOG, ...Object.keys(ST.custom || {}).filter(k => k.startsWith('c_'))];
  return html`<div class="v7-stack">
    <p class="v7-sub" aria-live="polite">
      ${
        full
          ? L(
              'Это максимум, 5 из 5: так отметка займет меньше минуты. Остальное можно записать словами',
              'That’s the maximum, 5 of 5: this keeps the check-in under a minute. Anything else you can write in words',
            )
          : L(
              'Выбрано ' + sel.length + ' из 5. Их можно будет отмечать каждый день в один тап',
              sel.length + ' of 5 chosen. You’ll mark them each day in one tap',
            )
      }
    </p>
    <div class="v7-chips" role="group" aria-label=${L('Симптомы', 'Symptoms')}>
      ${keys.map(k => {
        const on = sel.includes(k);
        return B(
          'v7-chip' + (on ? ' on' : '') + (full && !on ? ' dim' : ''),
          () => toggle(k),
          html`${on ? html`<span aria-hidden="true">✓ </span>` : null}${myName(k)}`,
          {
            'aria-pressed': on ? 'true' : 'false',
          },
        );
      })}
      ${full ? null : B('v7-chip v7-add', () => setOwn(''), L('+ свое название', '+ my own name'))}
    </div>
    ${
      onDone
        ? html`<div class="v7-actions">
            ${B('v7-btn v7-pri', onDone, L('дальше', 'next'))}
            ${inOnboarding && !sel.length ? B('v7-btn v7-sec', onDone, L('выберу потом', 'choose later')) : null}
          </div>`
        : null
    }
  </div>`;
}
function OwnSymptom({ text, setText, onAdd }) {
  const m = text.match(/^(.*?)(?:,?\s*(когда|после|если|when|after|if)\s+(.*))?$/i);
  const name = (m && m[1] ? m[1] : text).trim();
  const ctx = m && m[3] ? m[2] + ' ' + m[3] : null;
  return html`<div class="v7-stack">
    <h2 class="v7-q">${L('как вы это называете?', 'what do you call it?')}</h2>
    <p class="v7-sub">
      ${L('Своими словами, как говорите врачу или близким', 'In your own words, the way you tell your doctor or family')}
    </p>
    <label class="v7-field"
      ><span class="v7-sr">${L('Название симптома', 'Symptom name')}</span>
      <input
        class="v7-input v7-boxed"
        value=${text}
        onInput=${e => setText(e.target.value)}
        placeholder=${L('например, нога отнимается', 'for example, my leg gives way')}
      />
    </label>
    ${
      name
        ? html`<section class="v7-card">
            <p class="v7-row-s">${L('будет в списке так', 'it will look like this')}</p>
            <p class="v7-q">${name}</p>
            ${ctx ? html`<p class="v7-body">${L('Вы добавили ' + qt(ctx) + '. Запишу как обстоятельство, а не как причину', 'You added ' + qt(ctx) + '. I’ll save it as a circumstance, not a cause')}</p>` : null}
            <div class="v7-pair">
              ${B('v7-btn v7-pri', () => onAdd(name), L('добавить', 'add'))}
              ${B('v7-btn v7-sec', () => setText(null), L('отмена', 'cancel'))}
            </div>
          </section>`
        : B('v7-btn v7-sec', () => setText(null), L('отмена', 'cancel'))
    }
  </div>`;
}
function MedEditor({ onDone, inOnboarding }) {
  const [name, setName] = useState('');
  const [sched, setSched] = useState('daily');
  const meds = medList();
  return html`<div class="v7-stack">
    ${
      meds.length
        ? html`<section class="v7-card v7-tight">
            <ul class="v7-list">
              ${meds.map(
                m =>
                  html`<li class="v7-entry">
                    <span class="v7-grow"
                      ><span class="v7-entry-t">${m.name}</span
                      ><span class="v7-entry-s">${schedName(m.sched)}</span></span
                    >
                    ${B(
                      'v7-small v7-ghost',
                      () => {
                        ST.meds = ST.meds.filter(x => x.id !== m.id);
                        save();
                        announce(L('Убрала ', 'Removed ') + m.name);
                        rr();
                      },
                      html`<span aria-hidden="true">${L('убрать', 'remove')}</span
                        ><span class="v7-sr">${L('Убрать ', 'Remove ') + m.name}</span>`,
                    )}
                  </li>`,
              )}
            </ul>
          </section>`
        : null
    }
    <section class="v7-card" aria-labelledby="v7-addmed">
      <h2 id="v7-addmed" class="v7-h2">${L('добавить лекарство', 'add a medication')}</h2>
      <label class="v7-field"
        ><span class="v7-row-s">${L('название', 'name')}</span>
        <input
          class="v7-input v7-boxed"
          value=${name}
          onInput=${e => setName(e.target.value)}
          placeholder=${L('например, витамин D', 'for example, vitamin D')}
        />
      </label>
      <${Seg}
        label=${L('Как часто', 'How often')}
        val=${sched}
        set=${setSched}
        items=${SCHED.map(([k, n]) => [k, L(n[0], n[1])])}
      />
      ${B(
        'v7-btn v7-sec',
        () => {
          if (!name.trim()) return announce(L('Введите название', 'Enter a name'));
          addMed(name, sched);
          setName('');
          save();
          announce(L('Добавила', 'Added'));
          rr();
        },
        L('добавить', 'add'),
      )}
    </section>
    <p class="v7-foot">
      ${L('Только отметка приема: без доз, советов и проверок. Напоминания появятся в приложении для iPhone', 'Only a taken mark: no doses, advice or checks. Reminders will come in the iPhone app')}
    </p>
    ${
      onDone
        ? html`<div class="v7-actions">
            ${B('v7-btn v7-pri', onDone, L('дальше', 'next'))}
            ${inOnboarding && !meds.length ? B('v7-btn v7-sec', onDone, L('не принимаю', 'I don’t take any')) : null}
          </div>`
        : null
    }
  </div>`;
}

// ---- onboarding ----
function Onboarding() {
  const v = V();
  const finish = () => {
    v.onboarded = true;
    v.start = todayK();
    save();
    U.tab = 'today';
    U.focus = 'h1';
    rr();
  };
  if (U.ob === 'sym')
    return html`<${Head} title=${L('что беспокоит?', 'what bothers you?')} />
      <${SymPicker}
        inOnboarding
        onDone=${() => {
          U.ob = 'med';
          U.focus = 'h1';
          rr();
        }}
      />`;
  if (U.ob === 'med')
    return html`<${Head}
        title=${L('что вы принимаете?', 'what do you take?')}
        sub=${L('По желанию. Только чтобы отмечать прием', 'Optional. Only to mark that you took it')}
      />
      <${MedEditor}
        inOnboarding
        onDone=${() => {
          U.ob = 'mode';
          U.focus = 'h1';
          rr();
        }}
      />`;
  if (U.ob === 'mode')
    return html`<${Head}
        title=${L('как вам удобнее отмечать?', 'how do you prefer to mark?')}
        sub=${L('Можно поменять в настройках', 'You can change this in settings')}
      />
      <div class="v7-stack">
        <div class="v7-opts" role="group" aria-label=${L('Способ отметки', 'Way to mark')}>
          ${[
            ['mixed', L('по-разному', 'mixed')],
            ['tap', L('только нажимать', 'tap only')],
            ['voice', L('больше голосом', 'mostly voice')],
            ['text', L('больше текстом', 'mostly text')],
          ].map(([k, n]) =>
            B(
              'v7-opt' + (v.input === k ? ' on' : ''),
              () => {
                v.input = k;
                save();
                rr();
              },
              html`${v.input === k ? html`<span aria-hidden="true">✓ </span>` : null}${n}`,
              { 'aria-pressed': v.input === k ? 'true' : 'false' },
            ),
          )}
        </div>
        <p class="v7-foot">
          ${L('Все в приложении можно сделать нажатиями, без голоса и текста', 'Everything in the app can be done by tapping, without voice or text')}
        </p>
        <div class="v7-actions">${B('v7-btn v7-pri', finish, L('начать', 'start'))}</div>
      </div>`;
  return html`<div class="v7-welcome">
    <div class="v7-lang" role="group" aria-label="Language">
      ${[
        ['en', 'English'],
        ['ru', 'Русский'],
      ].map(([k, n]) =>
        B(
          'v7-segb v7-small' + (ST.lang === k ? ' on' : ''),
          () => {
            ST.lang = k;
            save();
            rr();
          },
          n,
          { 'aria-pressed': ST.lang === k ? 'true' : 'false', lang: k },
        ),
      )}
    </div>
    <div class="v7-hero">
      <${Mascot} mood="happy" size=${96} />
      <h1 class="v7-h1 v7-hero-t" tabindex="-1">
        ${L('отмечайте, как вы, за минуту в день', 'check in on how you are, in a minute a day')}
      </h1>
      <p class="v7-body">
        ${L('Ваши симптомы и лекарства в пару касаний, остальное своими словами. Для себя и для врача', 'Your symptoms and medications in a few taps, everything else in your own words. For you and your doctor')}
      </p>
    </div>
    <div class="v7-actions">
      <p class="v7-foot">
        ${L('Не медицинское приложение. Записи хранятся только на устройстве', 'Not a medical app. Entries stay on your device')}
      </p>
      ${B(
        'v7-btn v7-pri',
        () => {
          U.ob = 'sym';
          U.focus = 'h1';
          rr();
        },
        L('начать', 'start'),
      )}
      ${B(
        'v7-btn v7-sec',
        () => {
          enterSample();
          save();
          U.tab = 'today';
          rr();
        },
        L('посмотреть с примером', 'try with sample data'),
      )}
    </div>
  </div>`;
}

// ---- shell ----
function Tabs() {
  const items = [
    ['today', L('сегодня', 'today'), 'M4.5 10.5L12 4.5l7.5 6v9h-15z'],
    ['coin', L('совпадения', 'coincidences'), 'M4 19V11M10 19V5M16 19v-6M22 19H2'],
    [
      'doc',
      L('к врачу', 'for the doctor'),
      'M8.5 3.8h7v3h-7zM6.5 5.3H5v15.2h14V5.3h-1.5M8.5 11.5h7M8.5 15.5h5',
    ],
  ];
  return html`<nav class="v7-tabs" aria-label=${L('Разделы', 'Sections')}>
    ${items.map(
      ([k, n, d]) =>
        html`<button
          type="button"
          class=${'v7b v7-tab' + (U.tab === k && !U.page ? ' on' : '')}
          aria-current=${U.tab === k && !U.page ? 'page' : null}
          onClick=${() => go(k)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d=${d} />
          </svg>
          <span>${n}</span>
        </button>`,
    )}
  </nav>`;
}
function Toast() {
  const t = U.toast;
  if (!t) return null;
  return html`<div class="v7-toast" onPointerDown=${holdToast} onFocusIn=${holdToast} key=${t.id}>
    <div class="v7-grow">
      <p class="v7-toast-t"><span aria-hidden="true">✓ </span>${t.title}</p>
      ${t.sub ? html`<p class="v7-toast-s">${t.sub}</p>` : null}
    </div>
    <div class="v7-toast-acts">
      ${
        t.undo
          ? B(
              'v7-small',
              () => {
                t.undo();
                haptic('undo');
                announce(L('Отменила', 'Undone'));
                hideToast();
              },
              t.undoLabel || L('отменить', 'undo'),
            )
          : null
      }
      ${B('v7-small v7-ghost', hideToast, html`<span aria-hidden="true">✕</span><span class="v7-sr">${L('Закрыть', 'Close')}</span>`)}
    </div>
  </div>`;
}
let THEMED7 = false;
function applyTheme7() {
  const r = document.documentElement;
  if (ST.theme === 'light' || ST.theme === 'dark') {
    r.setAttribute('data-theme', ST.theme);
    THEMED7 = true;
  } else if (THEMED7) {
    r.removeAttribute('data-theme');
    THEMED7 = false;
  }
}

export function App7() {
  const [, f] = useState(0);
  RERENDER = () => f(x => x + 1);
  const v = V();
  setLANG(ST.lang || 'en');
  document.documentElement.lang = LANG;
  const root = useRef(null);
  useEffect(() => {
    applyTheme7();
    if (ST.city && !ST.demo) fetchWx(false);
    const k = e => {
      if (e.key === 'Escape') {
        if (U.toast) hideToast();
        else if (U.card) {
          U.card = null;
          rr();
        } else if (U.page) back();
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  useEffect(() => {
    if (U.focus === 'h1' && root.current) {
      const h = root.current.querySelector('h1');
      if (h) h.focus({ preventScroll: false });
      U.focus = null;
    }
  });
  let screen;
  const ob = !v.onboarded;
  if (ob) screen = html`<${Onboarding} />`;
  else if (U.page === 'all') screen = html`<${AllToday} />`;
  else if (U.page === 'settings') screen = html`<${Settings} />`;
  else if (U.page === 'big') screen = html`<${BigSummary} />`;
  else if (U.page === 'set-sym')
    screen = html`<${Head}
        title=${L('мои симптомы', 'my symptoms')}
        sub=${L('До 5, отмечаются каждый день. Убранный симптом останется в истории', 'Up to 5, marked every day. A removed symptom stays in your history')}
        backTo=${L('настройки', 'settings')}
      /><${SymPicker} />`;
  else if (U.page === 'set-med')
    screen = html`<${Head}
        title=${L('лекарства', 'medications')}
        sub=${L('Только отметка приема', 'Only a taken mark')}
        backTo=${L('настройки', 'settings')}
      /><${MedEditor} />`;
  else if (U.tab === 'coin') screen = html`<${Coincidences} />`;
  else if (U.tab === 'doc') screen = html`<${Doctor} />`;
  else screen = html`<${Today} />`;
  const showTabs = !ob && !v.simple && !U.flow;
  return html`<div class=${'phone v7' + (ST.bigText ? ' v7-bigtext' : '')} ref=${root}>
    <main class="v7-scroll" id="v7-main">${screen}</main>
    <${Toast} />
    ${showTabs ? html`<${Tabs} />` : null}
    <div id="v7-live" class="v7-sr" aria-live="polite" role="status"></div>
  </div>`;
}

/** Called from main.js before the first render. */
export function initV7() {
  const v = V();
  if (!v.onboarded) U.ob = 'welcome';
  saveS(ST);
}
