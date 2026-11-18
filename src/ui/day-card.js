// v6 day card: today in the card
import { addEntries, addQuestion, handleText, justNow, rr, save, undoAct } from '../app/actions.js';
import { mealName, norm, sName, symName } from '../core/catalog.js';
import { addD, ddiff, dk, fT, fromDk, now, todayK } from '../core/dates.js';
import { entrySub, entryTitle, onDay } from '../core/entries.js';
import { topSyms } from '../core/insights.js';
import { EN, L, cap, lc, nEnt, plRu, qt } from '../core/text.js';
import { html } from '../lib/preact.js';
import { ST, UI } from '../state/store.js';
import {
  CycleBlock,
  Follow,
  Insights,
  PhotoBlock,
  Questions,
  RangeList,
  Summary,
  dayHint,
  daySentence,
} from './answers.js';
import { handleAll } from './app.js';
import { DataBlock, HistoryBlock, VoiceBlock, WorseRow } from './blocks.js';
import {
  Ctx,
  FoodBlock,
  HeatBlock,
  I,
  Mascot,
  RecSheet,
  SafetySheet,
  SymBlock,
} from './components.js';
import { B, ChipGrid, V6, say, toast } from './feedback.js';
import { openSheet } from './frame.js';
import {
  GenericCard,
  SettingsBlock,
  StatesBlock,
  WidgetsBlock,
  WordsBlock,
  focusLine,
} from './states.js';

