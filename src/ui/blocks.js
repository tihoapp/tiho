// Voice, history and settings blocks
import { handleText, rr } from '../app/actions.js';
import { isHot } from '../core/context.js';
import { addD, dk, fDM, fromDk, todayK } from '../core/dates.js';
import { E, inWorse, worseDayN } from '../core/entries.js';
import { EN, L, nEnt } from '../core/text.js';
import { html, useEffect, useState } from '../lib/preact.js';
import { ST, UI } from '../state/store.js';
import { Follow } from './answers.js';
import { handleAll } from './app.js';
import { FeedRow, I, dayHead } from './components.js';
import { B, ChipGrid, say, toast } from './feedback.js';
import { openSheet } from './frame.js';
import { cmd } from './states.js';

// ---- voice: recording indicator in the card, line says "идет запись" ----
export function VoiceBlock({ r }) {
  const [sec, setSec] = useState(0);
  const [txt, setTxt] = useState('');
  useEffect(() => {
    const h = setInterval(() => setSec(s => s + 1), 1000);
    let rec = null;
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        rec = new SR();
        rec.lang = EN() ? 'en-US' : 'ru-RU';
        rec.interimResults = true;
        rec.continuous = true;
        rec.onresult = e => {
          let t = '';
          for (const res of e.results) t += res[0].transcript;
          setTxt(t);
          r.txt = t;
        };
        rec.start();
        r.rec = rec;
      }
    } catch (e) {
      rec = null;
    }
    return () => {
      clearInterval(h);
      try {
        if (rec) rec.stop();
      } catch (e) {}
    };
  }, []);
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
  const mm = String(Math.floor(sec / 60)) + ':' + String(sec % 60).padStart(2, '0');
  return html`<section class="card surf" aria-live="polite">
    <h2 class="q">${L('слушаю', 'listening')}</h2>
    <div class="rec" role="status" aria-label=${L('Идет запись, ', 'Recording, ') + mm}>
      <span class="dot"></span><span class="cs ink2 num">${L('запись, ', 'recording, ') + mm}</span>
      <div class="bars" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
    </div>
    ${
      txt
        ? html`<p class="b">${txt}</p>`
        : r.rec
          ? html`<p class="c ink2">
              ${L('Говорите. Текст появится здесь', 'Speak. The text appears here')}
            </p>`
          : html`<p class="c ink2">
                ${L('В этом браузере нет распознавания речи. Выберите фразу или напишите в строке', 'No speech recognition in this browser. Pick a phrase or type in the line')}
              </p>
              <div class="col8">
                ${ph.map(
                  p =>
                    html`<button
                      class="choice"
                      style="justify-content:flex-start;text-align:left"
                      onClick=${() => {
                        UI.resp = null;
                        handleText(p);
                      }}
                    >
                      ${p}
                    </button>`,
                )}
              </div>`
    }
    <p class="c ink2">
      ${L('Нажмите «готово», когда закончите', 'Tap “done” when you are finished')}
    </p>
    ${B ? html`<div class="foot"><${ChipGrid} items=${voiceChips(r)} /></div>` : null}
  </section>`;
}
export function voiceChips(r) {
  return [
    {
      l: L('готово', 'done'),
      fn: () => {
        const t = (r.txt || '').trim();
        UI.resp = null;
        if (t) handleAll(t);
        else rr();
      },
    },
    {
      l: L('отмена', 'cancel'),
      fn: () => {
        UI.resp = null;
        rr();
      },
    },
  ];
}
// ---- history by phrase: period and filters ----
export function HistoryBlock({ r }) {
  const T = fromDk(todayK());
  const per = r.per || 30;
  const f = r.f || 'all';
  const range = {
    a: per > 365 ? '0000' : dk(addD(T, -(per - 1))),
    b: todayK(),
    l: per === 7 ? L('неделя', 'week') : per === 30 ? L('месяц', 'month') : L('все', 'all'),
  };
  const set = o => say(Object.assign({}, r, o));
  const P = [
    [7, L('неделя', 'week')],
    [30, L('месяц', 'month')],
    [999, L('все', 'all')],
  ];
  const F = [
    ['all', L('все', 'all')],
    ['sym', L('самочувствие', 'how I felt')],
    ['food', L('еда', 'food')],
    ['worse', L('хуже обычного', 'worse than usual')],
    ['hot', L('в жару', 'in the heat')],
  ];
  let list = ST.entries.filter(x => x.d >= range.a && x.d <= range.b);
  if (f === 'sym') list = list.filter(x => x.kind === 'sym');
  else if (f === 'food') list = list.filter(x => x.kind === 'food');
  else if (f === 'worse') list = list.filter(x => inWorse(x.d));
  else if (f === 'hot') list = list.filter(x => isHot(new Date(x.at)));
  const groups = [];
  let cur = null;
  for (const x of list) {
    if (!cur || cur.d !== x.d) {
      cur = { d: x.d, items: [] };
      groups.push(cur);
    }
    cur.items.push(x);
  }
  return html`<section class="card surf" aria-live="polite">
    <div class="row" style="align-items:flex-start">
      <div class="grow col4">
        <h2 class="q">${L('история', 'history')}</h2>
        <p class="c ink2">${F.find(x => x[0] === f)[1] + ', ' + range.l}</p>
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
    <div class="seg" role="group" aria-label=${L('Период', 'Period')}>
      ${P.map(([d, l]) => html`<button class=${'chip' + (per === d ? ' on' : '')} aria-pressed=${per === d} onClick=${() => set({ per: d })}>${l}</button>`)}
    </div>
    <div class="seg" role="group" aria-label=${L('Фильтр', 'Filter')}>
      ${F.map(([id, l]) => html`<button class=${'chip' + (f === id ? ' on' : '')} aria-pressed=${f === id} onClick=${() => set({ f: id })}>${l}</button>`)}
    </div>
    ${
      !groups.length
        ? html`<p class="b ink2">
            ${L('Записей за этот период нет', 'No entries for this period')}
          </p>`
        : groups.slice(0, 12).map(
            g =>
              html`<div class="col4" key=${g.d}>
                <p class="lbl">${dayHead(g.d)}</p>
                <div class="rows">${g.items.map(x => html`<${FeedRow} key=${x.id} x=${x} />`)}</div>
              </div>`,
          )
    }
    <${Follow}
      items=${[{ l: L('что с этим связано?', 'what is linked to it?'), q: L('что связано с самочувствием?', 'what is linked to how I feel?') }, { l: L('сводка к врачу', 'doctor summary') }]}
    />
  </section>`;
}
// ---- settings by phrase, no tabs ----

