// Shared components: icons, mascot, today, sheets
import {
  handleText,
  justNow,
  logNote,
  logSym,
  removeIds,
  save,
  sortE,
  whenOpts,
} from '../app/actions.js';
import { HEAT, OB_SYM, SYM, ctxText, mealName, sName, symName } from '../core/catalog.js';
import {
  cycleTile,
  fmtNum,
  isHot,
  periodStarts,
  prePeriod,
  stepsFor,
  tempFor,
  weatherOn,
} from '../core/context.js';
import {
  WEN,
  WRU,
  addD,
  dayTitle,
  ddiff,
  dk,
  fDM,
  fT,
  fromDk,
  now,
  relDT,
  todayK,
} from '../core/dates.js';
import { entrySub, entryTitle, onDay, symEnts } from '../core/entries.js';
import { strengthOf } from '../core/lexicon.js';
import { EN, L, cap, nDay, nEnt, plRu, qt } from '../core/text.js';
import { html, useRef, useState } from '../lib/preact.js';
import { ST } from '../state/store.js';
import { B, toast } from './feedback.js';
import { Frame, closeSheet, openSheet } from './frame.js';
import { cmd, focusLine } from './states.js';

// ===== components =====
const IC = {
  mic: 'M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v3.5',
  cam: 'M4 8.5h3.2L9 5.8h6l1.8 2.7H20V19H4zM12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  send: 'M12 19V5M6 11l6-6 6 6',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  chevR: 'M9.5 5.5L16 12l-6.5 6.5',
  chevL: 'M14.5 5.5L8 12l6.5 6.5',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.6v.4',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.8v1.8M12 19.4v1.8M2.8 12h1.8M19.4 12h1.8M5.5 5.5l1.3 1.3M17.2 17.2l1.3 1.3M5.5 18.5l1.3-1.3M17.2 6.8l1.3-1.3',
  steps:
    'M8.5 3.5c1.6 0 2.4 1.9 2.4 4.2 0 2.2-1 4.6-2.4 4.6S6 9.9 6 7.7c0-2.3.9-4.2 2.5-4.2zM6.6 14.6h3.8l-.4 2.6a1.5 1.5 0 0 1-3 0zM15.5 6.5c1.6 0 2.5 1.9 2.5 4.2 0 2.2-1 4.6-2.5 4.6s-2.4-2.4-2.4-4.6c0-2.3.8-4.2 2.4-4.2zM13.6 17.6h3.8l-.4 1.6a1.5 1.5 0 0 1-3 0z',
  drop: 'M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0c0-4.4 6-10.8 6-10.8z',
  home: 'M4.5 10.5L12 4.5l7.5 6v9h-15z',
  list: 'M4 6.5h16M4 12h16M4 17.5h10',
  doc: 'M8.5 3.8h7v3h-7zM6.5 5.3H5v15.2h14V5.3h-1.5M8.5 11.5h7M8.5 15.5h5',
  spark: 'M12 3.5l1.9 5 5.1 1.9-5.1 1.9-1.9 5-1.9-5-5.1-1.9 5.1-1.9z',
  plate:
    'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM3.5 4v5a2 2 0 0 0 2 2v9M5.5 4v5M20.5 4c-1.6 1-2 3.4-2 6h2v10',
  note: 'M6 3.8h8.5L18 7.3v12.9H6zM9 11h6M9 15h6',
  pulse: 'M3 12h4l2.2-5.5 4.6 11L16 12h5',
  star: 'M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.3l-4.8 2.5 1-5.4-4-3.7 5.4-.7z',
  copy: 'M8.5 8.5h11v11h-11zM5 15.5V4.5h11',
  plus: 'M12 5v14M5 12h14',
  cal: 'M4.5 6h15v14h-15zM4.5 10.5h15M8.5 3.5v4M15.5 3.5v4',
};
export function I({ n, s = 24 }) {
  return html`<svg
    width=${s}
    height=${s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d=${IC[n] || ''} />
  </svg>`;
}
let MID = 0;
export function Mascot({ mood = 'calm', size = 88 }) {
  const r = useRef(null);
  if (!r.current) r.current = 'mc' + ++MID;
  const id = r.current;
  const ink = 'var(--mink)';
  const eyes =
    mood === 'happy'
      ? html`<path
          d="M43.5 63q4.5-6 9 0M67.5 63q4.5-6 9 0"
          stroke=${ink}
          stroke-width="3.2"
          stroke-linecap="round"
          fill="none"
        />`
      : mood === 'rest'
        ? html`<path
            d="M43.5 62q4.5 4 9 0M67.5 62q4.5 4 9 0"
            stroke=${ink}
            stroke-width="3"
            stroke-linecap="round"
            fill="none"
          />`
        : html`<ellipse cx="48" cy="62" rx="3.6" ry="4.6" fill=${ink} /><ellipse
              cx="72"
              cy="62"
              rx="3.6"
              ry="4.6"
              fill=${ink}
            /><circle cx="49.3" cy="60.3" r="1.3" fill="#fff" /><circle
              cx="73.3"
              cy="60.3"
              r="1.3"
              fill="#fff"
            />`;
  const mouth =
    mood === 'happy'
      ? html`<path d="M52.5 70.5q7.5 8.5 15 0z" fill=${ink} />`
      : mood === 'rest'
        ? html`<path
            d="M57 73q3 2 6 0"
            stroke=${ink}
            stroke-width="2.6"
            stroke-linecap="round"
            fill="none"
          />`
        : html`<path
            d="M54.5 71.5q5.5 4.5 11 0"
            stroke=${ink}
            stroke-width="2.8"
            stroke-linecap="round"
            fill="none"
          />`;
  return html`<svg
    class="masc"
    width=${size}
    height=${size}
    viewBox="0 0 120 120"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <radialGradient id=${id + 'b'} cx="40%" cy="32%" r="74%">
        <stop offset="0" style="stop-color:var(--m1)" />
        <stop offset=".58" style="stop-color:var(--m2)" />
        <stop offset="1" style="stop-color:var(--m3)" />
      </radialGradient>
      <radialGradient id=${id + 'h'} cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".9" />
        <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
      <radialGradient id=${id + 's'} cx="50%" cy="50%" r="50%">
        <stop offset="0" style="stop-color:var(--mshadow)" stop-opacity=".26" />
        <stop offset="1" style="stop-color:var(--mshadow)" stop-opacity="0" />
      </radialGradient>
      <linearGradient id=${id + 't'} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color:var(--m2)" />
        <stop offset="1" style="stop-color:var(--m3)" />
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="106" rx="36" ry="7" fill=${'url(#' + id + 's)'} />
    <g class="mb">
      <path d="M59 21c-3.5-8 .5-14.5 9-16-.4 6.5-3.6 11.8-9 16z" fill=${'url(#' + id + 't)'} />
      <path
        d="M60 20c23 0 39 19 39 45 0 23-16 39-39 39S21 88 21 65c0-26 16-45 39-45z"
        fill=${'url(#' + id + 'b)'}
      />
      <path
        d="M88 46c6 8 8.5 18 6.5 28"
        stroke="#ffffff"
        stroke-opacity=".38"
        stroke-width="3"
        stroke-linecap="round"
        fill="none"
      />
      <ellipse
        cx="45"
        cy="38"
        rx="14"
        ry="8"
        fill=${'url(#' + id + 'h)'}
        transform="rotate(-22 45 38)"
      />
      <ellipse cx="39" cy="72.5" rx="7" ry="4" style="fill:var(--mcheek)" opacity=".55" />
      <ellipse cx="81" cy="72.5" rx="7" ry="4" style="fill:var(--mcheek)" opacity=".55" />
      ${eyes}${mouth}
    </g>
  </svg>`;
}

