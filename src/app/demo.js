// Demo data for testers
import { sortE } from './actions.js';
import { hsh } from '../core/context.js';
import { addD, dk, now } from '../core/dates.js';
import { uid } from '../core/storage.js';
import { EN } from '../core/text.js';
import { ST } from '../state/store.js';

// ---- demo data for testers ----
export function seedDemo() {
  const ru = !EN(),
    T = now();
  const W = ru
    ? {
        numb: [
          ['немеют кончики пальцев после душа', null, ['shower']],
          ['сильно немеют пальцы в жару', 3, ['hot']],
          ['слегка немеют пальцы', 1, []],
        ],
        fatigue: [
          ['к вечеру нет сил', 2, []],
          ['очень тяжело после прогулки', 3, ['walk']],
        ],
        fog: [
          ['туман в голове с утра', 1, []],
          ['заметно торможу', 2, []],
        ],
      }
    : {
        numb: [
          ['fingertips numb after a shower', null, ['shower']],
          ['fingers really numb in the heat', 3, ['hot']],
          ['fingers slightly numb', 1, []],
        ],
        fatigue: [
          ['no strength by the evening', 2, []],
          ['very tired after a walk', 3, ['walk']],
        ],
        fog: [
          ['brain fog since morning', 1, []],
          ['noticeably foggy', 2, []],
        ],
      };
  const F = ru
    ? [
        ['овсянка', 'кофе с молоком'],
        ['сырники', 'чай'],
        ['гречка', 'курица'],
        ['паста', 'салат'],
        ['суп', 'хлеб'],
        ['йогурт', 'банан'],
        ['рис', 'рыба'],
      ]
    : [
        ['oatmeal', 'latte'],
        ['pancakes', 'tea'],
        ['buckwheat', 'chicken'],
        ['pasta', 'salad'],
        ['soup', 'bread'],
        ['yogurt', 'banana'],
        ['rice', 'fish'],
      ];
  const out = [];
  const push = (d, h, m, o) => {
    const t = new Date(d);
    t.setHours(h, m, 0, 0);
    if (t <= T) out.push(Object.assign({ id: uid(), at: t.getTime(), d: dk(t) }, o));
  };
  for (let i = 0; i < 22; i++) {
    const d = addD(T, -i);
    const lunch = hsh('dl' + i) < 0.8;
    const afterLunch = lunch && hsh('da' + i) < 0.55;
    if (i === 1 || hsh('dn' + i) < 0.45) {
      const w = W.numb[i % 3];
      const lab = F[(i + 3) % 7].slice(0, 2).join(', ');
      push(d, afterLunch ? 14 : 10 + Math.floor(hsh('dh' + i) * 10), afterLunch ? 40 : 12, {
        kind: 'sym',
        key: 'numb',
        s: w[1] === null ? 2 : w[1],
        ctx: afterLunch ? w[2].concat(['food:55|' + lab]) : w[2],
        words: w[0],
      });
    }
    if (hsh('df' + i) < 0.3) {
      const w = W.fatigue[i % 2];
      push(d, 19, 40, { kind: 'sym', key: 'fatigue', s: w[1], ctx: w[2], words: w[0] });
    }
    if (hsh('dg' + i) < 0.2) {
      const w = W.fog[i % 2];
      push(d, 9, 30, { kind: 'sym', key: 'fog', s: w[1], ctx: w[2], words: w[0] });
    }
    push(d, 8, 30, {
      kind: 'food',
      meal: 'breakfast',
      items: F[i % 7].slice(),
      words: null,
      photo: null,
    });
    if (lunch)
      push(d, 13, 45, {
        kind: 'food',
        meal: 'lunch',
        items: F[(i + 3) % 7].slice(),
        words: null,
        photo: null,
      });
  }
  ST.entries = out;
  sortE();
  ST.demo = true;
  ST.health = true;
  ST.geo = true;
  ST.cycle = 'health';
  ST.seed = dk(addD(T, -12));
  ST.firstDay = dk(addD(T, -21));
  ST.questions = [
    {
      id: uid(),
      text: ru ? 'Связано ли онемение с жарой?' : 'Is the numbness related to heat?',
      status: 'open',
      at: Date.now(),
    },
  ];
}
