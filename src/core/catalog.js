// Symptom and food catalog
import { EN, L } from './text.js';
import { ST } from '../state/store.js';

// ---- catalog ----
export const SYM = {
  numb: ['Онемение пальцев', 'Numb fingers'],
  fatigue: ['Усталость', 'Fatigue'],
  fog: ['Туман в голове', 'Brain fog'],
  legs: ['Слабость в ногах', 'Weak legs'],
  vision: ['Двоение в глазах', 'Double vision'],
  dizzy: ['Головокружение', 'Dizziness'],
  tingle: ['Покалывание', 'Tingling'],
  sleep: ['Плохой сон', 'Poor sleep'],
  headache: ['Головная боль', 'Headache'],
  tinnitus: ['Шум в ушах', 'Ringing in the ears'],
  nausea: ['Тошнота', 'Nausea'],
  flush: ['Покраснение лица', 'Facial redness'],
  stomach: ['Тяжесть в животе', 'Heavy stomach'],
  spasm: ['Спазмы', 'Spasms'],
  balance: ['Шаткость', 'Unsteadiness'],
  bladder: ['Частые позывы', 'Bladder urgency'],
  blur: ['Нечеткое зрение', 'Blurred vision'],
  weak: ['Слабость', 'Weakness'],
  pain: ['Боль', 'Pain'],
  fever: ['Температура или болезнь', 'Fever or illness'],
};
export const OB_SYM = ['numb', 'fatigue', 'fog', 'legs', 'vision', 'dizzy', 'tingle', 'sleep'];
export function symName(k) {
  if (SYM[k]) return L(SYM[k][0], SYM[k][1]);
  const c = ST && ST.custom[k];
  return c ? c : k || '';
}
const SN = { 1: ['слабо', 'mild'], 2: ['заметно', 'noticeable'], 3: ['сильно', 'strong'] };
export const sName = s => (s ? L(SN[s][0], SN[s][1]) : '');
const CMP = {
  less: ['слабее обычного', 'milder than usual'],
  same: ['как обычно', 'as usual'],
  more: ['сильнее обычного', 'stronger than usual'],
  first: ['впервые', 'first time'],
};
export const cmpName = c => (CMP[c] ? L(CMP[c][0], CMP[c][1]) : '');
const CTXP = {
  shower: ['после горячего душа', 'after a hot shower'],
  bath: ['после ванны', 'after a bath'],
  sauna: ['после бани', 'after a sauna'],
  hot: ['в жару', 'in the heat'],
  workout: ['после тренировки', 'after a workout'],
  walk: ['после прогулки', 'after a walk'],
  stress: ['после стресса', 'after stress'],
  effort: ['после нагрузки', 'after effort'],
};
const CTXC = {
  shower: ['тепло: душ', 'heat: shower'],
  bath: ['тепло: ванна', 'heat: bath'],
  sauna: ['тепло: баня', 'heat: sauna'],
  hot: ['тепло: жара', 'heat: hot weather'],
  workout: ['после: тренировка', 'after: workout'],
  walk: ['после: прогулка', 'after: walk'],
  stress: ['после: стресс', 'after: stress'],
  effort: ['после: нагрузка', 'after: effort'],
};
export const HEAT = ['shower', 'bath', 'sauna', 'hot'];
export function ctxText(c, chip) {
  if (c.indexOf('food:') === 0) {
    const p = c.slice(5).split('|');
    const m = +p[0];
    return EN() ? `${m} min after ${p[1]}` : `через ${m} мин после ${p[1]}`;
  }
  if (c.indexOf('med:') === 0) return L('после: ', 'after: ') + c.slice(4);
  const t = (chip ? CTXC : CTXP)[c];
  return t ? L(t[0], t[1]) : c;
}
const MEALS = {
  breakfast: ['завтрак', 'breakfast'],
  lunch: ['обед', 'lunch'],
  dinner: ['ужин', 'dinner'],
  snack: ['перекус', 'snack'],
  food: ['еда', 'food'],
};
export const mealName = m => L(MEALS[m || 'food'][0], MEALS[m || 'food'][1]);
export function mealByTime(d) {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 18) return 'snack';
  if (h >= 18 && h < 23) return 'dinner';
  return 'food';
}
const MOVES = {
  walk: ['прогулка', 'walk'],
  yoga: ['йога', 'yoga'],
  swim: ['бассейн', 'swimming'],
  pt: ['ЛФК', 'physical therapy'],
  bike: ['велосипед', 'cycling'],
};
export const moveName = k => (MOVES[k] ? L(MOVES[k][0], MOVES[k][1]) : k);
export const RES = {
  1: ['мало', 'low'],
  2: ['ниже обычного', 'below usual'],
  3: ['обычно', 'usual'],
  4: ['много', 'high'],
};

