// Lexicon: parsing free text into symptoms, food and time
import { norm } from './catalog.js';
import { addD, now } from './dates.js';
import { L } from './text.js';
import { ST } from '../state/store.js';

// ---- lexicon ----
const LEX = [
  [
    'fever',
    /(температур|простыл|простуд|болею|заболел|грипп|инфекц|озноб|ангин|fever|\bflu\b|a cold|feel sick|\bsick\b|infection|chills)/,
  ],
  [
    'headache',
    /(болит голов|голова болит|головн\S* бол|голова раскалыва|мигрен|headache|migraine)/,
  ],
  [
    'tinnitus',
    /(шум\S* в уш|шумит в уш|звон\S* в уш|звенит в уш|пищит в уш|заложило уш|tinnitus|ringing in (my )?ears|ears? (are |is )?ringing)/,
  ],
  ['nausea', /(тошн|мутит|подташнив|nause|feel(ing)? sick to my stomach|queasy)/],
  ['numb', /(неме|немот|не чувству\S* пальц|numb)/],
  [
    'fatigue',
    /(устал|усталост|утомл|нет сил|без сил|разбит|вымота|tired|fatigue|exhaust|worn out|no energy|out of energy|drained|wiped out)/,
  ],
  ['fog', /(туман|тормож|не соображ|рассеян|забываю|brain fog|foggy|\bfog\b)/],
  [
    'legs',
    /(слабост\S* в ног|ноги слаб|ватн\S* ног|ноги ватн|ноги не держ|weak legs|legs (feel |are )?weak|heavy legs|legs (feel |are )?(heavy|like jelly)|jelly legs)/,
  ],
  ['vision', /(двоит|двоени|двоится|double vision|seeing double)/],
  ['blur', /(расплыв|нечетк|мутно в глаз|пелена|blurr)/],
  ['dizzy', /(головокруж|кружится|кружилась|кружило|dizz|vertigo)/],
  ['tingle', /(покалыв|мурашк|tingl|pins and needles)/],
  [
    'sleep',
    /(плохо спал|не спал|не выспал|бессонн|просыпал|плохой сон|poor sleep|bad sleep|couldn.?t sleep|didn.?t sleep|insomnia|slept (badly|poorly|bad)|bad night|barely slept)/,
  ],
  ['flush', /(покраснел|прилив|flush|red face|face (got |went |is )?red)/],
  ['stomach', /(тяжест\S* в живот|тяжесть после|вздут|живот|stomach|bloat)/],
  ['spasm', /(спазм|судорог|сводит|spasm|cramp)/],
  ['balance', /(шатает|шатало|равновеси|координац|unsteady|off balance|wobbl)/],
  ['bladder', /(позыв|мочев|в туалет|bladder|urgency|need to pee|to the (toilet|bathroom))/],
  ['weak', /(слабост|weakness|weak all over|feel(ing)? weak)/],
  ['pain', /(боль|болит|болел|болят|pain|hurt|ache)/],
];
const S3 = new Set(
  'сильно очень жутко ужасно невыносимо сильная сильный сильное сильные сильнее strong strongly severe very really terrible awful'.split(
    ' ',
  ),
);
const S2 = new Set(
  'заметно средне ощутимо прилично умеренно заметное заметная noticeable noticeably moderate moderately quite'.split(
    ' ',
  ),
);
const S1 = new Set(
  'слабо слегка чуть немного немножко слабое легкое легкая mild mildly slight slightly little bit somewhat'.split(
    ' ',
  ),
);
const toks = t =>
  norm(t)
    .split(/[^a-zа-я0-9-]+/)
    .filter(Boolean);
