// Answers rendered in the main block
import { logFood, readPhoto, rr, save, whenOpts } from '../app/actions.js';
import { groupName, mealByTime, mealName, norm, sName, symName } from '../core/catalog.js';
import { cycleTile, onPeriod, periodStarts, prePeriod } from '../core/context.js';
import { MEN, MRG, MRN, addD, dk, fDM, fRange, fromDk, now, relDT, todayK } from '../core/dates.js';
import { E, onDay, symEnts } from '../core/entries.js';
import { buildSummary, coincidences, summaryText, topSyms } from '../core/insights.js';
import { EN, L, cap, lc, nDay, nEnt } from '../core/text.js';
import { html } from '../lib/preact.js';
import { LANG, ST, UI } from '../state/store.js';
import { handleAll } from './app.js';
import { FeedRow, I, dayHead, symStats } from './components.js';
import { B, ChipGrid, say, toast } from './feedback.js';
import { openSheet } from './frame.js';
import { notFood, photoConsent, photoYesterday } from './states.js';

// ---- answers rendered in the main block ----
export function monthOf(n) {
  const i = [...MRN, ...MRG].findIndex(m => n.indexOf(m.slice(0, 4)) >= 0);
  if (i >= 0) return i % 12;
  const j = MEN.findIndex(m => n.indexOf(m.slice(0, 3).toLowerCase()) >= 0);
  return j >= 0 ? j : null;
}
export function answer(q, keys, medical) {
  const n = norm(q);
  if (/(сводк|к врачу|for (the |my )?doctor|summary)/.test(n) && !medical)
    return say({ kind: 'summary', q });
  if (/(вопрос|question)/.test(n) && /(врач|doctor)/.test(n) && !medical)
    return say({ kind: 'questions', q });
  const isFood =
    /((^|\s)(ел|ела|ели|съел\S*)(?=\s|$|\?)|еда|еду|еды|поесть|\bate\b|\beat|food|meal)/.test(n);
  const isHeat = /(жар|жарк|heat|hot)/.test(n);
  let range = null;
  const T = fromDk(todayK());
  if (/(вчера|yesterday)/.test(n))
    range = { a: dk(addD(T, -1)), b: dk(addD(T, -1)), l: L('вчера', 'yesterday') };
  else if (/(сегодня|today)/.test(n))
    range = { a: todayK(), b: todayK(), l: L('сегодня', 'today') };
  else if (/(недел|week)/.test(n))
    range = { a: dk(addD(T, -6)), b: todayK(), l: L('7 дней', '7 days') };
  else if (/(месяц|month)/.test(n) && !monthOf(n))
    range = { a: dk(addD(T, -29)), b: todayK(), l: L('30 дней', '30 days') };
  else {
    const m = monthOf(n);
    if (m !== null) {
      const y = T.getFullYear() - (m > T.getMonth() ? 1 : 0);
      const a = new Date(y, m, 1, 12),
        b = new Date(y, m + 1, 0, 12);
      range = { a: dk(a), b: dk(b), l: EN() ? MEN[m] : MRN[m] };
    }
  }
  const list =
    /(покажи|что было|какие записи|show|what happened|entries|history|история)/.test(n) ||
    (range && !keys.length && !isHeat);
  say({
    kind: 'answer',
    q,
    keys: (keys || []).slice(0, 2),
    medical: !!medical,
    isFood,
    isHeat,
    range,
    list,
  });
}
export function daySentence(k) {
  const l = onDay(k);
  if (!l.length) return null;
  const syms = [],
    foods = [];
  const seen = new Set();
  for (const x of l.slice().reverse()) {
    if (x.kind === 'sym' && !seen.has(x.key)) {
      seen.add(x.key);
      syms.push(
        lc(symName(x.key)) +
          (x.s ? ', ' + sName(x.s) : '') +
          ((x.ctx || []).some(c => c.indexOf('food:') === 0) ? L(' после еды', ' after food') : ''),
      );
    }
    if (x.kind === 'food')
      foods.push(x.items && x.items.length ? x.items.join(', ') : mealName(x.meal));
  }
  const p = [];
  if (l.some(x => x.kind === 'pause')) p.push(L('Пауза', 'Pause'));
  if (syms.length) p.push(cap(syms.join('; ')));
  if (foods.length) p.push(cap(L('ели: ', 'ate: ') + foods.join('; ')));
  return p.join('. ');
}
export function RangeList({ range, f }) {
  const list = ST.entries.filter(
    x =>
      x.d >= range.a &&
      x.d <= range.b &&
      (f === 'all' || (f === 'sym' ? x.kind !== 'food' : x.kind === 'food')),
  );
  const groups = [];
  let cur = null;
  for (const x of list) {
    if (!cur || cur.d !== x.d) {
      cur = { d: x.d, items: [] };
      groups.push(cur);
    }
    cur.items.push(x);
  }
  if (!groups.length)
    return html`<p class="b ink2">
      ${L('За этот период записей нет', 'No entries for this period')}
    </p>`;
  const days = new Set(list.map(x => x.d)).size;
  return html`<p class="c ink2">${range.l}: ${nEnt(list.length)}, ${nDay(days)}</p>
    ${groups.map(
      g =>
        html`<div class="col4" key=${g.d}>
          <p class="lbl">${dayHead(g.d)}</p>
          <div class="rows">${g.items.map(x => html`<${FeedRow} key=${x.id} x=${x} />`)}</div>
        </div>`,
    )}`;
}
export function Summary({ days }) {
  const s = buildSummary(LANG, days);
  const P = [
    [30, L('30 дней', '30 days')],
    [92, L('3 месяца', '3 months')],
    [182, L('полгода', '6 months')],
  ];
  const copy = () => {
    const txt = summaryText(LANG, days);
    ST.copiedAt = Date.now();
    save();
    const done = () =>
      say({
        kind: 'log',
        t: {
          title: L('Скопировала сводку', 'Summary copied'),
          sub: L(
            'Вставьте в сообщение врачу или в заметки',
            'Paste it into a message to your doctor or into notes',
          ),
          icon: 'check',
          acts: [],
        },
      });
    try {
      navigator.clipboard.writeText(txt).then(done, () => openSheet('copy', { txt }));
    } catch (e) {
      openSheet('copy', { txt });
    }
  };
  const seg = html`<div class="seg" role="group" aria-label=${L('Период', 'Period')}>
    ${P.map(([d, l]) => html`<button class=${'chip' + (days === d ? ' on' : '')} aria-pressed=${days === d} onClick=${() => say({ kind: 'summary', days: d, big: UI.resp && UI.resp.big })}>${l}</button>`)}
  </div>`;
  return html`${s.few ? html`<p class="b">${L('Записей пока мало. Для совпадений мало, покажу факты без выводов', 'Few entries so far. Too few for coincidences, so facts only, no conclusions')}</p>` : null}
    ${s.sections.map(
      x =>
        html`<div class="col4">
          <p class="lbl">${x.lab}</p>
          ${x.kv ? html`<p class="b">${x.kv.map(r => r[0] + ' ' + r[1]).join(', ')}</p>` : null}
          ${x.text ? html`<p class="b">${x.text}</p>` : null}${
            x.list
              ? html`<ul class="b" style="margin:0;padding-left:20px">
                  ${x.list.map(q => html`<li>${q}</li>`)}
                </ul>`
              : null
          }
        </div>`,
    )}
    ${
      ST.allergies.length
        ? html`<div class="col4">
            <p class="lbl">${L('аллергии и непереносимость', 'allergies and intolerance')}</p>
            <p class="b">${ST.allergies.join(', ')}</p>
          </div>`
        : null
    }
    ${
      ST.protocols.length || ST.protocol
        ? html`<div class="col4">
            <p class="lbl">${L('питание', 'nutrition')}</p>
            <p class="b">
              ${(ST.protocol ? [ST.protocol] : [])
                .concat(ST.protocols)
                .map(
                  p =>
                    p.name +
                    ': ' +
                    (p.end
                      ? fRange(fromDk(p.start), fromDk(p.end))
                      : L('с ', 'since ') + fDM(fromDk(p.start)) + L(', идет', ', ongoing')),
                )
                .join('; ')}
            </p>
          </div>`
        : null
    }
    ${
      E().some(e => e.doc)
        ? html`<div class="col4">
            <p class="lbl">${L('заметки врача', 'doctor notes')}</p>
            ${E()
              .filter(e => e.doc)
              .slice(0, 3)
              .map(e => html`<p class="b" key=${e.id}>${fDM(new Date(e.at))}: ${e.words}</p>`)}
          </div>`
        : null
    }
    ${!ST.health ? html`<p class="c ink2">${L('Шаги и сон из Apple Health появятся в приложении для iPhone', 'Steps and sleep from Apple Health come in the iPhone app')}</p>` : null}
    <p class="f ink2">
      ${B ? L('Это не медицинское заключение', 'This is not a medical report') : L('Только факты. Не медицинское заключение', 'Facts only. Not a medical report')}
    </p>
    ${seg}
    <button class="btn pri" onClick=${copy}>
      <${I} n="copy" />${L('скопировать сводку', 'copy summary')}
    </button>`;
}

