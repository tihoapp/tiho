<p align="center"><img src="assets/banner.svg" alt="tiho: a companion for people with MS" width="100%"></p>

# tiho

a companion for people with multiple sclerosis. one input line: voice, text, a food photo. a summary for the doctor.

**[open the prototype →](https://tihoapp.github.io/tiho/)** · [all versions](https://tihoapp.github.io/tiho/versions.html)

not a medical app. it makes no diagnoses, and entries are stored only on the device.

## what it does

- **one input line** say or type how you feel, or make a photo of food. the app turns it into symptoms, meals and time, with no forms to fill.
- **coincidences** it shows what tends to happen together (heat, cycle, food, sleep) and never claims a cause.
- **a summary for the doctor** symptoms in the person's own words, ready to show at an appointment.
- **built for numb fingers** large touch targets, visual press feedback, a large-text mode and full RU / EN.
- **no streaks** a bad day is logged like any other day, and the app never punishes it.

## versions

| url | version |
|---|---|
| `?v=6` | today's last three entries inside the day card |
| `?v=5b` | minimum: no context line, zero steps after saving |
| `?v=5` | weather, steps and cycle above the day card |

add `&lang=en` or `&lang=ru` to set the language. to install, open the link in Safari, tap share, then add to home screen.

## project structure

```
index.html            app shell
v5.html               same shell, kept so old links and installs keep working
versions.html         version picker for testers
styles/app.css        all styles, light and dark themes
src/
  main.js             entry point: startup order and first render
  state/store.js      shared state (stored data, UI state, language)
  core/               pure logic, no UI
    text.js           bilingual strings, typography
    dates.js          app clock, day keys, formatting
    storage.js        localStorage load and save
    catalog.js        symptoms and food catalog
    lexicon.js        free text → symptoms, food, time
    context.js        weather, steps, cycle
    entries.js        diary entries
    insights.js       coincidences, stats, doctor summary
  app/                actions and commands
    actions.js        logging, sheets, toasts
    commands.js       commands by phrase ("history", "english")
    demo.js           sample data for testers
  ui/                 Preact components
    app.js            App root, input line, chips
    day-card.js       v6 day card
    answers.js        answers shown in the main block
    blocks.js         voice, history, settings
    states.js         every Figma state, reachable by phrase
    components.js     icons, mascot, shared controls
    feedback.js       main toast
    haptics.js        visual press and release feedback
    frame.js          edit and safety cards
  services/weather.js Open-Meteo, temperature only
  lib/preact.js       Preact + htm
assets/               icons, QR codes, banner
```

## tech

- plain ES modules, no build step: GitHub Pages serves the repository as is
- [Preact](https://preactjs.com) + [htm](https://github.com/developit/htm) for components, without JSX or a bundler
- ESLint and Prettier, checked in CI on every push
- data stays in `localStorage`; the only network calls are the font, the Preact bundle and the weather temperature

## run locally

```sh
npm install
npm start          # http://localhost:5173
npm run check      # lint + format check
```

---

designed and built by [Yuliya S](https://github.com/julie566).