// ---- today ----
export function Ctx() {
  const items = [];
  const tw = weatherOn() ? tempFor(now()) : null;
  if (weatherOn() && tw == null && ST.wxErr)
    items.push(
      html`<button
        class="cx off"
        onClick=${() => focusLine(L('город, например Тбилиси', 'city, for example Tbilisi'))}
      >
        <${I} n="sun" s=${20} />${L('погода: укажите город', 'weather: set a city')}
      </button>`,
    );
  else if (weatherOn() && tw == null)
    items.push(
      html`<span class="cx"
        ><${I} n="sun" s=${20} /><span
          class="ink2"
          aria-label=${L('погода загружается', 'weather is loading')}
          >…</span
        ></span
      >`,
    );
  else if (weatherOn())
    items.push(
      html`<span class="cx"
        ><${I} n="sun" s=${20} /><span class="v num">${(tw > 0 ? '+' : '') + tw + '°'}</span
        ><span class="sr">${L('погода', 'weather')}</span></span
      >`,
    );
  else
    items.push(
      html`<button class="cx off" onClick=${() => cmd('settings')}>
        <${I} n="sun" s=${20} />${L('погода: включить', 'weather: turn on')}
      </button>`,
    );
  if (ST.health)
    items.push(
      html`<span class="cx"
        ><${I} n="steps" s=${20} /><span class="v num">${fmtNum(stepsFor(now()))}</span
        ><span class="ink2 stl">${L('шагов', 'steps')}</span></span
      >`,
    );
  const c = cycleTile();
  if (c && !c.none)
    items.push(
      html`<span class="cx"
        ><${I} n="drop" s=${20} /><span class="ink2">${c.l}</span
        ><span class="v num">${c.v}</span></span
      >`,
    );
  else if (c && c.none)
    items.push(
      html`<span class="cx"
        ><${I} n="drop" s=${20} /><span class="ink2"
          >${L('цикл: скажите «месячные начались»', 'cycle: say “my period started”')}</span
        ></span
      >`,
    );
  return html`<div class="ctx" aria-label=${L('Контекст дня', 'Today’s context')}>${items}</div>`;
}
export function FeedRow({ x }) {
  const ic = x.kind === 'sym' ? 'pulse' : x.kind === 'food' ? 'plate' : 'note';
  const mark = justNow(x)
    ? L('только что', 'just now')
    : x.edited
      ? L('исправлено', 'edited')
      : null;
  return html`<button class="fi" onClick=${() => openSheet('rec', { id: x.id })}>
    ${x.photo ? html`<img class="th" src=${x.photo} alt="" />` : html`<span class="ico"><${I} n=${ic} /></span>`}
    <span class="tt"
      ><span class="bs">${cap(entryTitle(x))}</span><span class="c ink2">${entrySub(x)}</span></span
    >
    <span class="tm"
      ><span>${fT(new Date(x.at))}</span
      >${mark ? html`<span class="acc">${mark}</span>` : null}</span
    >
  </button>`;
}
// ---- history ----
export function dayHead(k) {
  const d = fromDk(k),
    n = ddiff(now(), d);
  const w = EN() ? WEN[d.getDay()] : WRU[d.getDay()];
  return cap((n <= 1 ? dayTitle(d) : w) + ', ' + fDM(d));
}
// ---- doctor ----
// ---- onboarding: one screen ----
// ---- shared controls ----
export function SwRow({ on, fn, t, s }) {
  return html`<button class="li" role="switch" aria-checked=${String(!!on)} onClick=${fn}>
    <span class="tt"
      ><span class="bs">${t}</span>${s ? html`<span class="c ink2">${s}</span>` : null}</span
    ><span class=${'sw' + (on ? ' on' : '')} aria-hidden="true"></span>
  </button>`;
}

