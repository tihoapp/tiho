// Chips, input line and the App root
import {
  addEntries,
  fixAct,
  foodBefore,
  handleText,
  logSym,
  rr,
  save,
  sortE,
  undoAct,
  whenOpts,
} from '../app/actions.js';
import { seedDemo } from '../app/demo.js';
import { cmpName, ctxText, mealName, sName, symName } from '../core/catalog.js';
import { isHot, periodOf, periodStarts, stepsFor, weatherOn } from '../core/context.js';
import { addD, dk, fHdr, now, relDT, todayK } from '../core/dates.js';
import { E, mainSym, onDay, symEnts } from '../core/entries.js';
import { loadS, phoneLang, saveS } from '../core/storage.js';
import { EN, L, cap, lc } from '../core/text.js';
import { html, useEffect, useRef, useState } from '../lib/preact.js';
import { fetchWx } from '../services/weather.js';
import { LANG, ST, UI, setLANG, setRR, setST } from '../state/store.js';
import { onPhoto } from './answers.js';
import { voiceChips } from './blocks.js';
import {
  CopySheet,
  Ctx,
  I,
  Mascot,
  QuickSheet,
  RecSheet,
  SafetySheet,
  SwRow,
  VoiceSheet,
} from './components.js';
import { Block } from './day-card.js';
import { B, ChipGrid, MODE, MainToast, V6, applyTheme, say, toast } from './feedback.js';
import { closeSheet } from './frame.js';
import { afterAppt, applyBig, cmd, myWords, protoAsk, protoDays } from './states.js';

