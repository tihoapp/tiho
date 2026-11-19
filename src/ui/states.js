// v5 states: every Figma state, reachable by phrase
import {
  addEntries,
  handleText,
  logFood,
  logNote,
  logSym,
  rr,
  save,
  undoAct,
} from '../app/actions.js';
import { cmdBase } from '../app/commands.js';
import { seedDemo } from '../app/demo.js';
import { mealByTime, norm, sName, symName } from '../core/catalog.js';
import { onPeriod, periodStarts } from '../core/context.js';
import { addD, ddiff, dk, fDM, fRange, fT, fromDk, now, todayK } from '../core/dates.js';
import { E, mainSym as mainSymOf, onDay, symEnts, worseDayN } from '../core/entries.js';
import { EN, L, cap, lc, nDay, nEnt, plRu, qt } from '../core/text.js';
import { html } from '../lib/preact.js';
import { fetchWx } from '../services/weather.js';
import { LANG, ST, UI } from '../state/store.js';
import { monthOf } from './answers.js';
import { handleAll } from './app.js';
import { I, Mascot, SwRow } from './components.js';
import { B, ChipGrid, MODE, applyTheme, say, toast } from './feedback.js';
import { openSheet } from './frame.js';
import { haptic } from './haptics.js';

export function applyBig() {
  document.documentElement.classList.toggle('ax', !!ST.bigText);
}
export const card = o => say(Object.assign({ kind: 'card' }, o));
export const focusLine = ph => {
  UI.ph = ph || null;
  rr();
  setTimeout(() => {
    const el = document.getElementById('line');
    if (el) el.focus();
  }, 60);
};
const noPhoneSettings = () =>
  toast({
    title: L('В прототипе настроек телефона нет', 'No phone settings in the prototype'),
    sub: L('В приложении откроются Настройки iOS', 'The app opens iOS Settings'),
    icon: 'info',
    acts: [],
  });
