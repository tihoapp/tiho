// Visual haptics: press, release and ring feedback
import { ST } from '../state/store.js';

// ---- explicit feedback: no vibration on iPhone web, so the screen does the buzzing ----
// press: instant squeeze under the finger; release: rattle like a motor + ring outside the finger; saves and warnings buzz the whole phone
const hOn = () => !(ST.comfort && ST.comfort.haptic === false);
function phoneBuzz() {
  const p = document.querySelector('.phone');
  if (!p) return;
  p.classList.remove('pbuzz');
  void p.offsetWidth;
  p.classList.add('pbuzz');
  p.addEventListener('animationend', () => p.classList.remove('pbuzz'), { once: true });
}
export function haptic(kind) {
  if (!hOn()) return;
  const pat =
    kind === 'save'
      ? [40, 40, 90]
      : kind === 'warn'
        ? [90, 60, 90]
        : kind === 'undo'
          ? [25, 40, 25]
          : [35];
  try {
    if (navigator.vibrate) navigator.vibrate(pat);
  } catch (e) {}
  if (kind === 'save' || kind === 'warn' || kind === 'undo') phoneBuzz();
}
const TAPSEL = '.v7b,.chip,.choice,.btn,.li,.fi,.tb,.tx,.mic,.cam,.link,.ib,.sw,.cx,.tr6,.more6';
function ring(el) {
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  const d = document.createElement('div');
  d.className = 'ring';
  d.setAttribute('aria-hidden', 'true');
  const rad = getComputedStyle(el).borderRadius || '16px';
  Object.assign(d.style, {
    left: r.left + 'px',
    top: r.top + 'px',
    width: r.width + 'px',
    height: r.height + 'px',
    borderRadius: rad,
  });
  document.body.appendChild(d);
  d.addEventListener('animationend', () => d.remove(), { once: true });
  setTimeout(() => d.remove(), 900);
}
let PRESSED = null;
function release(e, fire) {
  const el = PRESSED;
  PRESSED = null;
  if (!el) return;
  el.classList.remove('press');
  if (!fire) return;
  void el.offsetWidth;
  el.classList.add('tap');
  el.addEventListener('animationend', () => el.classList.remove('tap'), { once: true });
  ring(el);
  haptic(el.classList.contains('btn') ? 'save' : 'tap');
}

/** Runs once at startup, called from main.js in a fixed order. */
export function initHaptics() {
  document.addEventListener(
    'pointerdown',
    e => {
      const el = e.target.closest(TAPSEL);
      if (!el || !hOn()) return;
      PRESSED = el;
      el.classList.remove('tap');
      el.classList.add('press');
    },
    { passive: true },
  );
  document.addEventListener('pointerup', e => release(e, true), { passive: true });
  document.addEventListener('pointercancel', e => release(e, false), { passive: true });
}