// ---- three living chips ----
function chips() {
  const out = [];
  const n0 = now(),
    h = n0.getHours(),
    tk = todayK();
  const today = onDay(tk);
  const yk = dk(addD(n0, -1));
  const ys = onDay(yk).filter(x => x.kind === 'sym');
  const uniq = [];
  for (const x of ys) if (!uniq.find(u => u.key === x.key)) uniq.push(x);
  const lastFood = today.find(x => x.kind === 'food');
  if (!ST.entries.length) {
    const ph = EN()
      ? ['fingers slightly numb', 'oatmeal and coffee for breakfast']
      : ['слегка немеют пальцы', 'на завтрак овсянка и кофе'];
    const first = [
      {
        l: L('сфотографировать еду', 'photograph food'),
        cam: true,
        fn: () => {
          const el = document.querySelector('.cam input[type=file]');
          if (el) el.click();
        },
      },
    ];
    return B ? first : first.concat(ph.slice(0, 1).map(p => ({ l: p, fn: () => handleText(p) })));
  }
  if (!today.length && uniq.length) {
    out.push({
      l: L('как вчера', 'same as yesterday'),
      fn: () =>
        logSym(
          uniq.map(u => ({ key: u.key, s: u.s, ctx: [] })),
          null,
          null,
        ),
    });
    out.push({
      l: L('прошло', 'gone'),
      fn: () => {
        const at = n0.getTime();
        const ids = addEntries(uniq.map(u => ({ kind: 'gone', key: u.key, at })));
        save();
        toast({
          title: L('Хорошо, что прошло', 'Good that it passed'),
          sub: uniq.map(u => lc(symName(u.key))).join(', '),
          acts: [undoAct(ids)],
        });
      },
    });
  }
  const inl = () => {
    UI.inline = mainSym();
    rr();
  };
  if (ST.protocol && protoDays() >= 14 && !today.length)
    out.push({ l: L('протокол: день ', 'protocol: day ') + protoDays(), fn: protoAsk });
  if (ST.appt && ST.appt === dk(addD(n0, 1)))
    out.push({
      l: L('сводка к приему', 'summary for the visit'),
      fn: () => say({ kind: 'summary', days: 30 }),
    });
  if (ST.appt && ST.appt === dk(addD(n0, -1)))
    out.push({ l: L('после приема', 'after the visit'), fn: afterAppt });
  if (ST.worse)
    out.push({
      l: L('вернулось к обычному', 'back to usual'),
      fn: () => handleAll(L('вернулось к обычному', 'back to usual')),
    });
  {
    const pp = ST.cycle !== 'off' ? periodOf(n0) : null;
    if (pp && pp.open && pp.n >= 3)
      out.push({
        l: L('месячные закончились', 'period ended'),
        fn: () => handleText(L('месячные закончились', 'my period ended')),
      });
  }
  if (lastFood && n0.getTime() - lastFood.at < 3 * 36e5 && mainSym())
    out.push({ l: L('как сейчас?', 'how is it now?'), star: true, fn: inl });
  else if (mainSym()) out.push({ l: symName(mainSym()), star: true, fn: inl });
  if (B && ST.entries.some(e => e.words))
    out.push({ l: L('мои фразы', 'my phrases'), fn: () => myWords() });
  if (h >= 12 && !today.length)
    out.push({
      l: L('сегодня пауза', 'pause today'),
      fn: () => {
        const ids = addEntries([{ kind: 'pause', at: n0.getTime() }]);
        save();
        toast({ title: L('Записала: пауза', 'Saved: pause'), acts: [undoAct(ids)] });
      },
    });
  if (h >= 18 && !today.some(x => x.kind === 'sym'))
    out.push({
      l: L('как прошел день?', 'how was the day?'),
      fn: () => {
        UI.inline = mainSym() || 'fatigue';
        rr();
      },
    });
  const disc = [];
  if (ST.entries.length >= 14 && E().filter(e => e.kind === 'food').length >= 7)
    disc.push({
      l: L('что связано с самочувствием?', 'what is linked to how I feel?'),
      fn: () => handleAll(L('что связано с самочувствием?', 'what is linked to how I feel?')),
    });
  if (ST.entries.length >= 14 && periodStarts().length)
    disc.push({
      l: L('как это связано с циклом?', 'how is it linked to my cycle?'),
      fn: () => handleAll(L('как это связано с циклом?', 'how is it linked to my cycle?')),
    });
  if (ST.entries.length >= 14)
    disc.push({
      l: L('сводка к врачу', 'summary for the doctor'),
      fn: () => handleAll(L('сводка к врачу', 'summary for the doctor')),
    });
  if (n0.getDay() === 0 || n0.getDay() === 6)
    disc.push({
      l: L('что было за неделю?', 'what happened this week?'),
      fn: () => handleText(L('что было за неделю?', 'what happened this week?')),
    });
  if (disc.length) {
    const i = n0.getDate() % disc.length;
    out.push(disc[i]);
    if (disc.length > 1) out.push(disc[(i + 1) % disc.length]);
  }
  out.push({
    l: L('что я ела вчера?', 'what did I eat yesterday?'),
    fn: () => handleText(L('что я ела вчера?', 'what did I eat yesterday?')),
  });
  if (mainSym())
    out.push({
      l: L('когда последний раз?', 'when was the last time?'),
      fn: () => handleText(L('когда ', 'when ') + lc(symName(mainSym())) + '?'),
    });
  const seen = new Set();
  return out.filter(c => !seen.has(c.l) && seen.add(c.l)).slice(0, B ? 2 : 3);
}
function ctxOptions() {
  const n0 = now(),
    o = [];
  const f = E().find(e => e.kind === 'food' && n0.getTime() - e.at <= 3 * 36e5);
  if (f)
    o.push({
      l: L('после ', 'after ') + (f.items && f.items.length ? f.items[0] : mealName(f.meal)),
      c: foodBefore(n0.getTime()),
    });
  if (weatherOn() && isHot(n0)) o.push({ l: L('в жару', 'in the heat'), c: 'hot' });
  const h = n0.getHours();
  if (h >= 6 && h <= 11) o.push({ l: L('после душа', 'after a shower'), c: 'shower' });
  if (ST.health && stepsFor(n0) >= 6000)
    o.push({ l: L('после прогулки', 'after a walk'), c: 'walk' });
  if (h >= 17) o.push({ l: L('после работы', 'after work'), c: 'effort' });
  o.push({ l: L('стресс', 'stress'), c: 'stress' });
  return o.slice(0, 4);
}
function stepItems() {
  const close = () => {
    UI.inline = null;
    rr();
  };
  if (UI.inline && UI.inline.step === 'ctx') {
    if (B) {
      UI.inline = null;
      return null;
    }
    const st = UI.inline;
    const x = ST.entries.find(e => e.id === st.id);
    if (!x) {
      close();
      return null;
    }
    return {
      label: L('после чего? по желанию', 'after what? optional'),
      items: ctxOptions()
        .concat([{ l: L('ничего такого', 'nothing special'), c: null }])
        .map(o => ({
          l: o.l,
          fn: () => {
            if (o.c && !x.ctx.includes(o.c)) {
              x.ctx = x.ctx.concat([o.c]);
              x.edited = Date.now();
              save();
            }
            UI.inline = { step: 'when', id: x.id };
            rr();
          },
        }))
        .concat([{ l: '×', aria: L('Закрыть', 'Close'), fn: close }]),
    };
  }
  if (UI.inline && UI.inline.step === 'when') {
    if (B) {
      UI.inline = null;
      return null;
    }
    const st = UI.inline;
    const x = ST.entries.find(e => e.id === st.id);
    if (!x) {
      close();
      return null;
    }
    return {
      label: L('когда?', 'when?'),
      items: whenOpts()
        .slice(0, 3)
        .map(w => ({
          l: w.l,
          fn: () => {
            if (w.id !== 'now') {
              x.at = w.d.getTime();
              x.d = dk(w.d);
              x.edited = Date.now();
              sortE();
            }
            save();
            UI.inline = null;
            toast({
              title:
                L('Записала: ', 'Saved: ') + lc(symName(x.key)) + (x.s ? ', ' + sName(x.s) : ''),
              sub:
                cap(relDT(new Date(x.at))) +
                ((x.ctx || []).length ? ', ' + x.ctx.map(c => ctxText(c)).join(', ') : ''),
              acts: [fixAct(x.id), undoAct([x.id])],
            });
          },
        }))
        .concat([{ l: '×', aria: L('Закрыть', 'Close'), fn: close }]),
    };
  }
  if (UI.inline) {
    const k = typeof UI.inline === 'string' ? UI.inline : UI.inline.sym;
    const prior = symEnts(k).length > 0;
    const opts = prior
      ? [
          { l: cmpName('less'), n: 1, cmp: 'less' },
          { l: cmpName('same'), n: 2, cmp: 'same' },
          { l: cmpName('more'), n: 3, cmp: 'more' },
        ]
      : [1, 2, 3].map(n => ({ l: sName(n), n }));
    return {
      label: symName(k) + ':',
      items: opts
        .map(o => ({
          l: o.l,
          fn: () => {
            const ids = logSym([{ key: k, s: o.n, ctx: [] }], null, null);
            const x = E().find(e => e.id === ids[0]);
            if (x && o.cmp) {
              x.cmp = o.cmp;
              save();
              if (UI.mtoast)
                UI.mtoast.title =
                  L('Записала: ', 'Saved: ') + lc(symName(k)) + ', ' + cmpName(o.cmp);
            }
            UI.inline = B ? null : { step: 'ctx', id: ids[0] };
            rr();
          },
        }))
        .concat([{ l: '×', aria: L('Закрыть', 'Close'), fn: close }]),
    };
  }
  return null;
}
function allChips() {
  const st = stepItems();
  if (st) return st;
  if (UI.resp) {
    if (UI.resp.kind === 'voice' && !B) return { items: voiceChips(UI.resp) };
    if (!B && UI.resp.chips && UI.resp.chips.length) return { items: UI.resp.chips };
    return null;
  }
  const c = chips();
  if (!ST.chipHints) c.length = Math.min(c.length, 1);
  if (!B || V6)
    c.push({
      l: V6 ? L('что спросить?', 'what to ask?') : '?',
      aria: L('Что можно сказать', 'What you can say'),
      fn: () => say({ kind: 'help' }),
    });
  return { items: c };
}
function ChipsBottom({ ch }) {
  if (!ch) return null;
  return html`<div class="acard">
    ${ch.label ? html`<p class="lbl">${ch.label}</p>` : null}<${ChipGrid} items=${ch.items} />
  </div>`;
}
export function handleAll(v) {
  if (cmd(v) === false) handleText(v);
}
function InputLine() {
  const [t, setT] = useState(UI.draft || '');
  const send = () => {
    const v = t.trim();
    if (!v) return;
    setT('');
    UI.draft = '';
    const ph = UI.ph;
    UI.ph = null;
    if (ph && /город|city/.test(ph)) {
      ST.city = v;
      ST.geo = true;
      save();
      setTimeout(() => fetchWx(true), 0);
      return toast({ title: L('Город: ', 'City: ') + v, acts: [] });
    }
    if (ph && /врач|doctor/.test(ph)) return cmd(L('врач сказал: ', 'doctor said: ') + v);
    handleAll(v);
  };
  return html`<form
    class="line"
    onSubmit=${e => {
      e.preventDefault();
      send();
    }}
  >
    <label class=${'cam' + (ST.photoUsed || V6 ? '' : ' wide')}
      ><input
        type="file"
        accept="image/*"
        multiple
        class="sr"
        aria-label=${L('Фото еды', 'Food photo')}
        onChange=${onPhoto}
      /><${I}
        n="cam"
      />${ST.photoUsed || V6 ? null : html`<span aria-hidden="true">${L('фото', 'photo')}</span>`}</label
    >
    <input
      id="line"
      class="lin"
      value=${t}
      onInput=${e => {
        setT(e.target.value);
        UI.draft = e.target.value;
      }}
      placeholder=${UI.ph ? UI.ph : UI.resp && UI.resp.kind === 'voice' ? L('идет запись', 'recording') : UI.mtoast ? L('что-нибудь еще?', 'anything else?') : V6 ? (ST.bigText ? L('как вы?', 'how are you?') : L('скажите или спросите', 'tell me or ask')) : B ? L('как вы?', 'how are you?') : L('Как вы?', 'How are you?')}
      aria-label=${L('Что записать или спросить', 'What to save or ask')}
      enterkeyhint="send"
      autocomplete="off"
    />
    ${t.trim() ? html`<button type="submit" class="mic" aria-label=${L('Отправить', 'Send')}><${I} n="send" /></button>` : html`<button type="button" class="mic" aria-label=${L('Сказать голосом', 'Speak')} onClick=${() => say({ kind: 'voice', txt: '' })}><${I} n="mic" /></button>`}
  </form>`;
}
function Onboarding() {
  const [w, setW] = useState(true);
  const [cy, setCy] = useState(true);
  const [bt, setBt] = useState(!!ST.bigText);
  const pickBig = v => {
    setBt(v);
    ST.bigText = v;
    save();
    applyBig();
  };
  let sysDark = false;
  try {
    sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {}
  const [th, setTh] = useState(
    ST.theme === 'light' || ST.theme === 'dark' ? ST.theme : sysDark ? 'dark' : 'light',
  );
  const [md, setMd] = useState(MODE);
  const fr = useRef(null),
    br = useRef(null);
  useEffect(() => {
    const f = fr.current,
      b = br.current;
    if (!f || !b) return;
    let rm = false;
    try {
      rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (rm) return;
    const a = b.getBoundingClientRect(),
      m = f.getBoundingClientRect();
    const dy = a.top + a.height / 2 - (m.top + m.height / 2);
    f.style.transform = `translateY(${dy}px) scale(1.6)`;
    const t = setTimeout(() => {
      f.style.transform = '';
    }, 1000);
    return () => clearTimeout(t);
  }, []);
  const pickTheme = t => {
    setTh(t);
    ST.theme = t;
    save();
    applyTheme();
  };
  const [lg, setLg] = useState(LANG);
  const pickLang = v => {
    setLg(v);
    ST.lang = v;
    ST.langSet = true;
    setLANG(v);
    document.documentElement.lang = v;
    save();
    rr();
  };
  const start = demo => {
    ST.onboarded = true;
    ST.firstDay = todayK();
    ST.health = false;
    ST.cycle = cy ? 'manual' : 'off';
    if (w) ST.geo = true;
    if (demo) seedDemo();
    save();
    if (w && !demo) setTimeout(() => fetchWx(true), 50);
    if (md !== MODE) {
      try {
        localStorage.setItem('msapp.mode', md);
      } catch (e) {}
      location.replace(location.pathname + '?v=' + md + '&lang=' + (ST.lang || 'en'));
    }
  };
  const d = ms => ({ style: `animation-delay:${ms}ms` });
  const Seg = ({ items, val, fn, label }) =>
    html`<div class="seg" role="group" aria-label=${label}>
      ${items.map(([v, l]) => html`<button class=${'chip' + (val === v ? ' on' : '')} aria-pressed=${val === v} onClick=${() => fn(v)}><span>${l}</span></button>`)}
    </div>`;
  return html`<div class="ob">
    <div class="obb" ref=${br}>
      <div class="oblang">
        <${Seg}
          label="Язык / Language"
          val=${lg}
          fn=${pickLang}
          items=${[
            ['en', 'English'],
            ['ru', 'Русский'],
          ]}
        />
      </div>
      <div class="col center">
        <div class="flip" ref=${fr}>
          <div class="pop"><${Mascot} mood="happy" size=${96} /></div>
        </div>
        <h1 class="lt rv" ...${d(1300)}>
          ${L('расскажите, как вы, а я запишу', 'tell me how you are, I will write it down')}
        </h1>
        <p class="b ink2 rv" ...${d(1450)}>
          ${L('Голосом, текстом или фото еды', 'By voice, text or a food photo')}
        </p>
      </div>
      <div class="card surf rv obs" style="gap:0;padding:4px 20px;animation-delay:1650ms">
        <${SwRow} on=${w} fn=${() => setW(!w)} t=${L('Погода', 'Weather')} /><${SwRow}
          on=${cy}
          fn=${() => setCy(!cy)}
          t=${L('Учитывать цикл', 'Track the cycle')}
          s=${L('Если не нужно, выключите', 'Turn it off if it does not apply')}
        /><${SwRow} on=${bt} fn=${() => pickBig(!bt)} t=${L('Крупный текст', 'Large text')} />
        <div class="rw">
          <span class="bs">${L('Тема', 'Theme')}</span
          ><${Seg}
            label=${L('Тема', 'Theme')}
            val=${th}
            fn=${pickTheme}
            items=${[
              ['light', L('светлая', 'light')],
              ['dark', L('темная', 'dark')],
            ]}
          />
        </div>
        <div class="rw">
          <span class="bs">${L('Версия', 'Version')}</span
          ><${Seg}
            label=${L('Версия прототипа', 'Prototype version')}
            val=${md}
            fn=${setMd}
            items=${[
              ['5', 'v5'],
              ['5b', 'v5b'],
              ['6', 'v6'],
              ['7', 'v7'],
            ]}
          />
        </div>
      </div>
      <p class="f ink2 rv" style="animation-delay:1750ms">
        ${L('Apple Health подключится в приложении для iPhone. Все это можно поменять в настройках', 'Apple Health connects in the iPhone app. You can change all of this in settings')}
      </p>
    </div>
    <div class="obf rv" style="animation-delay:1850ms">
      <p class="f ink2" style="text-align:center;margin:0 0 8px">
        ${L('Не медицинское приложение', 'Not a medical app')}
      </p>
      <button class="btn pri" onClick=${() => start(false)}>${L('начать', 'start')}</button
      ><button class="link" onClick=${() => start(true)}>
        ${L('посмотреть с примером', 'try with sample data')}
      </button>
    </div>
  </div>`;
}
const SH = {
  rec: RecSheet,
  quick: QuickSheet,
  voice: VoiceSheet,
  safety: SafetySheet,
  copy: CopySheet,
};
function SheetHost() {
  const s = UI.sheet;
  useEffect(() => {
    if (!s) return;
    const el = document.querySelector('.sheet');
    if (el) el.focus();
  }, [s && s.k]);
  if (!s) return null;
  const C = SH[s.name];
  if (!C) return null;
  return html`<div class="scrim" onClick=${closeSheet} aria-hidden="true"></div>
    <${C} key=${s.k} ...${s} />`;
}
export function App() {
  const [, f] = useState(0);
  setRR(() => f(x => x + 1));
  useEffect(() => {
    applyTheme();
    const k = e => {
      if (e.key === 'Escape') {
        if (UI.sheet) closeSheet();
        else if (UI.resp) {
          UI.resp = null;
          rr();
        }
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  setLANG(ST.lang || 'en');
  document.documentElement.lang = LANG;
  if (!ST.onboarded) return html`<div class="phone"><${Onboarding} /></div>`;
  const ch = allChips();
  useEffect(() => {
    if (!V6 || UI.resp) return;
    const sc = document.querySelector('.scr');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }, [ST.entries.length, UI.mtoast && UI.mtoast.id, !!UI.resp]);
  UI.footChips = B && ch && !UI.resp ? ch.items : null;
  UI.footLabel = B && ch && !UI.resp ? ch.label || null : null;
  const bottom = B ? null : ch; // v5b/v6: steps live in the card footer only, never twice
  return html`<div class="phone">
    <header class="hd hfix">
      <div class="grow">
        <h1 class="lt">${L('сегодня', 'today')}</h1>
        <p class="c ink2">
          ${cap(fHdr(now()))}${ST.demo ? html` <span class="acc">${L('пример данных', 'sample data')}</span>` : null}
        </p>
      </div>
      <button
        class="ib surf hset"
        aria-label=${L('Настройки', 'Settings')}
        onClick=${() => cmd(L('настройки', 'settings'))}
      >
        <${I} n="sliders" />
      </button>
    </header>
    <main class="scr" aria-label=${L('Сегодня', 'Today')}>
      ${B ? null : html`<${Ctx} />`}
      <div class="spacer" aria-hidden="true"></div>
      <${Block} />
    </main>
    <div class="bot">
      <${MainToast} /><${ChipsBottom} ch=${bottom} /><${InputLine} />
      <div style="height:8px"></div>
    </div>
    <${SheetHost} />
  </div>`;
}

/** Runs once at startup, called from main.js in a fixed order. */
export function loadStoredState() {
  setST(loadS());
  if (ST.photoUsed === undefined) ST.photoUsed = false;
  {
    const lg = (location.search.match(/[?&]lang=(en|ru)\b/) || [])[1];
    if (lg) {
      if (lg !== ST.lang) {
        ST.lang = lg;
        ST.langSet = true;
        saveS(ST);
      }
    } else if (!ST.langSet && ST.lang !== phoneLang()) {
      // not chosen by the person: follow the phone (also fixes installs that defaulted to English)
      ST.lang = phoneLang();
      saveS(ST);
    }
  }
  setLANG(ST.lang || phoneLang());
}