export function Questions() {
  const qs = ST.questions.filter(x => x.status !== 'done');
  return html`${
    qs.length
      ? html`<div class="rows">
          ${qs.map(
            x =>
              html`<div class="li">
                <span class="tt b">${x.text}</span
                ><button
                  class="ib"
                  aria-label=${L('Убрать вопрос', 'Remove question')}
                  onClick=${() => {
                    ST.questions = ST.questions.filter(y => y.id !== x.id);
                    save();
                  }}
                >
                  <${I} n="close" s=${20} />
                </button>
              </div>`,
          )}
        </div>`
      : html`<p class="b ink2">${L('Пока пусто', 'Nothing yet')}</p>`
  }`;
}
export function Insights({ keys }) {
  const ks = keys && keys.length ? keys : topSyms(dk(addD(now(), -29)), todayK(), 2).map(x => x[0]);
  if (!ks.length)
    return html`<p class="b ink2">
      ${L('Пока нет записей о самочувствии за 30 дней', 'No entries about how you feel in 30 days yet')}
    </p>`;
  const co = coincidences();
  return html`${ks.map(k => {
      const st = symStats(k, 30);
      if (!st.n) return null;
      return html`<div class="col4" key=${k}>
        <p class="lbl">${symName(k)}: ${nEnt(st.n)}</p>
        <p class="c">
          ${L('В течение 3 часов после еды: ', 'Within 3 hours after food: ')}<span class="num"
            >${st.af} ${L('из', 'of')} ${st.n}</span
          >${st.dishes.length ? html`<span class="ink2">${' (' + st.dishes.map(d => d[0] + (d[1] > 1 ? ' ×' + d[1] : '')).join(', ') + ')'}</span>` : null}
        </p>
        <p class="c">
          ${L('После тепла или в жару: ', 'After heat or on hot days: ')}<span class="num"
            >${st.heat} ${L('из', 'of')} ${st.n}</span
          >
        </p>
        ${st.effort ? html`<p class="c">${L('После нагрузки: ', 'After effort: ')}<span class="num">${st.effort} ${L('из', 'of')} ${st.n}</span></p>` : null}
        ${st.pre !== null ? html`<p class="c">${L('За 1–3 дня до месячных: ', '1–3 days before a period: ')}<span class="num">${st.pre} ${L('из', 'of')} ${st.n}</span></p>` : null}
      </div>`;
    })}
    <p class="lbl">${L('по группам еды', 'by food group')}</p>
    ${
      co.few
        ? html`<p class="c ink2">
            ${EN() ? `Food on ${co.n} of 30 days, groups from 7` : `Еда записана ${co.n} из 30 дней, группы от 7`}
          </p>`
        : co.res.length
          ? html`<div class="kvr">
              ${co.res.slice(0, 4).map(x => html`<span class="c">${L('дни с ', 'days with ') + groupName({ g: x.g }, true)}</span><span class="c num">${EN() ? `${x.a} of ${x.n} with symptoms that day or the next; other days ${x.oa} of ${x.o}` : `${x.a} из ${x.n} с симптомами в тот же или на следующий день; в остальные дни ${x.oa} из ${x.o}`}</span>`)}
            </div>`
          : html`<p class="c ink2">
              ${L('Ни одна группа не встречалась 3 дня и больше', 'No group appeared on 3 or more days')}
            </p>`
    }
    ${!ST.photoUsed ? html`` : null}`;
}
export function CycleBlock({ keys }) {
  if (ST.cycle === 'off')
    return html`<p class="b">
      ${L('Цикл выключен. Включить можно в настройках', 'The cycle is off. You can turn it on in settings')}
    </p>`;
  if (!periodStarts().length)
    return html`<p class="b">
      ${L('Цикл пока не отмечен. Когда начнутся месячные, скажите «месячные начались»', 'No cycle marked yet. When your period starts, say “my period started”')}
    </p>`;
  const ks = keys && keys.length ? keys : topSyms(dk(addD(now(), -89)), todayK(), 2).map(x => x[0]);
  if (!ks.length)
    return html`<p class="b ink2">
      ${L('Записей о самочувствии пока нет', 'No entries about how you feel yet')}
    </p>`;
  const c = cycleTile();
  return html`${c ? html`<p class="c ink2">${L('Сейчас: ', 'Now: ') + c.l + ' ' + c.v}</p>` : null}
  ${ks.map(k => {
    const l = symEnts(k).filter(x => x.d >= dk(addD(now(), -89)));
    const pre = l.filter(x => prePeriod(x.d)).length;
    const on = l.filter(x => onPeriod(fromDk(x.d))).length;
    const rest = l.length - pre - on;
    return html`<div class="col4" key=${k}>
      <p class="lbl">${symName(k)}: ${nEnt(l.length)}${L(' за 90 дней', ' in 90 days')}</p>
      <div class="kvr">
        <span class="c">${L('за 1–3 дня до месячных', '1–3 days before a period')}</span
        ><span class="c num">${pre}</span
        ><span class="c">${L('во время месячных', 'during a period')}</span
        ><span class="c num">${on}</span
        ><span class="c">${L('в остальные дни', 'on other days')}</span
        ><span class="c num">${rest}</span>
      </div>
    </div>`;
  })} `;
}
export function dayHint() {
  const foodDays = new Set(
    E()
      .filter(e => e.kind === 'food')
      .map(e => e.d),
  ).size;
  const n = ST.entries.length;
  if (n < 5) return null;
  if (foodDays < 7)
    return {
      ic: 'cam',
      t: EN() ? `Food on ${foodDays} of 7 days` : `Еда записана: ${foodDays} из 7 дней`,
      s: L('Совпадения от 7 дней', 'Coincidences from 7 days'),
      fn: () => {
        const el = document.querySelector('.cam input[type=file]');
        if (el) el.click();
      },
    };
  const d = now().getDate() % 3;
  if (d === 0)
    return {
      ic: 'spark',
      t: L('что связано с самочувствием?', 'what is linked to how I feel?'),
      s: L('Еда, тепло, нагрузка, цикл', 'Food, heat, effort, cycle'),
      fn: () => handleAll(L('что связано с самочувствием?', 'what is linked to how I feel?')),
    };
  if (d === 1 && periodStarts().length)
    return {
      ic: 'drop',
      t: L('как это связано с циклом?', 'how is it linked to my cycle?'),
      s: L('До, во время, в остальные дни', 'Before, during, other days'),
      fn: () => handleAll(L('как это связано с циклом?', 'how is it linked to my cycle?')),
    };
  return {
    ic: 'doc',
    t: L('сводка к врачу', 'summary for the doctor'),
    s: L('За месяц, три или полгода', 'A month, three or six'),
    fn: () => handleAll(L('сводка к врачу', 'summary for the doctor')),
  };
}
export async function onPhoto(ev) {
  const files = Array.from(ev.target.files || []);
  ev.target.value = '';
  if (!files.length) return;
  const f = files[0];
  if (f.type && !/^image\//.test(f.type)) return notFood();
  try {
    const src = await readPhoto(f);
    const fresh = f.lastModified && Math.abs(Date.now() - f.lastModified) < 3 * 36e5;
    const yday = f.lastModified && dk(new Date(f.lastModified)) === dk(addD(now(), -1));
    const go = () => {
      if (yday) return photoYesterday(src, f.lastModified);
      say({
        kind: 'photo',
        src,
        at: fresh ? f.lastModified : null,
        items: [],
        meal: mealByTime(fresh ? new Date(f.lastModified) : now()),
        w: fresh ? 'photo' : 'now',
        other: false,
        txt: '',
        n: files.length,
      });
    };
    photoConsent(go);
  } catch (e) {
    toast({
      title: L('Не получилось открыть фото', 'Could not open the photo'),
      sub: L('Попробуйте другой снимок', 'Try another photo'),
      icon: 'info',
      acts: [],
    });
  }
}
function guessDishes(meal) {
  const seen = [];
  const push = x => {
    if (x && !seen.includes(x)) seen.push(x);
  };
  for (const e of E())
    if (e.kind === 'food' && e.meal === meal) for (const it of e.items || []) push(it);
  const typ = EN()
    ? {
        breakfast: ['oatmeal', 'eggs', 'coffee', 'yogurt'],
        lunch: ['soup', 'salad', 'pasta', 'chicken'],
        dinner: ['fish', 'vegetables', 'rice', 'pasta'],
        snack: ['fruit', 'nuts', 'yogurt'],
        food: ['salad', 'soup'],
      }
    : {
        breakfast: ['овсянка', 'яичница', 'кофе', 'йогурт'],
        lunch: ['суп', 'салат', 'паста', 'курица'],
        dinner: ['рыба', 'овощи', 'рис', 'паста'],
        snack: ['фрукты', 'орехи', 'йогурт'],
        food: ['салат', 'суп'],
      };
  for (const t of typ[meal] || typ.food) push(t);
  return seen.slice(0, 6);
}
export function PhotoBlock({ r }) {
  const set = o => {
    Object.assign(r, o);
    rr();
  };
  const dishes = [...new Set(r.items.concat(guessDishes(r.meal)))];
  const o = whenOpts(); // picked items stay when the meal changes
  const go = () => {
    const d = r.w === 'photo' ? new Date(r.at) : (o.find(y => y.id === r.w) || o[0]).d;
    const extra = r.txt.trim()
      ? r.txt
          .split(/[,;]/)
          .map(x => x.trim())
          .filter(Boolean)
      : [];
    const items = r.items.concat(extra);
    const al = ST.allergies.find(a => items.some(i => norm(i).indexOf(norm(a).slice(0, 4)) >= 0));
    UI.resp = null;
    logFood({ items, meal: r.meal, when: d, words: r.txt.trim() || null, photo: r.src });
    if (al)
      setTimeout(() => {
        if (UI.mtoast) {
          UI.mtoast.sub =
            L('Здесь ', 'Here: ') + al + L(', у вас на это аллергия', ', you are allergic to it');
          UI.mtoast.icon = 'info';
          rr();
        }
      }, 30);
  };
  const Row = ({ label, children }) =>
    html`<div class="col4">
      <p class="lbl">${label}</p>
      <div class="wrap">${children}</div>
    </div>`;
  return html`<section class="card surf" aria-live="polite">
    <div class="row" style="align-items:flex-start">${r.src ? html`<img class="th" src=${r.src} alt=${L('Выбранное фото', 'Selected photo')} style="width:64px;height:64px" />` : html`<span class="th" style="width:64px;height:64px;background:var(--canvas);display:block"></span>`}<div class="grow col4"><h2 class="q">${L('фото еды', 'food photo') + (r.n > 1 ? (EN() ? `, ${r.n} photos` : `, ${r.n} фото`) : '')}</h2><p class="c ink2">${r.nores ? L('Блюдо не узнала. Скажите словами, что ели', 'I did not recognize the dish. Say in words what you ate') : ST.recognize === false ? L('Без распознавания, только фото', 'No recognition, photo only') : L('Дальше по желанию', 'The rest is optional')}</p></div><button class="ib" aria-label=${L('Отмена', 'Cancel')} onClick=${() => {
      UI.resp = null;
      rr();
    }}><${I} n="close"/></button></div>
    <${Row} label=${r.nores ? L('что ели', 'what you ate') : L('похоже на', 'looks like')}>${(r.nores ? dishes.slice(0, 2) : dishes).map(d => html`<button class=${'chip' + (r.items.includes(d) ? ' on' : '')} key=${d} aria-pressed=${r.items.includes(d)} onClick=${() => set({ items: r.items.includes(d) ? r.items.filter(x => x !== d) : r.items.concat([d]) })}><span>${d}</span></button>`)}
      <button class=${'chip' + (r.other ? ' on' : '')} aria-expanded=${r.other} onClick=${() => set({ other: !r.other })}><span>${L('другое', 'other')}</span></button></${Row}>
    ${r.other ? html`<input class="field" id="pother" value=${r.txt} onInput=${e => set({ txt: e.target.value })} placeholder=${L('через запятую', 'comma separated')} aria-label=${L('Что еще на фото', 'What else is in the photo')} />` : null}
    <${Row} label=${L('прием пищи', 'meal')}>${['breakfast', 'lunch', 'dinner', 'snack'].map(m => html`<button class=${'chip' + (r.meal === m ? ' on' : '')} key=${m} aria-pressed=${r.meal === m} onClick=${() => set({ meal: m })}><span>${mealName(m)}</span></button>`)}</${Row}>
    ${r.at ? html`<p class="c ink2">${L('Время фото: ', 'Photo time: ') + relDT(new Date(r.at))}${r.w === 'photo' ? html` <button class="link" style="display:inline;width:auto;min-height:0" onClick=${() => set({ w: 'now' })}>${L('другое', 'change')}</button>` : null}</p>` : null}
    ${!r.at || r.w !== 'photo' ? html`<${Row} label=${r.at ? L('когда ели', 'when did you eat') : L('у фото нет времени. когда ели?', 'the photo has no time. when did you eat?')}>${o.slice(0, 4).map(w => html`<button class=${'chip' + (r.w === w.id ? ' on' : '')} key=${w.id} aria-pressed=${r.w === w.id} onClick=${() => set({ w: w.id })}><span>${w.l}</span></button>`)}</${Row}>` : null}
    <button class="btn pri" onClick=${go}>${L('записать', 'save')}</button>
    <p class="f ink2">${L('Подсказки из прошлых записей, не распознавание', 'Suggestions from past entries, not recognition')}</p>
  </section>`;
}
export function Follow({ items }) {
  return html`<${ChipGrid}
    label=${L('Дальше', 'Next')}
    items=${items.map(x => ({ l: x.l, ic: 'spark', fn: () => handleAll(x.q || x.l) }))}
  />`;
}
