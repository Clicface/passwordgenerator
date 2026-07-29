<h1 align="center">passwordgenerator</h1>

<p align="center">
  Generate random passwords in the browser, with live strength estimation.
</p>

<p align="center">
  <a href="https://github.com/Clicface/passwordgenerator/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/Clicface/passwordgenerator/actions/workflows/ci.yml/badge.svg">
  </a>
  <a href="https://nodejs.org">
    <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D18-5FA04E?logo=node.js&logoColor=white">
  </a>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
  <a href="https://passwordgenerator.clicface.com">
    <img alt="Live demo" src="https://img.shields.io/badge/demo-live-brightgreen">
  </a>
</p>

<p align="center">
  <b><a href="https://passwordgenerator.clicface.com">passwordgenerator.clicface.com</a></b>
</p>

---

Originally built for [Clicface](https://www.clicface.com) customers. The page is
plain static HTML and JavaScript; the optional API exposes the same generator
over HTTP.

## Features

- **Cryptographically secure** — draws from `crypto.getRandomValues`, with rejection sampling so no character is favoured
- **Configurable** — pick length and which character classes to draw from
- **Ambiguity-aware** — excludes `i l I O 0 1` by default, opt back in if you want them
- **Strength estimation** — scored live with [zxcvbn](https://github.com/dropbox/zxcvbn)
- **Multi-language** — English and French, in about sixty lines of `js/i18n.js`
- **No build step** — open `index.html` and it works

## Running it

There is nothing to run — open `index.html`. No server, no build step.

## Tests

```sh
node test/generator.js   # the generator itself
node test/browser.js     # drives index.html in headless Chromium
```

Neither pulls in a test framework. The browser test speaks the DevTools
protocol over Node's built-in WebSocket, so it needs **Node 22+** and any
Chromium or Chrome on `PATH` (or `CHROME_BIN`).

CI runs both on Node 24, lints with ESLint and scans with CodeQL. `npm audit`
covers the dev tooling, which is all that is left in `package.json`.

## Layout

```
index.html              the app
css/  js/  langpack/    styles, generator, translations
js/vendor/              zxcvbn, the only third-party code left
test/                   generator and front-end tests
```

The page ships **no npm dependencies**. zxcvbn is vendored under `js/vendor/`
and loaded on demand, on the first Generate — it is 400 KB and only scoring
needs it, so the page does not wait on it.

## Credits

- [zxcvbn](https://github.com/dropbox/zxcvbn) — strength estimation
- [Original jQuery snippet](http://onwebdev.blogspot.com/2011/08/jquery-generate-random-password.html) this grew from

## License

MIT — see [LICENSE](LICENSE).

The libraries under `js/vendor/` keep their own licences; see
[js/vendor/README.md](js/vendor/README.md).
