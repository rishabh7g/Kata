# Self-hosted Archivo

`styles.css` used to pull Archivo from Google Fonts. Kata is an offline PWA, so
it may not depend on a third-party origin (`docs/engineering.md` § 1 Stack) —
the font ships from this folder instead, through the `@font-face` rule at the
top of `styles.css`.

| File | What it is |
|---|---|
| `archivo-latin.woff2` | Archivo v25, latin subset, **variable** weight axis 100–900 at width 100% — one file covers the 400 / 600 / 800 the design uses |
| `OFL.txt` | SIL Open Font License 1.1, the licence Archivo ships under |

The file is byte-identical to the one Google Fonts serves for the latin subset:

```sh
curl -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 \
  (KHTML, like Gecko) Chrome/120.0 Safari/537.36' \
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap'
# then download the URL from the /* latin */ block — Google serves the same
# variable file for all three weights — and drop it in as archivo-latin.woff2.
```

Latin only, on purpose: every string Kata renders is English
(`docs/ubiquitous-language.md`), and the `unicode-range` in `styles.css` lets
the browser fall back to `system-ui` for anything outside it.