export function strengthOf(t) {
  const ts = toks(t);
  if (ts.some(x => S3.has(x))) return 3;
  if (ts.some(x => S2.has(x))) return 2;
  if (ts.some(x => S1.has(x))) return 1;
  return null;
}
export function symsIn(t) {
  const n = norm(t);
  const out = [];
  for (const [k, re] of LEX) {
    const m = n.match(re);
    if (m && !out.find(o => o.k === k)) {
      if (k === 'weak' && out.find(o => o.k === 'legs')) continue;
      if (k === 'pain' && out.find(o => o.k === 'headache')) continue;
      out.push({ k, i: m.index });
    }
  }
  if (ST)
    for (const [k, v] of Object.entries(ST.custom)) {
      const i = n.indexOf(norm(v));
      if (i >= 0 && !out.find(o => o.k === k)) out.push({ k, i });
    }
  return out.sort((a, b) => a.i - b.i).map(o => o.k);
}
export function parseCtx(t) {
  const n = norm(t);
  const c = [];
  if (/душ(?!н)|shower/.test(n)) c.push('shower');
  else if (/ванн|\bbath/.test(n)) c.push('bath');
  if (/бан[яиюе]|саун|sauna/.test(n)) c.push('sauna');
  if (!c.length && /(жара|жары|жару|жарко|в жару|духот|heat|hot weather|it.?s hot)/.test(n))
    c.push('hot');
  if (
    /(после|after)\s+(\S+\s+)?(таблет|укол|инъекц|лекарств|капельниц|pill|tablet|injection|shot|meds|medication)/.test(
      n,
    )
  ) {
    const m = ST && ST.meds[0];
    c.push('med:' + (m ? m.name : L('лекарство', 'medication')));
  }
  if (
    /после (трениров|зарядк|спорт|занят)|after (a |the |my )?(workout|exercise|gym|training)/.test(
      n,
    )
  )
    c.push('workout');
  if (/после прогулк|after (a |the |my )?walk/.test(n)) c.push('walk');
  if (/(стресс|нервнич|понервнич|stress)/.test(n)) c.push('stress');
  if (
    /(гиперфокус|перегруз|после работ|после созвон|после учеб|сосредоточ|много работ|много дел|после уборк|hyperfocus|overdid|after work|after a meeting|after studying|long day)/.test(
      n,
    )
  )
    c.push('effort');
  return c;
}
export function parseWhen(t) {
  const n = norm(t);
  const nw = now();
  let y = 0;
  if (/позавчера/.test(n)) y = 2;
  else if (/вчера|yesterday/.test(n)) y = 1;
  let hr = null;
  if (/(утром|с утра|morning)/.test(n)) hr = 9;
  else if (/(днем|afternoon)/.test(n)) hr = 14;
  else if (/(вечером|evening|tonight)/.test(n)) hr = 20;
  else if (/(ночью|at night|overnight)/.test(n)) hr = 3;
  if (/(час назад|an hour ago)/.test(n)) return new Date(nw.getTime() - 36e5);
  if (y) {
    const d = addD(nw, -y);
    d.setHours(hr === null ? 20 : hr, 0, 0, 0);
    return d;
  }
  if (hr !== null) {
    const d = new Date(nw);
    d.setHours(hr, 0, 0, 0);
    if (d <= nw) return d;
  }
  return null;
}
const FOOD_EX = new Set(
  'рис риса рисом чай чая чаю чаем сок сока соком мед меда медом каша кашу каши кашей паста пасту пасты вино вина пиво пива сыр сыра сыром сыры tea rice pie nuts nut egg eggs'.split(
    ' ',
  ),
);
const FOOD_ST =
  'овсян гречк гречнев макарон спагет хлеб булк батон тост сырник творог йогурт кефир молок молочн сметан сливк кофе капучино латте эспрессо какао яйц яичниц омлет куриц курин мяс говяд свинин индейк рыб лосос тунец суп борщ салат банан яблок груш апельсин мандарин ягод фрукт овощ помидор огурц огурец картош картоф шоколад печень торт пирож пирог выпечк конфет сахар морожен пицц бургер орех хачапури хинкали лобио сэндвич бутерброд мюсли гранол блин пельмен вареник фрикадел котлет плов шаурм ролл суши лаваш хумус авокадо тыкв кабачк морков капуст фасол чечевиц завтрак обед ужин перекус oat porridge pasta spaghetti noodle bread toast bagel cheese yogurt yoghurt milk cream coffee latte cappuccino espresso cocoa omelet chicken meat beef pork turkey fish salmon tuna soup salad banana apple pear orange berr fruit vegetable tomato cucumber potato chocolate cookie biscuit cake pastry candy sugar honey pizza burger wine beer juice sandwich cereal granola pancake dumpling sushi avocado hummus breakfast lunch dinner snack'.split(
    ' ',
  );
const isFoodTok = x => FOOD_EX.has(x) || (x.length >= 4 && FOOD_ST.some(s => x.indexOf(s) === 0));
const FOOD_INTENT =
  /(^|\s)(ел|ела|съел|съела|поел|поела|кушал|кушала|позавтракал\S*|пообедал\S*|поужинал\S*|перекусил\S*|на завтрак|на обед|на ужин|на перекус|ate|eaten|for breakfast|for lunch|for dinner|for a snack|i had)(?=\s|$|[,.:!])/;
