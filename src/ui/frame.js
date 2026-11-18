// Frame: edit and safety as cards on the one screen
import { SheetToast, closeSheetBase, openSheetBase, rr } from '../app/actions.js';
import { L } from '../core/text.js';
import { html } from '../lib/preact.js';
import { UI } from '../state/store.js';
import { I } from './components.js';
import { say } from './feedback.js';

// ---- figma v5: edit and safety are cards on the one screen, not sheets ----
export function openSheet(name, p) {
  if (name === 'rec') return say({ kind: 'edit', id: p.id });
  if (name === 'safety') return say({ kind: 'safety', v: p.v });
  return openSheetBase(name, p);
}
export function closeSheet() {
  if (UI.resp && (UI.resp.kind === 'edit' || UI.resp.kind === 'safety')) {
    UI.resp = null;
    rr();
    return;
  }
  return closeSheetBase();
}
export function Frame({ title, onBack, children, noClose }) {
  if (UI.sheet)
    return html`<div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-label=${title}
      tabindex="-1"
    >
      <div class="handle" aria-hidden="true"></div>
      ${UI.toast && UI.toast.where === 'sheet' ? html`<${SheetToast} />` : null}
      <div class="shd">
        ${onBack ? html`<button class="ib" aria-label=${L('Назад', 'Back')} onClick=${onBack}><${I} n="chevL" /></button>` : null}
        <h2 class="t2 grow">${title}</h2>
        ${noClose ? null : html`<button class="ib" aria-label=${L('Закрыть', 'Close')} onClick=${closeSheet}><${I} n="close" /></button>`}
      </div>
      ${children}
    </div>`;
  return html`<section class="card surf" aria-label=${title}>
    <div class="row" style="align-items:flex-start">
      ${onBack ? html`<button class="ib" aria-label=${L('Назад', 'Back')} onClick=${onBack}><${I} n="chevL" /></button>` : null}
      <h2 class="q grow">${title}</h2>
      ${noClose ? null : html`<button class="ib" aria-label=${L('К сегодня', 'Back to today')} onClick=${closeSheet}><${I} n="close" /></button>`}
    </div>
    ${children}
  </section>`;
}