export const GROUPS = {
  dairy: {
    n: ['молочное', 'dairy'],
    gen: ['молочного', 'dairy'],
    ins: ['с молочным', 'with dairy'],
    sub: ['молоко, сыр, йогурт, творог', 'milk, cheese, yogurt, cottage cheese'],
    st: [
      'молок',
      'молочн',
      'сыр',
      'творог',
      'йогурт',
      'кефир',
      'сметан',
      'сливк',
      'морожен',
      'капучино',
      'латте',
      'milk',
      'cheese',
      'yogurt',
      'yoghurt',
      'cream',
      'latte',
      'cappuccino',
    ],
  },
  gluten: {
    n: ['глютен', 'gluten'],
    gen: ['глютена', 'gluten'],
    ins: ['с глютеном', 'with gluten'],
    sub: ['хлеб, макароны, выпечка', 'bread, pasta, pastry'],
    st: [
      'хлеб',
      'булк',
      'батон',
      'тост',
      'макарон',
      'паст',
      'спагет',
      'пицц',
      'печень',
      'торт',
      'пирож',
      'пирог',
      'выпечк',
      'блин',
      'хачапури',
      'хинкали',
      'пельмен',
      'вареник',
      'лаваш',
      'bread',
      'toast',
      'bagel',
      'pasta',
      'spaghetti',
      'noodle',
      'pizza',
      'cookie',
      'biscuit',
      'cake',
      'pastry',
      'pancake',
      'dumpling',
    ],
  },
  coffee: {
    n: ['кофе', 'coffee'],
    gen: ['кофе', 'coffee'],
    ins: ['с кофе', 'with coffee'],
    sub: ['кофе, капучино, латте', 'coffee, cappuccino, latte'],
    st: ['кофе', 'капучино', 'латте', 'эспрессо', 'coffee', 'latte', 'cappuccino', 'espresso'],
  },
  sugar: {
    n: ['сладкое', 'sweets'],
    gen: ['сладкого', 'sweets'],
    ins: ['со сладким', 'with sweets'],
    sub: ['сахар, шоколад, выпечка', 'sugar, chocolate, pastry'],
    st: [
      'сахар',
      'шоколад',
      'конфет',
      'торт',
      'печень',
      'морожен',
      'пирож',
      'sugar',
      'chocolate',
      'candy',
      'cake',
      'cookie',
      'ice cream',
      'honey',
    ],
  },
  alcohol: {
    n: ['алкоголь', 'alcohol'],
    gen: ['алкоголя', 'alcohol'],
    ins: ['с алкоголем', 'with alcohol'],
    sub: ['вино, пиво', 'wine, beer'],
    st: [
      'вино',
      'вина',
      'пиво',
      'пива',
      'алкогол',
      'коктейл',
      'wine',
      'beer',
      'alcohol',
      'cocktail',
    ],
  },
};
export const norm = s =>
  String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u00A0\u202F]/g, ' ');
// chips carry non-breaking spaces, commands expect plain ones
export const inGroup = (item, g) => {
  const t = norm(item);
  return GROUPS[g].st.some(s => t.indexOf(s) >= 0);
};
export function groupName(c, gen) {
  if (GROUPS[c.g]) {
    const x = GROUPS[c.g][gen ? 'gen' : 'n'];
    return L(x[0], x[1]);
  }
  return c.label || '';
}
export function checkTitle(c) {
  return c.mode === 'in'
    ? L('возвращаю ', 'adding back ') + groupName(c)
    : L('без ', 'no ') + groupName(c, true);
}