function hasFood(t) {
  return toks(t).some(isFoodTok) || FOOD_INTENT.test(norm(t));
}
function mealIn(t) {
  const n = norm(t);
  if (/завтрак|breakfast/.test(n)) return 'breakfast';
  if (/обед|lunch/.test(n)) return 'lunch';
  if (/ужин|dinner|supper/.test(n)) return 'dinner';
  if (/перекус|snack/.test(n)) return 'snack';
  return null;
}
export function foodItems(t) {
  let s = ' ' + norm(t).replace(/[«»"“”]/g, ' ') + ' ';
  s = s.replace(
    /(^|\s)(сегодня|вчера|утром|днем|вечером|на завтрак|на обед|на ужин|на перекус|завтрак|обед|ужин|перекус|был[аио]?|ел|ела|съел|съела|поел|поела|кушал|кушала|выпил|выпила|позавтракал\S*|пообедал\S*|поужинал\S*|перекусил\S*|i had|i ate|ate|had|for breakfast|for lunch|for dinner|for a snack|today|yesterday|breakfast|lunch|dinner|snack|немного|чуть|еще)(?=\s|$|[,.:!])/g,
    ' ',
  );
  const parts = s
    .split(/[,;.!:]|\s(?:и|а также|плюс|and|plus|then|потом)\s/)
    .map(x => x.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (p.length > 40) continue;
    const ts = toks(p);
    if (!ts.length) continue;
    if (symsIn(p).length && !ts.some(isFoodTok)) continue;
    if (!ts.some(isFoodTok) && !FOOD_INTENT.test(norm(t))) continue;
    if (/(после|after)\s/.test(p) && !ts.slice(0, 1).some(isFoodTok)) continue;
    if (!out.includes(p)) out.push(p);
  }
  return out;
}
const SAFETY =
  /(внезапно|резко|вдруг|suddenly|all of a sudden).{0,40}(видеть|вижу|зрен|ослеп|глаз|говорить|речь|перекос|лицо|половин|паралич|парализ|отнял|не могу встать|не могу пошевел|can.?t see|vision|\beye|speak|speech|face|half|paraly|can.?t move)|(не вижу|ослеп|перестал\S* видеть|пропал\S* зрение|потерял\S* зрение|не могу говорить|пропала речь|перестал\S* говорить|отнялась|отнялись|парализ|перекосило|не могу пошевелить|сильнейш\S* головн|can.?t see|lost (my )?vision|can.?t speak|face (is )?drooping|can.?t move my|paralys|paralyz|worst headache)/;
const MED_Q =
  /(можно ли|можно мне|стоит ли|нужно ли|надо ли|что делать|что принять|что пить|чем лечить|как лечить|опасно ли|нормально ли|это нормально|почему|это обострение|из-за чего|отчего|should i|can i|is it normal|is it dangerous|is this normal|what should i|what can i take|why do|why does|why am|why is|is this a relapse|what causes)/;

const Q_START =
  /^(когда|сколько|как часто|покажи|найди|что|почему|можно|стоит|нужно|надо|опасно|нормально|отчего|зачем|when|how|what|why|can|should|is|show|find|did|do)(\s|$)/;
const DOC_PREFIX =
  /^(вопрос (к )?врачу|спросить (у )?врача|спрошу у врача|ask (the |my )?doctor|question for (the |my )?doctor)[:,\s-]*/;
const MED_TAKE = /(^|\s)(принял|приняла|выпил[аи]?|сделал[аи]? укол|took)(\s|$)/;
export function analyze(text) {
  const t = text.trim();
  const n = norm(t);
  if (SAFETY.test(n)) return { kind: 'safety' };
  return analyzeRest(t);
}
function analyzeRest(t) {
  const n = norm(t);
  if (DOC_PREFIX.test(n))
    return { kind: 'doctorq', q: t.replace(new RegExp(DOC_PREFIX.source, 'i'), '').trim() || t };
  const keys = symsIn(t);
  const isQ = /\?\s*$/.test(t) || Q_START.test(n);
  if (isQ) {
    if (MED_Q.test(n) && !/^(когда|сколько|как часто|when|how many|how often)/.test(n))
      return { kind: 'medical', keys };
    return { kind: 'query', keys };
  }
  const medWord =
    /(таблет|лекарств|укол|pill|meds|medication|tablet|shot|injection)/.test(n) ||
    (ST && ST.meds.some(m => n.indexOf(norm(m.name).split(' ')[0]) >= 0));
  if (MED_TAKE.test(n) && medWord && !keys.length) return { kind: 'med' };
  const when = parseWhen(t);
  if (hasFood(t)) {
    const items = foodItems(t);
    if (items.length) return { kind: 'food', items, meal: mealIn(t), feel: keys, when };
  }
  if (keys.length) {
    const ctx = parseCtx(t);
    const clauses = t.split(/[,;.!]|\s(?:и|а|но|and|but)\s/);
    const items = [];
    let last = null;
    for (const cl of clauses) {
      const ks = symsIn(cl);
      const s = strengthOf(cl);
      if (ks.length) {
        for (const k of ks) {
          if (items.find(i => i.key === k)) continue;
          const it = { key: k, s: null, ctx: ctx.slice() };
          items.push(it);
          last = it;
        }
        if (s && last) last.s = s;
      } else if (s && last && !last.s) last.s = s;
    }
    for (const k of keys)
      if (!items.find(i => i.key === k)) items.push({ key: k, s: null, ctx: ctx.slice() });
    return { kind: 'sym', items, when };
  }
  return { kind: 'unknown' };
}
