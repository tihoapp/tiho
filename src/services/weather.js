// Weather from Open-Meteo, temperature only
import { rr, save } from '../app/actions.js';
import { weatherOn } from '../core/context.js';
import { EN, L } from '../core/text.js';
import { ST } from '../state/store.js';
import { toast } from '../ui/feedback.js';
import { focusLine } from '../ui/states.js';

// ---- real weather: location or city -> Open-Meteo, only the temperature, place rounded to ~10 km ----
let WXBUSY = false;
async function wxCoords() {
  if (ST.city && !(ST.wx && ST.wx.city === ST.city && ST.wx.lat != null)) {
    const r = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?count=1&language=' +
        (EN() ? 'en' : 'ru') +
        '&name=' +
        encodeURIComponent(ST.city),
    );
    const j = await r.json();
    const g = j.results && j.results[0];
    if (!g) throw new Error('city');
    return {
      lat: Math.round(g.latitude * 10) / 10,
      lon: Math.round(g.longitude * 10) / 10,
      city: ST.city,
    };
  }
  if (ST.wx && ST.wx.lat != null && (!ST.city || ST.wx.city === ST.city))
    return { lat: ST.wx.lat, lon: ST.wx.lon, city: ST.wx.city || null };
  return await new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('geo'));
    navigator.geolocation.getCurrentPosition(
      p =>
        res({
          lat: Math.round(p.coords.latitude * 10) / 10,
          lon: Math.round(p.coords.longitude * 10) / 10,
          city: null,
        }),
      () => rej(new Error('geo')),
      { maximumAge: 36e5, timeout: 15000, enableHighAccuracy: false },
    );
  });
}
export async function fetchWx(force) {
  if (ST.demo || !weatherOn() || WXBUSY) return;
  if (
    !force &&
    ST.wx &&
    ST.wx.cur &&
    Date.now() - ST.wx.cur.at < 30 * 6e4 &&
    (!ST.city || ST.wx.city === ST.city)
  )
    return;
  WXBUSY = true;
  const prev = ST.wxErr;
  try {
    const c = await wxCoords();
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m&daily=temperature_2m_max&past_days=92&forecast_days=1&timezone=auto`,
    );
    if (!r.ok) throw new Error('net');
    const j = await r.json();
    const days = {};
    ((j.daily && j.daily.time) || []).forEach((t, i) => {
      const v = j.daily.temperature_2m_max[i];
      if (v != null) days[t] = Math.round(v);
    });
    ST.wx = {
      lat: c.lat,
      lon: c.lon,
      city: c.city,
      cur: { t: Math.round(j.current.temperature_2m), at: Date.now() },
      days,
    };
    ST.wxErr = null;
    save();
    rr();
  } catch (e) {
    ST.wxErr = e.message === 'geo' ? 'geo' : e.message === 'city' ? 'city' : 'net';
    save();
    if (ST.wxErr !== prev) {
      if (ST.wxErr === 'geo')
        toast({
          title: L('Без геопозиции', 'No location'),
          sub: L('Погоду можно брать по городу', 'Weather can come from a city'),
          icon: 'info',
          acts: [
            {
              l: L('указать город', 'set a city'),
              fn: () => focusLine(L('город, например Тбилиси', 'city, for example Tbilisi')),
            },
          ],
        });
      else if (ST.wxErr === 'city')
        toast({
          title: L('Город не нашла', 'City not found'),
          sub: ST.city || '',
          icon: 'info',
          acts: [
            {
              l: L('другой город', 'another city'),
              fn: () => {
                ST.city = null;
                save();
                focusLine(L('город, например Тбилиси', 'city, for example Tbilisi'));
              },
            },
          ],
        });
    }
    rr();
  } finally {
    WXBUSY = false;
  }
}

/** Runs once at startup, called from main.js in a fixed order. */
export function initWeather() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ST.onboarded) fetchWx();
  });
  setTimeout(() => {
    if (ST.onboarded) fetchWx();
  }, 400);
}
