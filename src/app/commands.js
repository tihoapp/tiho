// Commands by phrase (no settings screen)
import { addEntries, rr, save, undoAct } from './actions.js';
import { seedDemo } from './demo.js';
import { norm, symName } from '../core/catalog.js';
import { periodLen, periodOf } from '../core/context.js';
import { addD, ddiff, dk, fRange, fromDk, now, todayK } from '../core/dates.js';
import { worseDayN } from '../core/entries.js';
import { symsIn } from '../core/lexicon.js';
import { defaults } from '../core/storage.js';
import { EN, L, nDay, plRu } from '../core/text.js';
import { fetchWx } from '../services/weather.js';
import { ST, setLANG, setST } from '../state/store.js';
import { applyTheme, say, toast } from '../ui/feedback.js';

// ---- commands by phrase: no settings screen ----
export function cmdBase(v) {
  const n = norm(v);
  const wrap = (title, sub) => say({ kind: 'log', t: { title, sub, icon: 'check', acts: [] } });
  if (n === 'settings' || /^(настройки|settings)$/.test(n)) return say({ kind: 'settings' });
  if (/^(данные|данные и доступ|data|data and access)$/.test(n)) return say({ kind: 'data' });
  if (/^v(5b?|6|7)$/.test(n)) {
    try {
      localStorage.setItem('msapp.mode', n);
    } catch (e) {}
    location.search = '?v=' + n;
    return true;
  }
  if (/(истори|покажи записи|все записи|history|show (my )?entries|all entries)/.test(n))
    return say({ kind: 'history', per: 30, f: 'all' });
  if (
    /(хуже обычного|хуже чем обычно|плохой день|worse than usual|bad day)/.test(n) &&
    !/(^|\s)(вернул\S*|назад|уже|нормально|back|normal)/.test(n)
  ) {
    if (ST.worse)
      return toast({
        title: L('Хуже обычного, день ', 'Worse than usual, day ') + worseDayN(),
        sub: L(
          'Скажите «вернулось к обычному», когда пройдет',
          'Say “back to usual” when it passes',
        ),
        icon: 'info',
        acts: [],
      });
    ST.worse = { start: todayK() };
    save();
    return toast({
      title: L('Записала: хуже обычного', 'Saved: worse than usual'),
      sub: L(
        'Буду отмечать дни, пока не скажете, что вернулось к обычному. Это попадет в сводку',
        'I will mark the days until you say it is back to usual. This goes into the summary',
      ),
      acts: [
        undoAct([]) && {
          l: L('отменить', 'undo'),
          fn: () => {
            ST.worse = null;
            save();
            toast({ title: L('Отменила', 'Undone'), icon: 'undo' });
          },
        },
      ],
    });
  }
  if (
    /(вернулось к обычному|уже нормально|стало как обычно|back to usual|back to normal)/.test(n)
  ) {
    if (!ST.worse)
      return toast({
        title: L('Хуже обычного не отмечали', 'Nothing marked as worse than usual'),
        icon: 'info',
        acts: [],
      });
    const w = { start: ST.worse.start, end: todayK() };
    ST.worseHist.push(w);
    ST.worse = null;
    save();
    return toast({
      title: L('Записала: вернулось к обычному', 'Saved: back to usual'),
      sub:
        (EN()
          ? `${nDay(ddiff(fromDk(w.end), fromDk(w.start)) + 1)} worse than usual, `
          : `${nDay(ddiff(fromDk(w.end), fromDk(w.start)) + 1)} хуже обычного, `) +
        fRange(fromDk(w.start), fromDk(w.end)) +
        L('. В сводке к врачу', '. In the doctor summary'),
      acts: [
        { l: L('сводка к врачу', 'doctor summary'), fn: () => say({ kind: 'summary', days: 30 }) },
      ],
    });
  }
  if (/(что делалось|what was going on)/.test(n) && (ST.worse || ST.worseHist.length)) {
    const w = ST.worse || ST.worseHist[ST.worseHist.length - 1];
    return say({
      kind: 'answer',
      q: v,
      keys: [],
      range: { a: w.start, b: w.end || todayK(), l: L('эти дни', 'these days') },
      list: true,
    });
  }
  if (
    /(месячные (закончились|кончились|прошли)|(закончились|кончились|прошли) месячные|period (ended|is over|finished|stopped)|my period ended)/.test(
      n,
    )
  ) {
    const p = periodOf(now());
    if (!p)
      return toast({
        title: L('Начало месячных не отмечено', 'No period start marked'),
        sub: L(
          'Скажите «месячные начались», когда начнутся',
          'Say “my period started” when it starts',
        ),
        icon: 'info',
        acts: [],
      });
    const end = /(вчера|yesterday)/.test(n) ? dk(addD(now(), -1)) : todayK();
    const e = end < p.s ? p.s : end;
    ST.periodEnds = ST.periodEnds || {};
    const prev = ST.periodEnds[p.s];
    ST.periodEnds[p.s] = e;
    save();
    const len = periodLen(p.s);
    return toast({
      title: L('Записала: месячные закончились', 'Saved: period ended'),
      sub: EN()
        ? `Lasted ${len} ${len === 1 ? 'day' : 'days'}`
        : `Длились ${len} ${plRu(len, 'день', 'дня', 'дней')}`,
      acts: [
        {
          l: L('отменить', 'undo'),
          fn: () => {
            if (prev) ST.periodEnds[p.s] = prev;
            else delete ST.periodEnds[p.s];
            save();
            rr();
          },
        },
      ],
    });
  }
  if (
    /(месячные начались|начались месячные|period started|my period started|got my period)/.test(n)
  ) {
    if (ST.cycle !== 'health') {
      ST.cycle = 'manual';
    }
    if (!ST.periodMarks.includes(todayK())) ST.periodMarks.push(todayK());
    if (ST.cycle === 'health') {
      ST.cycle = 'manual';
    }
    save();
    return toast({
      title: L('Записала: месячные начались', 'Saved: period started'),
      sub: L(
        'Сегодня день цикла 1. Когда закончатся, скажите «месячные закончились». Цикл виден только вам',
        'Today is cycle day 1. When it ends, say “my period ended”. Only you can see the cycle',
      ),
      acts: [
        {
          l: L('как это связано с циклом?', 'how is it linked to my cycle?'),
          fn: () => say({ kind: 'cycle', keys: [] }),
        },
      ],
    });
  }
  if (/^(пауза|pause|сегодня пауза|pause today)$/.test(n)) {
    const ids = addEntries([{ kind: 'pause', at: now().getTime() }]);
    save();
    return toast({
      title: L('Пауза', 'Paused'),
      sub: L(
        'Записи сохранены, подсказок не будет, пока не вернетесь',
        'Entries are kept, no suggestions until you are back',
      ),
      acts: [undoAct(ids)],
    });
  }
  if (/(english|англий|на англ)/.test(n)) {
    ST.lang = 'en';
    ST.langSet = true;
    setLANG('en');
    save();
    return wrap('Switched to English');
  }
  if (/(по-русски|по русски|русский|russian)/.test(n)) {
    ST.lang = 'ru';
    ST.langSet = true;
    setLANG('ru');
    save();
    return wrap('Переключила на русский');
  }
  if (/(темн\S* тем|dark (theme|mode))/.test(n)) {
    ST.theme = 'dark';
    save();
    applyTheme();
    return wrap(L('Темная тема', 'Dark theme'));
  }
  if (/(светл\S* тем|light (theme|mode))/.test(n)) {
    ST.theme = 'light';
    save();
    applyTheme();
    return wrap(L('Светлая тема', 'Light theme'));
  }
  if (/(как в системе|system theme)/.test(n)) {
    ST.theme = 'system';
    save();
    applyTheme();
    return wrap(L('Тема как в системе', 'Theme follows the system'));
  }
  if (/(подключ\S*|включ\S*|connect|turn on|enable).{0,12}(здоровье|health)/.test(n)) {
    if (!ST.demo)
      return toast({
        title: L(
          'Apple Health подключится в приложении для iPhone',
          'Apple Health connects in the iPhone app',
        ),
        sub: L(
          'Здесь цикл можно отмечать словами: «месячные начались»',
          'Here you can mark the cycle in words: “my period started”',
        ),
        icon: 'info',
        acts: [],
      });
    ST.health = true;
    if (!ST.seed) ST.seed = dk(addD(now(), -11));
    if (ST.cycle === 'off') ST.cycle = 'health';
    save();
    return wrap(L('Подключила Здоровье', 'Health connected'));
  }
  if (/(отключ\S*|выключ\S*|disconnect|turn off|disable).{0,12}(здоровье|health)/.test(n)) {
    ST.health = false;
    if (ST.cycle === 'health') ST.cycle = 'off';
    save();
    return wrap(L('Отключила Здоровье', 'Health disconnected'));
  }
  if (/(подключ\S*|включ\S*|connect|turn on|enable).{0,12}(погод|weather)/.test(n)) {
    ST.geo = true;
    save();
    setTimeout(() => fetchWx(true), 0);
    return wrap(L('Включила погоду', 'Weather on'));
  }
  if (/(отключ\S*|выключ\S*|disconnect|turn off|disable).{0,12}(погод|weather)/.test(n)) {
    ST.geo = false;
    save();
    return wrap(L('Выключила погоду', 'Weather off'));
  }
  if (/(главн\S* для меня|main (one|symptom))/.test(n)) {
    const ks = symsIn(v);
    if (ks.length) {
      ST.main = ks[0];
      save();
      return wrap(L('Главный для меня: ', 'My main one: ') + symName(ks[0]));
    }
    return wrap(
      L('Назовите симптом: «главный для меня: усталость»', 'Name it: “main one: fatigue”'),
    );
  }
  if (/(стереть|удалить все|сбросить|erase|reset everything|wipe)/.test(n)) {
    return say({
      kind: 'confirm',
      title: L('стереть все данные?', 'erase all data?'),
      sub: L('Вернуть будет нельзя', 'This cannot be undone'),
      ok: L('стереть', 'erase'),
      fn: () => {
        const lg = ST.lang;
        setST(defaults());
        ST.lang = lg;
        ST.photoUsed = false;
        ST.demo = false;
        ST.onboarded = true;
        ST.firstDay = todayK();
        save();
        wrap(L('Стерла. Это снова первый день', 'Erased. First day again'));
      },
    });
  }
  if (/(пример|sample|demo)/.test(n)) {
    return say({
      kind: 'confirm',
      title: L('заменить данные примером?', 'replace data with a sample?'),
      sub: L('Ваши записи заменятся примером', 'Your entries get replaced with a sample'),
      ok: L('заменить', 'replace'),
      fn: () => {
        seedDemo();
        save();
        wrap(L('Загрузила пример', 'Sample loaded'));
      },
    });
  }
  if (/(что ты (умеешь|можешь)|помощь|help|what can you do)/.test(n)) return say({ kind: 'help' });
  if (/^(мои |my )?(вопросы|questions)( к| для)?( врач\S*| (the |my )?doctor)?\??$/.test(n))
    return say({ kind: 'questions', q: v });
  if (
    /(сводк|summary|^к врачу$|^(for the |to the )?doctor$)/.test(n) &&
    !/вопрос|question/.test(n)
  ) {
    const d = /(месяц|30|month)/.test(n) ? 30 : /(полгод|180|six)/.test(n) ? 182 : 92;
    return say({ kind: 'summary', q: v, days: d });
  }
  if (/(цикл|месячн|cycle|period)/.test(n) && /\?$|как|how|влия|affect/.test(n))
    return say({ kind: 'cycle', q: v, keys: symsIn(v) });
  if (
    /(связ|совпад|после чего|после какой|что влия|инсайт|триггер|link|related|pattern|insight|trigger|after what|affect|connected|makes? (it|me|them|my \S+) worse)/.test(
      n,
    ) &&
    !/^(почему|why)/.test(n)
  )
    return say({ kind: 'insights', q: v, keys: symsIn(v) });
  return false;
}
