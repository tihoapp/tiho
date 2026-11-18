// Insights: coincidences, summaries, stats for the doctor
import { GROUPS, HEAT, checkTitle, inGroup, symName } from './catalog.js';
import { hsh, isHot, periodStarts, prePeriod, sleepFor } from './context.js';
import { DAY, addD, ddiff, dk, fRange, fromDk, now, todayK } from './dates.js';
import { E, symEnts } from './entries.js';
import { EN, L, cap, lc, nDay, nEnt, plRu, qt, withLang } from './text.js';
import { ST } from '../state/store.js';

// ---- computations ----
export function topSyms(from, to, limit) {
  const c = {};
  for (const e of symEnts()) if (e.d >= from && e.d <= to) c[e.key] = (c[e.key] || 0) + 1;
  return Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit || 3);
}
function heatCount(k, from, to) {
  const l = symEnts(k).filter(e => e.d >= from && e.d <= to);
  return {
    n: l.length,
    h: l.filter(e => (e.ctx || []).some(c => HEAT.includes(c)) || isHot(new Date(e.at))).length,
  };
}
export function coincidences() {
  const end = fromDk(todayK());
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(dk(addD(end, -i)));
  const d0 = days[0];
  const foodDays = new Set(
    E()
      .filter(e => e.kind === 'food' && e.d >= d0)
      .map(e => e.d),
  );
  if (foodDays.size < 7) return { few: true, n: foodDays.size };
  const symDay = new Set(
    E()
      .filter(e => e.kind === 'sym' && e.d >= d0)
      .map(e => e.d),
  );
  const hit = d => symDay.has(d) || symDay.has(dk(addD(fromDk(d), 1)));
  const res = [];
  for (const g of Object.keys(GROUPS)) {
    const gD = days.filter(d =>
      E().some(e => e.kind === 'food' && e.d === d && (e.items || []).some(it => inGroup(it, g))),
    );
    if (gD.length < 3) continue;
    const after = gD.filter(hit);
    const oth = [...foodDays].filter(d => !gD.includes(d));
    const othA = oth.filter(hit);
    res.push({
      g,
      n: gD.length,
      a: after.length,
      o: oth.length,
      oa: othA.length,
      days: after,
      hot: after.filter(d => isHot(fromDk(d))).length,
      sl: ST.health ? after.filter(d => sleepFor(fromDk(d)) < 6).length : null,
      pre: periodStarts().length ? after.filter(prePeriod).length : null,
    });
  }
  res.sort((x, y) => y.a / y.n - y.oa / Math.max(1, y.o) - (x.a / x.n - x.oa / Math.max(1, x.o)));
  return { few: false, res, n: foodDays.size };
}

