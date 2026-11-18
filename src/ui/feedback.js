// Main toast, answers and chip grid
import { rr } from '../app/actions.js';
import { todayK } from '../core/dates.js';
import { onDay } from '../core/entries.js';
import { EN, L } from '../core/text.js';
import { html, useEffect } from '../lib/preact.js';
import { ST, UI } from '../state/store.js';
import { I } from './components.js';
import { haptic } from './haptics.js';
import { speak } from './states.js';

let TID = 0;
export const MODE = (() => {
  const m = (location.search.match(/[?&]v=(5b?|6)\b/) || [])[1];
  if (m) {
    try {
      localStorage.setItem('msapp.mode', m);
    } catch (e) {}
  }
  let s = null;
  try {
    s = localStorage.getItem('msapp.mode');
  } catch (e) {}
  return m || s || '5b';
})();
export const V6 = MODE === '6';
export const B = MODE === '5b' || V6;
// v6 builds on v5b
const LIM = () => (ST.bigText ? (EN() ? 13 : 11) : EN() ? 20 : 17);
// large text: long chips take a full row
let THEMED = false;
export function applyTheme() {
  const r = document.documentElement;
  if (ST.theme === 'light' || ST.theme === 'dark') {
    r.setAttribute('data-theme', ST.theme);
    THEMED = true;
  } else if (THEMED) {
    r.removeAttribute('data-theme');
    THEMED = false;
  }
}
export function say(o) {
  if (o && o.kind === 'log') return toast(o.t);
  UI.resp = Object.assign({ kind: 'info' }, o);
  rr();
}
// main toast: dark card above the day card, hides after 4 s, buttons live inside
export function toast(o) {
  const t = Object.assign(
    { id: ++TID, where: UI.sheet ? 'sheet' : 'main', icon: 'check', acts: [] },
    o,
  );
  if (t.where === 'sheet') {
    UI.toast = t;
  } else {
    UI.resp = null;
    UI.mtoast = t;
    if (V6 && t.acts && t.acts.length) {
      const top = onDay(todayK())
        .filter(x => !(x.src === 'health'))
        .slice(0, 3);
      const f = top.find(e => e.made && Date.now() - e.made < 800);
      if (f) t.inline6 = f.id;
    }
  }
  if (typeof speak === 'function') speak(t.title + (t.sub ? '. ' + t.sub : ''));
  if (typeof haptic === 'function')
    haptic(t.icon === 'info' ? 'warn' : t.icon === 'undo' ? 'undo' : 'save');
  rr();
}
export function MainToast() {
  const t = UI.mtoast;
  useEffect(() => {
    if (!t) return;
    const id = t.id;
    const h = setTimeout(
      () => {
        if (UI.mtoast && UI.mtoast.id === id) {
          UI.mtoast = null;
          rr();
        }
      },
      t.acts && t.acts.length ? 6000 : 4000,
    );
    return () => clearTimeout(h);
  }, [t && t.id]);
  if (!t) return null;
  if (V6 && t.inline6 && !UI.resp) return null;
  return html`<div class="toast mt" role="status">
    <div class="tr">
      <span class="tic"><${I} n=${t.icon} /></span>
      <div class="tt">
        <p class="bs">${t.title}</p>
        ${t.sub ? html`<p class="c">${t.sub}</p>` : null}
      </div>
      <button
        class="tx"
        aria-label=${L('Скрыть', 'Dismiss')}
        onClick=${() => {
          UI.mtoast = null;
          rr();
        }}
      >
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
                    UI.mtoast = null;
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
// chip grid: two columns, no horizontal scroll, long label takes the row
export function ChipGrid({ items, label }) {
  const rows = [];
  let cur = null;
  for (const it of items) {
    const long = (it.l || '').length + (it.star || it.cam || it.ic ? 3 : 0) > LIM();
    if (long) {
      cur = null;
      rows.push([it]);
      continue;
    }
    if (!cur || cur.length === 2) {
      cur = [];
      rows.push(cur);
    }
    cur.push(it);
  }
  const Chip = ({ x }) =>
    html`<button
      class=${'chip' + (x.on ? ' on' : '')}
      aria-pressed=${x.on === undefined ? undefined : !!x.on}
      aria-label=${x.aria || undefined}
      onClick=${x.fn}
    >
      ${x.star ? html`<span class="star"><${I} n="star" s=${18} /></span>` : x.cam ? html`<${I} n="cam" s=${18} />` : x.ic ? html`<${I} n=${x.ic} s=${18} />` : null}<span
        >${x.l}</span
      >
    </button>`;
  return html`<div class="grid" role="group" aria-label=${label || L('Подсказки', 'Suggestions')}>
    ${rows.map((r, i) => html`<div class="grow2" key=${i}>${r.map(x => html`<${Chip} x=${x} key=${x.l} />`)}${r.length === 1 && (r[0].l || '').length + (r[0].star || r[0].cam || r[0].ic ? 3 : 0) <= LIM() ? html`<span class="sp" aria-hidden="true"></span>` : null}</div>`)}
  </div>`;
}

/** Runs once at startup, called from main.js in a fixed order. */
export function initResponseState() {
  // ---- app ----
  // ===== v5: one screen (web = figma v5 / v5b) =====
  UI.resp = null;
  UI.hview = null;
  UI.inline = null;
  UI.mtoast = null;
}
