// Shared app state. ES modules cannot reassign each other's bindings,
// so every module reads these live exports and writes through the setters.

/** Interface language: 'ru' or 'en'. */
export let LANG = 'ru';
/** Stored data (entries, settings), loaded from localStorage at startup. */
export let ST = null;
/** Transient UI state: open sheet, toast, current answer. */
export let UI = null;
/** Rerender hook, set by the App root. */
export let RR = null;

export function setLANG(v) {
  LANG = v;
}
export function setST(v) {
  ST = v;
}
export function setUI(v) {
  UI = v;
}
export function setRR(v) {
  RR = v;
}