// ---- sheets ----

function Choices({ opts, val, pick, cols }) {
  return html`<div class=${cols === 2 ? 'ch2' : cols === 3 ? 'ch3' : 'col8'}>
    ${opts.map(o => html`<button class=${'choice' + (o.id === val ? ' sel' : '')} aria-pressed=${o.id === val} onClick=${() => pick(o.id)}>${o.id === val ? html`<${I} n="check" s=${20} />` : null}${o.l}</button>`)}
  </div>`;
}
const S_OPTS = () => [1, 2, 3].map(n => ({ id: n, l: cap(sName(n)) }));
const MEAL_OPTS = () =>
  ['breakfast', 'lunch', 'dinner', 'snack'].map(m => ({ id: m, l: cap(mealName(m)) }));
export function RecSheet({ id }) {
  const x = ST.entries.find(y => y.id === id);
  const [m, setM] = useState('view');
  const [txt, setTxt] = useState('');
  if (!x)
    return html`<${Frame} title=${L('запись', 'entry')}><p class="b ink2">${L('Этой записи уже нет', 'This entry no longer exists')}</p><button class="btn pri" onClick=${closeSheet}>${L('закрыть', 'close')}</button></${Frame}>`;
  const apply = (ch, label, title) => {
    const old = {};
    for (const k in ch) old[k] = x[k];
    const was = x.edited;
    const inSum = ST.copiedAt && x.at < ST.copiedAt;
    Object.assign(x, ch, { edited: Date.now() });
    if (ch.at) x.d = dk(new Date(ch.at));
    sortE();
    save();
    setM('view');
    toast({
      title: title || L('Исправила', 'Changed'),
      sub:
        label +
        (inSum
          ? L(
              '. Эта запись уже в скопированной сводке, отмечу в следующей',
              '. This entry is already in the copied summary, I will mark it in the next one',
            )
          : ''),
      acts: [
        {
          l: L('отменить', 'undo'),
          fn: () => {
            Object.assign(x, old);
            if (old.at) x.d = dk(new Date(old.at));
            x.edited = was;
            sortE();
            save();
            toast({ title: L('Вернула как было', 'Restored'), icon: 'undo' });
          },
        },
      ],
    });
  };
  const del = () => {
    const snap = Object.assign({}, x);
    removeIds([x.id]);
    save();
    closeSheet();
    toast({
      title: L('Запись удалена', 'Entry deleted'),
      icon: 'trash',
      acts: [
        {
          l: L('вернуть', 'restore'),
          fn: () => {
            ST.entries.push(snap);
            sortE();
            save();
            toast({ title: L('Вернула запись', 'Entry restored'), icon: 'undo' });
          },
        },
      ],
    });
  };
  const back = () => setM('view');
  const title = cap(entryTitle(x));
  if (m === 'del')
    return html`<${Frame} title=${L('удалить запись?', 'delete this entry?')}>
    <p class="b">${L('Ее не будет в истории и в сводке для врача', 'It will be gone from history and from the doctor summary')}</p>
    <div class="col"><button class="btn sec" onClick=${del}>${L('удалить', 'delete')}</button><button class="btn pri" onClick=${back}>${L('оставить', 'keep')}</button></div></${Frame}>`;
  if (m.indexOf('mm:') === 0) {
    const ns = +m.slice(3),
      ws = strengthOf(x.words || '');
    const keep = x.s || ws;
    return html`<${Frame} title=${L('поменять силу?', 'change the strength?')} onBack=${back}>
      <p class="b">${L('Вы говорили: ', 'You said: ')}${qt(x.words)}. ${L('В этих словах сила: ', 'Those words mean: ')}${qt(sName(ws))}.</p>
      <div class="col"><button class="btn pri" onClick=${() => apply({ s: ns }, cap(sName(ns)), L('Силу поменяла', 'Strength changed'))}>${L('поменять на ', 'change to ') + qt(sName(ns))}</button>
      <button class="btn sec" onClick=${() => {
        setM('view');
        toast({ title: L('Силу оставила', 'Strength kept'), sub: cap(sName(keep)) });
      }}>${L('оставить ', 'keep ') + qt(sName(keep))}</button></div></${Frame}>`;
  }
  if (m === 's')
    return html`<${Frame} title=${L('сила', 'strength')} onBack=${back}><${Choices} cols=${3} opts=${S_OPTS()} val=${x.s} pick=${n => {
      if (n === x.s) return back();
      const ws = x.words ? strengthOf(x.words) : null;
      if (ws && ws !== n) setM('mm:' + n);
      else apply({ s: n }, cap(sName(n)));
    }}/></${Frame}>`;
  if (m === 'what') {
    const keys = [...new Set([x.key, ...OB_SYM, ...Object.keys(SYM)])];
    return html`<${Frame} title=${L('что', 'what')} onBack=${back}><${Choices} cols=${2} opts=${keys.map(k => ({ id: k, l: symName(k) }))} val=${x.key} pick=${k => (k === x.key ? back() : apply({ key: k }, symName(k)))}/></${Frame}>`;
  }
  if (m === 'meal')
    return html`<${Frame} title=${L('прием пищи', 'meal')} onBack=${back}><${Choices} cols=${2} opts=${MEAL_OPTS()} val=${x.meal} pick=${v => (v === x.meal ? back() : apply({ meal: v }, cap(mealName(v))))}/></${Frame}>`;
  if (m === 'when') {
    const o = whenOpts();
    return html`<${Frame} title=${L('когда', 'when')} onBack=${back}><p class="c ink2">${L('Сейчас: ', 'Now set: ') + relDT(new Date(x.at))}</p><${Choices} cols=${2} opts=${o} val=${null} pick=${v => {
      const d = o.find(y => y.id === v).d;
      apply({ at: d.getTime() }, cap(relDT(d)));
    }}/></${Frame}>`;
  }
  if (m === 'words' || m === 'items') {
    const isI = m === 'items';
    return html`<${Frame} title=${isI ? L('что ели', 'what you ate') : L('ваши слова', 'your words')} onBack=${back}>
      <textarea class="field" id="edtxt" value=${txt} onInput=${e => setTxt(e.target.value)} aria-label=${isI ? L('Что ели', 'What you ate') : L('Ваши слова', 'Your words')}></textarea>
      ${isI ? html`<p class="f ink2">${L('Через запятую', 'Comma separated')}</p>` : null}
      <button class="btn pri" onClick=${() => {
        const v = txt.trim();
        if (isI) {
          const it = v
            ? v
                .split(/[,;]/)
                .map(s => s.trim())
                .filter(Boolean)
            : [];
          apply({ items: it }, it.join(', ') || L('без подписи', 'no caption'));
        } else apply({ words: v || null }, v ? qt(v) : L('без слов', 'no words'));
      }}>${L('сохранить', 'save')}</button></${Frame}>`;
  }
  const R = (f, lab, val) =>
    html`<button
      class="li"
      onClick=${() => {
        if (f === 'words') setTxt(x.words || '');
        if (f === 'items') setTxt((x.items || []).join(', '));
        setM(f);
      }}
    >
      <span class="tt"><span class="f ink2">${lab}</span><span class="bs">${val}</span></span
      ><${I} n="chevR" />
    </button>`;
  const rows =
    x.kind === 'sym'
      ? [
          R('what', L('что', 'what'), symName(x.key)),
          R('s', L('сила', 'strength'), x.s ? cap(sName(x.s)) : L('не указана', 'not set')),
          R('when', L('когда', 'when'), cap(relDT(new Date(x.at)))),
          R('words', L('ваши слова', 'your words'), x.words ? qt(x.words) : L('нет', 'none')),
        ]
      : x.kind === 'food'
        ? [
            R(
              'items',
              L('что ели', 'what you ate'),
              x.items && x.items.length ? x.items.join(', ') : L('без подписи', 'no caption'),
            ),
            R('meal', L('прием пищи', 'meal'), cap(mealName(x.meal))),
            R('when', L('когда', 'when'), cap(relDT(new Date(x.at)))),
          ]
        : [
            R('words', L('текст', 'text'), x.words ? qt(x.words) : L('нет', 'none')),
            R('when', L('когда', 'when'), cap(relDT(new Date(x.at)))),
          ];
  return html`<${Frame} title=${title}>
    ${x.photo ? html`<img class="photo" src=${x.photo} alt=${L('Фото еды', 'Food photo')} />` : null}
    <div class="list">${rows}</div>
    ${x.kind === 'sym' && x.ctx && x.ctx.length ? html`<p class="c ink2">${L('Контекст: ', 'Context: ') + x.ctx.map(c => ctxText(c)).join(', ')}</p>` : null}
    <button class="link" onClick=${() => setM('del')}>${L('удалить запись', 'delete entry')}</button>
  </${Frame}>`;
}