// v6: today list inside the day card, last three, no scroll
function TodayRow({ x, dup }) {
  const d = new Date(x.at);
  const w = dup ? null : x.words;
  const txt = w
    ? qt(w)
    : dup
      ? lc(symName(x.key)) + (x.s ? ', ' + sName(x.s) : '')
      : x.kind === 'sym'
        ? lc(entryTitle(x))
        : entryTitle(x);
  const sub = dup
    ? ''
    : w
      ? x.kind === 'sym'
        ? lc(symName(x.key)) + (x.s ? ', ' + sName(x.s) : '')
        : x.kind === 'food'
          ? mealName(x.meal)
          : ''
      : entrySub(x);
  const fresh = justNow(x);
  return html`<button
    class=${'tr6' + (fresh ? ' new' : '')}
    onClick=${() => openSheet('rec', { id: x.id })}
    aria-label=${fT(d) + ', ' + txt + (sub ? ', ' + sub : '') + (fresh ? L(', только что', ', just now') : '') + L('. Исправить', '. Edit')}
  >
    <span class="tm6 num">${fT(d)}</span
    ><span class="tx6"
      ><span class="b">${txt}</span
      >${sub && norm(sub) !== norm(txt) ? html`<span class="c ink2">${sub}</span>` : null}</span
    >${fresh ? html`<span class="nw6">${L('только что', 'just now')}</span>` : null}
  </button>`;
}
function DayCard6({ l, hint, foot, openDay, HintRow }) {
  const user = l.filter(
    x => !(x.kind === 'med' && x.src === 'health') && !(x.kind === 'move' && x.src === 'health'),
  );
  const last = user.slice(0, 3).reverse();
  const more = user.length - last.length;
  const t = UI.mtoast && UI.mtoast.inline6 ? UI.mtoast : null;
  return html`<section class="card surf d6" aria-live="polite">
    <${Ctx} /><${WorseRow} />
    <div class="today6" aria-label=${L('Сегодня записано', 'Saved today')}>
      ${more > 0 ? html`<button class="more6" onClick=${openDay}><span>${EN() ? `${more} earlier ${more === 1 ? 'entry' : 'entries'}` : `еще ${more} ${plRu(more, 'запись', 'записи', 'записей')} раньше`}</span><${I} n="chevR" s=${20} /></button>` : null}
      ${last.map((x, i) => {
        const row = html`<${TodayRow}
          key=${x.id}
          x=${x}
          dup=${!!(i && x.words && last[i - 1].words === x.words && Math.abs(last[i - 1].at - x.at) < 6e4)}
        />`;
        if (!(t && t.inline6 === x.id)) return row;
        // the fresh entry and its fix/undo live in one tinted block, inset from the card edges
        return html`<div class="fresh6" key=${'f' + x.id}>
          ${row}
          <div class="acts6">
            <p class="sr" role="status">${t.title}</p>
            ${t.sub && !/^(сегодня|today)(,|\s|$)/i.test(t.sub) ? html`<p class="c ink2 sub6">${t.sub}</p>` : null}${t.acts
              .filter(Boolean)
              .map(
                a =>
                  html`<button
                    class="chip"
                    onClick=${() => {
                      UI.mtoast = null;
                      a.fn();
                      rr();
                    }}
                  >
                    <span>${a.l}</span>
                  </button>`,
              )}
          </div>
        </div>`;
      })}
    </div>
    ${hint && last.length <= 2 ? html`<${HintRow} t=${hint.t} s=${hint.s} fn=${hint.fn} />` : null}
    ${foot}
  </section>`;
}
export function Block() {
  const r = UI.resp;
  const tk = todayK();
  const back = () => {
    UI.resp = null;
    rr();
  };
  const Head = ({ title, sub }) =>
    html`<div class="row" style="align-items:flex-start">
      <div class="grow col4">
        <h2 class="q">${title}</h2>
        ${sub ? html`<p class="c ink2">${sub}</p>` : null}
      </div>
      <button class="ib" aria-label=${L('К сегодня', 'Back to today')} onClick=${back}>
        <${I} n="close" />
      </button>
    </div>`;
  const foot =
    B && UI.footChips
      ? html`<div class="foot">
          ${UI.footLabel ? html`<p class="lbl">${UI.footLabel}</p>` : null}<${ChipGrid}
            items=${UI.footChips}
            label=${UI.footLabel || undefined}
          />
        </div>`
      : null;
  const openDay = () =>
    say({
      kind: 'answer',
      q: L('записи за сегодня', 'today’s entries'),
      keys: [],
      range: { a: tk, b: tk, l: L('сегодня', 'today') },
      list: true,
    });
  const HintRow = ({ t, s, ic, fn }) =>
    html`<button class="li hint" onClick=${fn}>
      ${ic ? html`<span class="ico"><${I} n=${ic} /></span>` : null}<span class="tt"
        ><span class="bs">${t}</span>${s ? html`<span class="c ink2">${s}</span>` : null}</span
      ><${I} n="chevR" />
    </button>`;
  if (!r) {
    const l = onDay(tk);
    if (!ST.entries.length)
      return html`<section class=${'card surf' + (V6 ? ' d6' : '')} aria-live="polite">
        ${V6 ? html`<${Ctx} />` : null}
        <div class="row">
          <${Mascot} mood="calm" size=${72} />
          <div class="grow col4">
            <h2 class="t2">${L('это ваш первый день', 'this is your first day')}</h2>
            <p class="c ink2">
              ${L('Скажите, как вы, или сфотографируйте еду', 'Say how you are, or take a photo of food')}
            </p>
          </div>
        </div>
        ${foot}
      </section>`;
    if (!l.length) {
      const lastE = ST.entries[0];
      const gap = lastE ? ddiff(now(), fromDk(lastE.d)) : 0;
      if (gap >= 14)
        return html`<section class="card surf" aria-live="polite">
          <p class="b">
            ${L('Две недели тихо. Если было хуже обычного, можно записать задним числом', 'Two quiet weeks. If it was worse than usual, you can log it for past days')}
          </p>
          ${
            B
              ? html`<div class="foot">
                  <${ChipGrid}
                    items=${[
                      {
                        l: L('было хуже', 'it was worse'),
                        fn: () => focusLine(L('когда и что было?', 'when and what was it?')),
                      },
                      {
                        l: L('все было обычно', 'all as usual'),
                        fn: () => {
                          const ids = addEntries([{ kind: 'pause', at: now().getTime() }]);
                          save();
                          toast({
                            title: L('Хорошо. Продолжаем с сегодня', 'Good. Continuing from today'),
                            acts: [undoAct(ids)],
                          });
                        },
                      },
                    ]}
                  />
                </div>`
              : null
          }
        </section>`;
      if (gap >= 7)
        return html`<section class="card surf" aria-live="polite">
          <div class="row">
            <${Mascot} mood="rest" size=${64} />
            <div class="grow">
              <p class="b">
                ${L('Неделю записей не было. Ничего не потеряно, можно начать с сегодня', 'No entries for a week. Nothing is lost, you can start from today')}
              </p>
            </div>
          </div>
          ${foot}
        </section>`;
      if (ST.firstDay && ddiff(now(), fromDk(ST.firstDay)) === 7) {
        const wk = ST.entries.filter(e => e.d >= ST.firstDay);
        const top = topSyms(ST.firstDay, tk, 1)[0];
        return html`<section class="card surf" aria-live="polite">
          <p class="b">
            ${(EN() ? `First week: ${nEnt(wk.length)}, ${wk.filter(e => e.photo).length} photos. ` : `Первая неделя: ${nEnt(wk.length)}, ${wk.filter(e => e.photo).length} фото. `) + (top ? L('Чаще всего: ', 'Most often: ') + lc(symName(top[0])) + '. ' : '') + L('Совпадения появятся через 2–3 недели', 'Coincidences appear after 2–3 weeks')}
          </p>
          ${foot}
        </section>`;
      }
      const yk = dk(addD(now(), -1));
      const ys = onDay(yk).filter(x => x.kind === 'sym');
      const yt = ys.length
        ? cap(
            L('вчера: ', 'yesterday: ') +
              [...new Set(ys.map(x => lc(symName(x.key))))].join(', ') +
              '. ',
          )
        : '';
      return html`<section class=${'card surf' + (V6 ? ' d6' : '')} aria-live="polite">
        ${V6 ? html`<${Ctx} />` : null}<${WorseRow} />
        <div class="row">
          <${Mascot} mood="rest" size=${64} />
          <div class="grow col4">
            <p class="b">${yt + L('Сегодня пока тихо', 'Quiet so far today')}</p>
          </div>
        </div>
        ${foot}
      </section>`;
    }
    const hint = dayHint();
    const n = l.length;
    if (V6)
      return html`<${DayCard6}
        l=${l}
        hint=${hint}
        foot=${foot}
        openDay=${openDay}
        HintRow=${HintRow}
      />`;
    return html`<section class="card surf" aria-live="polite">
      <${WorseRow} />${B ? null : html`<p class="lbl">${L('сегодня', 'today')}</p>`}
      <p class="b">${daySentence(tk)}</p>
      ${B ? null : html`<button class="link" onClick=${openDay}>${L('раскрыть записи', 'show entries')}</button>`}
      ${hint ? html`<${HintRow} t=${hint.t} s=${hint.s} fn=${hint.fn} />` : null}
      ${B ? html`<${HintRow} t=${EN() ? `${n} ${n === 1 ? 'entry' : 'entries'} today` : `${n} ${plRu(n, 'запись', 'записи', 'записей')} сегодня`} s=${L('Открыть день', 'Open the day')} fn=${openDay} />` : null}
      ${foot}
    </section>`;
  }
  if (r.kind === 'voice') return html`<${VoiceBlock} r=${r} />`;
  if (r.kind === 'edit') return html`<${RecSheet} key=${r.id} id=${r.id} />`;
  if (r.kind === 'safety') return html`<${SafetySheet} v=${r.v} />`;
  if (r.kind === 'history') return html`<${HistoryBlock} r=${r} />`;
  if (r.kind === 'settings') return html`<${SettingsBlock} r=${r} />`;
  if (r.kind === 'card') return html`<${GenericCard} r=${r} />`;
  if (r.kind === 'states') return html`<${StatesBlock} />`;
  if (r.kind === 'widgets') return html`<${WidgetsBlock} />`;
  if (r.kind === 'words') return html`<${WordsBlock} r=${r} />`;
  if (r.kind === 'data') return html`<${DataBlock} />`;
  if (r.kind === 'photo') return html`<${PhotoBlock} r=${r} />`;
  if (r.kind === 'confirm')
    return html`<section class="card surf">
      <h2 class="q">${r.title}</h2>
      <p class="b">${r.sub}</p>
      <div class="ch2">
        <button
          class="choice"
          onClick=${() => {
            UI.resp = null;
            r.fn();
          }}
        >
          ${r.ok}</button
        ><button class="choice sel" onClick=${back}>${L('отмена', 'cancel')}</button>
      </div>
    </section>`;
  if (r.kind === 'help') {
    const ex = EN()
      ? [
          'when were my fingers numb?',
          'what did I eat yesterday?',
          'what is linked to how I feel?',
          'how is it linked to my cycle?',
          'what happened this week?',
          'summary for a month',
          'ask the doctor: …',
          'my period started',
          'dark theme',
          'по-русски',
        ]
      : [
          'когда немело?',
          'что я ела вчера?',
          'что связано с самочувствием?',
          'как это связано с циклом?',
          'что было за неделю?',
          'сводка за месяц',
          'вопрос врачу: …',
          'месячные начались',
          'темная тема',
          'english',
        ];
    return html`<section class="card surf">
      <${Head} title=${L('что можно сказать', 'what you can say')} />
      <div class="wrap">
        ${ex.map(a => html`<button class="chip" onClick=${() => handleAll(a)}><span>${a}</span></button>`)}
      </div>
    </section>`;
  }
  if (r.kind === 'summary')
    return html`<section class=${'card doctor' + (r.big ? ' bigs' : '')}>
      <${Head} title=${L('к врачу', 'for the doctor')} /><${Summary}
        days=${r.days || 30}
      /><${ChipGrid}
        items=${[{ l: r.big ? L('обычный размер', 'normal size') : L('крупно для врача', 'large for the doctor'), fn: () => say(Object.assign({}, r, { big: !r.big })) }]}
      />
    </section>`;
  if (r.kind === 'insights')
    return html`<section class="card surf" aria-live="polite">
      <${Head}
        title=${L('совпадения', 'coincidences')}
        sub=${L('Совпадения, не причины', 'Coincidences, not causes')}
      /><${Insights} keys=${r.keys} /><${Follow}
        items=${[{ l: L('как это связано с циклом?', 'how is it linked to my cycle?') }, { l: L('сводка за месяц', 'summary for a month') }]}
      />
      <p class="ai f">
        <${I} n="spark" s=${16} /><span
          >${L('Из ваших записей за 30 дней. ИИ может ошибаться. Не медицинская рекомендация', 'From your entries, 30 days. AI can make mistakes. Not medical advice')}</span
        >
      </p>
    </section>`;
  if (r.kind === 'cycle')
    return html`<section class="card surf" aria-live="polite">
      <${Head} title=${L('цикл и самочувствие', 'cycle and how you feel')} /><${CycleBlock}
        keys=${r.keys}
      /><${Follow}
        items=${[{ l: L('что связано с самочувствием?', 'what is linked to how I feel?') }, { l: L('сводка за 3 месяца', 'summary for 3 months') }]}
      />
      <p class="ai f">
        <${I} n="spark" s=${16} /><span
          >${L('Совпадения, не причины. ИИ может ошибаться. Не медицинская рекомендация', 'Coincidences, not causes. AI can make mistakes. Not medical advice')}</span
        >
      </p>
    </section>`;
  if (r.kind === 'questions')
    return html`<section class="card doctor">
      <${Head} title=${L('вопросы к приему', 'questions for the visit')} /><${Questions} />
    </section>`;
  if (r.kind === 'answer') {
    const has = r.keys.length || r.isFood || r.isHeat || r.range;
    return html`<section class="card surf" aria-live="polite">
      <${Head} title=${qt(r.q)} />${B && !r.list && r.keys.length ? html`<${Ctx} />` : null}
      ${
        r.medical
          ? html`<div class="card doctor" style="padding:16px">
              <h3 class="q">
                ${L('на это лучше ответит врач', 'your doctor is the right person for this')}
              </h3>
              <button
                class="btn pri"
                onClick=${() => {
                  addQuestion(r.q);
                }}
              >
                ${L('добавить к вопросам', 'add to questions')}
              </button>
            </div>`
          : null
      }
      ${r.list && r.range ? html`<${RangeList} range=${r.range} f=${r.isFood ? 'food' : 'all'} />` : null}
      ${!r.list ? r.keys.map(k => html`<${SymBlock} k=${k} />`) : null}
      ${r.isFood && !r.medical && !r.list ? html`<${FoodBlock} yday=${!!(r.range && r.range.l === L('вчера', 'yesterday'))} />` : null}
      ${r.isHeat && !r.medical ? html`<${HeatBlock} />` : null}
      ${
        !has && !r.medical
          ? html`<p class="b">${L('В записях не нашла', 'Not in your entries')}</p>
              <div class="wrap">
                ${(EN() ? ['when were my fingers numb?', 'what did I eat yesterday?', 'what happened this week?'] : ['когда немело?', 'что я ела вчера?', 'что было за неделю?']).map(a => html`<button class="chip" onClick=${() => handleText(a)}><${I} n="spark" s=${18} /><span>${a}</span></button>`)}
              </div>`
          : null
      }
      ${
        has && !r.medical
          ? html`<${Follow}
              items=${
                r.keys.length
                  ? [
                      {
                        l: L('что с этим связано?', 'what is linked to it?'),
                        q: L('что связано с ', 'what is linked to ') + lc(symName(r.keys[0])) + '?',
                      },
                      {
                        l: L('как это связано с циклом?', 'how is it linked to my cycle?'),
                        q:
                          L('как ', 'how is ') +
                          lc(symName(r.keys[0])) +
                          L(' связано с циклом?', ' linked to my cycle?'),
                      },
                    ]
                  : [
                      { l: L('что связано с самочувствием?', 'what is linked to how I feel?') },
                      { l: L('сводка к врачу', 'summary for the doctor') },
                    ]
              }
            />`
          : null
      }
      <p class="ai f">
        <${I} n="spark" s=${16} /><span
          >${L('Из ваших записей. Совпадения, не причины. ИИ может ошибаться. Не медицинская рекомендация', 'From your entries. Coincidences, not causes. AI can make mistakes. Not medical advice')}</span
        >
      </p>
    </section>`;
  }
  return html`<section class="card surf">
    <p class="bs">${r.title || ''}</p>
    ${r.sub ? html`<p class="c ink2">${r.sub}</p>` : null}
  </section>`;
}