export function DataBlock() {
  const close = () => {
    UI.resp = null;
    rr();
  };
  const exp = () => {
    const txt = JSON.stringify({ entries: ST.entries, questions: ST.questions }, null, 1);
    try {
      navigator.clipboard.writeText(txt).then(
        () =>
          toast({
            title: L('Скопировала записи', 'Entries copied'),
            sub: L('Вставьте в заметки или письмо', 'Paste into notes or an email'),
            acts: [],
          }),
        () => openSheet('copy', { txt }),
      );
    } catch (e) {
      openSheet('copy', { txt });
    }
  };
  return html`<section class="card surf">
    <div class="row" style="align-items:flex-start">
      <div class="grow col4">
        <h2 class="q">${L('данные и доступ', 'data and access')}</h2>
        <p class="c ink2">
          ${L('Записи хранятся только в этом браузере', 'Entries are stored only in this browser')}
        </p>
      </div>
      <button class="ib" aria-label=${L('К сегодня', 'Back to today')} onClick=${close}>
        <${I} n="close" />
      </button>
    </div>
    <p class="b">
      ${EN() ? `${ST.entries.length} ${ST.entries.length === 1 ? 'entry' : 'entries'}, ${E().filter(e => e.photo).length} photos` : `${nEnt(ST.entries.length)}, ${E().filter(e => e.photo).length} фото`}
    </p>
    <button class="link" onClick=${exp}>${L('экспорт записей', 'export entries')}</button>
    <button class="link" onClick=${() => cmd(L('стереть все', 'erase everything'))}>
      ${L('удалить все записи', 'delete all entries')}
    </button>
    <p class="f ink2">${L('Удаление необратимо', 'Deleting cannot be undone')}</p>
  </section>`;
}
// bad day stays visible on the main screen until 'back to usual', all versions
export function WorseRow() {
  if (!ST.worse) return null;
  const n = worseDayN();
  return html`<div class="wr6" role="status">
    <span class="bs">${EN() ? `worse than usual, day ${n}` : `хуже обычного, день ${n}`}</span
    ><span class="c ink2"
      >${L('с ', 'since ') + fDM(fromDk(ST.worse.start)) + L(', попадет в сводку к врачу', ', goes into the doctor summary')}</span
    >
  </div>`;
}