function walkSpeed(d) {
  return 1.02 + hsh('w' + dk(d)) * 0.14;
}
export function buildSummary(lg, days) {
  return withLang(lg, () => {
    const end = fromDk(todayK());
    const start = addD(end, -((days || 92) - 1));
    const first = E().length ? fromDk(E()[E().length - 1].d) : end;
    const from = first > start ? first : start;
    const fk = dk(from),
      tk = dk(end);
    const S = [];
    const ws = ST.worseHist
      .filter(w => w.end >= fk)
      .map(w => ({ a: fromDk(w.start), b: fromDk(w.end) }));
    if (ST.worse) ws.push({ a: fromDk(ST.worse.start), b: end, open: true });
    ws.sort((x, y) => y.a - x.a);
    S.push({
      lab: L('дни хуже обычного', 'worse than usual'),
      text: ws.length
        ? (EN()
            ? `${ws.length} ${ws.length === 1 ? 'stretch' : 'stretches'}: `
            : `${ws.length} ${plRu(ws.length, 'период', 'периода', 'периодов')}: `) +
          ws
            .map(
              w =>
                `${fRange(w.a, w.b)} (${nDay(ddiff(w.b, w.a) + 1)}${w.open ? L(', продолжается', ', ongoing') : ''})`,
            )
            .join(', ')
        : L('не отмечали', 'none marked'),
    });
    const top = topSyms(fk, tk, 3);
    S.push({
      lab: L('чаще всего', 'most often'),
      kv: top.length ? top.map(([k, c]) => [lc(symName(k)), nEnt(c)]) : null,
      text: top.length ? null : L('записей нет', 'no entries'),
    });
    if (ST.health) {
      const a = walkSpeed(from),
        b = walkSpeed(end);
      S.push({
        lab: L('ходьба, Apple Health', 'walking, Apple Health'),
        text:
          L('скорость: ', 'speed: ') +
          (EN() ? a.toFixed(2) : a.toFixed(2).replace('.', ',')) +
          ' → ' +
          (EN() ? b.toFixed(2) : b.toFixed(2).replace('.', ',')) +
          L(' м/с', ' m/s'),
      });
    } else
      S.push({
        lab: L('ходьба, Apple Health', 'walking, Apple Health'),
        text: L('нет данных', 'no data'),
      });
    const lines = [];
    if (top.length) {
      const k = top[0][0];
      const hc = heatCount(k, fk, tk);
      if (hc.n)
        lines.push(
          EN()
            ? `${cap(symName(k))} on hot days or after heat: ${hc.h} of ${hc.n}`
            : `${cap(symName(k))} в жаркие дни или после тепла: ${hc.h} из ${hc.n}`,
        );
      const cool = symEnts().filter(e => e.d >= fk && e.cool);
      if (cool.length) {
        const y = cool.filter(e => e.cool === 'yes').length;
        lines.push(
          EN()
            ? `Better after cooling down: ${y} of ${cool.length}`
            : `Стало лучше, когда остыли: ${y} из ${cool.length}`,
        );
      }
      if (periodStarts().length) {
        const all = symEnts().filter(e => e.d >= fk && e.d <= tk);
        const pre = all.filter(e => prePeriod(e.d)).length;
        lines.push(
          EN()
            ? `1–3 days before a period: ${pre} of ${all.length} entries`
            : `За 1–3 дня до месячных: ${pre} из ${all.length} записей`,
        );
      }
    }
    if (ST.cyclePaused) lines.push(L('Цикл на паузе', 'Cycle paused'));
    if (top.length) {
      const k = top[0][0];
      const all = symEnts(k).filter(e => e.d >= fk && e.d <= tk);
      const af = all.filter(e => (e.ctx || []).some(c => c.indexOf('food:') === 0)).length;
      const ef = all.filter(e => (e.ctx || []).includes('effort')).length;
      if (af)
        lines.push(
          EN()
            ? `${cap(symName(k))} within 3 hours after food: ${af} of ${all.length}`
            : `${cap(symName(k))} в течение 3 часов после еды: ${af} из ${all.length}`,
        );
      if (ef)
        lines.push(
          EN() ? `After effort: ${ef} of ${all.length}` : `После нагрузки: ${ef} из ${all.length}`,
        );
    }
    if (lines.length)
      S.push({
        lab: L('тепло, еда, нагрузка, цикл', 'heat, food, effort, cycle'),
        text: lines.join('. '),
      });
    const nw = newLong(fk);
    if (nw.length)
      S.push({
        lab: L('новое и дольше суток', 'new and longer than a day'),
        text: nw
          .map(
            x =>
              `${cap(symName(x.key))}: ${fRange(fromDk(x.first), fromDk(x.last))}${x.gone ? L(', прошло', ', gone') : ''}`,
          )
          .join('. '),
      });
    const meds = ST.meds;
    if (meds.length) {
      S.push({
        lab: L('терапия', 'therapy'),
        text: meds
          .map(m => {
            const taken = E().filter(
              e => e.kind === 'med' && e.name === m.name && e.d >= fk,
            ).length;
            const how =
              m.how === 'course'
                ? L('курс', 'course')
                : m.how === 'asNeeded'
                  ? L('по необходимости', 'as needed')
                  : L('постоянно', 'regularly');
            return cap(
              `${m.name}, ${how}` +
                (taken ? L(`, отмечено приемов: ${taken}`, `, doses marked: ${taken}`) : ''),
            );
          })
          .join('. '),
      });
    }
    const ch = ST.checks.filter(c => c.end >= fk);
    if (ch.length)
      S.push({
        lab: L('проверки продуктов', 'food checks'),
        text: ch
          .map(c =>
            cap(
              `${checkTitle(c)}, ${fRange(fromDk(c.start), fromDk(c.end))}` +
                (c.result
                  ? `, ${L('отметка человека', 'person’s mark')}: ${verdictName(c.result)}`
                  : ''),
            ),
          )
          .join('. '),
      });
    const words = symEnts()
      .filter(e => e.d >= fk && e.words)
      .slice(0, 3)
      .map(e => qt(e.words));
    if (words.length)
      S.push({
        lab: L('своими словами', 'in the person’s words'),
        text:
          words.join(', ') +
          (EN() ? '. Original words; auto-translation is part of the app, not this prototype' : ''),
      });
    const qs = ST.questions.filter(q => q.status !== 'done');
    if (qs.length)
      S.push({ lab: L('вопросы к врачу', 'questions for the doctor'), list: qs.map(q => q.text) });
    return {
      range: fRange(from, end),
      from,
      end,
      sections: S,
      few: symEnts().filter(e => e.d >= fk).length < 5,
      ws,
      top,
    };
  });
}
function newLong(fk) {
  const out = [];
  const keys = [...new Set(symEnts().map(e => e.key))];
  for (const k of keys) {
    const l = symEnts(k).slice().reverse();
    if (!l.length || l[0].d < fk) continue;
    const first = l[0],
      last = l[l.length - 1];
    if (ST.firstDay && first.d <= ST.firstDay) continue;
    if (ddiff(now(), fromDk(first.d)) > 14) continue;
    if (last.at - first.at < DAY) continue;
    const gone = E().some(e => e.kind === 'gone' && e.key === k && e.at > last.at);
    out.push({ key: k, first: first.d, last: last.d, gone });
  }
  return out;
}
const verdictName = v =>
  v === 'link'
    ? L('вижу связь', 'I see a link')
    : v === 'none'
      ? L('не связано', 'not related')
      : L('пока не знаю', 'not sure yet');
export function summaryText(lg, days) {
  const s = buildSummary(lg, days);
  return withLang(lg, () => {
    let t =
      L('Сводка для врача', 'Summary for the doctor') +
      '\n' +
      s.range +
      '. ' +
      L('Только факты', 'Facts only') +
      '\n\n';
    for (const x of s.sections) {
      t += x.lab.toUpperCase() + '\n';
      if (x.kv) t += x.kv.map(r => r[0] + ': ' + r[1]).join('\n') + '\n';
      if (x.text) t += x.text + '\n';
      if (x.list) t += x.list.map(q => '— ' + q).join('\n') + '\n';
      t += '\n';
    }
    return t.replace(/\u00a0/g, ' ');
  });
}
