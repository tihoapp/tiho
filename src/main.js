// Entry point
import { initUiState } from './app/actions.js';
import { saveS } from './core/storage.js';
import { html, render } from './lib/preact.js';
import { initWeather } from './services/weather.js';
import { ST } from './state/store.js';
import { App, loadStoredState } from './ui/app.js';
import { initResponseState } from './ui/feedback.js';
import { initHaptics } from './ui/haptics.js';
import { applyStoredDefaults } from './ui/states.js';

initUiState();
initResponseState();
loadStoredState();
applyStoredDefaults();
initHaptics();
initWeather();

// migration: earlier builds faked Apple Health outside the sample
if (ST && !ST.demo && ST.health) {
  ST.health = false;
  if (ST.cycle === 'health') ST.cycle = 'manual';
  saveS(ST);
}
render(html`<${App} />`, document.getElementById('app'));
