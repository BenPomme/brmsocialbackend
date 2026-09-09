# Public website (babyrock.ai)

Static site for GitHub Pages. The words live in `content/` so they can be changed without touching the layout.
Legal pages (aviso, condiciones, privacidad, cookies, encargo) live in `../legal/{es,ca,fr,en}/` — Spanish is the legal original.

```
content/en.md es.md ca.md fr.md   ← copy
content/config.json               ← prices, WhatsApp number, formula
src/styles.css  src/site.js       ← look and simulator
build.mjs                         ← writes ../docs/
```

## Edit and rebuild

```bash
# change a sentence in content/es.md, then:
node site/build.mjs
```

GitHub Pages serves the `docs/` folder. Custom domain: `www.babyrock.ai` (see `docs/CNAME`).

## Preview locally

```bash
node site/build.mjs
npx --yes serve docs
```

## WhatsApp number

`content/config.json` → `whatsapp` is digits only, country code, no `+`. Header, footer and the green floating button on every page open `wa.me` to Rosalia (no form). Production number is the Spanish Cloud API line `+34 711 52 09 44`, not the Meta 555 test number.

## Portraits

`assets/portraits/rosalia.jpg` and `ben.jpg` use the same beige studio wall. Replace both files together if you change the background.