export function QuickSheet({ sym: k0 }) {
  return html`<${Frame} title=${symName(k0)}><p class="b ink2">${L('Как сейчас?', 'How is it now?')}</p>
    <${Choices} cols=${3} opts=${S_OPTS()} val=${null} pick=${n => {
      closeSheet();
      logSym([{ key: k0, s: n, ctx: [] }], null, null);
    }}/></${Frame}>`;
}
export function VoiceSheet() {
  const ph = EN()
    ? [
        'Fingertips really numb after a shower',
        'No strength left by the evening',
        'Pasta and salad for lunch',
        'When were my fingers numb last?',
      ]
    : [
        'Сильно немеют кончики пальцев после душа',
        'К вечеру совсем нет сил',
        'На обед паста и салат',
        'Когда немело в последний раз?',
      ];
  return html`<${Frame} title=${L('слушаю', 'listening')}>
    <div class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <p class="c ink2">${L('В прототипе голос имитируется. Выберите фразу или диктуйте с клавиатуры', 'Voice is simulated here. Pick a phrase or dictate with the keyboard')}</p>
    <div class="col8">${ph.map(
      p =>
        html`<button
          class="choice"
          style="justify-content:flex-start;text-align:left"
          onClick=${() => {
            closeSheet();
            handleText(p);
          }}
        >
          ${p}
        </button>`,
    )}</div>
    <button class="btn sec" onClick=${() => {
      closeSheet();
      setTimeout(() => {
        const el = document.getElementById('line');
        if (el) el.focus();
      }, 60);
    }}>${L('продиктовать с клавиатуры', 'dictate with keyboard')}</button>
  </${Frame}>`;
}
export function symStats(k, days) {
  const T = fromDk(todayK()),
    from = dk(addD(T, -(days - 1)));
  const l = symEnts(k).filter(x => x.d >= from);
  const ds = new Set(l.map(x => x.d));
  const strip = [];
  for (let i = days - 1; i >= 0; i--) {
    const kk = dk(addD(T, -i));
    strip.push({ k: kk, on: ds.has(kk) });
  }
  const heat = l.filter(
    x => (x.ctx || []).some(c => HEAT.includes(c)) || isHot(new Date(x.at)),
  ).length;
  const pre = periodStarts().length ? l.filter(x => prePeriod(x.d)).length : null;
  const afc = l.filter(x => (x.ctx || []).some(c => c.indexOf('food:') === 0));
  const dish = {};
  for (const x of afc) {
    const lab = x.ctx.find(c => c.indexOf('food:') === 0).split('|')[1];
    dish[lab] = (dish[lab] || 0) + 1;
  }
  const dishes = Object.entries(dish)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const effort = l.filter(x => (x.ctx || []).includes('effort')).length;
  return {
    n: l.length,
    days: ds.size,
    last: l[0] || null,
    heat,
    pre,
    strip,
    af: afc.length,
    dishes,
    effort,
  };
}
export function SymBlock({ k }) {
  const s = symStats(k, 30);
  if (!s.n)
    return html`<section class="card surf">
      <p class="lbl">${symName(k)}</p>
      <p class="b">${L('За 30 дней записей об этом нет', 'No entries about this in 30 days')}</p>
    </section>`;
  return html`<section class="card surf" aria-label=${symName(k)}>
    <p class="lbl">${symName(k)}</p>
    <div class="row" style="align-items:baseline;gap:10px">
      <span class="big">${s.n}</span
      ><span class="b"
        >${EN() ? (s.n === 1 ? 'entry' : 'entries') + ' in 30 days' : plRu(s.n, 'запись', 'записи', 'записей') + ' за 30 дней'}</span
      >
    </div>
    ${
      B
        ? null
        : html`<div
              class="strip"
              role="img"
              aria-label=${L('Дни с записями за 30 дней', 'Days with entries over 30 days')}
            >
              ${s.strip.map((d, i) => html`<i class=${(d.on ? 'on' : '') + (i === 29 ? ' td' : '')}></i>`)}
            </div>
            <div class="sx">
              <span>${L('30 дней назад', '30 days ago')}</span><span>${L('сегодня', 'today')}</span>
            </div>`
    }
    <div class="col4">
      ${B ? null : html`<p class="c">${L('Дней с записями: ', 'Days with entries: ')}<span class="num">${s.days} ${L('из', 'of')} 30</span></p>`}
      <p class="c">${L('Последний раз: ', 'Last time: ') + relDT(new Date(s.last.at))}</p>
      <p class="c">
        ${L('После тепла или в жару: ', 'After heat or on hot days: ')}<span class="num"
          >${s.heat} ${L('из', 'of')} ${s.n}</span
        >
      </p>
      ${s.af ? html`<p class="c">${L('В течение 3 часов после еды: ', 'Within 3 hours after food: ')}<span class="num">${s.af} ${L('из', 'of')} ${s.n}</span>${s.dishes.length ? html`<span class="ink2">${' (' + s.dishes.map(d => d[0] + (d[1] > 1 ? ' ×' + d[1] : '')).join(', ') + ')'}</span>` : null}</p>` : null}
      ${s.effort ? html`<p class="c">${L('После нагрузки: ', 'After effort: ')}<span class="num">${s.effort} ${L('из', 'of')} ${s.n}</span></p>` : null}
      ${s.pre !== null ? html`<p class="c">${L('За 1–3 дня до месячных: ', '1–3 days before a period: ')}<span class="num">${s.pre} ${L('из', 'of')} ${s.n}</span></p>` : null}
    </div>
  </section>`;
}
export function FoodBlock({ yday }) {
  const T = now();
  const days = yday ? [dk(addD(T, -1))] : [todayK(), dk(addD(T, -1)), dk(addD(T, -2))];
  const g = days
    .map(d => ({ d, l: onDay(d).filter(x => x.kind === 'food') }))
    .filter(x => x.l.length);
  if (!g.length)
    return html`<section class="card surf">
      <p class="b">
        ${yday ? L('Вчера записей о еде нет', 'No food entries yesterday') : L('За три дня записей о еде нет', 'No food entries in three days')}
      </p>
    </section>`;
  return html`${g.map(
    x =>
      html`<section class="card surf">
        <p class="lbl">${dayHead(x.d)}</p>
        <div class="rows">${x.l.map(y => html`<${FeedRow} key=${y.id} x=${y} />`)}</div>
      </section>`,
  )}`;
}
export function HeatBlock() {
  if (!weatherOn())
    return html`<section class="card surf">
      <p class="b">${L('Погода выключена', 'Weather is off')}</p>
      <button class="btn sec" onClick=${() => cmd('settings')}>
        ${L('включить погоду', 'turn on weather')}
      </button>
    </section>`;
  const T = fromDk(todayK());
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(dk(addD(T, -i)));
  const hot = days.filter(d => isHot(fromDk(d)));
  const cnt = ds => symEnts().filter(x => ds.includes(x.d)).length;
  const cold = days.filter(d => !hot.includes(d));
  return html`<section class="card surf">
    <p class="lbl">${L('жара, 14 дней', 'heat, 14 days')}</p>
    <div class="row" style="align-items:baseline;gap:10px">
      <span class="big">${hot.length}</span
      ><span class="b"
        >${EN() ? (hot.length === 1 ? 'hot day' : 'hot days') + ' (26° and above)' : plRu(hot.length, 'жаркий день', 'жарких дня', 'жарких дней') + ' (от 26°)'}</span
      >
    </div>
    <div class="kvr">
      <span class="c ink2">${L('в жаркие дни', 'on hot days')}</span
      ><span class="c num">${nEnt(cnt(hot))}</span
      ><span class="c ink2">${L('в остальные', 'on other days')}</span
      ><span class="c num">${nEnt(cnt(cold))}, ${nDay(cold.length)}</span>
    </div>
  </section>`;
}
function emergencyNo() {
  let r = '';
  try {
    r = (Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || '')
      .split('-')
      .pop()
      .toUpperCase();
  } catch (e) {}
  if (r === 'RU') return L('112 или 103', '112 or 103');
  if (r === 'US' || r === 'CA') return '911';
  return '112';
}
export function SafetySheet({ v }) {
  return html`<${Frame} title=${L('если это началось внезапно', 'if this started suddenly')}>
    <p class="b">${L('Звоните в скорую, не ждите', 'Call emergency services, do not wait')}</p>
    <div class="card surf"><p class="lbl">${L('скорая', 'emergency')}</p><p class="big num" style="user-select:all">${emergencyNo()}</p></div>
    <div class="col"><button class="btn pri" onClick=${closeSheet}>${L('понятно', 'got it')}</button><button class="btn sec" onClick=${() => {
      closeSheet();
      logNote(v);
    }}>${L('записать как есть', 'save as written')}</button></div>
  </${Frame}>`;
}
export function CopySheet({ txt }) {
  return html`<${Frame} title=${L('скопировать сводку', 'copy summary')}><p class="c ink2">${L('Выделите и скопируйте', 'Select and copy')}</p>
    <textarea class="field" id="cptxt" readonly style="min-height:240px" value=${txt} onFocus=${e => e.target.select()}></textarea></${Frame}>`;
}