export const speak = t => {
  if (!ST.readAloud) return;
  try {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = EN() ? 'en-US' : 'ru-RU';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) {}
};
const mainSym = () => mainSymOf() || 'fatigue';
export function protoDays() {
  return ST.protocol ? ddiff(now(), fromDk(ST.protocol.start)) + 1 : 0;
}
function protoStats() {
  const p = ST.protocol || ST.protocols[ST.protocols.length - 1];
  if (!p) return null;
  const k = mainSym();
  const a = fromDk(p.start),
    end = p.end ? fromDk(p.end) : now();
  const days = ddiff(end, a) + 1;
  const inP = symEnts(k).filter(e => e.d >= p.start && e.d <= dk(end)).length;
  const bA = dk(addD(a, -days)),
    bB = dk(addD(a, -1));
  const before = symEnts(k).filter(e => e.d >= bA && e.d <= bB).length;
  const foodDays = new Set(
    E()
      .filter(e => e.kind === 'food' && e.d >= p.start && e.d <= dk(end))
      .map(e => e.d),
  ).size;
  return { p, days, inP, before, k, foodDays, skips: Math.max(0, days - foodDays) };
}
// ---- commands ----
export function cmd(v) {
  const n = norm(v);
  if (/^(все состояния|all states)$/.test(n)) return say({ kind: 'states' });
  if (/^(виджеты|widgets)$/.test(n)) return say({ kind: 'widgets' });
  if (/^(мои слова|мои фразы|my words|my phrases)$/.test(n)) return myWords(null);
  if (
    /((выключ|отключ|убер|не нуж)\S*.{0,12}(цикл|месячн)|(цикл|месячн)\S*.{0,12}(не нуж|выключ|отключ)|(turn off|disable|stop tracking|don'?t need).{0,12}(cycle|period)|(cycle|period).{0,12}(off|not needed))/.test(
      n,
    )
  ) {
    ST.cycle = 'off';
    save();
    return toast({
      title: L('Цикл выключен', 'Cycle is off'),
      sub: L(
        'Включить можно в настройках или фразой «включи цикл»',
        'Turn it on in settings or say “turn on the cycle”',
      ),
      icon: 'info',
      acts: [
        {
          l: L('вернуть', 'undo'),
          fn: () => {
            ST.cycle = ST.health ? 'health' : 'manual';
            save();
            rr();
          },
        },
      ],
    });
  }
  if (
    /((включ|верни)\S*.{0,12}(цикл)|(turn on|enable|track).{0,12}(cycle))/.test(n) &&
    !/(выключ|отключ|off)/.test(n)
  ) {
    ST.cycle = ST.health ? 'health' : 'manual';
    save();
    return toast({
      title: L('Цикл включен', 'Cycle is on'),
      sub: L(
        'Когда начнутся месячные, скажите «месячные начались»',
        'When your period starts, say “my period started”',
      ),
      icon: 'info',
      acts: [],
    });
  }
  if (/(крупн\S* (шрифт|текст)|large text|big text)/.test(n)) {
    ST.bigText = !/(обычн|выключ|normal|off)/.test(n);
    save();
    applyBig();
    return toast({
      title: ST.bigText ? L('Крупный шрифт', 'Large text') : L('Обычный шрифт', 'Normal text'),
      sub: L('Можно менять и в настройках телефона', 'Can also be changed in phone settings'),
      acts: [],
    });
  }
  if (/^(обычный шрифт|normal text|normal size|обычный размер)$/.test(n)) {
    ST.bigText = false;
    save();
    applyBig();
    return toast({ title: L('Обычный шрифт', 'Normal text'), acts: [] });
  }
  if (/^(настройки|settings)[:\s]+(.+)$/.test(n)) {
    const p = n.replace(/^(настройки|settings)[:\s]+/, '');
    const map = {
      удобство: 'comfort',
      comfort: 'comfort',
      'ии и фото': 'ai',
      'ai and photos': 'ai',
      'мои симптомы': 'syms',
      'my symptoms': 'syms',
      цикл: 'cycle',
      cycle: 'cycle',
      'город и погода': 'city',
      'city and weather': 'city',
      'apple health': 'health',
      язык: 'lang',
      language: 'lang',
      'данные и доступ': 'data',
      'data and access': 'data',
    };
    if (map[p])
      return map[p] === 'data' ? say({ kind: 'data' }) : say({ kind: 'settings', page: map[p] });
  }
  // protocol
  if (
    /(с сегодня|со? завтра|начинаю|start(ing)?|from today).{0,20}(без |no |gluten|глютен|молоч|dairy|сахар|sugar)/.test(
      n,
    ) ||
    /(без (глютена|молочного|сахара)|(gluten|dairy|sugar)[- ]free|no (gluten|dairy|sugar)|cutting out (gluten|dairy|sugar)).{0,12}(с сегодня|со? завтра|from today|starting today|from tomorrow)/.test(
      n,
    ) ||
    /^(без глютена|без молочного|без сахара|gluten[- ]free|dairy[- ]free|sugar[- ]free)$/.test(n)
  ) {
    const name = /(глютен|gluten)/.test(n)
      ? L('без глютена', 'gluten free')
      : /(молоч|dairy)/.test(n)
        ? L('без молочного', 'dairy free')
        : /(сахар|sugar)/.test(n)
          ? L('без сахара', 'sugar free')
          : L('протокол', 'protocol');
    if (ST.protocol)
      return toast({
        title:
          L('Протокол уже идет: ', 'A protocol is already on: ') +
          ST.protocol.name +
          ', ' +
          nDay(protoDays()),
        sub: L(
          'Скажите «закончила протокол», чтобы начать новый',
          'Say “finished the protocol” to start a new one',
        ),
        icon: 'info',
        acts: [],
      });
    ST.protocol = { name, start: todayK() };
    save();
    return toast({
      title: EN() ? 'Saved: ' + name + ' from today' : 'Записала: с сегодня ' + name,
      sub: L(
        'День 1. Буду отмечать дни протокола. Через две недели покажу, как изменились записи',
        'Day 1. I will mark the protocol days. In two weeks I will show how the entries changed',
      ),
      acts: [
        {
          l: L('как это работает?', 'how does it work?'),
          fn: () =>
            card({
              title: L('протокол', 'protocol'),
              body: L(
                'Дни протокола помечаются в записях. Через 14 дней я сравню записи главного симптома за время протокола и за две недели до него. Это совпадение, не причина',
                'Protocol days are marked in entries. After 14 days I compare the main symptom entries during the protocol and two weeks before. A coincidence, not a cause',
              ),
              foot: true,
            }),
        },
      ],
    });
  }
  if (/(как идет протокол|история протокола|protocol history|how is the protocol)/.test(n)) {
    const s = protoStats();
    if (!s)
      return toast({
        title: L('Протокола сейчас нет', 'No protocol right now'),
        sub: L('Начать: «с сегодня без глютена»', 'Start: “gluten free from today”'),
        icon: 'info',
        acts: [],
      });
    return card({
      title: s.p.name + ', ' + L('день ', 'day ') + s.days,
      sub:
        L('С ', 'Since ') +
        fDM(fromDk(s.p.start)) +
        (s.skips ? ', ' + s.skips + L(' без фото еды', ' without food photos') : ''),
      rows: [
        [
          L('дни 1–7', 'days 1–7'),
          symName(s.k) +
            ': ' +
            nEnt(
              symEnts(s.k).filter(e => e.d >= s.p.start && e.d <= dk(addD(fromDk(s.p.start), 6)))
                .length,
            ),
        ],
        [
          L('дни 8–14', 'days 8–14'),
          symName(s.k) +
            ': ' +
            nEnt(
              symEnts(s.k).filter(
                e =>
                  e.d >= dk(addD(fromDk(s.p.start), 7)) && e.d <= dk(addD(fromDk(s.p.start), 13)),
              ).length,
            ),
        ],
        [L('до протокола', 'before'), nEnt(s.before) + L(' за ', ' in ') + nDay(s.days)],
      ],
      foot: true,
      chips: [
        {
          l: L('закончила протокол', 'finish the protocol'),
          fn: () => cmd(L('закончила протокол', 'finished the protocol')),
        },
        {
          l: L('продолжаю', 'continuing'),
          fn: () => {
            UI.resp = null;
            rr();
          },
        },
      ],
    });
  }
  if (/(закончил\S* протокол|finish(ed)? the protocol|stop the protocol)/.test(n)) {
    if (!ST.protocol)
      return toast({
        title: L('Протокола сейчас нет', 'No protocol right now'),
        icon: 'info',
        acts: [],
      });
    const p = ST.protocol;
    p.end = todayK();
    ST.protocols.push(p);
    ST.protocol = null;
    save();
    return toast({
      title: L('Записала: протокол ', 'Saved: protocol ') + p.name + L(' закончен', ' finished'),
      sub:
        nDay(ddiff(fromDk(p.end), fromDk(p.start)) + 1) +
        ', ' +
        fRange(fromDk(p.start), fromDk(p.end)) +
        L('. Итог сохранен в сводке к врачу', '. The result is kept in the doctor summary'),
      acts: [
        { l: L('сводка к врачу', 'doctor summary'), fn: () => say({ kind: 'summary', days: 30 }) },
      ],
    });
  }
  if (/(аллерги|непереносим|allerg|intoleran)/.test(n)) {
    const what = v
      .replace(
        /.*?(аллерги\S*|непереносимость|allergic to|allergy to|intolerance to|intolerant to)\s*(на\s+)?/i,
        '',
      )
      .replace(/[.!]+$/, '')
      .trim();
    if (!what)
      return card({
        title: L('аллергия', 'allergy'),
        body: L('Скажите, на что: «аллергия на орехи»', 'Say what to: “allergic to nuts”'),
        chips: [],
      });
    if (!ST.allergies.includes(what)) ST.allergies.push(what);
    save();
    return toast({
      title: L('Записала: аллергия на ', 'Saved: allergy to ') + what,
      sub: L(
        'Постоянно, в сводке к врачу. Если на фото еды будет это, предупрежу',
        'Permanent, in the doctor summary. If a food photo has it, I will warn you',
      ),
      acts: [
        {
          l: L('отменить', 'undo'),
          fn: () => {
            ST.allergies = ST.allergies.filter(a => a !== what);
            save();
            toast({ title: L('Убрала', 'Removed'), icon: 'undo' });
          },
        },
      ],
    });
  }
  if (
    /(прием|визит|appointment|visit).{0,8}(\d{1,2})\s*(\S+)/.test(n) &&
    !/(после|был|was|after)/.test(n)
  ) {
    const m = n.match(/(\d{1,2})\s*([а-яa-z]+)/);
    const mo = monthOf(m[2]);
    if (mo !== null) {
      const T = now();
      let d = new Date(T.getFullYear(), mo, +m[1], 12);
      if (d < addD(T, -1)) d = new Date(T.getFullYear() + 1, mo, +m[1], 12);
      ST.appt = dk(d);
      save();
      const dd = ddiff(d, T);
      return toast({
        title: L('Записала: прием ', 'Saved: appointment ') + fDM(d),
        sub:
          (dd > 0 ? (EN() ? `In ${nDay(dd)}. ` : `Через ${nDay(dd)}. `) : '') +
          L(
            'За день до приема предложу сводку. Без пушей, только на экране',
            'A day before, I will offer the summary. No push, only on screen',
          ),
        acts: [
          {
            l: L('сводка к врачу', 'doctor summary'),
            fn: () => say({ kind: 'summary', days: 30 }),
          },
        ],
      });
    }
  }
  if (/(что сказал врач|врач сказал|doctor said)/.test(n)) {
    const txt = v.replace(/.*?(врач сказал|сказал врач|doctor said)[:,]?\s*/i, '').trim();
    if (txt) {
      const ids = addEntries([{ kind: 'note', words: txt, doc: true, at: now().getTime() }]);
      save();
      return toast({
        title: L('Записала как заметку врача', 'Saved as a doctor note'),
        sub: qt(txt) + L('. Попадет в сводку', '. Goes into the summary'),
        acts: [undoAct(ids)],
      });
    }
  }
  return cmdBase(v);
}
// ---- my words: past phrases as large choices ----
export function myWords(after) {
  const words = [];
  for (const e of ST.entries) {
    if (e.words && !words.includes(e.words)) words.push(e.words);
    if (words.length >= 5) break;
  }
  if (!words.length)
    return toast({
      title: L('Своих фраз пока нет', 'No phrases of yours yet'),
      sub: L('Они появятся после первых записей', 'They appear after the first entries'),
      icon: 'info',
      acts: [],
    });
  say({ kind: 'words', words, after });
}
export function WordsBlock({ r }) {
  return html`<section class="card surf">
    <div class="row" style="align-items:flex-start">
      <div class="grow col4">
        <h2 class="q">${L('мои фразы', 'my phrases')}</h2>
        <p class="c ink2">${L('Как вы говорили раньше', 'How you said it before')}</p>
      </div>
      <button
        class="ib"
        aria-label=${L('К сегодня', 'Back to today')}
        onClick=${() => {
          UI.resp = null;
          rr();
        }}
      >
        <${I} n="close" />
      </button>
    </div>
    <div class="col8">
      ${r.words.map(
        w =>
          html`<button
            class="choice"
            key=${w}
            onClick=${() => {
              UI.resp = null;
              handleText(w);
            }}
          >
            ${w}
          </button>`,
      )}
    </div>
    <button
      class="link"
      onClick=${() => {
        UI.resp = null;
        rr();
      }}
    >
      ${L('ничего из этого', 'none of these')}
    </button>
  </section>`;
}
// ---- generic card ----
export function GenericCard({ r }) {
  const close = () => {
    UI.resp = null;
    rr();
  };
  return html`<section class=${'card ' + (r.tone || 'surf')} aria-live="polite">
    ${
      r.title
        ? html`<div class="row" style="align-items:flex-start">
            <div class="grow col4">
              <h2 class="q">${r.title}</h2>
              ${r.sub ? html`<p class="c ink2">${r.sub}</p>` : null}
            </div>
            <button class="ib" aria-label=${L('К сегодня', 'Back to today')} onClick=${close}>
              <${I} n="close" />
            </button>
          </div>`
        : null
    }
    ${
      r.mascot
        ? html`<div class="row">
            <${Mascot} mood=${r.mascot} size=${64} />
            <div class="grow"><p class="b">${r.body}</p></div>
          </div>`
        : r.body
          ? html`<p class="b">${r.body}</p>`
          : null
    }
    ${r.rows ? html`<div class="kvr">${r.rows.map(x => html`<span class="c ink2">${x[0]}</span><span class="c">${x[1]}</span>`)}</div>` : null}
    ${r.note ? html`<p class="c ink2">${r.note}</p>` : null}
    ${r.warn ? html`<div class="card state" style="padding:16px"><p class="c">${r.warn}</p></div>` : null}
    ${r.foot ? html`<p class="ai f"><${I} n="spark" s=${16} /><span>${L('Из ваших записей. Совпадения это не причины. ИИ может ошибаться. Не медицинская рекомендация', 'From your entries. Coincidences are not causes. AI can make mistakes. Not medical advice')}</span></p>` : null}
    ${r.button ? html`<button class="btn pri" onClick=${r.button.fn}>${r.button.l}</button>` : null}
    ${B && r.chips && r.chips.length ? html`<div class="foot"><${ChipGrid} items=${r.chips} /></div>` : null}
  </section>`;
}
// ---- widgets demo ----
export function WidgetsBlock() {
  const k = mainSym();
  const y = onDay(dk(addD(now(), -1))).filter(x => x.kind === 'sym');
  return html`<section class="card surf">
    <div class="row" style="align-items:flex-start">
      <div class="grow col4">
        <h2 class="q">${L('виджеты', 'widgets')}</h2>
        <p class="c ink2">
          ${L('Так они выглядят на главном экране и на экране блокировки. Ответ сохраняется без открытия приложения', 'This is how they look on the home and lock screens. The answer is saved without opening the app')}
        </p>
      </div>
      <button
        class="ib"
        aria-label=${L('К сегодня', 'Back to today')}
        onClick=${() => {
          UI.resp = null;
          rr();
        }}
      >
        <${I} n="close" />
      </button>
    </div>
    <div class="ch2">
      <div class="card surf" style="padding:14px;box-shadow:inset 0 0 0 1px var(--line)">
        <p class="f ink2">${L('главный', 'main')}</p>
        <p class="bs">${symName(k)}</p>
        <div class="wrap" style="margin-top:8px">
          ${[1, 2, 3].map(
            n =>
              html`<button
                class="chip"
                style="min-height:36px;padding:0 10px;font-size:13px"
                onClick=${() => {
                  UI.resp = null;
                  logSym([{ key: k, s: n, ctx: [] }], null, null);
                }}
              >
                <span>${sName(n)}</span>
              </button>`,
          )}
        </div>
      </div>
      <div class="card surf" style="padding:14px;box-shadow:inset 0 0 0 1px var(--line)">
        <p class="f ink2">${L('как вчера?', 'same as yesterday?')}</p>
        <p class="bs">
          ${y.length ? [...new Set(y.map(x => lc(symName(x.key))))].join(', ') : L('вчера тихо', 'quiet yesterday')}
        </p>
        <div class="wrap" style="margin-top:8px">
          <button
            class="chip"
            style="min-height:36px;padding:0 10px;font-size:13px"
            onClick=${() => {
              UI.resp = null;
              handleAll(L('как вчера', 'same as yesterday'));
            }}
          >
            <span>${L('да', 'yes')}</span></button
          ><button
            class="chip"
            style="min-height:36px;padding:0 10px;font-size:13px"
            onClick=${() => {
              UI.resp = null;
              rr();
            }}
          >
            <span>${L('нет', 'no')}</span>
          </button>
        </div>
      </div>
    </div>
    <div class="card doctor" style="padding:14px">
      <p class="f ink2">${L('живая активность', 'live activity')}</p>
      <p class="bs">
        ${ST.worse ? L('Хуже обычного, день ', 'Worse than usual, day ') + worseDayN() + L('. Как сегодня?', '. How is today?') : L('Вопрос дня: как сейчас?', 'Question of the day: how is it now?')}
      </p>
    </div>
  </section>`;
}
// ---- all states (moderator) ----
function statesList() {
  const T = now();
  const k = mainSym();
  const tk = todayK();
  const seedIf = () => {
    if (ST.entries.length < 5) seedDemo();
  };
  const g = (t, items) => ({ t, items });
  return [
    g(L('знакомство', 'welcome'), [
      [
        L('онбординг', 'onboarding'),
        () => {
          ST.onboarded = false;
          save();
        },
      ],
      [
        L('первый день', 'first day'),
        () => {
          ST.entries = [];
          ST.demo = false;
          save();
          UI.resp = null;
          rr();
        },
      ],
      [
        L('погода по месту', 'weather by location'),
        () =>
          card({
            body: L(
              'Погода помогает находить связь с жарой. Брать по геопозиции или указать город?',
              'Weather helps find links with heat. Use your location or set a city?',
            ),
            chips: [
              {
                l: L('по геопозиции', 'use location'),
                fn: () => {
                  ST.geo = true;
                  ST.city = null;
                  save();
                  UI.resp = null;
                  rr();
                },
              },
              {
                l: L('указать город', 'set a city'),
                fn: () => {
                  UI.resp = null;
                  focusLine(L('город, например Тбилиси', 'city, for example Tbilisi'));
                },
              },
            ],
          }),
      ],
    ]),
    g(L('сегодня и ответы', 'today and answers'), [
      [
        L('сегодня, пример данных', 'today, sample data'),
        () => {
          seedDemo();
          save();
          UI.resp = null;
          rr();
        },
      ],
      [
        L('тихий день', 'quiet day'),
        () => {
          seedIf();
          ST.entries = ST.entries.filter(e => e.d !== tk);
          save();
          UI.resp = null;
          rr();
        },
      ],
      [
        L('ответ: когда немело?', 'answer: when numb?'),
        () => {
          seedIf();
          handleAll(L('когда немели пальцы?', 'when were my fingers numb?'));
        },
      ],
      [
        L('совпадения', 'coincidences'),
        () => {
          seedIf();
          say({ kind: 'insights', keys: [] });
        },
      ],
      [
        L('цикл', 'cycle'),
        () => {
          seedIf();
          say({ kind: 'cycle', keys: [] });
        },
      ],
      [
        L('сводка к врачу', 'doctor summary'),
        () => {
          seedIf();
          say({ kind: 'summary', days: 30 });
        },
      ],
      [L('что можно сказать', 'what you can say'), () => say({ kind: 'help' })],
      [
        L('неделя', 'week'),
        () => {
          seedIf();
          handleAll(L('что было за неделю?', 'what happened this week?'));
        },
      ],
    ]),
    g(L('строка, голос, запись', 'line, voice, entry'), [
      [L('голос', 'voice'), () => say({ kind: 'voice', txt: '' })],
      [
        L('сила симптома', 'strength'),
        () => {
          UI.resp = null;
          UI.inline = k;
          rr();
        },
      ],
      [
        L('записала', 'saved'),
        () => {
          UI.resp = null;
          logSym([{ key: k, s: 2, ctx: [] }], null, null);
        },
      ],
      [
        L('после записи', 'after saving'),
        () => {
          UI.resp = null;
          logSym([{ key: k, s: 2, ctx: [] }], null, null);
          UI.mtoast = null;
          rr();
        },
      ],
      [
        L('исправить запись', 'edit entry'),
        () => {
          seedIf();
          openSheet('rec', { id: ST.entries[0].id });
        },
      ],
      [
        L('не поняла', 'did not catch that'),
        () => notUnderstood(L('какой-то странный день сегодня', 'a strange day somehow')),
      ],
      [
        L('мои фразы', 'my phrases'),
        () => {
          seedIf();
          myWords();
        },
      ],
      [L('температура', 'fever'), () => handleText(L('температура 37,8', 'fever 37.8'))],
      [L('новый симптом', 'new symptom'), () => handleText(L('двоится в глазах', 'seeing double'))],
      [L('пауза', 'pause'), () => cmd(L('пауза', 'pause'))],
      [L('без связи', 'offline'), () => offlineSave()],
      [
        L('медицинский вопрос', 'medical question'),
        () => handleText(L('можно ли удвоить дозу?', 'can I double the dose?')),
      ],
      [L('после таблетки', 'after a pill'), () => handleText(L('выпила таблетку', 'took my pill'))],
      [
        L('два симптома', 'two symptoms'),
        () => handleText(L('немеют пальцы и устала', 'fingers numb and tired')),
      ],
      [
        L('заметка', 'note'),
        () => {
          UI.resp = null;
          logNote(L('какой-то странный день', 'a strange day somehow'));
        },
      ],
      [
        L('похоже на повтор', 'looks like a repeat'),
        () => {
          logSym([{ key: k, s: 2, ctx: [] }], null, null);
          UI.mtoast = null;
          setTimeout(
            () => handleText(symName(k).toLowerCase() + ', ' + L('заметно', 'noticeably')),
            50,
          );
        },
      ],
      [
        L('запись уже в сводке', 'entry already in a summary'),
        () => {
          seedIf();
          ST.copiedAt = Date.now();
          save();
          openSheet('rec', { id: ST.entries[2].id });
        },
      ],
      [
        L('вопрос врачу из строки', 'question for the doctor'),
        () =>
          handleText(
            L(
              'спросить врача: связано ли онемение с жарой',
              'ask the doctor: is the numbness related to heat',
            ),
          ),
      ],
    ]),
    g(L('разрешения', 'permissions'), [
      [L('нет доступа к микрофону', 'no microphone access'), () => micDenied()],
      [L('нет доступа к камере', 'no camera access'), () => camDenied()],
    ]),
    g(L('хуже обычного и цикл', 'worse than usual and cycle'), [
      [
        L('хуже обычного, день 1', 'worse than usual, day 1'),
        () => {
          ST.worse = null;
          cmd(L('сегодня хуже обычного', 'worse than usual today'));
        },
      ],
      [
        L('что делалось', 'what was going on'),
        () => {
          if (!ST.worse) ST.worse = { start: dk(addD(T, -2)) };
          save();
          cmd(L('что делалось?', 'what was going on?'));
        },
      ],
      [
        L('вернулось к обычному', 'back to usual'),
        () => {
          if (!ST.worse) ST.worse = { start: dk(addD(T, -2)) };
          cmd(L('вернулось к обычному', 'back to usual'));
        },
      ],
      [
        L('месячные начались', 'period started'),
        () => cmd(L('месячные начались', 'my period started')),
      ],
    ]),
    g(L('еда', 'food'), [
      [
        L('фото еды', 'food photo'),
        () =>
          say({
            kind: 'photo',
            src: null,
            at: null,
            items: [],
            meal: mealByTime(T),
            w: 'now',
            other: false,
            txt: '',
            n: 1,
          }),
      ],
      [
        L('первое фото: распознавание', 'first photo: recognition'),
        () => {
          ST.photoConsent = null;
          save();
          photoConsent(() =>
            say({
              kind: 'photo',
              src: null,
              at: null,
              items: [],
              meal: 'lunch',
              w: 'now',
              other: false,
              txt: '',
              n: 1,
            }),
          );
        },
      ],
      [L('на фото не еда', 'not food'), () => notFood()],
      [
        L('не узнала продукты', 'dish not recognized'),
        () =>
          say({
            kind: 'photo',
            src: null,
            at: null,
            items: [],
            meal: 'lunch',
            w: 'now',
            other: false,
            txt: '',
            n: 1,
            nores: true,
          }),
      ],
      [
        L('фото из галереи, вчера', 'photo from gallery, yesterday'),
        () => photoYesterday(null, addD(T, -1).setHours(13, 20, 0, 0)),
      ],
      [
        L('несколько фото', 'several photos'),
        () =>
          say({
            kind: 'photo',
            src: null,
            at: null,
            items: [],
            meal: 'lunch',
            w: 'now',
            other: false,
            txt: '',
            n: 3,
          }),
      ],
      [
        L('из Telegram', 'from Telegram'),
        () =>
          card({
            title: L('из Telegram', 'from Telegram'),
            body: L(
              'Фото из чата, 12:05. Похоже на завтрак: омлет, кофе',
              'Photo from a chat, 12:05 PM. Looks like breakfast: omelette, coffee',
            ),
            note: L(
              'В прототипе: так приложение принимает фото через «поделиться»',
              'Prototype: this is how the app receives a photo via share',
            ),
            chips: [
              {
                l: L('да, завтрак', 'yes, breakfast'),
                fn: () => {
                  UI.resp = null;
                  logFood({
                    items: L('омлет, кофе', 'omelette, coffee').split(', '),
                    meal: 'breakfast',
                  });
                },
              },
              {
                l: L('не еда', 'not food'),
                fn: () => {
                  UI.resp = null;
                  rr();
                },
              },
            ],
          }),
      ],
    ]),
    g(L('питание', 'nutrition'), [
      [
        L('протокол: без глютена', 'protocol: gluten free'),
        () => {
          ST.protocol = null;
          cmd(L('с сегодня без глютена', 'gluten free from today'));
        },
      ],
      [
        L('протокол, день 14', 'protocol, day 14'),
        () => {
          seedIf();
          ST.protocol = { name: L('без глютена', 'gluten free'), start: dk(addD(T, -13)) };
          save();
          cmd(L('как идет протокол?', 'how is the protocol going?'));
        },
      ],
      [
        L('продолжаете протокол?', 'continue the protocol?'),
        () => {
          ST.protocol = { name: L('без глютена', 'gluten free'), start: dk(addD(T, -13)) };
          save();
          protoAsk();
        },
      ],
      [
        L('закончила протокол', 'protocol finished'),
        () => {
          if (!ST.protocol)
            ST.protocol = { name: L('без глютена', 'gluten free'), start: dk(addD(T, -13)) };
          cmd(L('закончила протокол', 'finished the protocol'));
        },
      ],
      [L('аллергия', 'allergy'), () => cmd(L('у меня аллергия на орехи', 'I am allergic to nuts'))],
    ]),
    g(L('к врачу', 'doctor'), [
      [
        L('дата приема', 'appointment date'),
        () => cmd(L('прием 20 ноября', 'appointment November 20')),
      ],
      [
        L('после приема', 'after the appointment'),
        () => {
          ST.appt = dk(addD(T, -1));
          save();
          afterAppt();
        },
      ],
      [
        L('сводка, мало записей', 'summary, few entries'),
        () => {
          ST.entries = ST.entries.slice(0, 4);
          save();
          say({ kind: 'summary', days: 30 });
        },
      ],
      [
        L('сводка без Здоровья', 'summary without Health'),
        () => {
          seedIf();
          ST.health = false;
          save();
          say({ kind: 'summary', days: 30 });
        },
      ],
      [
        L('сводка крупно для врача', 'summary, large for the doctor'),
        () => {
          seedIf();
          say({ kind: 'summary', days: 30, big: true });
        },
      ],
      [
        L('сводка скопирована', 'summary copied'),
        () => {
          ST.copiedAt = Date.now();
          save();
          toast({
            title: L('Скопировала сводку', 'Summary copied'),
            sub: L(
              'Вставьте в сообщение врачу или в заметки',
              'Paste it into a message to your doctor or into notes',
            ),
            acts: [],
          });
        },
      ],
    ]),
    g(L('пустые периоды', 'empty periods'), [
      [
        L('неделя без записей', 'a week without entries'),
        () => {
          seedIf();
          ST.entries = ST.entries.filter(e => e.d < dk(addD(T, -7)));
          save();
          UI.resp = null;
          rr();
        },
      ],
      [
        L('14 дней без записей', '14 days without entries'),
        () => {
          seedIf();
          ST.entries = ST.entries.filter(e => e.d < dk(addD(T, -14)));
          save();
          UI.resp = null;
          rr();
        },
      ],
      [
        L('итог первой недели', 'first week recap'),
        () => {
          seedIf();
          ST.firstDay = dk(addD(T, -7));
          ST.entries = ST.entries.filter(e => e.d >= ST.firstDay && e.d !== tk);
          save();
          UI.resp = null;
          rr();
        },
      ],
    ]),
    g(L('настройки и данные', 'settings and data'), [
      [L('настройки', 'settings'), () => say({ kind: 'settings' })],
      [L('удобство', 'comfort'), () => say({ kind: 'settings', page: 'comfort' })],
      [L('ИИ и фото', 'AI and photos'), () => say({ kind: 'settings', page: 'ai' })],
      [L('мои симптомы', 'my symptoms'), () => say({ kind: 'settings', page: 'syms' })],
      [L('цикл', 'cycle'), () => say({ kind: 'settings', page: 'cycle' })],
      [L('город и погода', 'city and weather'), () => say({ kind: 'settings', page: 'city' })],
      ['Apple Health', () => say({ kind: 'settings', page: 'health' })],
      [L('язык', 'language'), () => say({ kind: 'settings', page: 'lang' })],
      [L('данные и доступ', 'data and access'), () => say({ kind: 'data' })],
      [L('удалить все данные', 'delete all data'), () => cmd(L('стереть все', 'erase everything'))],
    ]),
    g(L('доступность', 'accessibility'), [
      [L('крупный шрифт', 'large text'), () => cmd(L('крупный шрифт', 'large text'))],
      [L('темная тема', 'dark theme'), () => cmd(L('темная тема', 'dark theme'))],
      [L('светлая тема', 'light theme'), () => cmd(L('светлая тема', 'light theme'))],
    ]),
    g(L('история', 'history'), [
      [
        L('история', 'history'),
        () => {
          seedIf();
          say({ kind: 'history', per: 30, f: 'all' });
        },
      ],
      [
        L('самочувствие', 'how I felt'),
        () => {
          seedIf();
          say({ kind: 'history', per: 30, f: 'sym' });
        },
      ],
      [
        L('еда', 'food'),
        () => {
          seedIf();
          say({ kind: 'history', per: 30, f: 'food' });
        },
      ],
      [
        L('хуже обычного', 'worse than usual'),
        () => {
          seedIf();
          say({ kind: 'history', per: 999, f: 'worse' });
        },
      ],
      [
        L('в жару', 'in the heat'),
        () => {
          seedIf();
          say({ kind: 'history', per: 30, f: 'hot' });
        },
      ],
      [L('пусто', 'empty'), () => say({ kind: 'history', per: 7, f: 'worse' })],
      [
        L('день', 'day'),
        () => {
          seedIf();
          say({
            kind: 'answer',
            q: L('записи за сегодня', 'today’s entries'),
            keys: [],
            range: { a: tk, b: tk, l: L('сегодня', 'today') },
            list: true,
          });
        },
      ],
      [
        L('запись на вчера', 'entry for yesterday'),
        () => handleText(L('вчера вечером была усталость', 'yesterday evening I was tired')),
      ],
    ]),
    g(L('виджеты', 'widgets'), [
      [L('виджеты и экран блокировки', 'widgets and lock screen'), () => say({ kind: 'widgets' })],
    ]),
  ];
}
export function StatesBlock() {
  const close = () => {
    UI.resp = null;
    rr();
  };
  return html`<section class="card surf">
    <div class="row" style="align-items:flex-start">
      <div class="grow col4">
        <h2 class="q">${L('все состояния', 'all states')}</h2>
        <p class="c ink2">
          ${L('Для модератора теста: открыть любое состояние. В приложении этого экрана нет', 'For the test moderator: open any state. This screen does not exist in the app')}
        </p>
      </div>
      <button class="ib" aria-label=${L('К сегодня', 'Back to today')} onClick=${close}>
        <${I} n="close" />
      </button>
    </div>
    ${statesList().map(
      g =>
        html`<div class="col4" key=${g.t}>
          <p class="lbl">${g.t}</p>
          <div class="rows">
            ${g.items.map(
              ([l, fn]) =>
                html`<button
                  class="li"
                  key=${l}
                  onClick=${() => {
                    UI.resp = null;
                    fn();
                    rr();
                  }}
                >
                  <span class="tt"><span class="bs">${l}</span></span
                  ><${I} n="chevR" />
                </button>`,
            )}
          </div>
        </div>`,
    )}
  </section>`;
}
// ---- single states ----
export function notUnderstood(v) {
  card({
    body: L(
      'Не поняла. Скажите иначе или выберите из своих слов',
      'I did not catch that. Say it differently or pick from your words',
    ),
    chips: [
      { l: L('мои фразы', 'my phrases'), fn: () => myWords() },
      {
        l: L('записать как есть', 'save as is'),
        fn: () => {
          UI.resp = null;
          logNote(v);
        },
      },
    ],
  });
}
function offlineSave() {
  const ids = addEntries([
    {
      kind: 'note',
      words: L('немеют пальцы после обеда', 'fingers numb after lunch'),
      raw: true,
      at: now().getTime(),
    },
  ]);
  save();
  toast({
    title: L('Записала как есть', 'Saved as is'),
    sub: L(
      'Связи нет. Запись сохранена на телефоне, разберу, когда появится сеть',
      'No connection. The entry is kept on your phone, I will sort it when the network is back',
    ),
    icon: 'info',
    acts: [undoAct(ids)],
  });
}
function micDenied() {
  card({
    body: L(
      'Микрофон для приложения выключен. Можно написать или включить его в настройках телефона',
      'The microphone is off for this app. You can type, or turn it on in phone settings',
    ),
    chips: [
      {
        l: L('написать', 'type'),
        fn: () => {
          UI.resp = null;
          focusLine();
        },
      },
      { l: L('открыть настройки', 'open settings'), fn: noPhoneSettings },
    ],
  });
}
function camDenied() {
  card({
    body: L(
      'Камера выключена. Можно выбрать фото из галереи или включить камеру в настройках',
      'The camera is off. You can pick a photo from the gallery or turn the camera on in settings',
    ),
    chips: [
      {
        l: L('из галереи', 'from gallery'),
        fn: () => {
          UI.resp = null;
          const el = document.querySelector('.cam input[type=file]');
          if (el) el.click();
        },
      },
      { l: L('открыть настройки', 'open settings'), fn: noPhoneSettings },
    ],
  });
}
export function notFood() {
  card({
    body: L(
      'Не похоже на еду. Сохранить как фото к дню?',
      'This does not look like food. Keep it as a photo of the day?',
    ),
    chips: [
      {
        l: L('сохранить к дню', 'keep for the day'),
        fn: () => {
          UI.resp = null;
          logNote(L('фото к дню', 'photo of the day'));
        },
      },
      {
        l: L('удалить', 'delete'),
        fn: () => {
          UI.resp = null;
          rr();
        },
      },
    ],
  });
}
export function photoConsent(go) {
  if (ST.photoConsent !== null) return go();
  card({
    title: L('первое фото еды', 'first food photo'),
    body: L(
      'Чтобы узнать блюдо, фото уйдет на распознавание. Хранится только на телефоне, результат можно исправить',
      'To name the dish, the photo goes out for recognition. It is stored only on your phone, the result can be edited',
    ),
    chips: [
      {
        l: L('распознавать', 'recognize'),
        fn: () => {
          ST.photoConsent = true;
          ST.recognize = true;
          save();
          go();
        },
      },
      {
        l: L('только сохранить фото', 'only keep the photo'),
        fn: () => {
          ST.photoConsent = false;
          ST.recognize = false;
          save();
          go();
        },
      },
    ],
  });
}
export function photoYesterday(src, at) {
  const d = new Date(at);
  card({
    body:
      L('Фото снято вчера, ', 'The photo was taken yesterday, ') +
      fT(d) +
      L('. Записать на вчера?', '. Save it for yesterday?'),
    chips: [
      {
        l: L('на вчера', 'for yesterday'),
        fn: () =>
          say({
            kind: 'photo',
            src,
            at,
            items: [],
            meal: mealByTime(d),
            w: 'photo',
            other: false,
            txt: '',
            n: 1,
          }),
      },
      {
        l: L('на сегодня', 'for today'),
        fn: () =>
          say({
            kind: 'photo',
            src,
            at: null,
            items: [],
            meal: mealByTime(now()),
            w: 'now',
            other: false,
            txt: '',
            n: 1,
          }),
      },
    ],
  });
}
export function protoAsk() {
  const s = protoStats();
  card({
    body:
      (s
        ? s.p.name +
          ' ' +
          nDay(s.days) +
          (s.skips >= 3
            ? L(', записей о еде три дня не было', ', no food entries for three days')
            : '')
        : '') + L('. Продолжаете?', '. Continuing?'),
    chips: [
      {
        l: L('продолжаю', 'continuing'),
        fn: () => {
          UI.resp = null;
          rr();
        },
      },
      {
        l: L('закончила протокол', 'finish the protocol'),
        fn: () => cmd(L('закончила протокол', 'finished the protocol')),
      },
    ],
  });
}
export function afterAppt() {
  card({
    body: L(
      'Прием был вчера. Что сказал врач, можно записать: попадет в сводку как заметка врача',
      'The appointment was yesterday. You can save what the doctor said: it goes into the summary as a doctor note',
    ),
    chips: [
      {
        l: L('записать', 'save'),
        fn: () => {
          UI.resp = null;
          focusLine(L('что сказал врач?', 'what did the doctor say?'));
        },
      },
      {
        l: L('ничего', 'nothing'),
        fn: () => {
          ST.appt = null;
          save();
          UI.resp = null;
          rr();
        },
      },
    ],
  });
}
export function newSymptomAsk(v, key, s) {
  card({
    body:
      cap(symName(key)) +
      L(
        ': такого в записях не было. Держится больше суток?',
        ': nothing like this in your entries. Has it lasted more than a day?',
      ),
    chips: [
      {
        l: L('больше суток', 'more than a day'),
        fn: () => {
          UI.resp = null;
          const ids = logSym([{ key, s, ctx: [], long: true }], null, v);
          const x = E().find(e => e.id === ids[0]);
          if (x) {
            x.newLong = true;
            save();
          }
          UI.mtoast = null;
          card({
            title: L('новое и долгое', 'new and lasting'),
            body:
              L('Записала: ', 'Saved: ') +
              lc(symName(key)) +
              L(
                ', больше суток. В сводке к врачу будет первым',
                ', more than a day. It goes first in the doctor summary',
              ),
            warn: L(
              'Если резко ухудшилось зрение, речь или сила в руке или ноге, обратитесь за помощью',
              'If your vision, speech or strength in an arm or leg got worse suddenly, seek help',
            ),
            chips: [
              {
                l: L('сводка к врачу', 'doctor summary'),
                fn: () => say({ kind: 'summary', days: 30 }),
              },
            ],
          });
        },
      },
      {
        l: L('меньше суток', 'less than a day'),
        fn: () => {
          UI.resp = null;
          logSym([{ key, s, ctx: [] }], null, v);
        },
      },
    ],
  });
}
// ---- settings pages ----
export function SettingsBlock({ r }) {
  const page = r && r.page;
  const close = () => {
    UI.resp = null;
    rr();
  };
  const back = () => say({ kind: 'settings' });
  const Head = ({ t, s }) =>
    html`<div class="row" style="align-items:flex-start">
      <div class="grow col4">
        <h2 class="q">${t}</h2>
        ${s ? html`<p class="c ink2">${s}</p>` : null}
      </div>
      <button class="ib" aria-label=${L('К сегодня', 'Back to today')} onClick=${close}>
        <${I} n="close" />
      </button>
    </div>`;
  const Tg = ({ k, on, fn, t, s }) => html`<${SwRow} on=${on} fn=${fn} t=${t} s=${s} />`;
  const Row = ({ t, s, fn }) =>
    html`<button class="li" onClick=${fn}>
      <span class="tt"
        ><span class="bs">${t}</span>${s ? html`<span class="c ink2">${s}</span>` : null}</span
      ><${I} n="chevR" />
    </button>`;
  if (!page)
    return html`<section class="card surf">
      <${Head} t=${L('настройки', 'settings')} />
      <div class="list">
        <${Row}
          t=${L('вид', 'display')}
          s=${(ST.theme === 'dark' ? L('Темная тема', 'Dark theme') : ST.theme === 'light' ? L('Светлая тема', 'Light theme') : L('Тема как в системе', 'Theme follows the system')) + (ST.bigText ? L(', крупный текст', ', large text') : '')}
          fn=${() => say({ kind: 'settings', page: 'view' })}
        />
        <${Row}
          t=${L('удобство', 'comfort')}
          s=${L('Отклик на нажатие, озвучивание', 'Tap feedback, read aloud')}
          fn=${() => say({ kind: 'settings', page: 'comfort' })}
        />
        <${Row}
          t=${L('ИИ и фото', 'AI and photos')}
          s=${L('Распознавание еды, подсказки чипов', 'Food recognition, chip suggestions')}
          fn=${() => say({ kind: 'settings', page: 'ai' })}
        />
        <${Row}
          t=${L('мои симптомы', 'my symptoms')}
          s=${L('Главный: ', 'Main: ') + symName(mainSym())}
          fn=${() => say({ kind: 'settings', page: 'syms' })}
        />
        <${Row}
          t=${L('цикл', 'cycle')}
          s=${ST.cycle === 'off' ? L('выключен', 'off') : L('виден только вам', 'only you can see it')}
          fn=${() => say({ kind: 'settings', page: 'cycle' })}
        />
        <${Row}
          t=${L('город и погода', 'city and weather')}
          s=${ST.geo ? ST.city || L('по геопозиции', 'by location') : L('выключена', 'off')}
          fn=${() => say({ kind: 'settings', page: 'city' })}
        />
        <${Row}
          t="Apple Health"
          s=${ST.health ? L('подключен, только чтение', 'connected, read only') : L('в приложении для iPhone', 'in the iPhone app')}
          fn=${() => say({ kind: 'settings', page: 'health' })}
        />
        <${Row}
          t=${L('язык', 'language')}
          s=${LANG === 'en' ? 'English' : 'русский'}
          fn=${() => say({ kind: 'settings', page: 'lang' })}
        />
        <${Row}
          t=${L('данные и доступ', 'data and access')}
          s=${L('Записи хранятся на телефоне', 'Entries are stored on your phone')}
          fn=${() => say({ kind: 'data' })}
        />
        <${Row}
          t=${L('версия прототипа', 'prototype version')}
          s=${MODE === '6' ? 'v6' : MODE === '5' ? 'v5' : 'v5b'}
          fn=${() => say({ kind: 'settings', page: 'ver' })}
        />
      </div>
      <p class="f ink2">
        ${L('Все это можно сказать строкой: «темная тема», «месячные начались», «english»', 'All of this can be said in the line: “dark theme”, “my period started”, “по-русски”')}
      </p>
    </section>`;
  const wrap = (t, s, body) =>
    html`<section class="card surf">
      <div class="row" style="align-items:flex-start">
        <button class="ib" aria-label=${L('Назад', 'Back')} onClick=${back}>
          <${I} n="chevL" />
        </button>
        <div class="grow col4">
          <h2 class="q">${t}</h2>
          ${s ? html`<p class="c ink2">${s}</p>` : null}
        </div>
        <button class="ib" aria-label=${L('К сегодня', 'Back to today')} onClick=${close}>
          <${I} n="close" />
        </button>
      </div>
      ${body}
    </section>`;
  if (page === 'comfort')
    return wrap(
      L('удобство', 'comfort'),
      L('Для онемевших пальцев и усталых глаз', 'For numb fingers and tired eyes'),
      html`<div class="list">
        <${Tg}
          on=${ST.readAloud}
          fn=${() => {
            ST.readAloud = !ST.readAloud;
            save();
            if (ST.readAloud) speak(L('Озвучивание включено', 'Read aloud is on'));
          }}
          t=${L('озвучивать ответы', 'read answers aloud')}
        /><${Tg}
          on=${ST.comfort.haptic !== false}
          fn=${() => {
            ST.comfort.haptic = ST.comfort.haptic === false;
            save();
            haptic('save');
          }}
          t=${L('сильный отклик на нажатие', 'strong tap feedback')}
          s=${L('Вибрация и встряска кнопки, чтобы нажатие было заметно даже онемевшими пальцами', 'Vibration and a button shake, so a tap is felt even with numb fingers')}
        />
      </div>`,
    );
  if (page === 'ai')
    return wrap(
      L('ИИ и фото', 'AI and photos'),
      L(
        'Фото хранятся только на телефоне. На распознавание уходит снимок без даты и места',
        'Photos stay on your phone. Recognition gets the image without date or location',
      ),
      html`<div class="list">
        <${Tg}
          on=${ST.recognize}
          fn=${() => {
            ST.recognize = !ST.recognize;
            ST.photoConsent = ST.recognize;
            save();
          }}
          t=${L('распознавать еду на фото', 'recognize food in photos')}
        /><${Tg}
          on=${ST.chipHints}
          fn=${() => {
            ST.chipHints = !ST.chipHints;
            save();
          }}
          t=${L('подсказки чипов', 'chip suggestions')}
        />
      </div>`,
    );
  if (page === 'syms') {
    const keys = [...new Set([mainSym(), ...ST.symptoms, ...Object.keys(ST.custom)])];
    return wrap(
      L('мои симптомы', 'my symptoms'),
      L('Главный показывается чипом', 'The main one shows as a chip'),
      html`<div class="col8">
          ${keys.map(
            k =>
              html`<button
                class=${'choice' + (k === mainSym() ? ' sel' : '')}
                key=${k}
                onClick=${() => {
                  ST.main = k;
                  ST.mainSet = true;
                  save();
                }}
              >
                ${symName(k)}${k === mainSym() ? L(', главный', ', main') : ''}
              </button>`,
          )}
        </div>
        <button
          class="link"
          onClick=${() => {
            UI.resp = null;
            focusLine(L('главный для меня: …', 'main one: …'));
          }}
        >
          ${L('добавить симптом', 'add a symptom')}
        </button>`,
    );
  }
  if (page === 'view') {
    const Seg3 = ({ val, items, fn, label }) =>
      html`<div class="seg" role="group" aria-label=${label}>
        ${items.map(([v, l]) => html`<button class=${'chip' + (val === v ? ' on' : '')} aria-pressed=${val === v} onClick=${() => fn(v)}><span>${l}</span></button>`)}
      </div>`;
    const th = ST.theme === 'light' || ST.theme === 'dark' ? ST.theme : 'system';
    return wrap(
      L('вид', 'display'),
      L('По умолчанию как в системе iPhone', 'Follows your iPhone settings by default'),
      html`<div class="col8">
          <p class="bs">${L('Тема', 'Theme')}</p>
          <${Seg3}
            label=${L('Тема', 'Theme')}
            val=${th}
            fn=${v => {
              ST.theme = v;
              save();
              applyTheme();
              rr();
            }}
            items=${[
              ['system', L('как в системе', 'system')],
              ['light', L('светлая', 'light')],
              ['dark', L('темная', 'dark')],
            ]}
          />
        </div>
        <div class="list">
          <${Tg}
            on=${ST.bigText}
            fn=${() => {
              ST.bigText = !ST.bigText;
              save();
              applyBig();
              rr();
            }}
            t=${L('крупный текст', 'large text')}
            s=${L('Текст и кнопки крупнее, подсказки по одной в строку', 'Bigger text and buttons, one suggestion per row')}
          />
        </div>`,
    );
  }
  if (page === 'ver')
    return wrap(
      L('версия прототипа', 'prototype version'),
      L('Записи общие для всех версий', 'Entries are shared across versions'),
      html`<div class="col8">
        ${[
          ['5', 'v5', L('Строка контекста над карточкой', 'Context row above the card')],
          ['5b', 'v5b', L('Минимум: карточка и два чипа', 'Minimal: the card and two chips')],
          ['6', 'v6', L('Последние три записи в карточке', 'The last three entries in the card')],
        ].map(
          ([v, t, d]) =>
            html`<button
              class=${'choice' + (MODE === v ? ' sel' : '')}
              aria-pressed=${MODE === v}
              onClick=${() => {
                if (MODE === v) return;
                try {
                  localStorage.setItem('msapp.mode', v);
                } catch (e) {}
                location.replace(location.pathname + '?v=' + v + '&lang=' + (ST.lang || 'en'));
              }}
            >
              <span class="tt"><span class="bs">${t}</span><span class="c ink2">${d}</span></span>
            </button>`,
        )}
      </div>`,
    );
  if (page === 'cycle') {
    const st = periodStarts(),
      last = st[0],
      on = last && onPeriod(now()),
      end = last && ST.periodEnds[last];
    const gaps = [];
    for (let k = 0; k + 1 < st.length && k < 6; k++)
      gaps.push(ddiff(fromDk(st[k]), fromDk(st[k + 1])));
    const avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
    const Info = ({ t, v }) =>
      html`<div class="li" style="cursor:default">
        <span class="tt"><span class="c ink2">${t}</span><span class="bs">${v}</span></span>
      </div>`;
    return wrap(
      L('цикл', 'cycle'),
      L(
        'Виден только вам. В сводку попадает как «дни до месячных»',
        'Only you can see it. In the summary it appears as “days before a period”',
      ),
      html`<div class="list">
          <${Tg}
            on=${ST.cycle !== 'off'}
            fn=${() => {
              ST.cycle = ST.cycle === 'off' ? (ST.health ? 'health' : 'manual') : 'off';
              save();
              rr();
            }}
            t=${L('учитывать цикл', 'track the cycle')}
            s=${L('Выключите, если не нужно: например, беременность, менопауза или его нет', 'Turn off if it does not apply: pregnancy, menopause, or no cycle')}
          />
          ${ST.cycle !== 'off' ? html`<${Info} t=${L('последние месячные', 'last period')} v=${last ? fDM(fromDk(last)) + (end ? '–' + fDM(fromDk(end)) : on ? L(', идут', ', ongoing') : '') : L('не отмечены', 'not marked')} /><${Info} t=${L('длина цикла', 'cycle length')} v=${avg ? (EN() ? `about ${avg} days` : `около ${avg} ${plRu(avg, 'дня', 'дней', 'дней')}`) : L('посчитается после двух отметок', 'calculated after two marks')} />` : null}
        </div>
        ${ST.cycle !== 'off' ? html`<div class="col8">${on && !end ? html`<button class="btn sec" onClick=${() => cmd(L('месячные закончились', 'my period ended'))}>${L('месячные закончились', 'period ended')}</button>` : html`<button class="btn sec" onClick=${() => cmd(L('месячные начались', 'my period started'))}>${L('месячные начались сегодня', 'period started today')}</button>`}</div>` : null}`,
    );
  }
  if (page === 'city')
    return wrap(
      L('город и погода', 'city and weather'),
      L(
        'Нужна только температура. Место хранится примерно, до города',
        'Only the temperature is needed. The place is kept roughly, to the city',
      ),
      html`<div class="list">
          <${Tg}
            on=${ST.geo}
            fn=${() => {
              ST.geo = !ST.geo;
              save();
              if (ST.geo) fetchWx(true);
            }}
            t=${L('погода в записях', 'weather in entries')}
          />
        </div>
        <div class="col8">
          <button
            class="choice"
            onClick=${() => {
              UI.resp = null;
              focusLine(L('город, например Тбилиси', 'city, for example Tbilisi'));
            }}
          >
            ${ST.city || (ST.wx && ST.wx.lat != null ? L('по геопозиции', 'by location') : L('указать город', 'set a city'))}
          </button>
        </div>`,
    );
  if (page === 'health' && !ST.demo)
    return wrap(
      'Apple Health',
      L(
        'Подключится в приложении для iPhone, только чтение',
        'Connects in the iPhone app, read only',
      ),
      html`<p class="b">
        ${L('Здесь цикл можно отмечать словами: «месячные начались»', 'Here you can mark the cycle in words: “my period started”')}
      </p>`,
    );
  if (page === 'health')
    return wrap(
      'Apple Health',
      L(
        'Только чтение. Приложение ничего не записывает в Здоровье',
        'Read only. The app writes nothing to Health',
      ),
      html`<div class="list">
        <${Tg}
          on=${ST.health}
          fn=${() => cmd(ST.health ? L('отключи Здоровье', 'disconnect Health') : L('подключи Здоровье', 'connect Health'))}
          t=${L('подключено', 'connected')}
        /><${Tg}
          on=${ST.hk.steps}
          fn=${() => {
            ST.hk.steps = !ST.hk.steps;
            save();
          }}
          t=${L('шаги', 'steps')}
        /><${Tg}
          on=${ST.hk.sleep}
          fn=${() => {
            ST.hk.sleep = !ST.hk.sleep;
            save();
          }}
          t=${L('сон', 'sleep')}
        /><${Tg}
          on=${ST.hk.walk}
          fn=${() => {
            ST.hk.walk = !ST.hk.walk;
            save();
          }}
          t=${L('скорость ходьбы', 'walking speed')}
        />
      </div>`,
    );
  if (page === 'lang')
    return wrap(
      L('язык', 'language'),
      L(
        'Записи остаются на том языке, на котором сказаны',
        'Entries stay in the language they were said in',
      ),
      html`<div class="col8">
        <button class=${'choice' + (LANG === 'ru' ? ' sel' : '')} onClick=${() => cmd('по-русски')}>
          русский</button
        ><button class=${'choice' + (LANG === 'en' ? ' sel' : '')} onClick=${() => cmd('english')}>
          English
        </button>
      </div>`,
    );
  return null;
}

/** Runs once at startup, called from main.js in a fixed order. */
export function applyStoredDefaults() {
  // ===== v5 states: everything from the figma sections, reachable by phrase or from «все состояния» =====
  ST.periodEnds = ST.periodEnds || {};
  ST.protocol = ST.protocol || null;
  ST.protocols = ST.protocols || [];
  ST.allergies = ST.allergies || [];
  ST.appt = ST.appt || null;
  ST.copiedAt = ST.copiedAt || 0;
  ST.photoConsent = ST.photoConsent === undefined ? null : ST.photoConsent;
  ST.recognize = ST.recognize !== false;
  ST.chipHints = ST.chipHints !== false;
  ST.readAloud = !!ST.readAloud;
  ST.bigText = !!ST.bigText;
  ST.hk = ST.hk || { steps: true, sleep: true, walk: true };
  applyBig();
}
